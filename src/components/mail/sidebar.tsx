import {
  Inbox,
  Star,
  Send,
  FileText,
  Archive,
  Trash2,
  Tag,
  LogOut,
  ListChecks,
  Paperclip,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { useMailStore, type Folder } from "@/hooks/use-mail";
import {
  useContacts,
  useConversations,
  useMyMxid,
  userTagLabel,
} from "@/lib/rooms";
import { useMyDisplayName } from "@/lib/profile";
import { logout } from "@/lib/matrix";

interface NavItem {
  label: string;
  icon: typeof Inbox;
  count?: number;
  folder?: Folder;
  disabled?: boolean;
}

export function Sidebar() {
  const conversations = useConversations();
  const contacts = useContacts();
  const myMxid = useMyMxid();
  const myDisplayName = useMyDisplayName();
  const folder = useMailStore((s) => s.folder);
  const setFolder = useMailStore((s) => s.setFolder);
  const setComposeOpen = useMailStore((s) => s.setComposeOpen);
  const setManageRoomsOpen = useMailStore((s) => s.setManageRoomsOpen);
  const setProfileOpen = useMailStore((s) => s.setProfileOpen);
  const setSidebarOpen = useMailStore((s) => s.setSidebarOpen);
  const activeTag = useMailStore((s) => s.activeTag);
  const setActiveTag = useMailStore((s) => s.setActiveTag);

  const peopleUnread = contacts.filter((c) => c.unread_room_count > 0).length;
  const groupsUnread = conversations.filter(
    (c) => !c.archived && c.unread && !c.dm_with_mxid,
  ).length;
  const starredCount = conversations.filter((c) => c.starred).length;
  const archivedCount = conversations.filter((c) => c.archived).length;
  const mediaCount = conversations.reduce(
    (acc, c) =>
      acc + c.messages.filter((m) => !!m.attachment && !m.redacted).length,
    0,
  );

  const items: NavItem[] = [
    { label: "People", icon: Users, count: peopleUnread, folder: "people" },
    { label: "Groups", icon: Inbox, count: groupsUnread, folder: "groups" },
    { label: "Starred", icon: Star, count: starredCount, folder: "starred" },
    { label: "Sent", icon: Send, disabled: true },
    { label: "Drafts", icon: FileText, disabled: true },
    { label: "Archive", icon: Archive, count: archivedCount, folder: "archive" },
    { label: "Media", icon: Paperclip, count: mediaCount, folder: "media" },
    { label: "Trash", icon: Trash2, disabled: true },
  ];

  const tagSet = new Set<string>();
  for (const c of conversations)
    for (const t of c.tags) if (t.startsWith("u.")) tagSet.add(t);
  const tags = Array.from(tagSet).sort((a, b) =>
    userTagLabel(a).localeCompare(userTagLabel(b), undefined, { sensitivity: "base" }),
  );

  const localpart = myMxid?.match(/^@([^:]+):/)?.[1] ?? myMxid ?? "";
  const domain = myMxid?.match(/:(.+)$/)?.[1] ?? "";

  return (
    <div className="flex h-full flex-col bg-surface">
      {/* Brand + identity (click to edit name) */}
      <button
        type="button"
        onClick={() => {
          setProfileOpen(true);
          setSidebarOpen(false);
        }}
        className="flex items-center gap-2 px-5 py-4 text-left transition hover:bg-accent"
        aria-label="Edit your profile"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded bg-seal text-seal-foreground">
          <span className="font-display text-sm font-bold italic">h</span>
        </div>
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-sm font-semibold tracking-tight">
            {myDisplayName || "Set your name"}
          </span>
          <span className="truncate font-mono text-[10px] text-muted-foreground">
            @{localpart}
            {domain && <>:{domain}</>}
          </span>
        </div>
      </button>

      {/* Compose */}
      <div className="px-4 pb-4">
        <button
          onClick={() => {
            setComposeOpen(true);
            setSidebarOpen(false);
          }}
          className="w-full rounded-sm bg-seal px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-seal-foreground shadow-sm transition hover:brightness-95"
        >
          Compose
        </button>
      </div>

      {/* Folders */}
      <nav>
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
                "flex w-full items-center justify-between border-l-2 border-transparent py-1.5 pl-5 pr-4 text-[13px] transition",
                "hover:bg-accent",
                active &&
                  "border-l-seal bg-accent font-bold text-seal hover:bg-accent",
                item.disabled && "opacity-40 hover:bg-transparent",
              )}
            >
              <span className="flex items-center gap-3">
                <item.icon className="h-3.5 w-3.5 shrink-0" />
                <span>
                  {item.label}
                  {item.count !== undefined && item.count > 0 && (
                    <span className={cn("ml-1", active ? "" : "text-muted-foreground")}>
                      ({item.count})
                    </span>
                  )}
                </span>
              </span>
            </button>
          );
        })}
        <button
          onClick={() => {
            setManageRoomsOpen(true);
            setSidebarOpen(false);
          }}
          className="flex w-full items-center gap-3 border-l-2 border-transparent py-1.5 pl-5 pr-4 text-[13px] text-muted-foreground transition hover:bg-accent hover:text-foreground"
        >
          <ListChecks className="h-3.5 w-3.5 shrink-0" />
          <span>Manage rooms…</span>
        </button>
      </nav>

      {tags.length > 0 && (
        <>
          <Separator className="my-3" />
          <div>
            <div className="px-5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Labels
            </div>
            {tags.map((tag) => {
              const active = activeTag === tag;
              const count = conversations.filter((c) => c.tags.includes(tag)).length;
              return (
                <button
                  key={tag}
                  onClick={() => {
                    setActiveTag(active ? null : tag);
                    setSidebarOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between border-l-2 border-transparent py-1 pl-5 pr-4 text-[13px] transition hover:bg-accent",
                    active
                      ? "border-l-seal bg-accent font-bold text-seal hover:bg-accent"
                      : "text-foreground/85",
                  )}
                >
                  <span className="flex items-center gap-3">
                    <Tag className="h-3 w-3 shrink-0" />
                    <span>{userTagLabel(tag)}</span>
                  </span>
                  {count > 0 && (
                    <span
                      className={cn(
                        "ml-1 text-[11px]",
                        active ? "" : "text-muted-foreground",
                      )}
                    >
                      ({count})
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}

      <div className="flex-1" />

      <Separator />
      <button
        onClick={() => void logout()}
        className="flex w-full items-center gap-3 px-5 py-2 text-[12px] text-muted-foreground transition hover:bg-accent"
      >
        <LogOut className="h-3 w-3" />
        <span>Sign out</span>
      </button>
    </div>
  );
}
