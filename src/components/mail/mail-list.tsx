import { useMemo } from "react";
import { Search, Star, Menu } from "lucide-react";
import { cn, relativeTime } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useMailStore } from "@/hooks/use-mail";
import { useConversations, type Conversation } from "@/lib/rooms";

function ConversationCard({
  conversation,
  selected,
  onSelect,
}: {
  conversation: Conversation;
  selected: boolean;
  onSelect: () => void;
}) {
  const lastMessage = conversation.messages[conversation.messages.length - 1];
  const ts = new Date(conversation.last_activity_ts);
  const senderLine =
    conversation.participants.map((p) => p.display_name).join(", ") ||
    "Empty room";

  return (
    <button
      onClick={onSelect}
      className={cn(
        "group relative flex w-full flex-col items-start gap-0.5 border-b border-border/60 px-4 py-3 text-left text-sm transition-colors",
        "hover:bg-accent/60",
        selected && "bg-selected hover:bg-selected",
      )}
    >
      <div className="flex w-full items-baseline justify-between gap-2">
        <div
          className={cn(
            "flex items-center gap-1.5 truncate",
            conversation.unread ? "font-semibold text-foreground" : "font-medium text-foreground/90",
          )}
        >
          {conversation.starred && (
            <Star className="h-3.5 w-3.5 shrink-0 fill-seal text-seal" />
          )}
          {conversation.unread && (
            <span aria-label="unread" className="h-1.5 w-1.5 shrink-0 rounded-full bg-seal" />
          )}
          <span className="truncate">{senderLine}</span>
        </div>
        <span
          className={cn(
            "shrink-0 font-mono text-[11px]",
            conversation.unread ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {relativeTime(ts)}
        </span>
      </div>

      <div
        className={cn(
          "w-full truncate text-[14px] leading-snug",
          conversation.unread ? "font-semibold" : "font-normal",
        )}
      >
        {conversation.subject}
      </div>

      <div className="line-clamp-1 w-full text-xs leading-relaxed text-muted-foreground">
        {lastMessage?.body || "—"}
      </div>

      {conversation.tags.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {conversation.tags.map((t) => (
            <Badge
              key={t}
              variant="outline"
              className="border-border/60 bg-transparent px-1.5 py-0 text-[9px] font-normal uppercase tracking-wider text-muted-foreground"
            >
              {t}
            </Badge>
          ))}
        </div>
      )}
    </button>
  );
}

export function MailList() {
  const selectedRoomId = useMailStore((s) => s.selectedRoomId);
  const setSelectedRoomId = useMailStore((s) => s.setSelectedRoomId);
  const folder = useMailStore((s) => s.folder);
  const setSidebarOpen = useMailStore((s) => s.setSidebarOpen);
  const setManageRoomsOpen = useMailStore((s) => s.setManageRoomsOpen);
  const all = useConversations();

  const filtered = useMemo(() => {
    if (folder === "starred") return all.filter((c) => c.starred);
    if (folder === "archive") return all.filter((c) => c.archived);
    return all.filter((c) => !c.archived);
  }, [all, folder]);

  const unread = filtered.filter((c) => c.unread);

  const folderTitle =
    folder === "starred" ? "Starred" : folder === "archive" ? "Archive" : "Inbox";

  const empty = filtered.length === 0;

  return (
    <Tabs defaultValue="all" className="flex h-full flex-col bg-background">
      <div className="flex items-center gap-2 px-2 pt-3 sm:px-4">
        <button
          aria-label="Open menu"
          onClick={() => setSidebarOpen(true)}
          className="rounded-full p-2 hover:bg-accent md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="flex-1 text-xl font-semibold tracking-tight">{folderTitle}</h1>
        <TabsList className="h-7 p-0.5">
          <TabsTrigger value="all" className="h-6 px-2 text-xs">
            All
          </TabsTrigger>
          <TabsTrigger value="unread" className="h-6 px-2 text-xs">
            Unread
          </TabsTrigger>
        </TabsList>
      </div>

      <div className="px-3 py-3 sm:px-4">
        <form>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search mail (Stage 5)"
              className="rounded-full bg-surface pl-9"
              disabled
            />
          </div>
        </form>
      </div>
      <Separator />

      <TabsContent value="all" className="m-0 flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div>
            {empty ? (
              <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
                <p className="text-sm text-muted-foreground">
                  No conversations in your hmail inbox yet.
                </p>
                <button
                  type="button"
                  onClick={() => setManageRoomsOpen(true)}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Adopt existing rooms…
                </button>
              </div>
            ) : (
              filtered.map((c) => (
                <ConversationCard
                  key={c.room_id}
                  conversation={c}
                  selected={c.room_id === selectedRoomId}
                  onSelect={() => setSelectedRoomId(c.room_id)}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </TabsContent>
      <TabsContent value="unread" className="m-0 flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div>
            {unread.length === 0 ? (
              <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                No unread.
              </div>
            ) : (
              unread.map((c) => (
                <ConversationCard
                  key={c.room_id}
                  conversation={c}
                  selected={c.room_id === selectedRoomId}
                  onSelect={() => setSelectedRoomId(c.room_id)}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </TabsContent>
    </Tabs>
  );
}
