import { useEffect, useMemo } from "react";
import {
  Archive,
  Star,
  Reply,
  ReplyAll,
  Forward,
  Trash2,
  MoreHorizontal,
  ShieldCheck,
  PenLine,
  Smile,
  ArchiveRestore,
} from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMailStore } from "@/hooks/use-mail";
import {
  markRoomRead,
  setArchived,
  setStarred,
  useConversation,
  useMyMxid,
  type Message,
} from "@/lib/rooms";

function MessageBlock({
  message,
  isYou,
  indent,
}: {
  message: Message;
  isYou: boolean;
  indent?: boolean;
}) {
  const muted = message.decryption_failed || message.redacted;
  return (
    <article
      className={
        "group relative flex gap-4 px-6 py-5 transition-colors hover:bg-muted/30 " +
        (indent ? "pl-14 border-l-2 border-border/40" : "")
      }
    >
      <Avatar className="h-9 w-9 shrink-0">
        <AvatarFallback
          className={
            isYou
              ? "bg-primary text-primary-foreground font-mono text-[11px]"
              : "bg-muted text-foreground font-mono text-[11px]"
          }
        >
          {message.sender.monogram}
        </AvatarFallback>
      </Avatar>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-baseline justify-between gap-3">
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="font-display text-[15px] font-medium leading-tight">
              {message.sender.display_name}
            </span>
            <span className="truncate font-mono text-[10px] text-muted-foreground">
              {message.sender.mxid}
            </span>
            {!isYou && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <ShieldCheck className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                </TooltipTrigger>
                <TooltipContent>
                  Device unverified · verification UI lands in Stage 4
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          <time
            className="shrink-0 font-mono text-[10px] text-muted-foreground"
            dateTime={message.ts}
          >
            {format(new Date(message.ts), "MMM d · h:mm a")}
          </time>
        </header>

        <div
          className={
            "mt-2 whitespace-pre-wrap font-sans text-sm leading-relaxed " +
            (muted ? "italic text-muted-foreground" : "text-foreground/90")
          }
        >
          {message.body}
        </div>

        <div className="mt-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2 text-xs text-muted-foreground"
            disabled
          >
            <Reply className="h-3 w-3" />
            Reply
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2 text-xs text-muted-foreground"
            disabled
          >
            <Smile className="h-3 w-3" />
            React
          </Button>
        </div>
      </div>
    </article>
  );
}

export function MailDisplay() {
  const selectedRoomId = useMailStore((s) => s.selectedRoomId);
  const conversation = useConversation(selectedRoomId);
  const myMxid = useMyMxid();

  // Mark-as-read on selection.
  useEffect(() => {
    if (selectedRoomId) {
      void markRoomRead(selectedRoomId);
    }
  }, [selectedRoomId, conversation?.last_activity_ts]);

  const grouped = useMemo(() => {
    if (!conversation) return null;
    const messages = conversation.messages;
    if (messages.length === 0) return { root: null, replies: [] as Message[], extras: [] as Message[] };
    const root = messages.find((m) => !m.is_thread_reply) ?? messages[0];
    const replies = messages.filter(
      (m) => m.is_thread_reply && m.thread_root === root.event_id,
    );
    const extras = messages.filter(
      (m) =>
        m.event_id !== root.event_id &&
        !(m.is_thread_reply && m.thread_root === root.event_id),
    );
    return { root, replies, extras };
  }, [conversation]);

  if (!conversation || !grouped) {
    return (
      <div className="flex h-full items-center justify-center bg-background paper-grain">
        <div className="text-center">
          <div className="font-display text-4xl italic text-muted-foreground/40">
            h
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Select a conversation
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-start justify-between gap-4 px-6 py-4">
        <div className="flex flex-col gap-1 min-w-0">
          <h1 className="font-display text-2xl font-medium leading-tight tracking-tight">
            {conversation.subject}
          </h1>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              with{" "}
              {conversation.participants.map((p) => p.display_name).join(", ") ||
                "no one yet"}
            </span>
            <span>·</span>
            <span className="font-mono">
              {conversation.messages.length}{" "}
              {conversation.messages.length === 1 ? "message" : "messages"}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setStarred(conversation.room_id, !conversation.starred)}
              >
                <Star
                  className={
                    conversation.starred
                      ? "h-4 w-4 fill-seal text-seal"
                      : "h-4 w-4"
                  }
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {conversation.starred ? "Unstar" : "Star"}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() =>
                  setArchived(conversation.room_id, !conversation.archived)
                }
              >
                {conversation.archived ? (
                  <ArchiveRestore className="h-4 w-4" />
                ) : (
                  <Archive className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {conversation.archived ? "Restore from archive" : "Archive"}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" disabled>
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Move to trash · Stage 3</TooltipContent>
          </Tooltip>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled>Mark as unread</DropdownMenuItem>
              <DropdownMenuItem disabled>Mute conversation</DropdownMenuItem>
              <DropdownMenuItem disabled>Add tag</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                disabled
              >
                Leave conversation
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Separator />

      <ScrollArea className="flex-1">
        <div className="divide-y divide-border/40">
          {grouped.root && (
            <MessageBlock
              key={grouped.root.event_id}
              message={grouped.root}
              isYou={grouped.root.sender.mxid === myMxid}
            />
          )}
          {grouped.replies.length > 0 && (
            <div className="bg-muted/10">
              <div className="px-6 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Thread · {grouped.replies.length}
              </div>
              {grouped.replies.map((m) => (
                <MessageBlock
                  key={m.event_id}
                  message={m}
                  isYou={m.sender.mxid === myMxid}
                  indent
                />
              ))}
            </div>
          )}
          {grouped.extras.map((m) => (
            <MessageBlock
              key={m.event_id}
              message={m}
              isYou={m.sender.mxid === myMxid}
            />
          ))}
        </div>
      </ScrollArea>

      <Separator />

      <div className="px-6 py-4">
        <button
          className="flex w-full items-center gap-3 rounded-md border border-input bg-background px-4 py-3 text-left text-sm text-muted-foreground transition-colors hover:border-ring/40 hover:bg-accent/30"
          aria-label="Reply"
          disabled
        >
          <PenLine className="h-3.5 w-3.5" />
          <span>Reply · Stage 2</span>
          <span className="ml-auto flex items-center gap-1.5 font-mono text-[10px]">
            <span className="rounded border border-border/60 bg-muted/40 px-1.5 py-0.5">
              R
            </span>
            <span>to reply</span>
          </span>
        </button>
        <div className="mt-2 flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="font-mono">⌘↵</span>
            <span>send</span>
          </span>
          <span>·</span>
          <span className="flex items-center gap-1.5">
            <span className="font-mono">A</span>
            <span>reply all</span>
          </span>
          <span>·</span>
          <span className="flex items-center gap-1.5">
            <Forward className="h-2.5 w-2.5" />
            <span className="font-mono">F</span>
            <span>forward</span>
          </span>
          <span className="ml-auto flex items-center gap-1.5">
            <ReplyAll className="h-2.5 w-2.5 opacity-0" />
          </span>
        </div>
      </div>
    </div>
  );
}
