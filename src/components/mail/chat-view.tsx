import { useEffect, useMemo, useRef } from "react";
import { format, isSameDay } from "date-fns";
import { Lock, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { Message } from "@/lib/rooms";

/**
 * A WhatsApp / iMessage-style chat layout for the same Matrix timeline that
 * the email view renders. Bubbles right-align for the current user and
 * left-align for everyone else; consecutive messages from one sender are
 * grouped tightly with a single avatar/header. Same data source — different
 * cognitive frame.
 */
export function ChatView({
  messages,
  myMxid,
  onOpenPerson,
}: {
  messages: Message[];
  roomId: string;
  myMxid: string | null;
  onOpenPerson: (mxid: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the most recent message whenever the timeline grows.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  // Group consecutive messages from one sender so we only render the avatar
  // and name on the first bubble in each run.
  const grouped = useMemo(() => {
    const out: { mxid: string; isYou: boolean; items: Message[] }[] = [];
    for (const m of messages) {
      const isYou = m.sender.mxid === myMxid;
      const last = out[out.length - 1];
      if (
        last &&
        last.mxid === m.sender.mxid &&
        last.items.length > 0 &&
        new Date(m.ts).getTime() -
          new Date(last.items[last.items.length - 1].ts).getTime() <
          5 * 60 * 1000
      ) {
        last.items.push(m);
      } else {
        out.push({ mxid: m.sender.mxid, isYou, items: [m] });
      }
    }
    return out;
  }, [messages, myMxid]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-12 text-sm text-muted-foreground">
        No messages yet.
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto">
      <div className="flex flex-col gap-4 px-3 py-4 sm:px-6">
        {grouped.map((group, gi) => {
          const prev = grouped[gi - 1]?.items[grouped[gi - 1].items.length - 1];
          const first = group.items[0];
          const showDivider =
            !prev || !isSameDay(new Date(prev.ts), new Date(first.ts));
          return (
            <div key={`${group.mxid}-${gi}`} className="flex flex-col gap-1">
              {showDivider && (
                <div className="my-2 flex items-center justify-center">
                  <span className="rounded-full bg-surface px-3 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    {format(new Date(first.ts), "EEE, MMM d")}
                  </span>
                </div>
              )}
              <div
                className={cn(
                  "flex items-end gap-2",
                  group.isYou ? "justify-end" : "justify-start",
                )}
              >
                {!group.isYou && (
                  <button
                    type="button"
                    onClick={() => onOpenPerson(group.mxid)}
                    aria-label={`See all messages from ${first.sender.display_name}`}
                    className="shrink-0"
                  >
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="bg-muted font-mono text-[10px]">
                        {first.sender.monogram}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                )}
                <div
                  className={cn(
                    "flex max-w-[75%] flex-col gap-0.5",
                    group.isYou ? "items-end" : "items-start",
                  )}
                >
                  {!group.isYou && (
                    <button
                      type="button"
                      onClick={() => onOpenPerson(group.mxid)}
                      className="px-1 text-[11px] font-medium text-muted-foreground hover:underline"
                    >
                      {first.sender.display_name}
                    </button>
                  )}
                  {group.items.map((m, mi) => {
                    const muted = m.decryption_failed || m.redacted;
                    const locked = !!m.coded?.locked;
                    return (
                      <div
                        key={m.event_id}
                        className={cn(
                          "rounded-2xl px-3 py-1.5 text-sm leading-relaxed shadow-sm",
                          group.isYou
                            ? "bg-primary text-primary-foreground"
                            : "bg-surface text-foreground",
                          // Soften the corners between consecutive bubbles.
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
                              Coded message — switch to email view to unlock
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
                                ? "text-primary-foreground/80"
                                : "text-muted-foreground",
                            )}
                          >
                            <Paperclip className="h-3 w-3" />
                            <span className="truncate">{m.attachment.name}</span>
                          </div>
                        )}
                      </div>
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
                    {group.items.some((m) => m.status === "sending") && " · sending"}
                    {group.items.some((m) => m.status === "failed") && " · failed"}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
