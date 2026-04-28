import { TooltipProvider } from "@/components/ui/tooltip";
import { Sidebar } from "@/components/mail/sidebar";
import { MailList } from "@/components/mail/mail-list";
import { MailDisplay } from "@/components/mail/mail-display";
import { MediaStore } from "@/components/mail/media-store";
import { Compose } from "@/components/mail/compose";
import { ManageRooms } from "@/components/mail/manage-rooms";
import { Profile } from "@/components/mail/profile";
import { KeyboardHelp } from "@/components/mail/keyboard-help";
import { PersonView } from "@/components/mail/person-view";
import { ContactsList } from "@/components/mail/contacts-list";
import { useMailStore } from "@/hooks/use-mail";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { cn } from "@/lib/utils";

export function Mail() {
  const selectedRoomId = useMailStore((s) => s.selectedRoomId);
  const personViewMxid = useMailStore((s) => s.personViewMxid);
  const folder = useMailStore((s) => s.folder);
  const sidebarOpen = useMailStore((s) => s.sidebarOpen);
  const setSidebarOpen = useMailStore((s) => s.setSidebarOpen);
  useKeyboardShortcuts();

  const main = personViewMxid ? (
    <PersonView />
  ) : selectedRoomId ? (
    <MailDisplay />
  ) : folder === "media" ? (
    <MediaStore />
  ) : folder === "people" ? (
    <ContactsList />
  ) : (
    <MailList />
  );

  return (
    <TooltipProvider delayDuration={200}>
      {/* Desktop: fixed sidebar + main */}
      <div className="hidden h-screen md:flex">
        <aside className="w-60 shrink-0 border-r border-border bg-surface">
          <Sidebar />
        </aside>
        <main className="flex-1 min-w-0 bg-background">{main}</main>
      </div>

      {/* Mobile: single-pane navigation */}
      <div className="flex h-screen flex-col md:hidden">{main}</div>

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
      <Profile />
      <KeyboardHelp />
    </TooltipProvider>
  );
}
