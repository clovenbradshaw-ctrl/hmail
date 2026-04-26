import { useState } from "react";
import { Copy, Check, KeyRound } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setupSecretStorage } from "@/lib/matrix";

interface KeyBackupModalProps {
  open: boolean;
  onClose: () => void;
}

type Step = "intro" | "working" | "reveal";

export function KeyBackupModal({ open, onClose }: KeyBackupModalProps) {
  const [step, setStep] = useState<Step>("intro");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [recoveryKey, setRecoveryKey] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  function reset() {
    setStep("intro");
    setPassword("");
    setError(null);
    setRecoveryKey("");
    setCopied(false);
    setConfirmed(false);
  }

  function handleClose() {
    if (step === "working") return;
    reset();
    onClose();
  }

  async function onSetUp(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;
    setError(null);
    setStep("working");
    try {
      const key = await setupSecretStorage(password);
      setRecoveryKey(key);
      setStep("reveal");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStep("intro");
    }
  }

  async function copyKey() {
    try {
      await navigator.clipboard.writeText(recoveryKey);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Back up encrypted history"
      className="sm:max-w-md"
    >
      {step === "intro" && (
        <form onSubmit={onSetUp} className="flex flex-col gap-4 p-5">
          <p className="text-sm text-muted-foreground">
            hmail's messages are end-to-end encrypted. If you lose this device
            without a backup, you can't recover your encrypted history. Set up
            a recovery key now and store it somewhere safe.
          </p>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              Re-enter your account password
            </span>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              autoComplete="current-password"
              placeholder="••••••••"
            />
            <span className="mt-1 block text-[10px] text-muted-foreground">
              Required by your homeserver to publish your cross-signing keys.
            </span>
          </label>
          {error && (
            <div className="rounded border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={handleClose}>
              Not now
            </Button>
            <Button type="submit" disabled={!password}>
              <KeyRound className="mr-1.5 h-4 w-4" />
              Generate recovery key
            </Button>
          </div>
        </form>
      )}

      {step === "working" && (
        <div className="flex flex-col items-center gap-3 p-8 text-center">
          <KeyRound className="h-6 w-6 animate-pulse text-primary" />
          <p className="text-sm text-muted-foreground">
            Publishing your cross-signing keys and provisioning a key backup…
          </p>
        </div>
      )}

      {step === "reveal" && (
        <div className="flex flex-col gap-4 p-5">
          <p className="text-sm text-muted-foreground">
            Save this recovery key somewhere offline (a password manager works).
            It's the only way to read your encrypted history if you lose every
            currently-signed-in device.
          </p>
          <div className="rounded-lg border border-border bg-surface p-4">
            <div className="break-all font-mono text-sm leading-relaxed">
              {recoveryKey}
            </div>
            <button
              type="button"
              onClick={() => void copyKey()}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" /> Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" /> Copy recovery key
                </>
              )}
            </button>
          </div>
          <label className="flex items-start gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5"
            />
            <span>I've saved my recovery key. I understand it can't be shown again.</span>
          </label>
          <div className="flex justify-end">
            <Button onClick={handleClose} disabled={!confirmed}>
              Done
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
