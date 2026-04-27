import { useEffect, useMemo, useState } from "react";
import {
  useAllConversations,
  type Attachment,
  type Sender,
} from "@/lib/rooms";
import { getClient } from "@/lib/matrix";

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

// Modern Matrix homeservers serve media from `/_matrix/client/v1/media/...`,
// which requires an `Authorization: Bearer <token>` header. Browsers can't add
// that header via `<img src>` or `<a href>`, so we fetch the bytes ourselves
// and hand back an object URL. The cache is refcounted across components so
// the gallery and the timeline can render the same image without re-fetching.
type BlobEntry = { url: string; refs: number; pending?: Promise<string | null> };
const _blobCache = new Map<string, BlobEntry>();

async function fetchAuthedBlob(mxc: string): Promise<string | null> {
  const client = getClient();
  if (!client) return null;
  const httpUrl = client.mxcUrlToHttp(
    mxc,
    undefined,
    undefined,
    undefined,
    true,
    false,
    true,
  );
  if (!httpUrl) return null;
  const token = client.getAccessToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(httpUrl, { headers });
  if (!res.ok) throw new Error(`media fetch ${res.status}`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

/**
 * Fetch a Matrix media URL through the authenticated endpoint and expose it
 * as a blob: URL safe to drop into `<img src>` / `<a href>`. Returns null
 * while loading or on error. The cache lives as long as at least one consumer
 * is mounted.
 */
export function useAttachmentUrl(mxc: string | undefined): string | null {
  const [url, setUrl] = useState<string | null>(() => {
    if (!mxc) return null;
    return _blobCache.get(mxc)?.url ?? null;
  });

  useEffect(() => {
    if (!mxc) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    let acquired = false;

    const existing = _blobCache.get(mxc);
    if (existing) {
      existing.refs += 1;
      acquired = true;
      setUrl(existing.url);
      return () => {
        cancelled = true;
        if (!acquired) return;
        const e = _blobCache.get(mxc);
        if (!e) return;
        e.refs -= 1;
        if (e.refs <= 0) {
          URL.revokeObjectURL(e.url);
          _blobCache.delete(mxc);
        }
      };
    }

    void (async () => {
      try {
        const objectUrl = await fetchAuthedBlob(mxc);
        if (cancelled) {
          if (objectUrl) URL.revokeObjectURL(objectUrl);
          return;
        }
        if (!objectUrl) {
          setUrl(null);
          return;
        }
        // Another consumer may have populated the cache while we were
        // fetching; reuse their entry instead of leaking a duplicate blob.
        const racing = _blobCache.get(mxc);
        if (racing) {
          URL.revokeObjectURL(objectUrl);
          racing.refs += 1;
          acquired = true;
          setUrl(racing.url);
          return;
        }
        _blobCache.set(mxc, { url: objectUrl, refs: 1 });
        acquired = true;
        setUrl(objectUrl);
      } catch {
        if (!cancelled) setUrl(null);
      }
    })();

    return () => {
      cancelled = true;
      if (!acquired) return;
      const e = _blobCache.get(mxc);
      if (!e) return;
      e.refs -= 1;
      if (e.refs <= 0) {
        URL.revokeObjectURL(e.url);
        _blobCache.delete(mxc);
      }
    };
  }, [mxc]);

  return url;
}
