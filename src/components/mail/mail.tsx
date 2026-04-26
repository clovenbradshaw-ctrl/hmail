import { TooltipProvider } from "@/components/ui/tooltip";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { Sidebar } from "@/components/mail/sidebar";
import { MailList } from "@/components/mail/mail-list";
import { MailDisplay } from "@/components/mail/mail-display";
import { Compose } from "@/components/mail/compose";
import { ManageRooms } from "@/components/mail/manage-rooms";
import { useMailStore } from "@/hooks/use-mail";
import { cn } from "@/lib/utils";

export function Mail() {
  const selectedRoomId = useMailStore((s) => s.selectedRoomId);
  const sidebarOpen = useMailStore((s) => s.sidebarOpen);
  const setSidebarOpen = useMailStore((s) => s.setSidebarOpen);

  return (
    <TooltipProvider delayDuration={200}>
      {/* Desktop: three-pane resizable */}
      <div className="hidden h-screen md:block">
        <ResizablePanelGroup direction="horizontal" className="h-screen w-full items-stretch">
          <ResizablePanel
            defaultSize={16}
            minSize={12}
            maxSize={22}
            collapsible
            collapsedSize={4}
            className="min-w-[180px]"
          >
            <Sidebar />
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel defaultSize={30} minSize={24} maxSize={40}>
            <MailList />
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel defaultSize={54} minSize={30}>
            <MailDisplay />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Mobile: single-pane navigation */}
      <div className="flex h-screen flex-col md:hidden">
        {selectedRoomId ? (
          <MailDisplay />
        ) : (
          <MailList />
        )}
      </div>

      {/* Mobile sidebar drawer */}
      <div
        className={cn(
          "fixed inset-0 z-40 transition-opacity md:hidden",
          sidebarOpen ? "pointer-events-auto bg-black/30" : "pointer-events-none opacity-0",
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
    </TooltipProvider>
  );
}
