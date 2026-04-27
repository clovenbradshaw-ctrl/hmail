import { useSyncExternalStore } from "react";
import type { MatrixClient } from "matrix-js-sdk";
import { getClient, subscribe } from "@/lib/matrix";

/**
 * The user's display name is the standard Matrix m.profile.display_name.
 * Setting it via setDisplayName makes the homeserver broadcast an
 * m.room.member event into every joined room — that's how it becomes
 * discoverable to the people we share rooms with, and how an updated name
 * propagates without us touching each room.
 */

function readDisplayNameFromRooms(): string {
  const client = getClient();
  if (!client) return "";
  const myUserId = client.getUserId();
  if (!myUserId) return "";
  for (const room of client.getRooms()) {
    const member = room.getMember(myUserId);
    if (member?.rawDisplayName) return member.rawDisplayName;
  }
  return "";
}

export async function getMyDisplayName(): Promise<string> {
  const cached = readDisplayNameFromRooms();
  if (cached) return cached;
  const client = getClient();
  if (!client) return "";
  const myUserId = client.getUserId();
  if (!myUserId) return "";
  try {
    const profile = (await client.getProfileInfo(myUserId, "displayname")) as {
      displayname?: string;
    };
    return profile.displayname ?? "";
  } catch {
    return "";
  }
}

export async function setMyDisplayName(name: string): Promise<void> {
  const client = getClient();
  if (!client) throw new Error("Not signed in.");
  await client.setDisplayName(name);
}

/**
 * Reactive view of the current user's display name. Refreshes whenever the
 * homeserver echoes an m.room.member update back to us.
 */
export function useMyDisplayName(): string {
  return useSyncExternalStore(
    subscribe,
    readDisplayNameFromRooms,
    () => "",
  );
}

// ---------------------------------------------------------------------------
// Connection-gated avatar
// ---------------------------------------------------------------------------

/**
 * Profile pictures in hmail are scoped to "people you've agreed to connect
 * with" — i.e. members of the rooms you've joined. Random Matrix users
 * looking up your global profile via /profile/{mxid}/avatar_url see nothing.
 *
 * Mechanism: we do *not* call setAvatarUrl (which writes to the server's
 * public profile and can be read by anyone). Instead we publish each user's
 * avatar through their own per-room m.room.member state event, which is only
 * visible to room members. The canonical mxc is stored in account data so we
 * can republish on every newly joined room (compose flow + invite acceptance).
 */
export const HMAIL_AVATAR_ACCOUNT_DATA = "social.hyphae.avatar";

interface AvatarAccountData {
  mxc?: string;
  updated_ts?: number;
}

interface AccountDataApi {
  getAccountData: (type: string) => { getContent(): unknown } | null;
  setAccountData: (type: string, value: unknown) => Promise<unknown>;
}

function asAccountDataApi(client: MatrixClient): AccountDataApi {
  return client as unknown as AccountDataApi;
}

type SendStateFn = (
  roomId: string,
  type: string,
  content: unknown,
  stateKey: string,
) => Promise<unknown>;

/** Read the current user's avatar mxc from account data, if set. */
export function readMyAvatarMxc(): string | undefined {
  const client = getClient();
  if (!client) return undefined;
  const ev = asAccountDataApi(client).getAccountData(HMAIL_AVATAR_ACCOUNT_DATA);
  const content = ev?.getContent() as AvatarAccountData | undefined;
  const mxc = content?.mxc;
  return typeof mxc === "string" && mxc.startsWith("mxc://") ? mxc : undefined;
}

export function useMyAvatarMxc(): string | undefined {
  return useSyncExternalStore(
    subscribe,
    readMyAvatarMxc,
    () => undefined,
  );
}

/**
 * Send my m.room.member state event in `roomId` with the given avatar mxc
 * (or omit avatar_url if `mxc` is undefined). Preserves the rest of the
 * existing member content so we don't blow away displayname.
 *
 * Each user is allowed to set state events with state_key = their own MXID,
 * so this works regardless of room power levels.
 */
async function publishAvatarToRoom(
  client: MatrixClient,
  roomId: string,
  mxc: string | undefined,
): Promise<void> {
  const myUserId = client.getUserId();
  if (!myUserId) return;
  const room = client.getRoom(roomId);
  if (!room) return;
  // Don't republish into rooms we haven't joined yet.
  if (room.getMyMembership() !== "join") return;
  const member = room.getMember(myUserId);
  const existing =
    (member?.events?.member?.getContent() as Record<string, unknown> | undefined) ??
    {};
  const next: Record<string, unknown> = { ...existing, membership: "join" };
  if (mxc) next.avatar_url = mxc;
  else delete next.avatar_url;
  // No-op short-circuit: the state event is already what we want.
  if ((existing as { avatar_url?: string }).avatar_url === next.avatar_url) {
    return;
  }
  await (client.sendStateEvent as unknown as SendStateFn)(
    roomId,
    "m.room.member",
    next,
    myUserId,
  );
}

/**
 * Republish my avatar into every joined room. Best-effort: per-room failures
 * are logged and don't abort the rest of the sweep.
 */
async function publishAvatarEverywhere(
  client: MatrixClient,
  mxc: string | undefined,
): Promise<void> {
  const tasks: Promise<void>[] = [];
  for (const room of client.getRooms()) {
    if (room.getMyMembership() !== "join") continue;
    tasks.push(
      publishAvatarToRoom(client, room.roomId, mxc).catch((err) => {
        console.warn("[hmail] avatar publish failed for", room.roomId, err);
      }),
    );
  }
  await Promise.all(tasks);
}

/**
 * Public hook used by matrix.ts (autoAcceptInvite) and rooms.ts
 * (composeNewConversation) to push my avatar into a room I just joined or
 * created — so newly connected people see it without me having to re-save.
 */
export async function publishMyAvatarToRoom(roomId: string): Promise<void> {
  const client = getClient();
  if (!client) return;
  const mxc = readMyAvatarMxc();
  if (!mxc) return;
  try {
    await publishAvatarToRoom(client, roomId, mxc);
  } catch (err) {
    console.warn("[hmail] avatar publish failed for", roomId, err);
  }
}

/**
 * Upload `file` to Matrix media, record the resulting mxc as my avatar in
 * account data, and broadcast it into every joined room's m.room.member.
 */
export async function setMyAvatar(file: File): Promise<string> {
  const client = getClient();
  if (!client) throw new Error("Not signed in.");
  const upload = await client.uploadContent(file, { type: file.type });
  const mxc = upload.content_uri;
  await asAccountDataApi(client).setAccountData(HMAIL_AVATAR_ACCOUNT_DATA, {
    mxc,
    updated_ts: Date.now(),
  });
  await publishAvatarEverywhere(client, mxc);
  return mxc;
}

/**
 * Drop my avatar everywhere. Clears account data and rewrites every joined
 * room's m.room.member event without an avatar_url.
 */
export async function clearMyAvatar(): Promise<void> {
  const client = getClient();
  if (!client) throw new Error("Not signed in.");
  await asAccountDataApi(client).setAccountData(HMAIL_AVATAR_ACCOUNT_DATA, {});
  await publishAvatarEverywhere(client, undefined);
}
