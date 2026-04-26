import { useEffect, useState, useSyncExternalStore } from "react";
import { Mail } from "@/components/mail/mail";
import { Login } from "@/components/auth/login";
import {
  getClient,
  getSyncPhase,
  hydrateFromSession,
  loadSession,
  subscribe,
} from "@/lib/matrix";

function useSyncPhase() {
  return useSyncExternalStore(subscribe, getSyncPhase, () => "logged_out");
}

function useClientUserId() {
  return useSyncExternalStore(
    subscribe,
    () => getClient()?.getUserId() ?? null,
    () => null,
  );
}

function LoadingShell({ label }: { label: string }) {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background paper-grain">
      <div className="text-center">
        <div className="font-display text-5xl italic text-seal">h</div>
        <p className="mt-3 font-display text-sm text-muted-foreground">
          {label}
          <span className="ml-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-seal align-middle" />
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const phase = useSyncPhase();
  const userId = useClientUserId();
  const [hydrating, setHydrating] = useState<boolean>(() => !!loadSession());

  useEffect(() => {
    let cancelled = false;
    if (loadSession() && !getClient()) {
      hydrateFromSession()
        .catch((err) => console.error("[hmail] hydrate failed", err))
        .finally(() => {
          if (!cancelled) setHydrating(false);
        });
    } else {
      setHydrating(false);
    }
    return () => {
      cancelled = true;
    };
  }, []);

  if (hydrating) return <LoadingShell label="Restoring session" />;
  if (!userId) return <Login />;
  if (phase === "starting") return <LoadingShell label="Connecting" />;
  if (phase !== "prepared" && phase !== "syncing")
    return <LoadingShell label="Syncing" />;
  return <Mail />;
}
