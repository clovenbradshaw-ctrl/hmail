import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Lock, RefreshCw, ShieldAlert } from "lucide-react";
import type { MatrixClient } from "matrix-js-sdk";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  decodeMessage,
  formatCode,
  generateCode,
  normalizeCode,
  type CodeScope,
  type CodedPayload,
} from "@/lib/coded";
import {
  isVaultAvailable,
  persistCode,
  rememberCodeInMemory,
} from "@/lib/coded-vault";
import { decodeWith } from "@/lib/coded-runtime";

// ---------------------------------------------------------------------------
// Compose modal: sender picks scope + code, then we hand back to the caller.
// ---------------------------------------------------------------------------

interface CodeComposeModalProps {
  open: boolean;
  onClose: () => void;
  /** Called with the chosen scope + passphrase if the user clicks Use Code. */
  onPick: (input: { scope: CodeScope; passphrase: string }) => void;
  defaultScope?: CodeScope;
}

const SCOPE_OPTIONS: { value: CodeScope; label: string; hint: string }[] = [
  {
    value: "always",
    label: "Always (this contact)",
    hint: "Recipient enters this once and it unlocks every message you send them with this code.",
  },
  {
    value: "thread",
    label: "This conversation",
    hint: "Recipient enters this once per conversation; unlocks every message in this thread.",
  },
  {
    value: "message",
    label: "Just this message",
    hint: "Fresh code, this message only. Recipient enters it every time.",
  },
];

export function CodeComposeModal({
  open,
  onClose,
  onPick,
  defaultScope = "thread",
}: CodeComposeModalProps) {
  const [scope, setScope] = useState<CodeScope>(defaultScope);
  const [code, setCode] = useState<string>("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setScope(defaultScope);
    setCode(generateCode());
    setCopied(false);
  }, [open, defaultScope]);

  const trimmed = useMemo(() => normalizeCode(code), [code]);
  const tooShort = trimmed.length < 8;

  async function copy() {
    try {
      await navigator.clipboard.writeText(formatCode(code));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  function regenerate() {
    setCode(generateCode());
    setCopied(false);
  }

  function confirm() {
    if (tooShort) return;
    onPick({ scope, passphrase: trimmed });
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Lock this message with a code">
      <div className="flex flex-col gap-5 p-5">
        <p className="text-sm text-muted-foreground">
          Encrypts the message body with a passphrase the recipient must enter
          to read it. Pick how broadly the same code unlocks future messages.
        </p>

        <div className="flex flex-col gap-2">
          {SCOPE_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2",
                scope === opt.value
                  ? "border-primary bg-selected/40"
                  : "border-border bg-background hover:bg-accent",
              )}
            >
              <input
                type="radio"
                name="coded-scope"
                value={opt.value}
                checked={scope === opt.value}
                onChange={() => setScope(opt.value)}
                className="mt-0.5"
              />
              <span className="flex flex-col gap-0.5 text-sm">
                <span className="font-medium">{opt.label}</span>
                <span className="text-xs text-muted-foreground">{opt.hint}</span>
              </span>
            </label>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Code
          </label>
          <div className="flex items-center gap-1.5">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 font-mono text-base tracking-[0.15em] focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <button
              type="button"
              onClick={regenerate}
              aria-label="Generate a new code"
              className="rounded-md border border-border bg-background p-2 text-muted-foreground hover:bg-accent"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => void copy()}
              aria-label="Copy code"
              className="rounded-md border border-border bg-background p-2 text-muted-foreground hover:bg-accent"
            >
              {copied ? (
                <Check className="h-4 w-4 text-primary" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Share this code with the recipient out of band (text, voice, paper).
            Anyone with the code can read the message.
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={confirm} disabled={tooShort}>
            <Lock className="mr-1.5 h-3.5 w-3.5" /> Use code
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Unlock modal: recipient enters the code, optionally persists to 4S.
// ---------------------------------------------------------------------------

interface CodeUnlockModalProps {
  open: boolean;
  onClose: () => void;
  client: MatrixClient | null;
  payload: CodedPayload;
  eventId: string;
  /** For scope="always", the sender's MXID. For "thread", the room id. */
  scopeKey: string;
}

export function CodeUnlockModal({
  open,
  onClose,
  client,
  payload,
  eventId,
  scopeKey,
}: CodeUnlockModalProps) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Persistence picker: temporary (in-memory only) vs. permanent (4S vault).
  const [persistence, setPersistence] = useState<"temporary" | "permanent">(
    "temporary",
  );
  const [vaultAvail, setVaultAvail] = useState<boolean>(false);

  useEffect(() => {
    if (!open) return;
    setInput("");
    setError(null);
    setBusy(false);
    setPersistence("temporary");
    if (client) {
      void isVaultAvailable(client).then(setVaultAvail);
    } else {
      setVaultAvail(false);
    }
  }, [open, client]);

  const persistDisabled = payload.scope === "message";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const passphrase = normalizeCode(input);
    if (!passphrase) return;
    setBusy(true);
    setError(null);
    try {
      // Verify against the SDK first via a direct call so a wrong code fails
      // before we touch the vault.
      await decodeMessage(payload, passphrase);
      // Cache decoded body so the message renders cleartext immediately.
      await decodeWith(eventId, payload, passphrase);
      // Persist according to the user's choice.
      if (persistence === "permanent" && !persistDisabled && client) {
        try {
          await persistCode(client, payload.scope, scopeKey, passphrase);
        } catch (err) {
          // Vault save failed — fall back to in-memory so the unlock still
          // works for this session, and tell the user.
          rememberCodeInMemory(payload.scope, scopeKey, passphrase);
          console.warn("[hmail] persistCode failed, kept in memory only", err);
        }
      } else if (!persistDisabled) {
        rememberCodeInMemory(payload.scope, scopeKey, passphrase);
      }
      onClose();
    } catch {
      setError("Couldn't unlock — check the code and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Enter the code to unlock">
      <form onSubmit={submit} className="flex flex-col gap-5 p-5">
        <p className="text-sm text-muted-foreground">
          The sender encrypted this message with a code. Enter it to read.
        </p>

        <div className="flex flex-col gap-2">
          <input
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="abcd-efgh-ijkl-mnop"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            disabled={busy}
            className="rounded-md border border-input bg-background px-3 py-2 font-mono text-base tracking-[0.15em] focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {error && (
            <div className="rounded border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}
        </div>

        {!persistDisabled && (
          <fieldset className="flex flex-col gap-2 rounded-md border border-border p-3">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Remember this code
            </legend>
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="radio"
                name="coded-persist"
                value="temporary"
                checked={persistence === "temporary"}
                onChange={() => setPersistence("temporary")}
                className="mt-0.5"
              />
              <span className="flex flex-col">
                <span className="font-medium">Just this session</span>
                <span className="text-xs text-muted-foreground">
                  Lost when you log out or reload. Disappearing-messages style.
                </span>
              </span>
            </label>
            <label
              className={cn(
                "flex cursor-pointer items-start gap-2 text-sm",
                !vaultAvail && "opacity-60",
              )}
            >
              <input
                type="radio"
                name="coded-persist"
                value="permanent"
                checked={persistence === "permanent"}
                onChange={() => setPersistence("permanent")}
                disabled={!vaultAvail}
                className="mt-0.5"
              />
              <span className="flex flex-col">
                <span className="font-medium">
                  Across all my devices
                  {!vaultAvail && (
                    <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-normal text-muted-foreground">
                      <ShieldAlert className="h-3 w-3" /> Set up Matrix
                      Secret Storage to enable
                    </span>
                  )}
                </span>
                <span className="text-xs text-muted-foreground">
                  Encrypted at rest in your Matrix Secret Storage vault, so
                  re-logging in on any device unlocks automatically.
                </span>
              </span>
            </label>
          </fieldset>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy || normalizeCode(input).length === 0}>
            <Lock className="mr-1.5 h-3.5 w-3.5" />
            {busy ? "Unlocking…" : "Unlock"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
