import { useState, useSyncExternalStore } from "react";
import { ShieldAlert, X } from "lucide-react";
import { getSecretStorageReady, subscribe } from "@/lib/matrix";
import { KeyBackupModal } from "@/components/auth/key-backup-modal";

const SNOOZE_KEY = "hmail:keybackup-snoozed";

function useSecretStorageReady() {
  return useSyncExternalStore(
    subscribe,
    () => getSecretStorageReady(),
    () => null,
  );
}

export function KeyBackupBanner() {
  const ready = useSecretStorageReady();
  const [snoozed, setSnoozed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(SNOOZE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [open, setOpen] = useState(false);

  // null = unknown (still checking); true = good; false = needs setup.
  if (ready !== false) return null;
  if (snoozed) return null;

  function snooze() {
    try {
      sessionStorage.setItem(SNOOZE_KEY, "1");
    } catch {
      /* ignore */
    }
    setSnoozed(true);
  }

  return (
    <>
      <div className="flex items-center gap-2 border-b border-border bg-amber-50 px-3 py-1.5 text-xs text-amber-900 sm:px-4 dark:bg-amber-950/40 dark:text-amber-200">
        <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate">
          Encrypted history isn't backed up. Lose this device and it's gone.
        </span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="shrink-0 rounded-sm bg-amber-900/10 px-2 py-0.5 font-semibold uppercase tracking-wider hover:bg-amber-900/20 dark:bg-amber-100/10 dark:hover:bg-amber-100/20"
        >
          Set up
        </button>
        <button
          type="button"
          onClick={snooze}
          aria-label="Dismiss"
          className="shrink-0 rounded p-0.5 hover:bg-amber-900/10 dark:hover:bg-amber-100/10"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      <KeyBackupModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
