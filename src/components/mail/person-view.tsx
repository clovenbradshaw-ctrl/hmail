import { useEffect, useMemo, useRef, useState } from "react";
import { format, isSameDay } from "date-fns";
import {
  ArrowLeft,
  Inbox,
  Lock,
  Paperclip,
  Send,
  ExternalLink,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useMailStore } from "@/hooks/use-mail";
import {
  sendThreadReply,
  useMessagesFromPerson,
  useMyMxid,
  type PersonMessage,
} from "@/lib/rooms";

/**
 * The unified message stream with one person — every back-and-forth across
 * every room they share with you, in chronological order. Own messages are
 * right-aligned; their messages are left-aligned. A subtle "in <room>" pill
 * surfaces whenever a message lived in a non-default room (a group, or a
 * different DM). Replies default to the most-recent DM with this contact.
 */
type Group = {
  mxid: string;
  isYou: boolean;
  items: PersonMessage[];
};

export function PersonView() {
  const personViewMxid = useMailStore((s) => s.personViewMxid);
  const setPersonViewMxid = useMailStore((s) => s.setPersonViewMxid);
  const setSelectedRoomId = useMailStore((s) => s.setSelectedRoomId);
  const data = useMessagesFromPerson(personViewMxid);
  const myMxid = useMyMxid();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Group consecutive messages from one sender within a 5-minute window so
  // bubbles cluster (matches ChatView's grouping cadence).
  const groups = useMemo<Group[]>(() => {
    if (!data) return [];
    const out: Group[] = [];
    for (const m of data.messages) {
      const isYou = !!myMxid && m.sender.mxid === myMxid;
      const last = out[out.length - 1];
      if (
        last &&
        last.mxid === m.sender.mxid &&
        last.items.length > 0 &&
        new Date(m.ts).getTime() -
          new Date(last.items[last.items.length - 1].ts).getTime() <
          5 * 60 * 1000 &&
        last.items[last.items.length - 1].room_id === m.room_id
      ) {
        last.items.push(m);
      } else {
        out.push({ mxid: m.sender.mxid, isYou, items: [m] });
      }
    }
    return out;
  }, [data, myMxid]);

  // Auto-scroll to the bottom whenever the stream grows.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [data?.messages.length]);

  if (!data) {
    return (
      <div className="flex h-full items-center justify-center bg-background text-sm text-muted-foreground">
        Select a person to see your back-and-forth.
      </div>
    );
  }

  const replyRoomId = data.default_reply_room_id;
  const replyIsDm = data.default_reply_is_dm;
  const replyRoomLabel = data.default_reply_room_subject;

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center gap-3 border-b border-border bg-surface px-3 py-3 sm:px-6">
        <button
          type="button"
          aria-label="Back"
          onClick={() => setPersonViewMxid(null)}
          className="rounded-full p-2 hover:bg-accent"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <Avatar className="h-9 w-9 shrink-0">
          <AvatarFallback className="bg-muted font-mono text-[11px]">
            {data.monogram}
          </AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col">
          <h1 className="truncate text-lg font-semibold leading-tight tracking-tight sm:text-xl">
            {data.display_name}
          </h1>
          <span className="truncate font-mono text-[10px] text-muted-foreground">
            {data.mxid} · {data.messages.length}{" "}
            {data.messages.length === 1 ? "message" : "messages"}
          </span>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {data.messages.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
            <Inbox className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No messages exchanged with this person yet.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 px-3 py-4 sm:px-6">
            {groups.map((group, gi) => {
              const prev =
                groups[gi - 1]?.items[groups[gi - 1].items.length - 1];
              const first = group.items[0];
              const showDateDivider =
                !prev || !isSameDay(new Date(prev.ts), new Date(first.ts));
              // Show the room pill when the message isn't in the contact's DM
              // and either there's no previous group or the room changed.
              const showRoomPill =
                !first.is_dm &&
                (!prev ||
                  prev.room_id !== first.room_id ||
                  !isSameDay(new Date(prev.ts), new Date(first.ts)));
              return (
                <div key={`${group.mxid}-${gi}`} className="flex flex-col gap-1">
                  {showDateDivider && (
                    <div className="my-2 flex items-center justify-center">
                      <span className="rounded-full bg-surface px-3 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        {format(new Date(first.ts), "EEE, MMM d")}
                      </span>
                    </div>
                  )}
                  {showRoomPill && (
                    <div className="my-1 flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => setSelectedRoomId(first.room_id)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground"
                      >
                        <Users className="h-3 w-3" />
                        in {first.room_subject}
                        <ExternalLink className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  )}
                  <div
                    className={cn(
                      "flex items-end gap-2",
                      group.isYou ? "justify-end" : "justify-start",
                    )}
                  >
                    {!group.isYou && (
                      <Avatar className="h-7 w-7 shrink-0">
                        <AvatarFallback className="bg-muted font-mono text-[10px]">
                          {first.sender.monogram}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div
                      className={cn(
                        "flex max-w-[78%] flex-col gap-0.5",
                        group.isYou ? "items-end" : "items-start",
                      )}
                    >
                      {group.items.map((m, mi) => {
                        const muted = m.decryption_failed || m.redacted;
                        const locked = !!m.coded?.locked;
                        return (
                          <button
                            key={m.event_id}
                            type="button"
                            onClick={() => setSelectedRoomId(m.room_id)}
                            title={`Open thread: ${m.room_subject}`}
                            className={cn(
                              "rounded-2xl px-3 py-1.5 text-left text-sm leading-relaxed shadow-sm transition hover:brightness-95",
                              group.isYou
                                ? "bg-seal text-seal-foreground"
                                : "bg-surface text-foreground",
                              mi > 0 &&
                                (group.isYou ? "rounded-tr-md" : "rounded-tl-md"),
                              mi < group.items.length - 1 &&
                                (group.isYou ? "rounded-br-md" : "rounded-bl-md"),
                              muted && "italic opacity-70",
                            )}
                          >
                            {locked && m.coded ? (
                              <span className="inline-flex items-center gap-1.5">
                                <Lock className="h-3.5 w-3.5" />
                                <span className="text-xs">
                                  Coded message — open the thread to unlock
                                </span>
                              </span>
                            ) : (
                              <span className="whitespace-pre-wrap break-words">
                                {m.body}
                              </span>
                            )}
                            {m.attachment && (
                              <div
                                className={cn(
                                  "mt-1.5 flex items-center gap-1.5 text-[11px]",
                                  group.isYou
                                    ? "text-seal-foreground/80"
                                    : "text-muted-foreground",
                                )}
                              >
                                <Paperclip className="h-3 w-3" />
                                <span className="truncate">
                                  {m.attachment.name}
                                </span>
                              </div>
                            )}
                          </button>
                        );
                      })}
                      <span
                        className={cn(
                          "px-1 font-mono text-[10px] text-muted-foreground",
                          group.isYou ? "text-right" : "text-left",
                        )}
                      >
                        {format(
                          new Date(group.items[group.items.length - 1].ts),
                          "h:mm a",
                        )}
                        {group.items.some((m) => m.edited) && " · edited"}
                        {group.items.some((m) => m.status === "sending") &&
                          " · sending"}
                        {group.items.some((m) => m.status === "failed") &&
                          " · failed"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <PersonComposer
        roomId={replyRoomId}
        isDm={replyIsDm}
        roomLabel={replyRoomLabel}
        contactMxid={data.mxid}
        contactDisplayName={data.display_name}
      />
    </div>
  );
}

function PersonComposer({
  roomId,
  isDm,
  roomLabel,
  contactMxid,
  contactDisplayName,
}: {
  roomId: string | null;
  isDm: boolean;
  roomLabel: string | null;
  contactMxid: string;
  contactDisplayName: string;
}) {
  const setComposeOpen = useMailStore((s) => s.setComposeOpen);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 240) + "px";
  }, [body]);

  async function send() {
    if (busy || !roomId) return;
    const text = body.trim();
    if (!text) return;
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

  // No shared room with this contact at all — drop into the full Compose modal
  // pre-filled with their MXID so the user can name/encrypt the new DM.
  if (!roomId) {
    return (
      <div className="border-t border-border bg-surface px-4 py-4 text-center text-sm sm:px-6">
        <p className="text-muted-foreground">
          You don't share a room with {contactDisplayName} yet.
        </p>
        <Button
          variant="default"
          size="sm"
          className="mt-2"
          onClick={() => setComposeOpen(true)}
        >
          Start a conversation with {contactMxid}
        </Button>
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
          rows={1}
          placeholder={`Reply to ${contactDisplayName}…`}
          className="block w-full resize-none border-0 bg-transparent px-4 py-3 text-sm focus:outline-none"
          disabled={busy}
        />
        <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
          <span className="flex min-w-0 items-center gap-1.5 truncate text-[11px] text-muted-foreground">
            {isDm ? (
              <>Replying via DM</>
            ) : (
              <>
                <Users className="h-3 w-3" />
                Replying in <span className="font-medium">{roomLabel}</span>
              </>
            )}
          </span>
          <div className="flex items-center gap-2">
            <span className="hidden text-[10px] text-muted-foreground sm:inline">
              ⌘↵ to send
            </span>
            <Button
              onClick={() => void send()}
              disabled={busy || !body.trim()}
              className="inline-flex items-center gap-1.5 rounded-full bg-seal px-5 py-2 text-sm font-medium text-seal-foreground shadow-sm hover:bg-seal hover:brightness-95 disabled:opacity-60"
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
