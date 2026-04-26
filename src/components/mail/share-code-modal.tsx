import { useEffect, useState } from "react";
import {
  MessageSquare,
  Mail,
  Phone,
  Send,
  Copy,
  Check,
  Share2,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

interface ShareCodeModalProps {
  open: boolean;
  onClose: () => void;
  recipient: string;
  code: string;
  /** Pre-formatted message to share. */
  message?: string;
}

function whatsappLink(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
function signalLink(text: string): string {
  // Signal's URL scheme. Works on iOS / installed Signal Desktop.
  return `sgnl://send?text=${encodeURIComponent(text)}`;
}
function smsLink(text: string): string {
  return `sms:?body=${encodeURIComponent(text)}`;
}
function mailLink(text: string, subject: string): string {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
}

export function ShareCodeModal({
  open,
  onClose,
  recipient,
  code,
  message,
}: ShareCodeModalProps) {
  const [copied, setCopied] = useState(false);
  const [hasNativeShare, setHasNativeShare] = useState(false);

  useEffect(() => {
    if (open) setCopied(false);
  }, [open]);

  useEffect(() => {
    setHasNativeShare(typeof navigator !== "undefined" && "share" in navigator);
  }, []);

  const text =
    message ??
    `It's me. To unlock our hmail conversation, enter this code: ${code}`;
  const subject = "hmail confirmation code";

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  async function nativeShare() {
    try {
      await (navigator as Navigator & { share?: (d: ShareData) => Promise<void> }).share?.({
        title: subject,
        text,
      });
    } catch {
      /* user cancelled */
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Confirm your recipient">
      <div className="flex flex-col gap-5 p-5">
        <p className="text-sm text-muted-foreground">
          Send this code to{" "}
          <span className="font-mono text-foreground">{recipient}</span> via a
          channel you both already trust. They'll need to enter it on their
          side to unlock the conversation.
        </p>

        <div className="rounded-xl border border-border bg-surface p-5 text-center">
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Confirmation code
          </div>
          <div className="mt-2 font-mono text-3xl font-bold tracking-[0.4em] sm:text-4xl">
            {code}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <a
            href={smsLink(text)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-accent"
          >
            <Phone className="h-4 w-4" /> Text / SMS
          </a>
          <a
            href={signalLink(text)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-accent"
          >
            <Send className="h-4 w-4" /> Signal
          </a>
          <a
            href={whatsappLink(text)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-accent"
          >
            <MessageSquare className="h-4 w-4" /> WhatsApp
          </a>
          <a
            href={mailLink(text, subject)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-accent"
          >
            <Mail className="h-4 w-4" /> Email
          </a>
          <button
            type="button"
            onClick={copyAll}
            className="flex items-center justify-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-accent"
          >
            {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy text"}
          </button>
          {hasNativeShare && (
            <button
              type="button"
              onClick={() => void nativeShare()}
              className="flex items-center justify-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-accent"
            >
              <Share2 className="h-4 w-4" /> Share…
            </button>
          )}
        </div>

        <details className="rounded-md border border-border bg-surface px-3 py-2 text-xs text-muted-foreground">
          <summary className="cursor-pointer text-foreground">Preview message</summary>
          <pre className="mt-2 whitespace-pre-wrap break-words font-sans text-xs">
            {text}
          </pre>
        </details>

        <div className="flex justify-end">
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </Modal>
  );
}
