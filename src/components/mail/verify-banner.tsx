import { useState } from "react";
import { ShieldCheck, ShieldAlert, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  generateConfirmationCode,
  sendConfirmationRequest,
  submitConfirmationCode,
  type ConfirmState,
} from "@/lib/rooms";
import { ShareCodeModal } from "@/components/mail/share-code-modal";

interface Props {
  roomId: string;
  state: ConfirmState;
  recipientLabel: string;
}

export function VerifyBanner({ roomId, state, recipientLabel }: Props) {
  const [code, setCode] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [busyStart, setBusyStart] = useState(false);

  async function startOrResend() {
    setBusyStart(true);
    try {
      const c = generateConfirmationCode(6);
      await sendConfirmationRequest(roomId, c);
      setCode(c);
      setShareOpen(true);
    } finally {
      setBusyStart(false);
    }
  }

  if (state.status === "verified") {
    return (
      <div className="flex items-center gap-2 border-b border-border bg-selected/40 px-4 py-1.5 text-[12px] text-selected-foreground sm:px-6">
        <ShieldCheck className="h-3.5 w-3.5" />
        <span>
          Identity confirmed{" "}
          {state.counterpartyMxid && (
            <span className="font-mono text-[10px] text-muted-foreground">
              · {state.counterpartyMxid}
            </span>
          )}
        </span>
      </div>
    );
  }

  if (state.status === "awaiting_me") {
    return (
      <AwaitingMeBanner
        roomId={roomId}
        senderLabel={state.counterpartyMxid ?? "the sender"}
      />
    );
  }

  // none or awaiting_them — sender side.
  const isResend = state.status === "awaiting_them";
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-4 py-2 text-[12px] sm:px-6">
        {isResend ? (
          <Lock className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ShieldAlert className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <span className="text-muted-foreground">
          {isResend
            ? `Waiting for ${recipientLabel} to confirm with the code you sent.`
            : "Recipient not yet confirmed by side-channel."}
        </span>
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0 text-[12px] text-primary"
          onClick={() => void startOrResend()}
          disabled={busyStart}
        >
          {busyStart
            ? "Generating…"
            : isResend
            ? "Resend with a new code →"
            : "Send a code via another channel →"}
        </Button>
      </div>
      <ShareCodeModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        recipient={recipientLabel}
        code={code ?? ""}
      />
    </>
  );
}

function AwaitingMeBanner({
  roomId,
  senderLabel,
}: {
  roomId: string;
  senderLabel: string;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const ok = await submitConfirmationCode(roomId, code);
      if (!ok) {
        setError("Code didn't match. Double-check with the sender.");
      } else {
        setCode("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-b border-border bg-seal/5 px-4 py-3 sm:px-6">
      <div className="flex items-center gap-2 text-[13px] font-medium">
        <Lock className="h-4 w-4 text-seal" />
        <span>
          {senderLabel} is asking you to confirm via a side channel before
          chatting.
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        They'll have sent you a 6-character code by SMS, Signal, WhatsApp, or
        email. Enter it here to unlock the conversation.
      </p>
      <form onSubmit={submit} className="mt-2 flex flex-wrap items-center gap-2">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="K7M2X4"
          maxLength={6}
          className="w-40 font-mono uppercase tracking-[0.3em]"
          disabled={busy}
        />
        <Button type="submit" size="sm" disabled={busy || !code.trim()}>
          {busy ? "Checking…" : "Confirm"}
        </Button>
        {error && <span className="text-xs text-destructive">{error}</span>}
      </form>
    </div>
  );
}
