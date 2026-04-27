import { useMemo, useState } from "react";
import { Tag, Plus, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  addUserTag,
  removeUserTag,
  toUserTag,
  useConversations,
  userTagLabel,
  type Conversation,
} from "@/lib/rooms";

/**
 * Tag picker for a single conversation. Shows known user tags from across
 * the inbox, lets you toggle membership, and accepts a free-text new tag.
 */
export function ConversationTagPicker({
  conversation,
}: {
  conversation: Conversation;
}) {
  const [draft, setDraft] = useState("");
  const all = useConversations();

  const knownTags = useMemo(() => {
    const set = new Set<string>();
    for (const c of all) for (const t of c.tags) if (t.startsWith("u.")) set.add(t);
    return Array.from(set).sort((a, b) =>
      userTagLabel(a).localeCompare(userTagLabel(b), undefined, { sensitivity: "base" }),
    );
  }, [all]);

  const myTags = new Set(conversation.tags.filter((t) => t.startsWith("u.")));

  async function toggle(tag: string) {
    if (myTags.has(tag)) await removeUserTag(conversation.room_id, tag);
    else await addUserTag(conversation.room_id, tag);
  }

  async function commitDraft() {
    const value = draft.trim();
    if (!value) return;
    const tag = toUserTag(value);
    if (!tag) return;
    setDraft("");
    if (!myTags.has(tag)) await addUserTag(conversation.room_id, tag);
  }

  const myUserTags = conversation.tags.filter((t) => t.startsWith("u."));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Tag conversation"
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded px-2 text-xs",
            myUserTags.length > 0
              ? "bg-accent text-foreground"
              : "text-muted-foreground hover:bg-accent",
          )}
        >
          <Tag className="h-3.5 w-3.5" />
          {myUserTags.length > 0 ? (
            <span className="hidden sm:inline">
              {myUserTags.length === 1
                ? userTagLabel(myUserTags[0])
                : `${myUserTags.length} tags`}
            </span>
          ) : (
            <span className="hidden sm:inline">Tag</span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 p-2">
        <div className="px-1 pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Tags
        </div>

        {myUserTags.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1 px-1">
            {myUserTags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-0.5 text-[11px]"
              >
                {userTagLabel(t)}
                <button
                  type="button"
                  aria-label={`Remove ${userTagLabel(t)}`}
                  onClick={(e) => {
                    e.preventDefault();
                    void toggle(t);
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void commitDraft();
          }}
          className="mb-2 flex items-center gap-1 px-1"
        >
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="New tag…"
            className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            // Stop the dropdown's typeahead from stealing keystrokes.
            onKeyDown={(e) => e.stopPropagation()}
          />
          <button
            type="submit"
            aria-label="Add tag"
            className="rounded-md bg-primary px-2 py-1 text-primary-foreground hover:brightness-95 disabled:opacity-50"
            disabled={!draft.trim()}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </form>

        {knownTags.length > 0 && (
          <>
            <div className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Existing
            </div>
            <div className="max-h-48 overflow-y-auto">
              {knownTags.map((t) => {
                const checked = myTags.has(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => void toggle(t)}
                    className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                  >
                    <span>{userTagLabel(t)}</span>
                    {checked && <Check className="h-3.5 w-3.5 text-primary" />}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
