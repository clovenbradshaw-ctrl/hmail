import { useSyncExternalStore } from "react";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import {
  acceptPendingVerification,
  cancelPendingVerification,
  confirmSas,
  getActiveSas,
  getPendingVerification,
  reportSasMismatch,
  subscribe,
} from "@/lib/matrix";
import { VerificationPhase } from "matrix-js-sdk/lib/crypto-api";

function usePendingVerification() {
  return useSyncExternalStore(
    subscribe,
    () => getPendingVerification(),
    () => null,
  );
}

function useActiveSas() {
  return useSyncExternalStore(
    subscribe,
    () => getActiveSas(),
    () => null,
  );
}

export function VerifyModal() {
  const req = usePendingVerification();
  const sas = useActiveSas();
  if (!req) return null;

  const phase = req.phase;
  const otherUser = req.otherUserId;
  const isSelf = req.isSelfVerification;

  // The flow we surface:
  //   Requested  → "Accept / Decline"
  //   Ready      → "Waiting for emojis…" (auto-starts SAS)
  //   Started + sas → emoji grid + "They match / Don't match"
  //   Started w/o sas → "Waiting…"
  //   Cancelled / Done → modal closes via state cleanup
  const headerLabel = isSelf
    ? "Verify your other session"
    : `Verify ${otherUser}`;

  return (
    <Modal
      open={true}
      onClose={() => void cancelPendingVerification()}
      title={headerLabel}
      className="sm:max-w-md"
    >
      <div className="flex flex-col gap-4 p-5">
        {phase === VerificationPhase.Requested && (
          <>
            <p className="text-sm text-muted-foreground">
              {isSelf
                ? "Another one of your sessions is asking to verify with this device. Confirming will let it read your encrypted history."
                : `${otherUser} is asking to verify with you over an encrypted side channel.`}
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => void cancelPendingVerification()}
              >
                Decline
              </Button>
              <Button onClick={() => void acceptPendingVerification()}>
                Accept
              </Button>
            </div>
          </>
        )}

        {(phase === VerificationPhase.Ready ||
          (phase === VerificationPhase.Started && !sas)) && (
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Waiting for the other side to send the emoji set…
          </div>
        )}

        {phase === VerificationPhase.Started && sas && sas.sas.emoji && (
          <>
            <p className="text-sm text-muted-foreground">
              Make sure these seven emojis match what{" "}
              {isSelf ? "your other session" : "the other person"} sees, in the
              same order.
            </p>
            <div className="grid grid-cols-7 gap-2 rounded-lg border border-border bg-surface p-3 text-center">
              {sas.sas.emoji.map(([emoji, name], i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <span className="text-2xl leading-none">{emoji}</span>
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
                    {name}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  reportSasMismatch();
                }}
              >
                <ShieldAlert className="mr-1.5 h-4 w-4" />
                Don't match
              </Button>
              <Button onClick={() => void confirmSas()}>
                <ShieldCheck className="mr-1.5 h-4 w-4" />
                They match
              </Button>
            </div>
          </>
        )}

        {phase === VerificationPhase.Cancelled && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-destructive">
              Verification was cancelled
              {req.cancellationCode ? ` (${req.cancellationCode})` : ""}.
            </p>
            <div className="flex justify-end">
              <Button onClick={() => void cancelPendingVerification()}>
                Close
              </Button>
            </div>
          </div>
        )}

        {phase === VerificationPhase.Done && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-primary">
              Verified. Their messages will now be marked trusted.
            </p>
            <div className="flex justify-end">
              <Button onClick={() => void cancelPendingVerification()}>
                Done
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
