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
  Reply,
  Paperclip,
  Send,
  X,
  FileIcon,
  Download,
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
  sendAttachment,
  setArchived,
  setStarred,
  toggleReaction,
  useConfirmState,
  useConversation,
  useMyMxid,
  type Message,
  type Attachment,
} from "@/lib/rooms";
import { VerifyBanner } from "@/components/mail/verify-banner";

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

function AttachmentBlock({ attachment }: { attachment: Attachment }) {
  if (attachment.kind === "image" && attachment.url) {
    return (
      <a
        href={attachment.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-block max-w-md overflow-hidden rounded-lg border border-border"
      >
        <img
          src={attachment.url}
          alt={attachment.name}
          className="block max-h-80 w-auto"
          loading="lazy"
        />
      </a>
    );
  }
  return (
    <a
      href={attachment.url ?? "#"}
      target="_blank"
      rel="noopener noreferrer"
      download={attachment.name}
      className="mt-2 inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm hover:bg-accent"
    >
      <FileIcon className="h-4 w-4 text-muted-foreground" />
      <span className="font-medium">{attachment.name}</span>
      {attachment.size && (
        <span className="font-mono text-[10px] text-muted-foreground">
          {Math.round(attachment.size / 1024)} kB
        </span>
      )}
      <Download className="ml-1 h-3.5 w-3.5 text-muted-foreground" />
    </a>
  );
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

function EmojiPalette({ onPick }: { onPick: (emoji: string) => void }) {
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

function MessageCard({
  message,
  roomId,
  isYou,
  collapsed,
  onToggleCollapsed,
}: {
  message: Message;
  roomId: string;
  isYou: boolean;
  collapsed: boolean;
  onToggleCollapsed: () => void;
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

  // Collapsed: one-line preview with sender, date, snippet.
  if (collapsed) {
    const snippet = message.body.split("\n")[0].slice(0, 140);
    return (
      <button
        type="button"
        onClick={onToggleCollapsed}
        className="flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left transition hover:bg-accent/40 sm:px-6"
      >
        <Avatar className="h-7 w-7 shrink-0">
          <AvatarFallback className="bg-muted font-mono text-[10px]">
            {message.sender.monogram}
          </AvatarFallback>
        </Avatar>
        <span className="min-w-0 flex-1 truncate text-sm">
          <span className="font-medium">{message.sender.display_name}</span>
          <span className="ml-2 text-muted-foreground">{snippet}</span>
        </span>
        <span className="hidden shrink-0 font-mono text-[10px] text-muted-foreground sm:inline">
          {format(new Date(message.ts), "MMM d")}
        </span>
      </button>
    );
  }

  return (
    <article className="group relative border-b border-border bg-background px-4 py-4 sm:px-6 sm:py-5">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
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
          <div className="flex min-w-0 flex-col">
            <div className="flex items-baseline gap-2 min-w-0">
              <span className="text-[15px] font-semibold leading-tight">
                {message.sender.display_name}
              </span>
              {message.edited && (
                <span className="text-[10px] text-muted-foreground">(edited)</span>
              )}
              <StatusPill status={message.status} />
            </div>
            <span className="truncate font-mono text-[10px] text-muted-foreground">
              {message.sender.mxid}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
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
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100"
            aria-label="Collapse"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      <div className="mt-3 pl-0 sm:pl-12">
        {editing ? (
          <div className="flex flex-col gap-2">
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
              "whitespace-pre-wrap text-sm leading-relaxed",
              muted ? "italic text-muted-foreground" : "text-foreground/90",
            )}
          >
            {message.body}
          </div>
        )}

        {message.attachment && <AttachmentBlock attachment={message.attachment} />}

        <ReactionRow message={message} roomId={roomId} />

        {!editing && !muted && (
          <div className="mt-3 flex flex-wrap items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
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

function ReplyCard({ roomId }: { roomId: string }) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 240) + "px";
  }, [body, open]);

  async function send() {
    if (busy) return;
    const text = body.trim();
    if (!text && files.length === 0) return;
    setBusy(true);
    try {
      if (text) await sendThreadReply(roomId, text);
      for (const f of files) {
        await sendAttachment(roomId, f);
      }
      setBody("");
      setFiles([]);
      setOpen(false);
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

  if (!open) {
    return (
      <div className="border-t border-border bg-background px-4 py-3 sm:px-6">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => setOpen(true)}
          >
            <Reply className="mr-1.5 h-3.5 w-3.5" /> Reply
          </Button>
          <Button variant="outline" size="sm" className="rounded-full" disabled>
            <ReplyAll className="mr-1.5 h-3.5 w-3.5" /> Reply all
          </Button>
          <Button variant="outline" size="sm" className="rounded-full" disabled>
            <Forward className="mr-1.5 h-3.5 w-3.5" /> Forward
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-border bg-background px-3 py-3 sm:px-6">
      <div className="rounded-2xl border border-border bg-surface shadow-sm">
        <textarea
          ref={ref}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={onKeyDown}
          rows={2}
          placeholder="Reply…"
          autoFocus
          className="block w-full resize-none border-0 bg-transparent px-4 py-3 text-sm focus:outline-none"
          disabled={busy}
        />
        {files.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-4 pb-2">
            {files.map((f, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-xs"
              >
                <Paperclip className="h-3 w-3 text-muted-foreground" />
                <span className="max-w-[14ch] truncate">{f.name}</span>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => setFiles(files.filter((_, j) => j !== i))}
                  aria-label="Remove attachment"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between gap-2 border-t border-border px-2 py-2">
          <div className="flex items-center gap-1">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              onChange={(e) => {
                const list = Array.from(e.target.files ?? []);
                if (list.length) setFiles((prev) => [...prev, ...list]);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={busy}
                  className="rounded-full p-2 text-muted-foreground hover:bg-accent"
                >
                  <Paperclip className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Attach</TooltipContent>
            </Tooltip>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-[10px] text-muted-foreground sm:inline">
              ⌘↵ to send
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setOpen(false);
                setBody("");
                setFiles([]);
              }}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => void send()}
              disabled={busy || (!body.trim() && files.length === 0)}
              className="gap-1.5 rounded-full"
            >
              <Send className="h-3.5 w-3.5" />
              {busy ? "Sending…" : "Send"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MailDisplay() {
  const selectedRoomId = useMailStore((s) => s.selectedRoomId);
  const setSelectedRoomId = useMailStore((s) => s.setSelectedRoomId);
  const conversation = useConversation(selectedRoomId);
  const confirmState = useConfirmState(selectedRoomId);
  const myMxid = useMyMxid();
  const [collapsedSet, setCollapsedSet] = useState<Set<string>>(new Set());
  const initRoomRef = useRef<string | null>(null);

  // When the selected room changes, collapse all messages except the latest.
  useEffect(() => {
    if (!conversation) return;
    if (initRoomRef.current === conversation.room_id) return;
    initRoomRef.current = conversation.room_id;
    if (conversation.messages.length <= 1) {
      setCollapsedSet(new Set());
      return;
    }
    const latest = conversation.messages[conversation.messages.length - 1];
    const next = new Set<string>();
    for (const m of conversation.messages) {
      if (m.event_id !== latest.event_id) next.add(m.event_id);
    }
    setCollapsedSet(next);
  }, [conversation]);

  useEffect(() => {
    if (selectedRoomId) {
      void markRoomRead(selectedRoomId);
    }
  }, [selectedRoomId, conversation?.last_activity_ts]);

  const ordered = useMemo(() => {
    if (!conversation) return [] as Message[];
    return conversation.messages;
  }, [conversation]);

  if (!conversation) {
    const loading = !!selectedRoomId;
    return (
      <div className="flex h-full flex-col bg-background">
        {loading && (
          <div className="flex items-center gap-2 px-3 py-3 sm:px-6 sm:py-4 md:hidden">
            <button
              aria-label="Back"
              onClick={() => setSelectedRoomId(null)}
              className="rounded-full p-2 hover:bg-accent"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          </div>
        )}
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <div className="text-4xl italic text-muted-foreground/40">h</div>
            <p className="mt-2 text-sm text-muted-foreground">
              {loading ? "Opening conversation…" : "Select a conversation"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  function toggleCollapsed(eventId: string) {
    setCollapsedSet((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  }

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
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
                {ordered.length} {ordered.length === 1 ? "message" : "messages"}
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
            <TooltipContent>{conversation.starred ? "Unstar" : "Star"}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setArchived(conversation.room_id, !conversation.archived)}
              >
                {conversation.archived ? (
                  <ArchiveRestore className="h-4 w-4" />
                ) : (
                  <Archive className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{conversation.archived ? "Restore" : "Archive"}</TooltipContent>
          </Tooltip>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled>
                <ReplyAll className="mr-2 h-3.5 w-3.5" /> Reply all · soon
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                <Forward className="mr-2 h-3.5 w-3.5" /> Forward · soon
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

      {confirmState && (
        <VerifyBanner
          roomId={conversation.room_id}
          state={confirmState}
          recipientLabel={
            conversation.participants.map((p) => p.display_name).join(", ") ||
            confirmState.counterpartyMxid ||
            "the recipient"
          }
        />
      )}

      {/* Messages */}
      <ScrollArea className="flex-1">
        {ordered.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">
            No messages yet.
          </div>
        ) : (
          ordered.map((m) => (
            <MessageCard
              key={m.event_id}
              message={m}
              roomId={conversation.room_id}
              isYou={m.sender.mxid === myMxid}
              collapsed={collapsedSet.has(m.event_id)}
              onToggleCollapsed={() => toggleCollapsed(m.event_id)}
            />
          ))
        )}
      </ScrollArea>

      {confirmState?.status === "awaiting_me" ? (
        <div className="border-t border-border bg-surface px-4 py-3 text-center text-xs text-muted-foreground sm:px-6">
          Confirm with the code above to unlock replies.
        </div>
      ) : (
        <ReplyCard roomId={conversation.room_id} />
      )}
    </div>
  );
}
