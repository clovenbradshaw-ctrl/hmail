import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useMailStore } from "@/hooks/use-mail";
import { getMyDisplayName, setMyDisplayName } from "@/lib/profile";
import { useMyMxid } from "@/lib/rooms";

export function Profile() {
  const open = useMailStore((s) => s.profileOpen);
  const setOpen = useMailStore((s) => s.setProfileOpen);
  const myMxid = useMyMxid();
  const [name, setName] = useState("");
  const [initial, setInitial] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSavedAt(null);
    getMyDisplayName()
      .then((n) => {
        if (cancelled) return;
        setName(n);
        setInitial(n);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const trimmed = name.trim();
  const dirty = trimmed !== initial.trim();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !dirty) return;
    setBusy(true);
    setError(null);
    try {
      await setMyDisplayName(trimmed);
      setInitial(trimmed);
      setSavedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Your profile">
      <form onSubmit={save} className="flex flex-col gap-4 p-5">
        <p className="text-xs text-muted-foreground">
          Your display name is shared with everyone who shares a room with
          you. Change it here and the new name propagates to every
          conversation you're in.
        </p>
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Display name
          </span>
          <Input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (savedAt !== null) setSavedAt(null);
            }}
            placeholder={loading ? "Loading…" : "e.g. Alice Smith"}
            disabled={busy || loading}
            autoFocus
            maxLength={120}
          />
        </label>
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Matrix ID
          </span>
          <span className="font-mono text-xs">{myMxid ?? "—"}</span>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        {savedAt !== null && !dirty && !error && (
          <p className="text-xs text-primary">
            Saved. The new name is propagating to your rooms.
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Close
          </Button>
          <Button type="submit" disabled={busy || loading || !dirty}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
