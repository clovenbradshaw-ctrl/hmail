import {
  Inbox,
  Star,
  Send,
  FileText,
  Archive,
  Trash2,
  Tag,
  PenLine,
  LogOut,
  ListChecks,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useMailStore } from "@/hooks/use-mail";
import { useConversations, useMyMxid } from "@/lib/rooms";
import { logout } from "@/lib/matrix";

interface NavItem {
  label: string;
  icon: typeof Inbox;
  count?: number;
  folder?: "inbox" | "starred" | "archive";
  disabled?: boolean;
}

export function Sidebar() {
  const conversations = useConversations();
  const myMxid = useMyMxid();
  const folder = useMailStore((s) => s.folder);
  const setFolder = useMailStore((s) => s.setFolder);
  const setComposeOpen = useMailStore((s) => s.setComposeOpen);
  const setManageRoomsOpen = useMailStore((s) => s.setManageRoomsOpen);
  const setSidebarOpen = useMailStore((s) => s.setSidebarOpen);

  const inboxUnread = conversations.filter((c) => !c.archived && c.unread).length;
  const starredCount = conversations.filter((c) => c.starred).length;
  const archivedCount = conversations.filter((c) => c.archived).length;

  const items: NavItem[] = [
    { label: "Inbox", icon: Inbox, count: inboxUnread, folder: "inbox" },
    { label: "Starred", icon: Star, count: starredCount, folder: "starred" },
    { label: "Sent", icon: Send, disabled: true },
    { label: "Drafts", icon: FileText, disabled: true },
    { label: "Archive", icon: Archive, count: archivedCount, folder: "archive" },
    { label: "Trash", icon: Trash2, disabled: true },
  ];

  const tagSet = new Set<string>();
  for (const c of conversations) for (const t of c.tags) tagSet.add(t);
  const tags = Array.from(tagSet).sort();

  const localpart = myMxid?.match(/^@([^:]+):/)?.[1] ?? myMxid ?? "";
  const domain = myMxid?.match(/:(.+)$/)?.[1] ?? "";

  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-seal text-seal-foreground">
          <span className="font-display text-base font-bold italic">h</span>
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="text-sm font-semibold leading-tight tracking-tight">hmail</span>
          <span className="truncate font-mono text-[10px] leading-tight text-muted-foreground">
            @{localpart}
            {domain && <>:{domain}</>}
          </span>
        </div>
      </div>

      <div className="px-3 pb-3 pt-1">
        <Button
          onClick={() => {
            setComposeOpen(true);
            setSidebarOpen(false);
          }}
          className="w-full justify-start gap-3 rounded-2xl bg-primary px-4 text-base font-medium shadow-sm hover:bg-primary/90"
          size="lg"
        >
          <PenLine className="h-5 w-5" />
          Compose
        </Button>
      </div>

      <nav className="px-2">
        {items.map((item) => {
          const active = item.folder !== undefined && folder === item.folder;
          return (
            <button
              key={item.label}
              onClick={() => {
                if (item.folder) {
                  setFolder(item.folder);
                  setSidebarOpen(false);
                }
              }}
              disabled={item.disabled}
              className={cn(
                "flex w-full items-center justify-between rounded-r-full px-4 py-2 text-sm font-medium transition-colors",
                "hover:bg-accent",
                active && "bg-selected text-selected-foreground hover:bg-selected",
                item.disabled && "opacity-40 hover:bg-transparent",
              )}
            >
              <span className="flex items-center gap-4">
                <item.icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </span>
              {item.count !== undefined && item.count > 0 && (
                <span
                  className={cn(
                    "font-mono text-[11px]",
                    active ? "text-selected-foreground" : "text-muted-foreground",
                  )}
                >
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
        <button
          onClick={() => {
            setManageRoomsOpen(true);
            setSidebarOpen(false);
          }}
          className="mt-1 flex w-full items-center gap-4 rounded-r-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ListChecks className="h-4 w-4 shrink-0" />
          <span>Manage rooms…</span>
        </button>
      </nav>

      {tags.length > 0 && (
        <>
          <Separator className="my-3" />
          <div className="px-2">
            <div className="mb-1 px-4 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Tags
            </div>
            {tags.map((tag) => (
              <button
                key={tag}
                disabled
                className="flex w-full items-center gap-4 rounded-r-full px-4 py-1.5 text-sm transition-colors hover:bg-accent"
              >
                <Tag className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="text-muted-foreground">{tag}</span>
              </button>
            ))}
          </div>
        </>
      )}

      <div className="flex-1" />

      <Separator />
      <div className="p-2">
        <button
          onClick={() => void logout()}
          className="flex w-full items-center gap-4 rounded-r-full px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Sign out</span>
        </button>
      </div>
    </div>
  );
}
