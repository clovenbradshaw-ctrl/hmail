import { useMemo } from "react";
import {
  useAllConversations,
  type Attachment,
  type Sender,
} from "@/lib/rooms";

/**
 * One attachment in the in-app media store. Materializes a per-attachment view
 * over the live message timeline so the UI can browse media without iterating
 * conversations itself.
 */
export interface MediaItem {
  /** Stable id: `${room_id}:${event_id}`. */
  id: string;
  attachment: Attachment;
  sender: Sender;
  /** ISO timestamp of the message that carried the attachment. */
  ts: string;
  room_id: string;
  /** Conversation subject for breadcrumb display. */
  subject: string;
  /** Other participants in the conversation (for "shared with" fallback). */
  participants: Sender[];
  /** Whether the current user uploaded this file. */
  is_mine: boolean;
}

/** All non-redacted attachments in hmail-tagged conversations, newest first. */
export function useMediaItems(): MediaItem[] {
  const conversations = useAllConversations();
  return useMemo(() => {
    const items: MediaItem[] = [];
    for (const c of conversations) {
      if (!c.in_hmail) continue;
      for (const m of c.messages) {
        if (!m.attachment) continue;
        if (m.redacted) continue;
        items.push({
          id: `${c.room_id}:${m.event_id}`,
          attachment: m.attachment,
          sender: m.sender,
          ts: m.ts,
          room_id: c.room_id,
          subject: c.subject,
          participants: c.participants,
          is_mine: m.is_mine,
        });
      }
    }
    items.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
    return items;
  }, [conversations]);
}

export type MediaFilter = "all" | "image" | "file";

export function filterMediaItems(
  items: MediaItem[],
  filter: MediaFilter,
): MediaItem[] {
  if (filter === "all") return items;
  return items.filter((i) => i.attachment.kind === filter);
}

/**
 * Effective access list for a media item: the explicit grant list if recorded,
 * otherwise the conversation participants (the implicit grant via room
 * membership). This lets older attachments that predate the access field still
 * render a sensible "shared with" line.
 */
export function effectiveGrantedMxids(item: MediaItem): string[] {
  const explicit = item.attachment.access?.granted;
  if (explicit && explicit.length > 0) return explicit;
  return item.participants.map((p) => p.mxid);
}
