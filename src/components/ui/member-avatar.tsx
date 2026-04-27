import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAttachmentUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

interface MemberAvatarProps {
  /** Per-room avatar mxc, or undefined to render monogram only. */
  mxc: string | undefined;
  monogram: string;
  /** Tailwind size classes — defaults match the small inline avatar. */
  className?: string;
  fallbackClassName?: string;
  /** Used as the rendered alt text for the image. */
  alt?: string;
}

/**
 * Renders a connection-gated avatar: if `mxc` is set we fetch it through the
 * authenticated media endpoint and render it; otherwise we render the
 * monogram fallback. Profile pictures only appear when we share a room with
 * the person — that's the connection gate.
 */
export function MemberAvatar({
  mxc,
  monogram,
  className,
  fallbackClassName,
  alt,
}: MemberAvatarProps) {
  const url = useAttachmentUrl(mxc);
  return (
    <Avatar className={className}>
      {url && <AvatarImage src={url} alt={alt ?? ""} />}
      <AvatarFallback
        className={cn("bg-muted font-mono text-[10px]", fallbackClassName)}
      >
        {monogram}
      </AvatarFallback>
    </Avatar>
  );
}
