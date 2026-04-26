import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useMailStore } from "@/hooks/use-mail";
import {
  composeNewConversation,
  searchUsers,
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
  const [suggestions, setSuggestions] = useState<UserSearchResult[]>([]);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) {
      setTo("");
      setSubject("");
      setBody("");
      setBusy(false);
      setError(null);
      setSuggestions([]);
    }
  }, [open]);

  useEffect(() => {
    if (!to || to.length < 2) {
      setSuggestions([]);
      return;
    }
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      void searchUsers(to).then(setSuggestions);
    }, 200);
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
    >
      <form onSubmit={onSend} className="flex flex-col gap-3 p-5">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">
            To
          </span>
          <Input
            autoFocus
            placeholder="@alice:matrix.org"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            disabled={busy}
            className="font-mono text-sm"
          />
          {suggestions.length > 0 && (
            <ul className="mt-1 max-h-40 overflow-y-auto rounded-md border border-border bg-popover">
              {suggestions.map((u) => (
                <li key={u.user_id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent"
                    onClick={() => {
                      setTo(u.user_id);
                      setSuggestions([]);
                    }}
                  >
                    <span>{u.display_name || u.user_id}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {u.user_id}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
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
