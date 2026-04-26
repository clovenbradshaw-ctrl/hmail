import { useMemo, useState } from "react";
import {
  Star,
  Menu,
  RefreshCw,
  ChevronDown,
  Search,
  Paperclip,
  Inbox as InboxIcon,
} from "lucide-react";
import { cn, relativeTime } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMailStore } from "@/hooks/use-mail";
import {
  setStarred,
  useConversations,
  type Conversation,
} from "@/lib/rooms";

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

export function MailList() {
  const selectedRoomId = useMailStore((s) => s.selectedRoomId);
  const setSelectedRoomId = useMailStore((s) => s.setSelectedRoomId);
  const folder = useMailStore((s) => s.folder);
  const setSidebarOpen = useMailStore((s) => s.setSidebarOpen);
  const setManageRoomsOpen = useMailStore((s) => s.setManageRoomsOpen);
  const all = useConversations();

  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  const filtered = useMemo(() => {
    let list: Conversation[];
    if (folder === "starred") list = all.filter((c) => c.starred);
    else if (folder === "archive") list = all.filter((c) => c.archived);
    else list = all.filter((c) => !c.archived);
    if (showUnreadOnly) list = list.filter((c) => c.unread);
    return list;
  }, [all, folder, showUnreadOnly]);

  const total = filtered.length;
  const unreadCount = filtered.filter((c) => c.unread).length;

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
            placeholder="Search mail (soon)"
            disabled
            className="rounded-md border-0 bg-background pl-9 text-sm shadow-sm"
          />
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-1 border-b border-border bg-background px-2 py-1.5 sm:px-4">
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
            onClick={() => setShowUnreadOnly(false)}
            className={cn(
              "rounded px-2 py-1",
              !showUnreadOnly ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent",
            )}
          >
            All
          </button>
          <button
            onClick={() => setShowUnreadOnly(true)}
            className={cn(
              "rounded px-2 py-1",
              showUnreadOnly ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent",
            )}
          >
            Unread {unreadCount > 0 && `(${unreadCount})`}
          </button>
        </div>
        <span className="ml-auto font-mono text-[10px] text-muted-foreground">
          {total === 0 ? "0" : `1–${total} of ${total}`}
        </span>
      </div>

      {/* "Unread" pill row, only when unread */}
      {!showUnreadOnly && unreadCount > 0 && (
        <div className="border-b border-border bg-background px-4 py-1.5 text-[11px] font-bold text-foreground">
          Unread
        </div>
      )}

      <ScrollArea className="flex-1">
        {total === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
            <InboxIcon className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {folder === "archive"
                ? "Archive is empty."
                : folder === "starred"
                ? "No starred conversations."
                : "Your hmail inbox is empty."}
            </p>
            {folder === "inbox" && (
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
