import { TooltipProvider } from "@/components/ui/tooltip";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { Sidebar } from "@/components/mail/sidebar";
import { MailList } from "@/components/mail/mail-list";
import { MailDisplay } from "@/components/mail/mail-display";

export function Mail() {
  return (
    <TooltipProvider delayDuration={200}>
      <ResizablePanelGroup
        direction="horizontal"
        className="h-screen w-full items-stretch"
      >
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
    </TooltipProvider>
  );
}
