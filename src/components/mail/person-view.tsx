import { useMemo } from "react";
import { format } from "date-fns";
import { ArrowLeft, Inbox } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { useMailStore } from "@/hooks/use-mail";
import { useMessagesFromPerson, type PersonMessage } from "@/lib/rooms";

/**
 * A long chronological chain of every message we've ever received from one
 * person, regardless of which conversation it lived in. Selecting a message
 * jumps back to its source thread.
 */
export function PersonView() {
  const personViewMxid = useMailStore((s) => s.personViewMxid);
  const setPersonViewMxid = useMailStore((s) => s.setPersonViewMxid);
  const setSelectedRoomId = useMailStore((s) => s.setSelectedRoomId);
  const data = useMessagesFromPerson(personViewMxid);

  const grouped = useMemo(() => {
    const out: { date: string; items: PersonMessage[] }[] = [];
    if (!data) return out;
    let current: { date: string; items: PersonMessage[] } | null = null;
    for (const m of data.messages) {
      const d = format(new Date(m.ts), "EEEE, MMM d, yyyy");
      if (!current || current.date !== d) {
        current = { date: d, items: [] };
        out.push(current);
      }
      current.items.push(m);
    }
    return out;
  }, [data]);

  if (!data) {
    return (
      <div className="flex h-full items-center justify-center bg-background text-sm text-muted-foreground">
        Select a person to see their long chain.
      </div>
    );
  }

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
        <MemberAvatar
          className="h-9 w-9 shrink-0"
          mxc={data.avatar_mxc}
          monogram={data.monogram}
          alt={data.display_name}
          fallbackClassName="bg-muted font-mono text-[11px]"
        />
        <div className="flex min-w-0 flex-col">
          <h1 className="truncate text-lg font-semibold leading-tight tracking-tight sm:text-xl">
            All messages from {data.display_name}
          </h1>
          <span className="truncate font-mono text-[10px] text-muted-foreground">
            {data.mxid} · {data.messages.length}{" "}
            {data.messages.length === 1 ? "message" : "messages"}
          </span>
        </div>
      </div>

      <ScrollArea className="flex-1">
        {data.messages.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
            <Inbox className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No messages from this person yet.
            </p>
          </div>
        ) : (
          <div>
            {grouped.map((group) => (
              <div key={group.date}>
                <div className="sticky top-0 z-10 border-b border-border bg-surface/95 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">
                  {group.date}
                </div>
                {group.items.map((m) => (
                  <button
                    key={m.event_id}
                    type="button"
                    onClick={() => setSelectedRoomId(m.room_id)}
                    className="flex w-full items-start gap-3 border-b border-border/60 px-4 py-3 text-left transition hover:bg-accent/40 sm:px-6"
                  >
                    <span className="w-12 shrink-0 pt-0.5 font-mono text-[10px] text-muted-foreground">
                      {format(new Date(m.ts), "h:mm a")}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="truncate text-[11px] text-muted-foreground">
                        in <span className="font-medium">{m.room_subject}</span>
                      </span>
                      <span className="whitespace-pre-wrap break-words text-sm text-foreground/90">
                        {m.coded?.locked
                          ? "🔒 Coded message — open the conversation to unlock"
                          : m.body}
                      </span>
                      {m.attachment && (
                        <span className="truncate text-[11px] text-muted-foreground">
                          📎 {m.attachment.name}
                        </span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
