import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Combine, Layers, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { mergeThreads, type Conversation } from "@/lib/rooms";

/**
 * Merging is a one-way fold: one thread becomes the *primary* and the others
 * are tagged so their messages render inside the primary's view. We require
 * the user to confirm the participant set explicitly when the threads don't
 * already share one — combining a thread with @alice into a thread with
 * @bob would otherwise quietly mix two separate conversations.
 *
 * The default primary is the most recently active candidate, which matches
 * the typical "newer thread is the live one, fold the older stragglers in"
 * intent. The user can override with the radio list.
 */
export function MergeThreadsModal({
  open,
  onClose,
  candidates,
  onMerged,
}: {
  open: boolean;
  onClose: () => void;
  candidates: Conversation[];
  onMerged: (primaryRoomId: string) => void;
}) {
  const ordered = useMemo(
    () =>
      [...candidates].sort(
        (a, b) =>
          new Date(b.last_activity_ts).getTime() -
          new Date(a.last_activity_ts).getTime(),
      ),
    [candidates],
  );

  const [primaryId, setPrimaryId] = useState<string | null>(null);
  const [confirmedDifferentPeople, setConfirmedDifferentPeople] =
    useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setPrimaryId(null);
      setConfirmedDifferentPeople(false);
      setBusy(false);
      setError(null);
      return;
    }
    setPrimaryId(ordered[0]?.room_id ?? null);
    setConfirmedDifferentPeople(false);
    setError(null);
  }, [open, ordered]);

  // Compare the participant set across every candidate. If the union and the
  // intersection don't match, at least one thread has a different person on
  // it — that's the case the confirmation gate is for.
  const { differentPeople, allParticipants } = useMemo(() => {
    if (ordered.length < 2) {
      return { differentPeople: false, allParticipants: [] as string[] };
    }
    const sets = ordered.map(
      (c) => new Set(c.participants.map((p) => p.mxid)),
    );
    const union = new Set<string>();
    for (const s of sets) for (const x of s) union.add(x);
    const intersection = new Set<string>(sets[0]);
    for (let i = 1; i < sets.length; i++) {
      for (const x of [...intersection]) {
        if (!sets[i].has(x)) intersection.delete(x);
      }
    }
    return {
      differentPeople: union.size !== intersection.size,
      allParticipants: Array.from(union),
    };
  }, [ordered]);

  const tooFew = ordered.length < 2;
  const canSubmit =
    !tooFew &&
    !!primaryId &&
    !busy &&
    (!differentPeople || confirmedDifferentPeople);

  async function submit() {
    if (!canSubmit || !primaryId) return;
    setBusy(true);
    setError(null);
    try {
      const sources = ordered
        .map((c) => c.room_id)
        .filter((id) => id !== primaryId);
      await mergeThreads(primaryId, sources);
      onMerged(primaryId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <Combine className="h-4 w-4" />
          Merge {ordered.length} {ordered.length === 1 ? "thread" : "threads"}
        </span>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="flex flex-col gap-4 px-5 py-4"
      >
        {tooFew ? (
          <p className="text-sm text-muted-foreground">
            Select at least two threads to merge.
          </p>
        ) : (
          <>
            <fieldset className="flex flex-col gap-2 rounded-md border border-border bg-surface/50 p-3">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Keep as primary thread
              </legend>
              <p className="px-1 text-[12px] text-muted-foreground">
                The other threads will be tagged as merged into this one and
                their messages will appear inline. The originals stay archived
                — you can unmerge them later from the conversation menu.
              </p>
              <div className="flex flex-col gap-1">
                {ordered.map((c) => {
                  const isPrimary = c.room_id === primaryId;
                  return (
                    <label
                      key={c.room_id}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-md border p-2.5 transition",
                        isPrimary
                          ? "border-primary bg-selected/40"
                          : "border-border hover:bg-accent/40",
                      )}
                    >
                      <input
                        type="radio"
                        name="primary"
                        value={c.room_id}
                        checked={isPrimary}
                        onChange={() => setPrimaryId(c.room_id)}
                        className="mt-1"
                      />
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-sm font-medium">
                          {c.subject || "(no subject)"}
                        </span>
                        <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <Users className="h-3 w-3 shrink-0" />
                          <span className="truncate">
                            {c.participants
                              .map((p) => p.display_name)
                              .join(", ") || "—"}
                          </span>
                        </span>
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {c.messages.length} msg
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {differentPeople && (
              <label
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-md border p-3 transition",
                  confirmedDifferentPeople
                    ? "border-destructive/60 bg-destructive/5"
                    : "border-destructive/40 bg-destructive/5 hover:bg-destructive/10",
                )}
              >
                <input
                  type="checkbox"
                  checked={confirmedDifferentPeople}
                  onChange={(e) =>
                    setConfirmedDifferentPeople(e.target.checked)
                  }
                  className="mt-1"
                />
                <span className="flex flex-col gap-1">
                  <span className="flex items-center gap-2 text-sm font-medium text-destructive">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    These threads have different people on them
                  </span>
                  <span className="text-[12px] text-muted-foreground">
                    Combined participants:{" "}
                    {allParticipants.length > 0
                      ? allParticipants.join(", ")
                      : "—"}
                  </span>
                  <span className="text-[12px] text-muted-foreground">
                    Folding them won't share messages between rooms — each
                    person still only sees their own thread on the network. But
                    you'll see them as one inbox entry. Confirm you want that.
                  </span>
                </span>
              </label>
            )}

            {!differentPeople && (
              <p className="flex items-center gap-2 rounded-md border border-border bg-surface/50 px-3 py-2 text-[12px] text-muted-foreground">
                <Layers className="h-3.5 w-3.5 shrink-0" />
                All selected threads share the same participants — safe to
                merge.
              </p>
            )}
          </>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={!canSubmit}>
            {busy ? "Merging…" : "Merge"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
