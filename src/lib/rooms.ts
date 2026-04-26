import { useSyncExternalStore, useMemo } from "react";
import {
  EventType,
  EventStatus,
  MsgType,
  type MatrixClient,
  type MatrixEvent,
  type Room,
  RelationType,
  RoomMemberEvent,
} from "matrix-js-sdk";
import { getClient, subscribe } from "@/lib/matrix";

export interface Sender {
  mxid: string;
  display_name: string;
  monogram: string;
}

export interface Reaction {
  key: string;
  count: number;
  /** True if my user reacted with this key. */
  mine: boolean;
  /** event_id of my reaction event so we can redact it. */
  my_event_id?: string;
}

export interface EditEntry {
  body: string;
  ts: string;
}

/**
 * Sender-asserted record of who was granted view access to an attachment at
 * send time. This is *intent*, not enforcement — the room-level membership ACL
 * is the authoritative gate. Mirrors the way Gmail surfaces "who has access"
 * on a Drive attachment: we render this list so the sender can see and audit
 * exactly who they handed the file to.
 */
export interface AttachmentAccess {
  /** MXID of the user who uploaded the file. */
  owner: string;
  /** MXIDs that were explicitly granted view access. */
  granted: string[];
  /** ISO timestamp the grant was recorded. */
  granted_ts: string;
}

export interface Attachment {
  kind: "image" | "file";
  /** HTTP URL for display, resolved from mxc:// at parse time. */
  url: string | null;
  /** Raw mxc:// URI — kept so future revocation can target the media. */
  mxc?: string;
  name: string;
  mimetype?: string;
  size?: number;
  access?: AttachmentAccess;
}

export const MEDIA_ACCESS_KEY = "social.hyphae.media.access";

export interface Message {
  event_id: string;
  sender: Sender;
  body: string;
  ts: string;
  thread_root?: string;
  decryption_failed?: boolean;
  redacted?: boolean;
  /** True for events that are explicitly threaded replies. */
  is_thread_reply?: boolean;
  /** Local-echo status: 'sending' | 'sent' | 'failed'. */
  status: "sending" | "sent" | "failed";
  /** True if this message has been edited (m.replace). */
  edited?: boolean;
  /** Aggregated reactions (m.annotation). */
  reactions: Reaction[];
  /** Replace history, oldest first. */
  edits: EditEntry[];
  /** Whether the current user authored this message. */
  is_mine: boolean;
  attachment?: Attachment;
}

export interface Conversation {
  room_id: string;
  subject: string;
  last_activity_ts: string;
  participants: Sender[];
  unread: boolean;
  starred: boolean;
  archived: boolean;
  /** True when the room is tagged for hmail (visible in inbox). */
  in_hmail: boolean;
  tags: string[];
  messages: Message[];
}

export const ARCHIVED_TAG = "social.hyphae.archived";
export const HMAIL_TAG = "social.hyphae.hmail";
const FAVOURITE_TAG = "m.favourite";

function localpart(mxid: string): string {
  const m = mxid.match(/^@([^:]+):/);
  return m ? m[1] : mxid;
}

function monogramFor(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return trimmed.slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function senderFor(_client: MatrixClient, room: Room, mxid: string): Sender {
  const member = room.getMember(mxid);
  const profileName = member?.name || member?.rawDisplayName || undefined;
  const display = profileName?.trim() || localpart(mxid);
  return {
    mxid,
    display_name: display,
    monogram: monogramFor(display),
  };
}

function rawBody(content: Record<string, unknown> | undefined): string {
  if (!content) return "";
  if (typeof content.body === "string") return content.body as string;
  return "";
}

function effectiveBody(ev: MatrixEvent): string {
  if (ev.isRedacted()) return "(retracted)";
  if (ev.isDecryptionFailure()) return "🔒 Encrypted — couldn't decrypt this message";
  // If the event has been replaced by an edit, use the edit's m.new_content.
  const replacing = ev.replacingEvent?.();
  if (replacing) {
    const newContent = replacing.getContent()?.["m.new_content"] as
      | Record<string, unknown>
      | undefined;
    if (newContent && typeof newContent.body === "string")
      return newContent.body as string;
  }
  return rawBody(ev.getContent());
}

function statusOf(ev: MatrixEvent): "sending" | "sent" | "failed" {
  const status = ev.status;
  if (status === EventStatus.SENDING || status === EventStatus.QUEUED || status === EventStatus.ENCRYPTING)
    return "sending";
  if (status === EventStatus.NOT_SENT || status === EventStatus.CANCELLED)
    return "failed";
  return "sent";
}

function reactionsFor(
  client: MatrixClient,
  room: Room,
  ev: MatrixEvent,
): Reaction[] {
  const eventId = ev.getId();
  if (!eventId) return [];
  const relations = room
    .getUnfilteredTimelineSet()
    .relations.getChildEventsForEvent(
      eventId,
      RelationType.Annotation,
      EventType.Reaction,
    );
  if (!relations) return [];
  const myUserId = client.getUserId();
  const reactionEvents = relations.getRelations() ?? [];
  const counts = new Map<string, Reaction>();
  for (const r of reactionEvents) {
    if (r.isRedacted()) continue;
    const rel = r.getContent()?.["m.relates_to"] as
      | { key?: string }
      | undefined;
    const key = rel?.key;
    if (!key) continue;
    const existing = counts.get(key);
    if (existing) {
      existing.count += 1;
      if (r.getSender() === myUserId) {
        existing.mine = true;
        existing.my_event_id = r.getId() ?? existing.my_event_id;
      }
    } else {
      counts.set(key, {
        key,
        count: 1,
        mine: r.getSender() === myUserId,
        my_event_id:
          r.getSender() === myUserId ? r.getId() ?? undefined : undefined,
      });
    }
  }
  return Array.from(counts.values()).sort((a, b) => b.count - a.count);
}

function editsFor(room: Room, ev: MatrixEvent): EditEntry[] {
  const eventId = ev.getId();
  if (!eventId) return [];
  const relations = room
    .getUnfilteredTimelineSet()
    .relations.getChildEventsForEvent(
      eventId,
      RelationType.Replace,
      EventType.RoomMessage,
    );
  if (!relations) return [];
  const events = relations.getRelations() ?? [];
  return events
    .filter((e) => !e.isRedacted())
    .map((e) => {
      const newContent = e.getContent()?.["m.new_content"] as
        | Record<string, unknown>
        | undefined;
      return {
        body: typeof newContent?.body === "string" ? (newContent.body as string) : rawBody(e.getContent()),
        ts: new Date(e.getTs()).toISOString(),
      };
    })
    .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
}

function eventToMessage(
  client: MatrixClient,
  room: Room,
  ev: MatrixEvent,
): Message | null {
  const type = ev.getType();
  if (type !== EventType.RoomMessage && type !== EventType.RoomMessageEncrypted) {
    return null;
  }
  // Skip edit events themselves — they collapse onto their parent.
  const relation = ev.getContent()?.["m.relates_to"] as
    | { rel_type?: string; event_id?: string }
    | undefined;
  if (relation?.rel_type === RelationType.Replace) return null;

  const senderMxid = ev.getSender();
  if (!senderMxid) return null;
  const isThreadReply = relation?.rel_type === RelationType.Thread;
  const myUserId = client.getUserId();
  const edits = editsFor(room, ev);
  const content = ev.getContent() as Record<string, unknown> | undefined;
  const msgtype = content?.msgtype as string | undefined;
  let attachment: Attachment | undefined;
  if (!ev.isRedacted() && (msgtype === MsgType.Image || msgtype === MsgType.File)) {
    const info = (content?.info ?? {}) as { mimetype?: string; size?: number };
    const mxc = typeof content?.url === "string" ? (content.url as string) : undefined;
    const accessRaw = content?.[MEDIA_ACCESS_KEY] as
      | Record<string, unknown>
      | undefined;
    let access: AttachmentAccess | undefined;
    if (
      accessRaw &&
      typeof accessRaw.owner === "string" &&
      Array.isArray(accessRaw.granted)
    ) {
      access = {
        owner: accessRaw.owner,
        granted: (accessRaw.granted as unknown[]).filter(
          (x): x is string => typeof x === "string",
        ),
        granted_ts:
          typeof accessRaw.granted_ts === "string"
            ? accessRaw.granted_ts
            : new Date(ev.getTs()).toISOString(),
      };
    }
    attachment = {
      kind: msgtype === MsgType.Image ? "image" : "file",
      url: mxc ? mxcToHttp(mxc) : null,
      mxc,
      name: typeof content?.body === "string" ? (content.body as string) : "attachment",
      mimetype: info.mimetype,
      size: info.size,
      access,
    };
  }
  return {
    event_id: ev.getId() ?? `${ev.getTs()}`,
    sender: senderFor(client, room, senderMxid),
    body: effectiveBody(ev),
    ts: new Date(ev.getTs()).toISOString(),
    thread_root: isThreadReply ? relation?.event_id : undefined,
    is_thread_reply: isThreadReply,
    decryption_failed: ev.isDecryptionFailure(),
    redacted: ev.isRedacted(),
    status: statusOf(ev),
    edited: edits.length > 0,
    reactions: reactionsFor(client, room, ev),
    edits,
    is_mine: senderMxid === myUserId,
    attachment,
  };
}

function isUnread(room: Room, client: MatrixClient): boolean {
  if (typeof (room as Room & { getUnreadNotificationCount?: () => number }).getUnreadNotificationCount === "function") {
    const count = (room as unknown as { getUnreadNotificationCount: () => number }).getUnreadNotificationCount();
    if (typeof count === "number" && count > 0) return true;
  }
  const myUserId = client.getUserId();
  if (!myUserId) return false;
  const events = room.getLiveTimeline().getEvents();
  for (let i = events.length - 1; i >= 0; i--) {
    const ev = events[i];
    const type = ev.getType();
    if (type !== EventType.RoomMessage && type !== EventType.RoomMessageEncrypted) continue;
    if (ev.getSender() === myUserId) return false;
    const receipt = room.getReadReceiptForUserId(myUserId);
    if (!receipt) return true;
    return receipt.eventId !== ev.getId();
  }
  return false;
}

function tagsFor(room: Room): {
  tags: string[];
  starred: boolean;
  archived: boolean;
  in_hmail: boolean;
} {
  const allTags = room.tags ?? {};
  const tagNames = Object.keys(allTags);
  return {
    starred: FAVOURITE_TAG in allTags,
    archived: ARCHIVED_TAG in allTags,
    in_hmail: HMAIL_TAG in allTags,
    tags: tagNames.filter(
      (t) => t !== FAVOURITE_TAG && t !== ARCHIVED_TAG && t !== HMAIL_TAG,
    ),
  };
}

function roomToConversation(client: MatrixClient, room: Room): Conversation {
  const events = room.getLiveTimeline().getEvents();
  const messages: Message[] = [];
  for (const ev of events) {
    const m = eventToMessage(client, room, ev);
    if (m) messages.push(m);
  }
  const lastTs =
    messages[messages.length - 1]?.ts ??
    new Date(room.getLastActiveTimestamp() || 0).toISOString();

  const myUserId = client.getUserId();
  const participants: Sender[] = room
    .getJoinedMembers()
    .filter((m) => m.userId !== myUserId)
    .slice(0, 8)
    .map((m) => senderFor(client, room, m.userId));

  if (participants.length === 0 && room.guessDMUserId()) {
    const dm = room.guessDMUserId();
    if (dm) participants.push(senderFor(client, room, dm));
  }

  const { tags, starred, archived, in_hmail } = tagsFor(room);

  return {
    room_id: room.roomId,
    subject: room.name || room.normalizedName || room.roomId,
    last_activity_ts: lastTs,
    participants,
    unread: isUnread(room, client),
    starred,
    archived,
    in_hmail,
    tags,
    messages,
  };
}

function getConversationsSnapshot(): Conversation[] {
  const client = getClient();
  if (!client) return EMPTY;
  const rooms = client.getRooms();
  const out = rooms
    .filter((r) => r.getMyMembership() === "join")
    .map((r) => roomToConversation(client, r));
  out.sort(
    (a, b) =>
      new Date(b.last_activity_ts).getTime() -
      new Date(a.last_activity_ts).getTime(),
  );
  return out;
}

/** All rooms regardless of hmail tag — for the Manage Rooms modal. */
export function useAllConversations(): Conversation[] {
  return useSyncExternalStore(subscribe, getStableConversations, () => EMPTY);
}

/** Only rooms tagged into hmail. */
export function useHmailConversations(): Conversation[] {
  const all = useAllConversations();
  return useMemo(() => all.filter((c) => c.in_hmail), [all]);
}

const EMPTY: Conversation[] = [];

// Cache to keep useSyncExternalStore stable when nothing's changed.
let _cachedSnapshot: Conversation[] = EMPTY;
let _cachedFingerprint = "";

function snapshotFingerprint(convs: Conversation[]): string {
  return convs
    .map(
      (c) =>
        `${c.room_id}:${c.last_activity_ts}:${c.unread ? 1 : 0}:${c.starred ? 1 : 0}:${c.archived ? 1 : 0}:${c.in_hmail ? 1 : 0}:${c.messages.length}:${c.messages.map((m) => `${m.event_id}!${m.status}!${m.edited ? "e" : ""}!${m.reactions.length}`).join(",")}`,
    )
    .join("|");
}

function getStableConversations(): Conversation[] {
  const next = getConversationsSnapshot();
  const fp = snapshotFingerprint(next);
  if (fp === _cachedFingerprint) return _cachedSnapshot;
  _cachedFingerprint = fp;
  _cachedSnapshot = next;
  return next;
}

export function useConversations(): Conversation[] {
  return useHmailConversations();
}

export function useConversation(roomId: string | null): Conversation | null {
  // Look across ALL rooms, not just hmail-tagged ones — when the user has just
  // composed a new conversation, the HMAIL_TAG round-trip can lag the room
  // creation, and we don't want the screen to go blank in that window.
  const all = useAllConversations();
  return useMemo(
    () => (roomId ? all.find((c) => c.room_id === roomId) ?? null : null),
    [all, roomId],
  );
}

export function useMyMxid(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => getClient()?.getUserId() ?? null,
    () => null,
  );
}

/** Send m.read + m.fully_read for the latest visible message in a room. */
export async function markRoomRead(roomId: string) {
  const client = getClient();
  if (!client) return;
  const room = client.getRoom(roomId);
  if (!room) return;
  const events = room.getLiveTimeline().getEvents();
  for (let i = events.length - 1; i >= 0; i--) {
    const ev = events[i];
    const type = ev.getType();
    if (type === EventType.RoomMessage || type === EventType.RoomMessageEncrypted) {
      try {
        await client.sendReadReceipt(ev);
      } catch {
        /* ignore */
      }
      return;
    }
  }
}

export async function setStarred(roomId: string, starred: boolean) {
  const client = getClient();
  if (!client) return;
  if (starred) await client.setRoomTag(roomId, FAVOURITE_TAG, { order: 0 });
  else await client.deleteRoomTag(roomId, FAVOURITE_TAG);
}

export async function setArchived(roomId: string, archived: boolean) {
  const client = getClient();
  if (!client) return;
  if (archived) await client.setRoomTag(roomId, ARCHIVED_TAG, {});
  else await client.deleteRoomTag(roomId, ARCHIVED_TAG);
}

export async function adoptIntoHmail(roomId: string) {
  const client = getClient();
  if (!client) return;
  await client.setRoomTag(roomId, HMAIL_TAG, {});
}

export async function releaseFromHmail(roomId: string) {
  const client = getClient();
  if (!client) return;
  await client.deleteRoomTag(roomId, HMAIL_TAG);
}

// Trigger a notify when a member's display name changes so derived sender
// lines refresh.
export function attachMemberNameRefresh(client: MatrixClient) {
  client.on(RoomMemberEvent.Name, () => {
    /* subscribe handlers will pick this up via the existing notify path
       in matrix.ts; this listener is defensive in case it's not. */
  });
}

// ---------------------------------------------------------------------------
// Write path
// ---------------------------------------------------------------------------

function rootEventIdFor(room: Room): string | null {
  const events = room.getLiveTimeline().getEvents();
  for (const ev of events) {
    const type = ev.getType();
    if (type !== EventType.RoomMessage && type !== EventType.RoomMessageEncrypted) continue;
    const rel = ev.getContent()?.["m.relates_to"] as
      | { rel_type?: string }
      | undefined;
    if (rel?.rel_type === RelationType.Replace) continue;
    if (rel?.rel_type === RelationType.Thread) continue;
    return ev.getId() ?? null;
  }
  return null;
}

export interface UserSearchResult {
  user_id: string;
  display_name?: string;
}

export async function searchUsers(query: string): Promise<UserSearchResult[]> {
  const client = getClient();
  if (!client || !query) return [];
  try {
    const res = await client.searchUserDirectory({ term: query, limit: 8 });
    return (res.results ?? []).map((u) => ({
      user_id: u.user_id,
      display_name: u.display_name,
    }));
  } catch {
    return [];
  }
}

/**
 * Everyone the current user shares a joined room with — i.e. everyone they've
 * communicated with via Matrix. Deduped by MXID, sorted by display name.
 */
export function getKnownContacts(): UserSearchResult[] {
  const client = getClient();
  if (!client) return [];
  const myUserId = client.getUserId();
  const seen = new Map<string, UserSearchResult>();
  for (const room of client.getRooms()) {
    if (room.getMyMembership() !== "join") continue;
    for (const member of room.getJoinedMembers()) {
      if (member.userId === myUserId) continue;
      if (seen.has(member.userId)) continue;
      seen.set(member.userId, {
        user_id: member.userId,
        display_name: member.name || member.rawDisplayName || undefined,
      });
    }
  }
  const arr = Array.from(seen.values());
  arr.sort((a, b) =>
    (a.display_name ?? a.user_id).localeCompare(b.display_name ?? b.user_id),
  );
  return arr;
}

/**
 * Reactive hook: known contacts, refreshing on sync events.
 */
export function useKnownContacts(): UserSearchResult[] {
  return useSyncExternalStore(
    subscribe,
    () => {
      const next = getKnownContacts();
      const fp = next.map((c) => c.user_id).join(",");
      if (fp === _knownContactsFingerprint) return _knownContactsCache;
      _knownContactsFingerprint = fp;
      _knownContactsCache = next;
      return next;
    },
    () => EMPTY_CONTACTS,
  );
}

const EMPTY_CONTACTS: UserSearchResult[] = [];
let _knownContactsCache: UserSearchResult[] = EMPTY_CONTACTS;
let _knownContactsFingerprint = "";

export async function composeNewConversation(opts: {
  subject: string;
  to: string;
  body: string;
}): Promise<string> {
  const client = getClient();
  if (!client) throw new Error("Not signed in.");
  const inviteList = opts.to.trim() ? [opts.to.trim()] : [];
  const created = await client.createRoom({
    name: opts.subject || undefined,
    invite: inviteList,
    is_direct: inviteList.length === 1,
    initial_state: [
      {
        type: "m.room.encryption",
        state_key: "",
        content: { algorithm: "m.megolm.v1.aes-sha2" },
      },
    ],
  });
  const roomId = created.room_id;
  // Mark as DM in account data so other clients (and our list) treat it right.
  if (inviteList.length === 1) {
    try {
      const acct = (
        client as unknown as {
          getAccountData: (t: string) => { getContent(): unknown } | null;
          setAccountData: (t: string, v: unknown) => Promise<unknown>;
        }
      );
      const existing =
        (acct.getAccountData("m.direct")?.getContent() as
          | Record<string, string[]>
          | undefined) ?? {};
      const next: Record<string, string[]> = { ...existing };
      const list = next[inviteList[0]] ? [...next[inviteList[0]]] : [];
      if (!list.includes(roomId)) list.push(roomId);
      next[inviteList[0]] = list;
      await acct.setAccountData("m.direct", next);
    } catch {
      /* non-fatal */
    }
  }
  // Tag as hmail-managed so it shows up in the inbox.
  try {
    await client.setRoomTag(roomId, HMAIL_TAG, {});
  } catch {
    /* non-fatal */
  }
  if (opts.body.trim()) {
    await client.sendMessage(roomId, {
      msgtype: MsgType.Text,
      body: opts.body,
    });
  }
  return roomId;
}

export async function sendThreadReply(roomId: string, body: string) {
  const client = getClient();
  if (!client) throw new Error("Not signed in.");
  const room = client.getRoom(roomId);
  if (!room) throw new Error("Unknown room.");
  const rootId = rootEventIdFor(room);
  if (!rootId) {
    // No root yet — send a flat message.
    await client.sendMessage(roomId, { msgtype: MsgType.Text, body });
    return;
  }
  await client.sendMessage(roomId, rootId, {
    msgtype: MsgType.Text,
    body,
    "m.relates_to": {
      rel_type: RelationType.Thread,
      event_id: rootId,
    },
  });
}

export async function sendFlatMessage(roomId: string, body: string) {
  const client = getClient();
  if (!client) throw new Error("Not signed in.");
  await client.sendMessage(roomId, { msgtype: MsgType.Text, body });
}

export async function editMessage(
  roomId: string,
  eventId: string,
  newBody: string,
) {
  const client = getClient();
  if (!client) throw new Error("Not signed in.");
  await client.sendMessage(roomId, {
    msgtype: MsgType.Text,
    body: `* ${newBody}`,
    "m.new_content": { msgtype: MsgType.Text, body: newBody },
    "m.relates_to": { rel_type: RelationType.Replace, event_id: eventId },
  });
}

export async function retractMessage(roomId: string, eventId: string) {
  const client = getClient();
  if (!client) throw new Error("Not signed in.");
  await client.redactEvent(roomId, eventId, undefined, { reason: "retracted" });
}

/**
 * Compute the implicit grant list for a room: every joined or invited member
 * other than the uploader. Used when sendAttachment is called without an
 * explicit `granted` argument (e.g. attaching to an existing thread).
 */
function impliedGrantList(client: MatrixClient, roomId: string): string[] {
  const room = client.getRoom(roomId);
  if (!room) return [];
  const owner = client.getUserId();
  const out = new Set<string>();
  for (const m of room.getJoinedMembers()) {
    if (m.userId !== owner) out.add(m.userId);
  }
  try {
    const invited = room.currentState
      .getMembers()
      .filter((m) => m.membership === "invite" && m.userId !== owner);
    for (const m of invited) out.add(m.userId);
  } catch {
    /* membership state may not be loaded yet — joined list is enough */
  }
  return Array.from(out);
}

export async function sendAttachment(
  roomId: string,
  file: File,
  granted?: string[],
) {
  const client = getClient();
  if (!client) throw new Error("Not signed in.");
  const upload = await client.uploadContent(file, { type: file.type });
  const isImage = file.type.startsWith("image/");
  const owner = client.getUserId() ?? "";
  const grantedList = (granted ?? impliedGrantList(client, roomId)).filter(
    (mxid) => mxid !== owner,
  );
  const access: AttachmentAccess = {
    owner,
    granted: grantedList,
    granted_ts: new Date().toISOString(),
  };
  const baseContent = {
    body: file.name,
    url: upload.content_uri,
    info: { mimetype: file.type, size: file.size },
    [MEDIA_ACCESS_KEY]: access,
  };
  const content = isImage
    ? { msgtype: MsgType.Image, ...baseContent }
    : { msgtype: MsgType.File, ...baseContent };
  type SendMsgFn = (roomId: string, content: unknown) => Promise<unknown>;
  await (client.sendMessage as unknown as SendMsgFn)(roomId, content);
}

export function mxcToHttp(mxc: string | undefined): string | null {
  const client = getClient();
  if (!client || !mxc) return null;
  try {
    return client.mxcUrlToHttp(mxc, undefined, undefined, undefined, true, false, true);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// User confirmation (side-channel proof)
// ---------------------------------------------------------------------------

export const CONFIRM_EVENT_TYPE = "social.hyphae.hmail.confirm";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O 1/I, uppercase

export function generateConfirmationCode(length = 6): string {
  const buf = new Uint32Array(length);
  crypto.getRandomValues(buf);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[buf[i] % CODE_ALPHABET.length];
  }
  return out;
}

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export type ConfirmKind = "request" | "proof";

export interface ConfirmRequest {
  kind: "request";
  code_hash: string;
  ts: number;
}

export interface ConfirmProof {
  kind: "proof";
  ts: number;
  /** event_id of the request being proven. */
  for: string;
}

export interface ConfirmState {
  status: "none" | "awaiting_them" | "awaiting_me" | "verified";
  myRole: "requester" | "verifier" | null;
  /** The MXID we're either asking to confirm or being asked to confirm to. */
  counterpartyMxid: string | null;
  /** The active request event, if any. */
  request: { event_id: string; sender: string; ts: string; code_hash: string } | null;
  /** The matching proof, if any. */
  proof: { sender: string; ts: string } | null;
}

export function getConfirmState(client: MatrixClient, room: Room): ConfirmState {
  const myUserId = client.getUserId();
  const events = room.getLiveTimeline().getEvents();
  // Find latest request event (timeline order ascending; iterate in reverse).
  let request: ConfirmState["request"] = null;
  let requestEventId: string | null = null;
  let requestSender: string | null = null;
  for (let i = events.length - 1; i >= 0; i--) {
    const ev = events[i];
    if (ev.getType() !== CONFIRM_EVENT_TYPE) continue;
    const c = ev.getContent() as Partial<ConfirmRequest | ConfirmProof>;
    if (c?.kind === "request" && typeof c.code_hash === "string") {
      request = {
        event_id: ev.getId() ?? "",
        sender: ev.getSender() ?? "",
        ts: new Date(ev.getTs()).toISOString(),
        code_hash: c.code_hash,
      };
      requestEventId = request.event_id;
      requestSender = request.sender;
      break;
    }
  }
  let proof: ConfirmState["proof"] = null;
  if (requestEventId) {
    for (const ev of events) {
      if (ev.getType() !== CONFIRM_EVENT_TYPE) continue;
      const c = ev.getContent() as Partial<ConfirmRequest | ConfirmProof>;
      if (c?.kind === "proof" && c.for === requestEventId) {
        proof = {
          sender: ev.getSender() ?? "",
          ts: new Date(ev.getTs()).toISOString(),
        };
        break;
      }
    }
  }

  if (!request) {
    return {
      status: "none",
      myRole: null,
      counterpartyMxid: null,
      request: null,
      proof: null,
    };
  }
  if (proof) {
    return {
      status: "verified",
      myRole: requestSender === myUserId ? "requester" : "verifier",
      counterpartyMxid:
        requestSender === myUserId ? proof.sender : (requestSender ?? null),
      request,
      proof,
    };
  }
  if (requestSender === myUserId) {
    // I sent the code, awaiting their proof. Counterparty: anyone joined who isn't me.
    const others = room
      .getJoinedMembers()
      .filter((m) => m.userId !== myUserId)
      .map((m) => m.userId);
    return {
      status: "awaiting_them",
      myRole: "requester",
      counterpartyMxid: others[0] ?? null,
      request,
      proof: null,
    };
  }
  return {
    status: "awaiting_me",
    myRole: "verifier",
    counterpartyMxid: requestSender,
    request,
    proof: null,
  };
}

export function useConfirmState(roomId: string | null): ConfirmState | null {
  return useSyncExternalStore(
    subscribe,
    () => {
      if (!roomId) return null;
      const client = getClient();
      if (!client) return null;
      const room = client.getRoom(roomId);
      if (!room) return null;
      return getConfirmState(client, room);
    },
    () => null,
  );
}

/** Sender side: hash the code and post a request event. Returns the code hash. */
export async function sendConfirmationRequest(
  roomId: string,
  code: string,
): Promise<string> {
  const client = getClient();
  if (!client) throw new Error("Not signed in.");
  const code_hash = await sha256Hex(code.trim().toUpperCase());
  const content: ConfirmRequest = {
    kind: "request",
    code_hash,
    ts: Date.now(),
  };
  await (
    client.sendEvent as unknown as (
      roomId: string,
      type: string,
      content: unknown,
    ) => Promise<unknown>
  )(roomId, CONFIRM_EVENT_TYPE, content);
  return code_hash;
}

/**
 * Recipient side: verify the entered code matches the active request hash.
 * If it does, post a proof event. Returns true on success.
 */
export async function submitConfirmationCode(
  roomId: string,
  code: string,
): Promise<boolean> {
  const client = getClient();
  if (!client) throw new Error("Not signed in.");
  const room = client.getRoom(roomId);
  if (!room) throw new Error("Unknown room.");
  const state = getConfirmState(client, room);
  if (!state.request) throw new Error("No confirmation request in this room.");
  if (state.status === "verified") return true;
  const submitted = await sha256Hex(code.trim().toUpperCase());
  if (submitted !== state.request.code_hash) return false;
  const content: ConfirmProof = {
    kind: "proof",
    ts: Date.now(),
    for: state.request.event_id,
  };
  await (
    client.sendEvent as unknown as (
      roomId: string,
      type: string,
      content: unknown,
    ) => Promise<unknown>
  )(roomId, CONFIRM_EVENT_TYPE, content);
  return true;
}

export async function toggleReaction(
  roomId: string,
  eventId: string,
  key: string,
  existing: Reaction | undefined,
) {
  const client = getClient();
  if (!client) throw new Error("Not signed in.");
  if (existing?.mine && existing.my_event_id) {
    await client.redactEvent(roomId, existing.my_event_id);
    return;
  }
  await client.sendEvent(roomId, EventType.Reaction, {
    "m.relates_to": {
      rel_type: RelationType.Annotation,
      event_id: eventId,
      key,
    },
  });
}
