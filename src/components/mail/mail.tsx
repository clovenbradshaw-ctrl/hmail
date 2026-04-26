import { TooltipProvider } from "@/components/ui/tooltip";
import { Sidebar } from "@/components/mail/sidebar";
import { MailList } from "@/components/mail/mail-list";
import { MailDisplay } from "@/components/mail/mail-display";
import { Compose } from "@/components/mail/compose";
import { ManageRooms } from "@/components/mail/manage-rooms";
import { VerifyModal } from "@/components/auth/verify-modal";
import { KeyBackupBanner } from "@/components/auth/key-backup-banner";
import { useMailStore } from "@/hooks/use-mail";
import { cn } from "@/lib/utils";

export function Mail() {
  const selectedRoomId = useMailStore((s) => s.selectedRoomId);
  const sidebarOpen = useMailStore((s) => s.sidebarOpen);
  const setSidebarOpen = useMailStore((s) => s.setSidebarOpen);

  return (
    <TooltipProvider delayDuration={200}>
      {/* Desktop: fixed sidebar + main */}
      <div className="hidden h-screen flex-col md:flex">
        <KeyBackupBanner />
        <div className="flex min-h-0 flex-1">
          <aside className="w-60 shrink-0 border-r border-border bg-surface">
            <Sidebar />
          </aside>
          <main className="flex-1 min-w-0 bg-background">
            {selectedRoomId ? <MailDisplay /> : <MailList />}
          </main>
        </div>
      </div>

      {/* Mobile: single-pane navigation */}
      <div className="flex h-screen flex-col md:hidden">
        <KeyBackupBanner />
        <div className="min-h-0 flex-1">
          {selectedRoomId ? <MailDisplay /> : <MailList />}
        </div>
      </div>

      {/* Mobile sidebar drawer */}
      <div
        className={cn(
          "fixed inset-0 z-40 transition-opacity md:hidden",
          sidebarOpen
            ? "pointer-events-auto bg-black/30"
            : "pointer-events-none opacity-0",
        )}
        onClick={() => setSidebarOpen(false)}
      >
        <div
          className={cn(
            "absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-surface shadow-xl transition-transform",
            sidebarOpen ? "translate-x-0" : "-translate-x-full",
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <Sidebar />
        </div>
      </div>

      <Compose />
      <ManageRooms />
      <VerifyModal />
    </TooltipProvider>
  );
}
