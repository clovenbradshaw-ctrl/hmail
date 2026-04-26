import {
  Inbox,
  Star,
  Send,
  FileText,
  Archive,
  Trash2,
  Tag,
  PenLine,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { MOCK_CONVERSATIONS } from "@/lib/mock-data";

interface NavItem {
  label: string;
  icon: typeof Inbox;
  count?: number;
  active?: boolean;
}

export function Sidebar() {
  // Phase 0: counts are derived from mock data; in Phase 2 these come from
  // room counts + account_data tags.
  const unreadCount = MOCK_CONVERSATIONS.filter((c) => c.unread).length;
  const starredCount = MOCK_CONVERSATIONS.filter((c) => c.starred).length;

  const items: NavItem[] = [
    { label: "Inbox", icon: Inbox, count: unreadCount, active: true },
    { label: "Starred", icon: Star, count: starredCount },
    { label: "Sent", icon: Send },
    { label: "Drafts", icon: FileText },
    { label: "Archive", icon: Archive },
    { label: "Trash", icon: Trash2 },
  ];

  // Tags from account_data (m.tag in Matrix terms). Phase 0 stub.
  const tags = ["work", "writing", "surveillance", "eo", "data"];

  return (
    <div className="flex h-full flex-col bg-background paper-grain">
      {/* Brand + account */}
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <span className="font-display text-base font-medium italic">h</span>
        </div>
        <div className="flex flex-col">
          <span className="font-display text-sm font-medium leading-tight">
            hmail
          </span>
          <span className="font-mono text-[10px] leading-tight text-muted-foreground">
            @you:hyphae
          </span>
        </div>
      </div>

      <Separator />

      {/* Compose */}
      <div className="px-3 py-3">
        <Button className="w-full justify-start gap-2 font-medium" size="sm">
          <PenLine className="h-4 w-4" />
          Compose
        </Button>
      </div>

      {/* Folders */}
      <nav className="px-2">
        {items.map((item) => (
          <button
            key={item.label}
            className={cn(
              "flex w-full items-center justify-between rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent",
              item.active && "bg-accent text-accent-foreground",
            )}
          >
            <span className="flex items-center gap-3">
              <item.icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </span>
            {item.count !== undefined && item.count > 0 && (
              <span
                className={cn(
                  "font-mono text-[11px]",
                  item.active
                    ? "text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        ))}
      </nav>

      <Separator className="my-3" />

      {/* Tags */}
      <div className="px-2">
        <div className="mb-1 px-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Tags
        </div>
        {tags.map((tag) => (
          <button
            key={tag}
            className="flex w-full items-center gap-3 rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-accent"
          >
            <Tag className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="text-muted-foreground">{tag}</span>
          </button>
        ))}
      </div>

      <div className="flex-1" />

      <Separator />
      <div className="p-2">
        <button className="flex w-full items-center gap-3 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent">
          <Settings className="h-3.5 w-3.5" />
          <span>Settings</span>
        </button>
      </div>
    </div>
  );
}
