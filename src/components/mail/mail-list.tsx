import { useMemo } from "react";
import { Search, Star } from "lucide-react";
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
    conversation.participants.map((p) => p.display_name).join(", ") || "Empty room";

  return (
    <button
      onClick={onSelect}
      className={cn(
        "group relative flex w-full flex-col items-start gap-1 border-b border-border/60 px-4 py-3 text-left text-sm transition-colors",
        "hover:bg-accent/40",
        selected && "bg-accent/70 hover:bg-accent/70",
      )}
    >
      {conversation.unread && (
        <span
          aria-label="unread"
          className="absolute left-1.5 top-5 h-1.5 w-1.5 rounded-full bg-seal"
        />
      )}

      <div className="flex w-full items-baseline justify-between gap-2">
        <div
          className={cn(
            "flex items-center gap-1.5 truncate",
            conversation.unread ? "font-semibold" : "font-medium",
          )}
        >
          {conversation.starred && (
            <Star className="h-3 w-3 shrink-0 fill-seal text-seal" />
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
          "w-full truncate font-display text-[15px] leading-snug",
          conversation.unread ? "text-foreground" : "text-foreground/90",
        )}
      >
        {conversation.subject}
      </div>

      <div className="line-clamp-2 w-full text-xs leading-relaxed text-muted-foreground">
        {lastMessage?.body || "—"}
      </div>

      {conversation.tags.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {conversation.tags.map((t) => (
            <Badge
              key={t}
              variant="outline"
              className="border-border/60 bg-transparent px-1.5 py-0 font-mono text-[9px] font-normal uppercase tracking-wider text-muted-foreground"
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
  const all = useConversations();

  const filtered = useMemo(() => {
    if (folder === "starred") return all.filter((c) => c.starred);
    if (folder === "archive") return all.filter((c) => c.archived);
    return all.filter((c) => !c.archived);
  }, [all, folder]);

  const unread = filtered.filter((c) => c.unread);

  const folderTitle =
    folder === "starred" ? "Starred" : folder === "archive" ? "Archive" : "Inbox";

  return (
    <Tabs defaultValue="all" className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 px-4 pt-4">
        <h1 className="font-display text-xl font-medium tracking-tight">
          {folderTitle}
        </h1>
        <TabsList className="h-7 p-0.5">
          <TabsTrigger value="all" className="h-6 px-2 text-xs">
            All
          </TabsTrigger>
          <TabsTrigger value="unread" className="h-6 px-2 text-xs">
            Unread
          </TabsTrigger>
        </TabsList>
      </div>

      <div className="px-4 py-3">
        <form>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search conversations…"
              className="pl-8 font-sans"
              disabled
            />
          </div>
        </form>
      </div>
      <Separator />

      <TabsContent value="all" className="m-0 flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div>
            {filtered.length === 0 ? (
              <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                No conversations.
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
