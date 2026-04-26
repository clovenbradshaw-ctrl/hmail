import { useState, useMemo } from "react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Search, Check } from "lucide-react";
import { useMailStore } from "@/hooks/use-mail";
import {
  adoptIntoHmail,
  releaseFromHmail,
  useAllConversations,
} from "@/lib/rooms";

export function ManageRooms() {
  const open = useMailStore((s) => s.manageRoomsOpen);
  const setOpen = useMailStore((s) => s.setManageRoomsOpen);
  const all = useAllConversations();
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (c) =>
        c.subject.toLowerCase().includes(q) ||
        c.participants.some((p) =>
          (p.display_name + p.mxid).toLowerCase().includes(q),
        ),
    );
  }, [all, query]);

  async function toggle(roomId: string, currentlyIn: boolean) {
    setBusyId(roomId);
    try {
      if (currentlyIn) await releaseFromHmail(roomId);
      else await adoptIntoHmail(roomId);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      title="Manage rooms in hmail"
      className="sm:max-w-2xl"
    >
      <div className="flex flex-col gap-3 p-4">
        <p className="text-xs text-muted-foreground">
          hmail only shows rooms you've added here. New conversations you
          compose are added automatically.
        </p>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search rooms…"
            className="pl-8"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <ul className="divide-y divide-border rounded-md border border-border">
          {filtered.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">
              No rooms.
            </li>
          ) : (
            filtered.map((c) => (
              <li
                key={c.room_id}
                className="flex items-center justify-between gap-3 px-3 py-2"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">
                    {c.subject}
                  </span>
                  <span className="truncate font-mono text-[10px] text-muted-foreground">
                    {c.participants.map((p) => p.mxid).join(", ") || c.room_id}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={busyId === c.room_id}
                  onClick={() => toggle(c.room_id, c.in_hmail)}
                  className={
                    "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition " +
                    (c.in_hmail
                      ? "border-primary bg-selected text-selected-foreground"
                      : "border-border text-foreground hover:bg-accent")
                  }
                >
                  {c.in_hmail && <Check className="h-3 w-3" />}
                  {c.in_hmail ? "In hmail" : "Add"}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </Modal>
  );
}
