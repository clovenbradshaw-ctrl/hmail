import { Modal } from "@/components/ui/modal";
import { useMailStore } from "@/hooks/use-mail";

interface ShortcutRow {
  keys: string[];
  label: string;
  /** Render keys as a sequence (g then i) instead of alternatives (j or ↓). */
  sequence?: boolean;
}

const SECTIONS: { title: string; rows: ShortcutRow[] }[] = [
  {
    title: "Navigation",
    rows: [
      { keys: ["j", "↓"], label: "Next conversation" },
      { keys: ["k", "↑"], label: "Previous conversation" },
      { keys: ["Esc"], label: "Back / close compose" },
      { keys: ["g", "p"], label: "Go to people", sequence: true },
      { keys: ["g", "g"], label: "Go to groups", sequence: true },
      { keys: ["g", "s"], label: "Go to starred", sequence: true },
      { keys: ["g", "a"], label: "Go to archive", sequence: true },
    ],
  },
  {
    title: "Actions",
    rows: [
      { keys: ["c"], label: "Compose new conversation" },
      { keys: ["s"], label: "Star / unstar selected" },
      { keys: ["e"], label: "Archive / unarchive selected" },
    ],
  },
  {
    title: "Help",
    rows: [{ keys: ["?"], label: "Show / hide this dialog" }],
  },
];

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[1.5rem] items-center justify-center rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[11px] font-medium text-foreground shadow-sm">
      {children}
    </kbd>
  );
}

export function KeyboardHelp() {
  const open = useMailStore((s) => s.helpOpen);
  const setOpen = useMailStore((s) => s.setHelpOpen);

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      title="Keyboard shortcuts"
      className="sm:max-w-md"
    >
      <div className="flex flex-col gap-4 p-5">
        {SECTIONS.map((section) => (
          <div key={section.title}>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {section.title}
            </div>
            <ul className="space-y-1.5">
              {section.rows.map((row) => (
                <li
                  key={row.label}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="text-sm text-foreground/90">{row.label}</span>
                  <span className="flex items-center gap-1">
                    {row.keys.map((k, i) => (
                      <span key={i} className="flex items-center gap-1">
                        {i > 0 && (
                          <span className="text-[10px] text-muted-foreground">
                            {row.sequence ? "then" : "or"}
                          </span>
                        )}
                        <Kbd>{k}</Kbd>
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <p className="text-[10px] text-muted-foreground">
          Shortcuts are ignored while typing in any text field.
        </p>
      </div>
    </Modal>
  );
}
