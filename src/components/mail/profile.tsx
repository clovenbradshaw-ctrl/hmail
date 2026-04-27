import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { useMailStore } from "@/hooks/use-mail";
import {
  clearMyAvatar,
  getMyDisplayName,
  setMyAvatar,
  setMyDisplayName,
  useMyAvatarMxc,
} from "@/lib/profile";
import { useMyMxid } from "@/lib/rooms";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB

function monogramFor(name: string, mxid: string | null): string {
  const base = name.trim() || (mxid?.match(/^@([^:]+):/)?.[1] ?? mxid ?? "");
  if (!base) return "?";
  const parts = base.split(/\s+/);
  if (parts.length === 1) return base.slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Profile() {
  const open = useMailStore((s) => s.profileOpen);
  const setOpen = useMailStore((s) => s.setProfileOpen);
  const myMxid = useMyMxid();
  const avatarMxc = useMyAvatarMxc();
  const [name, setName] = useState("");
  const [initial, setInitial] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSavedAt(null);
    setAvatarError(null);
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

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset the input value so picking the same file twice still fires.
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setAvatarError("Please choose an image.");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarError("Image is too large — please keep it under 5 MB.");
      return;
    }
    setAvatarBusy(true);
    setAvatarError(null);
    try {
      await setMyAvatar(file);
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : String(err));
    } finally {
      setAvatarBusy(false);
    }
  }

  async function onRemove() {
    if (avatarBusy) return;
    setAvatarBusy(true);
    setAvatarError(null);
    try {
      await clearMyAvatar();
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : String(err));
    } finally {
      setAvatarBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Your profile">
      <form onSubmit={save} className="flex flex-col gap-4 p-5">
        <div className="flex items-center gap-4">
          <MemberAvatar
            className="h-16 w-16"
            mxc={avatarMxc}
            monogram={monogramFor(name, myMxid)}
            alt="Your profile picture"
            fallbackClassName="bg-muted text-foreground font-mono text-sm"
          />
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">
              Your profile picture is only visible to people you've agreed to
              connect with — anyone who shares a room with you. It isn't
              attached to your public Matrix profile.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={avatarBusy}
                onClick={() => fileInputRef.current?.click()}
              >
                {avatarBusy
                  ? "Working…"
                  : avatarMxc
                    ? "Replace picture"
                    : "Upload picture"}
              </Button>
              {avatarMxc && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={avatarBusy}
                  onClick={onRemove}
                >
                  Remove
                </Button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onPickFile}
            />
            {avatarError && (
              <p className="text-xs text-destructive">{avatarError}</p>
            )}
          </div>
        </div>

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
          <span className="text-[11px] text-muted-foreground">
            Your display name is shared with everyone who shares a room with
            you. Change it here and the new name propagates to every
            conversation you're in.
          </span>
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
