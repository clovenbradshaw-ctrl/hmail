import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, UserPlus, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import {
  inviteToRoom,
  searchUsers,
  type HistoryAccess,
  type UserSearchResult,
} from "@/lib/rooms";

/**
 * Adding someone to an in-flight conversation forces an explicit choice about
 * what the new person can see of the past. The dialog won't submit until the
 * user has picked one — no quiet default.
 */
export function AddPeopleModal({
  open,
  onClose,
  roomId,
  conversationLabel,
}: {
  open: boolean;
  onClose: () => void;
  roomId: string;
  conversationLabel: string;
}) {
  const [to, setTo] = useState("");
  const [access, setAccess] = useState<HistoryAccess | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hits, setHits] = useState<UserSearchResult[]>([]);

  useEffect(() => {
    if (!open) {
      setTo("");
      setAccess(null);
      setError(null);
      setHits([]);
      setBusy(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const q = to.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    let alive = true;
    const t = window.setTimeout(async () => {
      const res = await searchUsers(q);
      if (alive) setHits(res);
    }, 200);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [to, open]);

  const validTarget = useMemo(() => /^@[^:]+:.+/.test(to.trim()), [to]);
  const canSubmit = validTarget && access !== null && !busy;

  async function submit() {
    if (!canSubmit || !access) return;
    setBusy(true);
    setError(null);
    try {
      await inviteToRoom(roomId, to.trim(), access);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <UserPlus className="h-4 w-4" />
          Add someone to "{conversationLabel}"
        </span>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="flex flex-col gap-4 px-5 py-4"
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Who
          </span>
          <input
            type="text"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="@alice:example.org"
            autoFocus
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            disabled={busy}
          />
          {hits.length > 0 && (
            <div className="mt-1 max-h-40 overflow-y-auto rounded-md border border-border bg-popover">
              {hits.map((h) => (
                <button
                  key={h.user_id}
                  type="button"
                  onClick={() => setTo(h.user_id)}
                  className="flex w-full flex-col items-start gap-0.5 px-3 py-1.5 text-left hover:bg-accent"
                >
                  <span className="text-sm">
                    {h.display_name || h.user_id}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {h.user_id}
                  </span>
                </button>
              ))}
            </div>
          )}
        </label>

        <fieldset className="flex flex-col gap-2 rounded-md border border-border bg-surface/50 p-3">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            What can they see?
          </legend>
          <p className="px-1 text-[12px] text-muted-foreground">
            You must choose. This decision is permanent for messages already
            sent — once the past is shared, it stays shared.
          </p>
          <label
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-md border p-3 transition",
              access === "new-only"
                ? "border-primary bg-selected/40"
                : "border-border hover:bg-accent/40",
            )}
          >
            <input
              type="radio"
              name="access"
              value="new-only"
              checked={access === "new-only"}
              onChange={() => setAccess("new-only")}
              className="mt-1"
            />
            <span className="flex flex-col gap-0.5">
              <span className="flex items-center gap-2 text-sm font-medium">
                <EyeOff className="h-3.5 w-3.5" />
                New messages only
              </span>
              <span className="text-[12px] text-muted-foreground">
                They'll see everything from the moment they accept the invite —
                nothing before.
              </span>
            </span>
          </label>
          <label
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-md border p-3 transition",
              access === "share-history"
                ? "border-primary bg-selected/40"
                : "border-border hover:bg-accent/40",
            )}
          >
            <input
              type="radio"
              name="access"
              value="share-history"
              checked={access === "share-history"}
              onChange={() => setAccess("share-history")}
              className="mt-1"
            />
            <span className="flex flex-col gap-0.5">
              <span className="flex items-center gap-2 text-sm font-medium">
                <Eye className="h-3.5 w-3.5" />
                Share the full thread
              </span>
              <span className="text-[12px] text-muted-foreground">
                They'll be able to read every previous message in this
                conversation.
              </span>
            </span>
          </label>
        </fieldset>

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={!canSubmit}>
            {busy ? "Inviting…" : "Invite"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
