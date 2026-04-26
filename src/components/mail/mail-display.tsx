import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  Star,
  ArrowLeft,
  ReplyAll,
  Forward,
  MoreHorizontal,
  Smile,
  ArchiveRestore,
  Pencil,
  Eraser,
  Clock,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
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
  editMessage,
  markRoomRead,
  retractMessage,
  sendThreadReply,
  setArchived,
  setStarred,
  toggleReaction,
  useConversation,
  useMyMxid,
  type Message,
} from "@/lib/rooms";

const REACTION_PALETTE = ["👍", "❤️", "😂", "🎉", "🤔", "🙏"];

function StatusPill({ status }: { status: Message["status"] }) {
  if (status === "sending") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
        <Loader2 className="h-2.5 w-2.5 animate-spin" /> sending
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-mono text-destructive">
        <AlertCircle className="h-2.5 w-2.5" /> failed
      </span>
    );
  }
  return null;
}

function ReactionRow({
  message,
  roomId,
}: {
  message: Message;
  roomId: string;
}) {
  if (message.reactions.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {message.reactions.map((r) => (
        <button
          key={r.key}
          onClick={() => void toggleReaction(roomId, message.event_id, r.key, r)}
          className={cn(
            "flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition",
            r.mine
              ? "border-primary bg-selected text-selected-foreground"
              : "border-border bg-background text-foreground hover:bg-accent",
          )}
        >
          <span>{r.key}</span>
          <span className="font-mono text-[10px]">{r.count}</span>
        </button>
      ))}
    </div>
  );
}

function EmojiPalette({
  onPick,
}: {
  onPick: (emoji: string) => void;
}) {
  return (
    <div className="flex gap-1">
      {REACTION_PALETTE.map((e) => (
        <button
          key={e}
          type="button"
          onClick={() => onPick(e)}
          className="rounded p-1 text-base hover:bg-accent"
        >
          {e}
        </button>
      ))}
    </div>
  );
}

function LifecyclePopover({ message }: { message: Message }) {
  return (
    <div className="w-72 rounded-md border border-border bg-popover p-3 text-sm shadow-md">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Lifecycle
      </div>
      <ul className="space-y-1.5">
        <li className="flex items-baseline justify-between gap-2">
          <span>sent</span>
          <span className="font-mono text-[10px] text-muted-foreground">
            {format(new Date(message.ts), "MMM d · h:mm a")}
          </span>
        </li>
        {message.edits.map((e, i) => (
          <li key={i} className="flex items-baseline justify-between gap-2">
            <span>edited</span>
            <span className="font-mono text-[10px] text-muted-foreground">
              {format(new Date(e.ts), "MMM d · h:mm a")}
            </span>
          </li>
        ))}
        {message.redacted && (
          <li className="flex items-baseline justify-between gap-2">
            <span>retracted</span>
            <span className="font-mono text-[10px] text-muted-foreground">—</span>
          </li>
        )}
      </ul>
    </div>
  );
}

function MessageBlock({
  message,
  roomId,
  isYou,
  indent,
}: {
  message: Message;
  roomId: string;
  isYou: boolean;
  indent?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.body);
  const [showReact, setShowReact] = useState(false);
  const muted = message.decryption_failed || message.redacted;

  async function commitEdit() {
    if (draft.trim() && draft !== message.body) {
      await editMessage(roomId, message.event_id, draft.trim());
    }
    setEditing(false);
  }

  function onRetract() {
    if (window.confirm("Retract this message? Other clients will see a placeholder.")) {
      void retractMessage(roomId, message.event_id);
    }
  }

  return (
    <article
      className={cn(
        "group relative flex gap-3 px-4 py-4 transition-colors hover:bg-accent/30 sm:gap-4 sm:px-6 sm:py-5",
        indent && "border-l-2 border-border/40 pl-8 sm:pl-14",
      )}
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
            <span className="text-[15px] font-semibold leading-tight">
              {message.sender.display_name}
            </span>
            <span className="hidden truncate font-mono text-[10px] text-muted-foreground sm:inline">
              {message.sender.mxid}
            </span>
            {message.edited && (
              <span className="text-[10px] text-muted-foreground">(edited)</span>
            )}
            <StatusPill status={message.status} />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Lifecycle"
                  className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100"
                >
                  <Clock className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="p-0">
                <LifecyclePopover message={message} />
              </DropdownMenuContent>
            </DropdownMenu>
            <time
              className="font-mono text-[10px] text-muted-foreground"
              dateTime={message.ts}
            >
              {format(new Date(message.ts), "MMM d · h:mm a")}
            </time>
          </div>
        </header>

        {editing ? (
          <div className="mt-2 flex flex-col gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={() => void commitEdit()}>
                Save
              </Button>
            </div>
          </div>
        ) : (
          <div
            className={cn(
              "mt-2 whitespace-pre-wrap text-sm leading-relaxed",
              muted ? "italic text-muted-foreground" : "text-foreground/90",
            )}
          >
            {message.body}
          </div>
        )}

        <ReactionRow message={message} roomId={roomId} />

        {!editing && !muted && (
          <div className="mt-2 flex flex-wrap items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            {showReact ? (
              <EmojiPalette
                onPick={(emoji) => {
                  const existing = message.reactions.find((r) => r.key === emoji);
                  void toggleReaction(roomId, message.event_id, emoji, existing);
                  setShowReact(false);
                }}
              />
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 px-2 text-xs text-muted-foreground"
                onClick={() => setShowReact(true)}
              >
                <Smile className="h-3 w-3" />
                React
              </Button>
            )}
            {isYou && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 px-2 text-xs text-muted-foreground"
                  onClick={() => {
                    setDraft(message.body);
                    setEditing(true);
                  }}
                >
                  <Pencil className="h-3 w-3" />
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 px-2 text-xs text-muted-foreground"
                  onClick={onRetract}
                >
                  <Eraser className="h-3 w-3" />
                  Retract
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function ReplyComposer({ roomId }: { roomId: string }) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  // Auto-grow.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 240) + "px";
  }, [body]);

  async function send() {
    const text = body.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      await sendThreadReply(roomId, text);
      setBody("");
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void send();
    }
  }

  return (
    <div className="border-t border-border bg-surface/50 px-3 py-3 sm:px-6">
      <div className="flex items-end gap-2 rounded-2xl border border-border bg-background px-3 py-2 shadow-sm focus-within:border-primary">
        <textarea
          ref={ref}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder="Reply…"
          className="min-h-[36px] flex-1 resize-none border-0 bg-transparent text-sm focus:outline-none"
          disabled={busy}
        />
        <Button
          size="sm"
          onClick={() => void send()}
          disabled={busy || !body.trim()}
          className="rounded-full"
        >
          {busy ? "…" : "Send"}
        </Button>
      </div>
      <div className="mt-1 px-1 text-[10px] text-muted-foreground">
        ⌘↵ to send · replies are threaded
      </div>
    </div>
  );
}

export function MailDisplay() {
  const selectedRoomId = useMailStore((s) => s.selectedRoomId);
  const setSelectedRoomId = useMailStore((s) => s.setSelectedRoomId);
  const conversation = useConversation(selectedRoomId);
  const myMxid = useMyMxid();

  useEffect(() => {
    if (selectedRoomId) {
      void markRoomRead(selectedRoomId);
    }
  }, [selectedRoomId, conversation?.last_activity_ts]);

  const grouped = useMemo(() => {
    if (!conversation) return null;
    const messages = conversation.messages;
    if (messages.length === 0)
      return { root: null as Message | null, replies: [] as Message[], extras: [] as Message[] };
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
      <div className="hidden h-full items-center justify-center bg-background md:flex">
        <div className="text-center">
          <div className="text-4xl italic text-muted-foreground/40">h</div>
          <p className="mt-2 text-sm text-muted-foreground">
            Select a conversation
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-start justify-between gap-3 px-3 py-3 sm:px-6 sm:py-4">
        <div className="flex min-w-0 items-start gap-2">
          <button
            aria-label="Back"
            onClick={() => setSelectedRoomId(null)}
            className="rounded-full p-2 hover:bg-accent md:hidden"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="truncate text-xl font-semibold leading-tight tracking-tight sm:text-2xl">
              {conversation.subject}
            </h1>
            <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
              <span className="truncate">
                with{" "}
                {conversation.participants
                  .map((p) => p.display_name)
                  .join(", ") || "no one yet"}
              </span>
              <span>·</span>
              <span className="font-mono">
                {conversation.messages.length}{" "}
                {conversation.messages.length === 1 ? "message" : "messages"}
              </span>
            </div>
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
              {conversation.archived ? "Restore" : "Archive"}
            </TooltipContent>
          </Tooltip>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled>
                <ReplyAll className="mr-2 h-3.5 w-3.5" /> Reply all · Stage 2
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                <Forward className="mr-2 h-3.5 w-3.5" /> Forward · Stage 2
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled>Mute conversation</DropdownMenuItem>
              <DropdownMenuItem disabled className="text-destructive focus:text-destructive">
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
              roomId={conversation.room_id}
              isYou={grouped.root.sender.mxid === myMxid}
            />
          )}
          {grouped.replies.length > 0 && (
            <div className="bg-muted/20">
              <div className="px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground sm:px-6">
                Thread · {grouped.replies.length}
              </div>
              {grouped.replies.map((m) => (
                <MessageBlock
                  key={m.event_id}
                  message={m}
                  roomId={conversation.room_id}
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
              roomId={conversation.room_id}
              isYou={m.sender.mxid === myMxid}
            />
          ))}
        </div>
      </ScrollArea>

      <ReplyComposer roomId={conversation.room_id} />
    </div>
  );
}
