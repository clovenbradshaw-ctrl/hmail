import { useEffect, useRef } from "react";
import { useMailStore, type Folder } from "@/hooks/use-mail";
import {
  setArchived,
  setStarred,
  useConversations,
  type Conversation,
} from "@/lib/rooms";

function isTextEntryTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  const tag = t.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (t.isContentEditable) return true;
  return false;
}

/**
 * Filter conversations the same way MailList does, so j/k follow what's on
 * screen. groups = non-archived non-DM; starred = starred; archive = archived;
 * people/media views don't list rooms — keyboard nav falls back to non-archived.
 */
function visibleConversations(
  all: Conversation[],
  folder: Folder,
): Conversation[] {
  if (folder === "starred") return all.filter((c) => c.starred);
  if (folder === "archive") return all.filter((c) => c.archived);
  if (folder === "groups")
    return all.filter((c) => !c.archived && !c.dm_with_mxid);
  return all.filter((c) => !c.archived);
}

/**
 * Global keyboard shortcuts. Mounted once at the top of <Mail />. Skipped
 * whenever a text input is focused so users don't lose keystrokes mid-typing.
 *
 * c        — compose
 * Esc      — close compose, then deselect conversation, then close help
 * ?        — toggle keyboard help overlay
 * j / ↓    — next conversation in current folder
 * k / ↑    — previous conversation in current folder
 * s        — star/unstar selected
 * e        — archive/unarchive selected
 * g p      — go to people
 * g g      — go to groups
 * g s      — go to starred
 * g a      — go to archive
 */
export function useKeyboardShortcuts() {
  const folder = useMailStore((s) => s.folder);
  const setFolder = useMailStore((s) => s.setFolder);
  const selectedRoomId = useMailStore((s) => s.selectedRoomId);
  const setSelectedRoomId = useMailStore((s) => s.setSelectedRoomId);
  const composeOpen = useMailStore((s) => s.composeOpen);
  const setComposeOpen = useMailStore((s) => s.setComposeOpen);
  const helpOpen = useMailStore((s) => s.helpOpen);
  const setHelpOpen = useMailStore((s) => s.setHelpOpen);
  const conversations = useConversations();

  // Two-key sequences (g i / g s / g a). Reset after a short window.
  const pendingPrefix = useRef<string | null>(null);
  const pendingPrefixAt = useRef<number>(0);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTextEntryTarget(e.target)) return;

      // Resolve a pending prefix if it's still fresh.
      const now = Date.now();
      const prefix =
        pendingPrefix.current && now - pendingPrefixAt.current < 1500
          ? pendingPrefix.current
          : null;
      pendingPrefix.current = null;

      const visible = visibleConversations(conversations, folder);
      const selected = selectedRoomId
        ? visible.findIndex((c) => c.room_id === selectedRoomId)
        : -1;

      switch (e.key) {
        case "c": {
          if (helpOpen) return;
          e.preventDefault();
          setComposeOpen(true);
          return;
        }
        case "Escape": {
          if (composeOpen) {
            setComposeOpen(false);
          } else if (helpOpen) {
            setHelpOpen(false);
          } else if (selectedRoomId) {
            setSelectedRoomId(null);
          } else {
            return;
          }
          e.preventDefault();
          return;
        }
        case "?": {
          e.preventDefault();
          setHelpOpen(!helpOpen);
          return;
        }
        case "j":
        case "ArrowDown": {
          if (composeOpen || helpOpen || visible.length === 0) return;
          e.preventDefault();
          const nextIdx = selected < 0 ? 0 : Math.min(selected + 1, visible.length - 1);
          setSelectedRoomId(visible[nextIdx].room_id);
          return;
        }
        case "k":
        case "ArrowUp": {
          if (composeOpen || helpOpen || visible.length === 0) return;
          e.preventDefault();
          const prevIdx = selected <= 0 ? 0 : selected - 1;
          setSelectedRoomId(visible[prevIdx].room_id);
          return;
        }
        case "s": {
          if (prefix === "g") {
            e.preventDefault();
            setFolder("starred");
            return;
          }
          if (composeOpen || helpOpen || !selectedRoomId) return;
          const conv = visible.find((c) => c.room_id === selectedRoomId);
          if (!conv) return;
          e.preventDefault();
          void setStarred(selectedRoomId, !conv.starred);
          return;
        }
        case "e": {
          if (composeOpen || helpOpen || !selectedRoomId) return;
          const conv = visible.find((c) => c.room_id === selectedRoomId);
          if (!conv) return;
          e.preventDefault();
          void setArchived(selectedRoomId, !conv.archived);
          return;
        }
        case "g": {
          if (prefix === "g") {
            e.preventDefault();
            setFolder("groups");
            return;
          }
          if (composeOpen || helpOpen) return;
          pendingPrefix.current = "g";
          pendingPrefixAt.current = now;
          e.preventDefault();
          return;
        }
        case "p": {
          if (prefix === "g") {
            e.preventDefault();
            setFolder("people");
          }
          return;
        }
        case "a": {
          if (prefix === "g") {
            e.preventDefault();
            setFolder("archive");
          }
          return;
        }
      }

    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    folder,
    setFolder,
    selectedRoomId,
    setSelectedRoomId,
    composeOpen,
    setComposeOpen,
    helpOpen,
    setHelpOpen,
    conversations,
  ]);
}
