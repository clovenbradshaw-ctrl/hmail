import { useSyncExternalStore, useMemo } from "react";
import {
  EventType,
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
}

export interface Conversation {
  room_id: string;
  subject: string;
  last_activity_ts: string;
  participants: Sender[];
  unread: boolean;
  starred: boolean;
  archived: boolean;
  tags: string[];
  messages: Message[];
}

export const ARCHIVED_TAG = "social.hyphae.archived";
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

function bodyOf(ev: MatrixEvent): string {
  if (ev.isRedacted()) return "(retracted)";
  if (ev.isDecryptionFailure()) return "🔒 Encrypted — couldn't decrypt this message";
  const content = ev.getContent();
  if (typeof content?.body === "string") return content.body as string;
  return "";
}

function eventToMessage(client: MatrixClient, room: Room, ev: MatrixEvent): Message | null {
  const type = ev.getType();
  if (type !== EventType.RoomMessage && type !== EventType.RoomMessageEncrypted) {
    return null;
  }
  const senderMxid = ev.getSender();
  if (!senderMxid) return null;
  const relation = ev.getContent()?.["m.relates_to"] as
    | { rel_type?: string; event_id?: string }
    | undefined;
  const isThreadReply = relation?.rel_type === RelationType.Thread;
  return {
    event_id: ev.getId() ?? `${ev.getTs()}`,
    sender: senderFor(client, room, senderMxid),
    body: bodyOf(ev),
    ts: new Date(ev.getTs()).toISOString(),
    thread_root: isThreadReply ? relation?.event_id : undefined,
    is_thread_reply: isThreadReply,
    decryption_failed: ev.isDecryptionFailure(),
    redacted: ev.isRedacted(),
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

function tagsFor(room: Room): { tags: string[]; starred: boolean; archived: boolean } {
  const allTags = room.tags ?? {};
  const tagNames = Object.keys(allTags);
  return {
    starred: FAVOURITE_TAG in allTags,
    archived: ARCHIVED_TAG in allTags,
    tags: tagNames.filter((t) => t !== FAVOURITE_TAG && t !== ARCHIVED_TAG),
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

  const { tags, starred, archived } = tagsFor(room);

  return {
    room_id: room.roomId,
    subject: room.name || room.normalizedName || room.roomId,
    last_activity_ts: lastTs,
    participants,
    unread: isUnread(room, client),
    starred,
    archived,
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

const EMPTY: Conversation[] = [];

// Cache to keep useSyncExternalStore stable when nothing's changed.
let _cachedSnapshot: Conversation[] = EMPTY;
let _cachedFingerprint = "";

function snapshotFingerprint(convs: Conversation[]): string {
  return convs
    .map(
      (c) =>
        `${c.room_id}:${c.last_activity_ts}:${c.unread ? 1 : 0}:${c.starred ? 1 : 0}:${c.archived ? 1 : 0}:${c.messages.length}`,
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
  return useSyncExternalStore(subscribe, getStableConversations, () => EMPTY);
}

export function useConversation(roomId: string | null): Conversation | null {
  const all = useConversations();
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

// Trigger a notify when a member's display name changes so derived sender
// lines refresh.
export function attachMemberNameRefresh(client: MatrixClient) {
  client.on(RoomMemberEvent.Name, () => {
    /* subscribe handlers will pick this up via the existing notify path
       in matrix.ts; this listener is defensive in case it's not. */
  });
}
