import { useMemo } from "react";
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
  MOCK_CONVERSATIONS,
  type MockMessage,
  type MockSender,
} from "@/lib/mock-data";

function MessageBlock({
  message,
  isYou,
}: {
  message: MockMessage;
  isYou: boolean;
}) {
  return (
    <article className="group relative flex gap-4 px-6 py-5 transition-colors hover:bg-muted/30">
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
            {/* Verification badge — green if cross-signing trust chains.
                Phase 0 is mock; in Phase 4 the real flag drives this. */}
            {!isYou && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <ShieldCheck className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                </TooltipTrigger>
                <TooltipContent>
                  Device unverified · Phase 4 will let you verify
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

        <div className="mt-2 whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground/90">
          {message.body}
        </div>

        {/* Per-message actions, revealed on hover. */}
        <div className="mt-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2 text-xs text-muted-foreground"
          >
            <Reply className="h-3 w-3" />
            Reply
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2 text-xs text-muted-foreground"
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
  const conversation = useMemo(
    () => MOCK_CONVERSATIONS.find((c) => c.room_id === selectedRoomId),
    [selectedRoomId],
  );

  if (!conversation) {
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

  const yourMxid = "@you:hyphae.intelechia.com";
  const otherParticipants: MockSender[] = conversation.participants;

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Conversation header */}
      <div className="flex items-start justify-between gap-4 px-6 py-4">
        <div className="flex flex-col gap-1 min-w-0">
          <h1 className="font-display text-2xl font-medium leading-tight tracking-tight">
            {conversation.subject}
          </h1>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              with {otherParticipants.map((p) => p.display_name).join(", ")}
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
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Star
                  className={
                    conversation.starred
                      ? "h-4 w-4 fill-seal text-seal"
                      : "h-4 w-4"
                  }
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Star</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Archive className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Archive</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Move to trash</TooltipContent>
          </Tooltip>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Mark as unread</DropdownMenuItem>
              <DropdownMenuItem>Mute conversation</DropdownMenuItem>
              <DropdownMenuItem>Add tag</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive">
                Leave conversation
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Separator />

      {/* Messages */}
      <ScrollArea className="flex-1">
        <div className="divide-y divide-border/40">
          {conversation.messages.map((m) => (
            <MessageBlock
              key={m.event_id}
              message={m}
              isYou={m.sender.mxid === yourMxid}
            />
          ))}
        </div>
      </ScrollArea>

      <Separator />

      {/* Reply composer placeholder */}
      <div className="px-6 py-4">
        <button
          className="flex w-full items-center gap-3 rounded-md border border-input bg-background px-4 py-3 text-left text-sm text-muted-foreground transition-colors hover:border-ring/40 hover:bg-accent/30"
          aria-label="Reply"
        >
          <PenLine className="h-3.5 w-3.5" />
          <span>Reply to {otherParticipants[0]?.display_name ?? "this conversation"}…</span>
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
