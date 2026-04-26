import { useEffect, useMemo, useRef, useState } from "react";
import {
  Maximize2,
  Minimize2,
  Minus,
  Paperclip,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useMailStore } from "@/hooks/use-mail";
import {
  composeNewConversation,
  generateConfirmationCode,
  searchUsers,
  sendAttachment,
  sendConfirmationRequest,
  useKnownContacts,
  type UserSearchResult,
} from "@/lib/rooms";
import { ShareCodeModal } from "@/components/mail/share-code-modal";

type WindowState = "normal" | "minimized" | "fullscreen";

export function Compose() {
  const open = useMailStore((s) => s.composeOpen);
  const setOpen = useMailStore((s) => s.setComposeOpen);
  const setSelectedRoomId = useMailStore((s) => s.setSelectedRoomId);

  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [directoryHits, setDirectoryHits] = useState<UserSearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [windowState, setWindowState] = useState<WindowState>("normal");
  const debounceRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Post-send confirmation share state.
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [shareRecipient, setShareRecipient] = useState<string>("");
  const [shareOpen, setShareOpen] = useState(false);

  const knownContacts = useKnownContacts();

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
      setFiles([]);
      setBusy(false);
      setError(null);
      setDirectoryHits([]);
      setShowSuggestions(false);
      setWindowState("normal");
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

  function discard() {
    if (busy) return;
    if (
      (to || subject || body || files.length > 0) &&
      !window.confirm("Discard this draft?")
    )
      return;
    setOpen(false);
  }

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
      // Upload attachments after the room exists. We pass the recipient list
      // explicitly: the invitee won't have a "join" membership yet, so the
      // implicit grant computation in sendAttachment can't see them.
      for (const f of files) {
        await sendAttachment(roomId, f, [trimmed]);
      }
      const code = generateConfirmationCode(6);
      try {
        await sendConfirmationRequest(roomId, code);
      } catch {
        /* non-fatal — the banner will let them retry */
      }
      setSelectedRoomId(roomId);
      setShareCode(code);
      setShareRecipient(trimmed);
      setShareOpen(true);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <ShareCodeModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        recipient={shareRecipient}
        code={shareCode ?? ""}
      />
    );
  }

  const headerTitle = subject.trim() || to.trim() || "New Message";

  return (
    <>
      <ShareCodeModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        recipient={shareRecipient}
        code={shareCode ?? ""}
      />

      {windowState === "fullscreen" && (
        <div
          aria-hidden
          className="fixed inset-0 z-40 bg-black/30"
          onClick={() => setWindowState("normal")}
        />
      )}

      <div
        role="dialog"
        aria-modal={windowState === "fullscreen"}
        aria-label="New message"
        className={cn(
          "fixed z-50 flex flex-col bg-card text-card-foreground shadow-2xl",
          // Mobile baseline: the compose window owns the screen.
          windowState === "minimized"
            ? "bottom-0 right-0 left-0 sm:left-auto sm:right-6 sm:w-[320px] rounded-t-md sm:rounded-t-md sm:rounded-b-none"
            : windowState === "fullscreen"
              ? "inset-2 sm:inset-8 rounded-lg"
              : "inset-x-0 bottom-0 top-0 sm:inset-auto sm:bottom-0 sm:right-6 sm:top-auto sm:w-[540px] sm:max-h-[min(640px,calc(100vh-72px))] sm:rounded-t-lg",
        )}
      >
        {/* Header bar */}
        <div
          onClick={() => {
            if (windowState === "minimized") setWindowState("normal");
          }}
          className={cn(
            "flex shrink-0 items-center justify-between gap-2 bg-foreground/95 px-3 py-2 text-background",
            windowState === "minimized" && "cursor-pointer",
            windowState === "fullscreen"
              ? "rounded-t-lg"
              : windowState === "minimized"
                ? "rounded-t-md"
                : "sm:rounded-t-lg",
          )}
        >
          <span className="truncate text-[13px] font-semibold">
            {windowState === "minimized" ? headerTitle : "New Message"}
          </span>
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              aria-label={windowState === "minimized" ? "Expand" : "Minimize"}
              onClick={(e) => {
                e.stopPropagation();
                setWindowState(
                  windowState === "minimized" ? "normal" : "minimized",
                );
              }}
              className="rounded p-1 hover:bg-white/10"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              aria-label={
                windowState === "fullscreen" ? "Exit full screen" : "Full screen"
              }
              onClick={(e) => {
                e.stopPropagation();
                setWindowState(
                  windowState === "fullscreen" ? "normal" : "fullscreen",
                );
              }}
              className="hidden rounded p-1 hover:bg-white/10 sm:inline-flex"
            >
              {windowState === "fullscreen" ? (
                <Minimize2 className="h-3.5 w-3.5" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5" />
              )}
            </button>
            <button
              type="button"
              aria-label="Close"
              onClick={(e) => {
                e.stopPropagation();
                discard();
              }}
              className="rounded p-1 hover:bg-white/10"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {windowState !== "minimized" && (
          <form
            onSubmit={onSend}
            className="flex min-h-0 flex-1 flex-col"
          >
            {/* Recipient row */}
            <div className="relative border-b border-border px-3 py-1.5">
              <label className="flex items-center gap-2">
                <span className="w-12 shrink-0 text-xs text-muted-foreground">
                  To
                </span>
                <input
                  autoFocus
                  placeholder="@alice:matrix.org"
                  value={to}
                  onChange={(e) => {
                    setTo(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => {
                    window.setTimeout(() => setShowSuggestions(false), 150);
                  }}
                  disabled={busy}
                  className="w-full bg-transparent py-1 font-mono text-sm placeholder:text-muted-foreground/60 focus:outline-none"
                />
              </label>
              {showSuggestions && suggestions.length > 0 && (
                <ul className="absolute left-3 right-3 top-full z-10 mt-1 max-h-72 overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
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
                          className={cn(
                            "shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider",
                            u.source === "known"
                              ? "bg-selected text-selected-foreground"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          {u.source === "known" ? "Known" : "Directory"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Subject row */}
            <div className="border-b border-border px-3 py-1.5">
              <label className="flex items-center gap-2">
                <span className="sr-only">Subject</span>
                <input
                  placeholder="Subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  disabled={busy}
                  className="w-full bg-transparent py-1 text-sm placeholder:text-muted-foreground/60 focus:outline-none"
                />
              </label>
            </div>

            {/* Body */}
            <div className="flex min-h-0 flex-1 flex-col px-3 pt-2">
              <textarea
                placeholder="Your message…"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                disabled={busy}
                className="w-full flex-1 resize-none bg-transparent py-1 text-sm placeholder:text-muted-foreground/60 focus:outline-none"
              />
              {files.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pb-2">
                  {files.map((f, i) => (
                    <span
                      key={`${f.name}-${i}`}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-xs"
                    >
                      <Paperclip className="h-3 w-3 text-muted-foreground" />
                      <span className="max-w-[16ch] truncate">{f.name}</span>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() =>
                          setFiles(files.filter((_, j) => j !== i))
                        }
                        aria-label="Remove attachment"
                        disabled={busy}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {error && (
                <div className="mb-2 rounded border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  {error}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border bg-surface/40 px-3 py-2">
              <div className="flex items-center gap-1">
                <Button
                  type="submit"
                  disabled={busy}
                  className="rounded-sm bg-seal px-5 py-1.5 text-xs font-bold uppercase tracking-wider text-seal-foreground shadow-sm hover:brightness-95"
                >
                  {busy ? "Sending…" : "Send"}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  hidden
                  onChange={(e) => {
                    const list = Array.from(e.target.files ?? []);
                    if (list.length) setFiles((prev) => [...prev, ...list]);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={busy}
                  aria-label="Attach files"
                  className="rounded-full p-2 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
                >
                  <Paperclip className="h-4 w-4" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="hidden text-[10px] text-muted-foreground sm:inline">
                  encrypted · code-confirm
                </span>
                <button
                  type="button"
                  onClick={discard}
                  disabled={busy}
                  aria-label="Discard draft"
                  className="rounded-full p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </>
  );
}
