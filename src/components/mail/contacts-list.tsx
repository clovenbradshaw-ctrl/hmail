import { useMemo, useState } from "react";
import {
  Menu,
  RefreshCw,
  ChevronDown,
  Search,
  Inbox as InboxIcon,
  ArrowDownAZ,
  CalendarArrowDown,
  Mail,
  X,
  Filter,
  Users,
} from "lucide-react";
import { cn, relativeTime } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMailStore } from "@/hooks/use-mail";
import { useContacts, type ContactSummary } from "@/lib/rooms";

type ContactSort = "recent" | "name" | "unread-first";

const SORT_OPTIONS: { value: ContactSort; label: string; Icon: typeof Mail }[] = [
  { value: "recent", label: "Most recent", Icon: CalendarArrowDown },
  { value: "name", label: "Name (A–Z)", Icon: ArrowDownAZ },
  { value: "unread-first", label: "Unread first", Icon: Mail },
];

function ContactRow({
  contact,
  onSelect,
}: {
  contact: ContactSummary;
  onSelect: () => void;
}) {
  const [hover, setHover] = useState(false);
  const ts = contact.last_message_ts ? new Date(contact.last_message_ts) : null;
  const unread = contact.unread_room_count > 0;
  const snippet = contact.last_message_snippet || "No messages yet";
  const showRoomTag =
    !!contact.last_message_room_subject && !contact.last_message_is_dm;

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onSelect}
      className={cn(
        "flex cursor-pointer items-start gap-3 border-b border-border/50 px-3 py-3 text-[13px] transition-colors sm:px-4",
        unread ? "bg-background" : "bg-surface/40",
        hover && "shadow-[inset_0_0_0_9999px_hsl(var(--accent)/0.5)]",
      )}
    >
      <Avatar className="mt-0.5 h-9 w-9 shrink-0">
        <AvatarFallback className="bg-muted font-mono text-[11px]">
          {contact.monogram}
        </AvatarFallback>
      </Avatar>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-baseline gap-2">
          <span
            className={cn(
              "min-w-0 flex-1 truncate",
              unread ? "font-bold text-foreground" : "font-medium text-foreground/90",
            )}
          >
            {contact.display_name}
          </span>
          {ts && (
            <span
              className={cn(
                "shrink-0 font-mono text-[11px]",
                unread ? "font-bold text-foreground" : "text-muted-foreground",
              )}
            >
              {relativeTime(ts)}
            </span>
          )}
        </div>

        <div className="flex items-baseline gap-2">
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-[12px]",
              unread ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {contact.last_message_is_mine && (
              <span className="text-muted-foreground">you: </span>
            )}
            {snippet}
          </span>
          {unread && (
            <span className="shrink-0 rounded-full bg-seal px-1.5 py-0.5 font-mono text-[10px] font-bold text-seal-foreground">
              {contact.unread_room_count}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="truncate font-mono">{contact.mxid}</span>
          {showRoomTag && (
            <>
              <span>·</span>
              <span className="inline-flex shrink-0 items-center gap-1 truncate">
                <Users className="h-3 w-3" />
                in {contact.last_message_room_subject}
              </span>
            </>
          )}
          {contact.shared_room_ids.length > 1 && (
            <>
              <span>·</span>
              <span className="shrink-0">
                {contact.shared_room_ids.length} shared rooms
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function matchesSearch(c: ContactSummary, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  if (c.display_name.toLowerCase().includes(needle)) return true;
  if (c.mxid.toLowerCase().includes(needle)) return true;
  if (c.last_message_snippet.toLowerCase().includes(needle)) return true;
  if (c.last_message_room_subject.toLowerCase().includes(needle)) return true;
  return false;
}

function compareContacts(a: ContactSummary, b: ContactSummary, sort: ContactSort): number {
  switch (sort) {
    case "name":
      return a.display_name.localeCompare(b.display_name, undefined, {
        sensitivity: "base",
      });
    case "unread-first": {
      const u = Number(b.unread_room_count > 0) - Number(a.unread_room_count > 0);
      if (u !== 0) return u;
      if (a.last_message_ts === b.last_message_ts) return 0;
      return a.last_message_ts < b.last_message_ts ? 1 : -1;
    }
    case "recent":
    default:
      if (a.last_message_ts === b.last_message_ts) return 0;
      return a.last_message_ts < b.last_message_ts ? 1 : -1;
  }
}

export function ContactsList() {
  const setPersonViewMxid = useMailStore((s) => s.setPersonViewMxid);
  const setSidebarOpen = useMailStore((s) => s.setSidebarOpen);
  const setManageRoomsOpen = useMailStore((s) => s.setManageRoomsOpen);
  const searchQuery = useMailStore((s) => s.searchQuery);
  const setSearchQuery = useMailStore((s) => s.setSearchQuery);
  const unreadOnly = useMailStore((s) => s.unreadOnly);
  const setUnreadOnly = useMailStore((s) => s.setUnreadOnly);
  const contacts = useContacts();
  const [sortBy, setSortBy] = useState<ContactSort>("recent");

  const filtered = useMemo(() => {
    let list = contacts;
    if (unreadOnly) list = list.filter((c) => c.unread_room_count > 0);
    if (searchQuery.trim()) {
      const q = searchQuery.trim();
      list = list.filter((c) => matchesSearch(c, q));
    }
    return [...list].sort((a, b) => compareContacts(a, b, sortBy));
  }, [contacts, unreadOnly, searchQuery, sortBy]);

  const total = filtered.length;
  const unreadCount = filtered.filter((c) => c.unread_room_count > 0).length;
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
            placeholder="Search people, snippets, rooms…"
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

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Filter"
              className={cn(
                "ml-1 inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium",
                unreadOnly
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-accent",
              )}
            >
              <Filter className="h-3 w-3" />
              <span>Filter{unreadOnly ? " (1)" : ""}</span>
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
          </DropdownMenuContent>
        </DropdownMenu>

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
          {total === 0 ? "0" : `${total} ${total === 1 ? "person" : "people"}`}
        </span>
      </div>

      <ScrollArea className="flex-1">
        {total === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
            <InboxIcon className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {searchQuery.trim() || unreadOnly
                ? "No people match these filters."
                : "You're not yet sharing a room with anyone."}
            </p>
            {!searchQuery.trim() && !unreadOnly && (
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
              <ContactRow
                key={c.mxid}
                contact={c}
                onSelect={() => setPersonViewMxid(c.mxid)}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
