import { useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useMailStore } from "@/hooks/use-mail";
import {
  composeNewConversation,
  searchUsers,
  useKnownContacts,
  type UserSearchResult,
} from "@/lib/rooms";

export function Compose() {
  const open = useMailStore((s) => s.composeOpen);
  const setOpen = useMailStore((s) => s.setComposeOpen);
  const setSelectedRoomId = useMailStore((s) => s.setSelectedRoomId);

  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [directoryHits, setDirectoryHits] = useState<UserSearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<number | null>(null);

  const knownContacts = useKnownContacts();

  // Combined suggestions: known contacts (already in your rooms) + directory hits.
  // Filtered by the current `to` query.
  const suggestions = useMemo(() => {
    const q = to.trim().toLowerCase();
    const known: (UserSearchResult & { source: "known" | "directory" })[] =
      knownContacts.map((c) => ({ ...c, source: "known" as const }));
    const dir: (UserSearchResult & { source: "known" | "directory" })[] =
      directoryHits.map((c) => ({ ...c, source: "directory" as const }));
    const seen = new Set<string>();
    const merged: typeof known = [];
    for (const list of [known, dir]) {
      for (const c of list) {
        if (seen.has(c.user_id)) continue;
        if (q) {
          const hay = `${c.display_name ?? ""} ${c.user_id}`.toLowerCase();
          if (!hay.includes(q)) continue;
        }
        seen.add(c.user_id);
        merged.push(c);
      }
    }
    return merged.slice(0, 25);
  }, [to, knownContacts, directoryHits]);

  useEffect(() => {
    if (!open) {
      setTo("");
      setSubject("");
      setBody("");
      setBusy(false);
      setError(null);
      setDirectoryHits([]);
      setShowSuggestions(false);
    }
  }, [open]);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (!to || to.length < 2) {
      setDirectoryHits([]);
      return;
    }
    debounceRef.current = window.setTimeout(() => {
      void searchUsers(to).then(setDirectoryHits);
    }, 250);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [to]);

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const trimmed = to.trim();
      if (!trimmed.startsWith("@") || !trimmed.includes(":")) {
        throw new Error("Enter a full MXID (e.g. @alice:matrix.org).");
      }
      const roomId = await composeNewConversation({
        subject: subject.trim() || trimmed,
        to: trimmed,
        body,
      });
      setSelectedRoomId(roomId);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => !busy && setOpen(false)}
      title="New conversation"
      className="sm:max-w-xl"
    >
      <form onSubmit={onSend} className="flex flex-col gap-3 p-5">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">
            To
          </span>
          <div className="relative">
            <Input
              autoFocus
              placeholder="@alice:matrix.org"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => {
                // Delay so click on suggestion still registers.
                window.setTimeout(() => setShowSuggestions(false), 150);
              }}
              disabled={busy}
              className="font-mono text-sm"
            />
            {showSuggestions && suggestions.length > 0 && (
              <ul className="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
                {suggestions.map((u) => (
                  <li key={u.user_id}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setTo(u.user_id);
                        setShowSuggestions(false);
                      }}
                    >
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">
                          {u.display_name || u.user_id}
                        </span>
                        <span className="truncate font-mono text-[10px] text-muted-foreground">
                          {u.user_id}
                        </span>
                      </span>
                      <span
                        className={
                          "shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider " +
                          (u.source === "known"
                            ? "bg-selected text-selected-foreground"
                            : "bg-muted text-muted-foreground")
                        }
                      >
                        {u.source === "known" ? "Known" : "Directory"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {!to && knownContacts.length > 0 && (
            <span className="mt-1 block text-[10px] text-muted-foreground">
              Suggestions show people you share rooms with. Type to search the
              wider directory.
            </span>
          )}
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">
            Subject
          </span>
          <Input
            placeholder="What's this about?"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={busy}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">
            Message
          </span>
          <textarea
            rows={6}
            placeholder="Your message…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={busy}
            className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </label>

        {error && (
          <div className="rounded border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-[10px] text-muted-foreground">
            Encrypted DM · auto-tagged for hmail
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Sending…" : "Send"}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
