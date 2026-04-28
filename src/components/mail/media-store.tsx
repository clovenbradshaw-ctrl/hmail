import { useMemo, useState } from "react";
import {
  Menu,
  Image as ImageIcon,
  FileIcon,
  Download,
  ExternalLink,
  Lock,
  ShieldCheck,
  Users,
  Paperclip,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Modal } from "@/components/ui/modal";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useMailStore } from "@/hooks/use-mail";
import {
  effectiveGrantedMxids,
  filterMediaItems,
  useAttachmentUrl,
  useMediaItems,
  type MediaFilter,
  type MediaItem,
} from "@/lib/media";
import { useMyMxid } from "@/lib/rooms";

function localpart(mxid: string): string {
  const m = mxid.match(/^@([^:]+):/);
  return m ? m[1] : mxid;
}

function formatBytes(size?: number): string | null {
  if (!size || size <= 0) return null;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} kB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function MediaTile({
  item,
  onOpen,
}: {
  item: MediaItem;
  onOpen: () => void;
}) {
  const grant = effectiveGrantedMxids(item);
  const sizeLabel = formatBytes(item.attachment.size);
  const isImage = item.attachment.kind === "image" && !!item.attachment.mxc;
  const blobUrl = useAttachmentUrl(isImage ? item.attachment.mxc : undefined);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex flex-col overflow-hidden rounded-lg border border-border bg-surface text-left shadow-sm transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-ring"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
        {isImage && blobUrl ? (
          <img
            src={blobUrl}
            alt={item.attachment.name}
            loading="lazy"
            className="h-full w-full object-cover transition group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <FileIcon className="h-12 w-12 text-muted-foreground/60" />
          </div>
        )}
        <div className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-mono text-muted-foreground shadow-sm">
          <Lock className="h-2.5 w-2.5" />
          {grant.length} {grant.length === 1 ? "viewer" : "viewers"}
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-0.5 px-3 py-2">
        <div className="truncate text-sm font-medium">
          {item.attachment.name}
        </div>
        <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <span className="truncate">{item.sender.display_name}</span>
          <span className="shrink-0 font-mono">
            {format(new Date(item.ts), "MMM d")}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
          <span className="truncate italic">{item.subject}</span>
          {sizeLabel && <span className="shrink-0 font-mono">{sizeLabel}</span>}
        </div>
      </div>
    </button>
  );
}

function GrantList({
  granted,
  owner,
  myMxid,
}: {
  granted: string[];
  owner?: string;
  myMxid: string | null;
}) {
  const rows = useMemo(() => {
    const out: { mxid: string; role: "owner" | "you" | "viewer" }[] = [];
    if (owner) out.push({ mxid: owner, role: owner === myMxid ? "you" : "owner" });
    for (const g of granted) {
      if (g === owner) continue;
      out.push({ mxid: g, role: g === myMxid ? "you" : "viewer" });
    }
    return out;
  }, [granted, owner, myMxid]);

  if (rows.length === 0) {
    return (
      <p className="text-xs italic text-muted-foreground">
        No explicit grants on file.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-border rounded-md border border-border bg-background">
      {rows.map((row) => (
        <li
          key={row.mxid}
          className="flex items-center justify-between gap-3 px-3 py-2"
        >
          <div className="flex min-w-0 items-center gap-2">
            <Avatar className="h-7 w-7 shrink-0">
              <AvatarFallback className="bg-muted font-mono text-[10px]">
                {localpart(row.mxid).slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm">{localpart(row.mxid)}</span>
              <span className="truncate font-mono text-[10px] text-muted-foreground">
                {row.mxid}
              </span>
            </div>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
              row.role === "owner"
                ? "bg-seal/15 text-seal"
                : row.role === "you"
                  ? "bg-selected text-selected-foreground"
                  : "bg-muted text-muted-foreground",
            )}
          >
            {row.role === "owner" ? "Owner" : row.role === "you" ? "You" : "Can view"}
          </span>
        </li>
      ))}
    </ul>
  );
}

function MediaDetails({
  item,
  onClose,
}: {
  item: MediaItem;
  onClose: () => void;
}) {
  const setSelectedRoomId = useMailStore((s) => s.setSelectedRoomId);
  const setFolder = useMailStore((s) => s.setFolder);
  const myMxid = useMyMxid();
  const granted = effectiveGrantedMxids(item);
  const owner = item.attachment.access?.owner ?? item.sender.mxid;
  const grantedTs = item.attachment.access?.granted_ts ?? item.ts;
  const isImage = item.attachment.kind === "image" && !!item.attachment.mxc;
  const blobUrl = useAttachmentUrl(item.attachment.mxc);
  const sizeLabel = formatBytes(item.attachment.size);

  function openConversation() {
    onClose();
    setFolder("groups");
    setSelectedRoomId(item.room_id);
  }

  return (
    <Modal
      open
      onClose={onClose}
      sheet
      className="sm:max-w-3xl"
      title={
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-semibold">
            {item.attachment.name}
          </span>
          <span className="truncate text-[11px] font-normal text-muted-foreground">
            from {item.sender.display_name} · {format(new Date(item.ts), "MMM d, yyyy · h:mm a")}
          </span>
        </div>
      }
    >
      <div className="flex flex-col gap-4 p-5">
        {isImage ? (
          <a
            href={blobUrl ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!blobUrl}
            onClick={(e) => {
              if (!blobUrl) e.preventDefault();
            }}
            className="block overflow-hidden rounded-md border border-border bg-muted"
          >
            {blobUrl ? (
              <img
                src={blobUrl}
                alt={item.attachment.name}
                className="block max-h-[60vh] w-full object-contain"
              />
            ) : (
              <div className="flex h-48 w-full items-center justify-center text-xs text-muted-foreground">
                Loading image…
              </div>
            )}
          </a>
        ) : (
          <div className="flex items-center gap-3 rounded-md border border-border bg-surface px-4 py-4">
            <FileIcon className="h-8 w-8 shrink-0 text-muted-foreground" />
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium">
                {item.attachment.name}
              </span>
              <span className="truncate font-mono text-[10px] text-muted-foreground">
                {item.attachment.mimetype ?? "application/octet-stream"}
                {sizeLabel && <> · {sizeLabel}</>}
              </span>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {item.attachment.mxc && (
            <a
              href={blobUrl ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              download={item.attachment.name}
              aria-disabled={!blobUrl}
              onClick={(e) => {
                if (!blobUrl) e.preventDefault();
              }}
            >
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={!blobUrl}
              >
                <Download className="h-3.5 w-3.5" />
                {blobUrl ? "Download" : "Loading…"}
              </Button>
            </a>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={openConversation}
          >
            <ExternalLink className="h-3.5 w-3.5" /> Open conversation
          </Button>
        </div>

        <section className="rounded-lg border border-border bg-surface/40 p-4">
          <header className="mb-3 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Who has access</h3>
          </header>
          <GrantList granted={granted} owner={owner} myMxid={myMxid} />
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            Granted {format(new Date(grantedTs), "MMM d, yyyy")} when this file
            was shared. Access is enforced by the conversation's membership —
            removing someone from the room revokes their view.
          </p>
        </section>
      </div>
    </Modal>
  );
}

const FILTERS: { id: MediaFilter; label: string; icon: typeof ImageIcon }[] = [
  { id: "all", label: "All", icon: Paperclip },
  { id: "image", label: "Images", icon: ImageIcon },
  { id: "file", label: "Files", icon: FileIcon },
];

export function MediaStore() {
  const items = useMediaItems();
  const setSidebarOpen = useMailStore((s) => s.setSidebarOpen);
  const [filter, setFilter] = useState<MediaFilter>("all");
  const [openItem, setOpenItem] = useState<MediaItem | null>(null);

  const filtered = useMemo(
    () => filterMediaItems(items, filter),
    [items, filter],
  );

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center gap-2 border-b border-border bg-surface px-2 py-2 sm:px-4">
        <button
          aria-label="Open menu"
          onClick={() => setSidebarOpen(true)}
          className="rounded-full p-2 hover:bg-accent md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex min-w-0 flex-1 flex-col">
          <h1 className="text-base font-semibold tracking-tight sm:text-lg">
            Media
          </h1>
          <span className="text-[11px] text-muted-foreground">
            All attachments shared in your hmail conversations.
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1 border-b border-border bg-background px-2 py-1.5 sm:px-4">
        {FILTERS.map((f) => {
          const active = f.id === filter;
          const Icon = f.icon;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded px-2 py-1 text-[11px] font-medium transition",
                active
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-accent",
              )}
            >
              <Icon className="h-3 w-3" />
              {f.label}
            </button>
          );
        })}
        <span className="ml-auto font-mono text-[10px] text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? "item" : "items"}
        </span>
      </div>

      <ScrollArea className="flex-1">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
            <Users className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {items.length === 0
                ? "No attachments yet. Anything you send or receive with a file will land here."
                : "Nothing matches that filter."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((item) => (
              <MediaTile
                key={item.id}
                item={item}
                onOpen={() => setOpenItem(item)}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      {openItem && (
        <MediaDetails item={openItem} onClose={() => setOpenItem(null)} />
      )}
    </div>
  );
}
