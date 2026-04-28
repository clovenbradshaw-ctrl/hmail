import { useMemo, useState } from "react";
import {
  Star,
  Menu,
  RefreshCw,
  ChevronDown,
  Search,
  Paperclip,
  Inbox as InboxIcon,
  ArrowDownAZ,
  ArrowUpAZ,
  CalendarArrowDown,
  CalendarArrowUp,
  Mail,
  Tag,
  X,
  Filter,
} from "lucide-react";
import { cn, relativeTime } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMailStore, type SortKey } from "@/hooks/use-mail";
import {
  setStarred,
  useConversations,
  userTagLabel,
  type Conversation,
} from "@/lib/rooms";

const SORT_OPTIONS: { value: SortKey; label: string; Icon: typeof Mail }[] = [
  { value: "date-desc", label: "Newest first", Icon: CalendarArrowDown },
  { value: "date-asc", label: "Oldest first", Icon: CalendarArrowUp },
  { value: "sender", label: "Sender (A–Z)", Icon: ArrowDownAZ },
  { value: "subject", label: "Subject (A–Z)", Icon: ArrowUpAZ },
  { value: "unread-first", label: "Unread first", Icon: Mail },
];

function ConversationRow({
  conversation,
  selected,
  onSelect,
}: {
  conversation: Conversation;
  selected: boolean;
  onSelect: () => void;
}) {
  const [hover, setHover] = useState(false);
  const last = conversation.messages[conversation.messages.length - 1];
  const ts = new Date(conversation.last_activity_ts);
  const senderLine =
    conversation.participants.map((p) => p.display_name).join(", ") || "—";
  const hasAttachment = conversation.messages.some((m) => !!m.attachment);
  const userTags = conversation.tags.filter((t) => t.startsWith("u."));

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onSelect}
      className={cn(
        "flex h-9 cursor-pointer items-center gap-2 border-b border-border/50 px-2 text-[13px] transition-colors sm:px-4",
        conversation.unread ? "bg-background" : "bg-surface/40",
        hover && "shadow-[inset_0_0_0_9999px_hsl(var(--accent)/0.5)]",
        selected && "bg-selected hover:bg-selected",
      )}
    >
      {/* Star */}
      <button
        type="button"
        aria-label={conversation.starred ? "Unstar" : "Star"}
        onClick={(e) => {
          e.stopPropagation();
          void setStarred(conversation.room_id, !conversation.starred);
        }}
        className="shrink-0 p-1 text-muted-foreground hover:text-seal"
      >
        <Star
          className={cn(
            "h-3.5 w-3.5",
            conversation.starred && "fill-seal text-seal",
          )}
        />
      </button>

      {/* Sender */}
      <div
        className={cn(
          "w-32 shrink-0 truncate sm:w-44",
          conversation.unread ? "font-bold text-foreground" : "font-normal text-foreground/85",
        )}
      >
        {senderLine}
      </div>

      {/* Subject — snippet */}
      <div className="flex min-w-0 flex-1 items-baseline gap-2 truncate">
        <span
          className={cn(
            "truncate",
            conversation.unread ? "font-bold text-foreground" : "text-foreground/90",
          )}
        >
          {conversation.subject}
        </span>
        {userTags.length > 0 && (
          <span className="hidden shrink-0 items-center gap-1 sm:inline-flex">
            {userTags.slice(0, 3).map((t) => (
              <span
                key={t}
                className="inline-flex items-center rounded-sm border border-border/70 bg-surface px-1 text-[10px] font-medium text-muted-foreground"
              >
                {userTagLabel(t)}
              </span>
            ))}
          </span>
        )}
        {last?.body && (
          <span className="truncate text-muted-foreground">
            {" — "}
            {last.body}
          </span>
        )}
      </div>

      {hasAttachment && (
        <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground" />
      )}

      {/* Date */}
      <div
        className={cn(
          "w-14 shrink-0 text-right font-mono text-[11px]",
          conversation.unread ? "font-bold text-foreground" : "text-muted-foreground",
        )}
      >
        {relativeTime(ts)}
      </div>
    </div>
  );
}

function matchesSearch(c: Conversation, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  if (c.subject.toLowerCase().includes(needle)) return true;
  for (const p of c.participants) {
    if (p.display_name.toLowerCase().includes(needle)) return true;
    if (p.mxid.toLowerCase().includes(needle)) return true;
  }
  for (const m of c.messages) {
    if (m.body.toLowerCase().includes(needle)) return true;
  }
  for (const t of c.tags) {
    if (t.toLowerCase().includes(needle)) return true;
  }
  return false;
}

function compareConversations(a: Conversation, b: Conversation, sort: SortKey): number {
  switch (sort) {
    case "date-asc":
      return (
        new Date(a.last_activity_ts).getTime() -
        new Date(b.last_activity_ts).getTime()
      );
    case "sender": {
      const an = a.participants.map((p) => p.display_name).join(", ") || "";
      const bn = b.participants.map((p) => p.display_name).join(", ") || "";
      const cmp = an.localeCompare(bn, undefined, { sensitivity: "base" });
      if (cmp !== 0) return cmp;
      return (
        new Date(b.last_activity_ts).getTime() -
        new Date(a.last_activity_ts).getTime()
      );
    }
    case "subject": {
      const cmp = a.subject.localeCompare(b.subject, undefined, {
        sensitivity: "base",
      });
      if (cmp !== 0) return cmp;
      return (
        new Date(b.last_activity_ts).getTime() -
        new Date(a.last_activity_ts).getTime()
      );
    }
    case "unread-first": {
      const u = Number(b.unread) - Number(a.unread);
      if (u !== 0) return u;
      return (
        new Date(b.last_activity_ts).getTime() -
        new Date(a.last_activity_ts).getTime()
      );
    }
    case "date-desc":
    default:
      return (
        new Date(b.last_activity_ts).getTime() -
        new Date(a.last_activity_ts).getTime()
      );
  }
}

export function MailList() {
  const selectedRoomId = useMailStore((s) => s.selectedRoomId);
  const setSelectedRoomId = useMailStore((s) => s.setSelectedRoomId);
  const folder = useMailStore((s) => s.folder);
  const setSidebarOpen = useMailStore((s) => s.setSidebarOpen);
  const setManageRoomsOpen = useMailStore((s) => s.setManageRoomsOpen);
  const sortBy = useMailStore((s) => s.sortBy);
  const setSortBy = useMailStore((s) => s.setSortBy);
  const searchQuery = useMailStore((s) => s.searchQuery);
  const setSearchQuery = useMailStore((s) => s.setSearchQuery);
  const activeTag = useMailStore((s) => s.activeTag);
  const setActiveTag = useMailStore((s) => s.setActiveTag);
  const attachmentsOnly = useMailStore((s) => s.attachmentsOnly);
  const setAttachmentsOnly = useMailStore((s) => s.setAttachmentsOnly);
  const unreadOnly = useMailStore((s) => s.unreadOnly);
  const setUnreadOnly = useMailStore((s) => s.setUnreadOnly);
  const all = useConversations();

  const filtered = useMemo(() => {
    let list: Conversation[];
    if (folder === "starred") list = all.filter((c) => c.starred);
    else if (folder === "archive") list = all.filter((c) => c.archived);
    else if (folder === "groups")
      list = all.filter((c) => !c.archived && !c.dm_with_mxid);
    else list = all.filter((c) => !c.archived);
    if (unreadOnly) list = list.filter((c) => c.unread);
    if (attachmentsOnly)
      list = list.filter((c) => c.messages.some((m) => !!m.attachment));
    if (activeTag) list = list.filter((c) => c.tags.includes(activeTag));
    if (searchQuery.trim()) {
      const q = searchQuery.trim();
      list = list.filter((c) => matchesSearch(c, q));
    }
    list = [...list].sort((a, b) => compareConversations(a, b, sortBy));
    return list;
  }, [
    all,
    folder,
    unreadOnly,
    attachmentsOnly,
    activeTag,
    searchQuery,
    sortBy,
  ]);

  const total = filtered.length;
  const unreadCount = filtered.filter((c) => c.unread).length;
  const activeFilterCount =
    (unreadOnly ? 1 : 0) + (attachmentsOnly ? 1 : 0) + (activeTag ? 1 : 0);
  const sortMeta = SORT_OPTIONS.find((o) => o.value === sortBy);
  const SortIcon = sortMeta?.Icon ?? CalendarArrowDown;

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Top search */}
      <div className="flex items-center gap-2 border-b border-border bg-surface px-2 py-2 sm:px-4">
        <button
          aria-label="Open menu"
          onClick={() => setSidebarOpen(true)}
          className="rounded-full p-2 hover:bg-accent md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search subject, sender, body, tags…"
            className="rounded-md border-0 bg-background pl-9 pr-9 text-sm shadow-sm"
          />
          {searchQuery && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-accent"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b border-border bg-background px-2 py-1.5 sm:px-4">
        <button
          type="button"
          aria-label="Select all"
          className="flex items-center gap-1 rounded p-1.5 text-muted-foreground hover:bg-accent"
        >
          <input type="checkbox" disabled className="h-3.5 w-3.5" />
          <ChevronDown className="h-3 w-3" />
        </button>
        <button
          type="button"
          aria-label="Refresh"
          className="rounded p-1.5 text-muted-foreground hover:bg-accent"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
        <div className="ml-2 flex gap-1 text-[11px] font-medium">
          <button
            onClick={() => setUnreadOnly(false)}
            className={cn(
              "rounded px-2 py-1",
              !unreadOnly ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent",
            )}
          >
            All
          </button>
          <button
            onClick={() => setUnreadOnly(true)}
            className={cn(
              "rounded px-2 py-1",
              unreadOnly ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent",
            )}
          >
            Unread {unreadCount > 0 && `(${unreadCount})`}
          </button>
        </div>

        {/* Filter dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Filter"
              className={cn(
                "ml-1 inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium",
                activeFilterCount > 0
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-accent",
              )}
            >
              <Filter className="h-3 w-3" />
              <span>Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Filter
            </DropdownMenuLabel>
            <DropdownMenuCheckboxItem
              checked={unreadOnly}
              onCheckedChange={(v) => setUnreadOnly(!!v)}
            >
              Unread only
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={attachmentsOnly}
              onCheckedChange={(v) => setAttachmentsOnly(!!v)}
            >
              Has attachment
            </DropdownMenuCheckboxItem>
            {activeTag && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked
                  onCheckedChange={() => setActiveTag(null)}
                >
                  Tag: {userTagLabel(activeTag)}
                </DropdownMenuCheckboxItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Sort dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Sort"
              className="ml-1 inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-accent"
            >
              <SortIcon className="h-3 w-3" />
              <span className="hidden sm:inline">{sortMeta?.label ?? "Sort"}</span>
              <span className="sm:hidden">Sort</span>
              <ChevronDown className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Sort by
            </DropdownMenuLabel>
            {SORT_OPTIONS.map((opt) => (
              <DropdownMenuCheckboxItem
                key={opt.value}
                checked={sortBy === opt.value}
                onCheckedChange={() => setSortBy(opt.value)}
              >
                <opt.Icon className="mr-2 h-3.5 w-3.5" />
                {opt.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <span className="ml-auto font-mono text-[10px] text-muted-foreground">
          {total === 0 ? "0" : `1–${total} of ${total}`}
        </span>
      </div>

      {/* Active filter chips */}
      {(activeTag || attachmentsOnly || searchQuery.trim()) && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-border bg-surface/40 px-2 py-1.5 text-[11px] sm:px-4">
          {searchQuery.trim() && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 hover:bg-accent"
            >
              <Search className="h-3 w-3" />
              <span>"{searchQuery.trim()}"</span>
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
          {activeTag && (
            <button
              type="button"
              onClick={() => setActiveTag(null)}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 hover:bg-accent"
            >
              <Tag className="h-3 w-3" />
              <span>{userTagLabel(activeTag)}</span>
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
          {attachmentsOnly && (
            <button
              type="button"
              onClick={() => setAttachmentsOnly(false)}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 hover:bg-accent"
            >
              <Paperclip className="h-3 w-3" />
              <span>Has attachment</span>
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
        </div>
      )}

      <ScrollArea className="flex-1">
        {total === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
            <InboxIcon className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {searchQuery.trim() || activeTag || attachmentsOnly || unreadOnly
                ? "No conversations match these filters."
                : folder === "archive"
                ? "Archive is empty."
                : folder === "starred"
                ? "No starred conversations."
                : folder === "groups"
                ? "No group conversations yet."
                : "Your hmail inbox is empty."}
            </p>
            {folder === "groups" && !searchQuery.trim() && !activeTag && (
              <button
                type="button"
                onClick={() => setManageRoomsOpen(true)}
                className="text-sm font-medium text-primary hover:underline"
              >
                Adopt existing rooms…
              </button>
            )}
          </div>
        ) : (
          <div>
            {filtered.map((c) => (
              <ConversationRow
                key={c.room_id}
                conversation={c}
                selected={c.room_id === selectedRoomId}
                onSelect={() => setSelectedRoomId(c.room_id)}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
