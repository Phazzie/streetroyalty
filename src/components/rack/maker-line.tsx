import { Link } from "@tanstack/react-router";
import { MakerCrown } from "@/components/makers/maker-crown";
import { cn } from "@/lib/cn";
import type { MakerRef } from "@/lib/social/types";

/** Who made it, with their own crown, linked to their page. */
export function MakerLine({
  maker,
  size = "sm",
  className,
}: {
  maker: MakerRef;
  size?: "sm" | "md";
  className?: string;
}) {
  const body = (
    <>
      {maker.handle ? <MakerCrown handle={maker.handle} size={size === "md" ? 44 : 28} /> : null}
      <span className="min-w-0">
        <span
          className={cn(
            "block truncate font-display leading-tight",
            size === "md" ? "text-base" : "text-xs",
          )}
        >
          {maker.name}
        </span>
        {maker.handle ? (
          <span className={cn("block truncate text-muted", size === "md" ? "text-sm" : "text-xs")}>
            @{maker.handle}
          </span>
        ) : null}
      </span>
    </>
  );
  const shape = cn("flex min-h-11 min-w-0 items-center gap-2 text-left", className);
  if (!maker.handle) return <span className={shape}>{body}</span>;
  return (
    <Link
      to="/m/$handle"
      params={{ handle: maker.handle }}
      aria-label={`Made by ${maker.name}. See their page`}
      className={cn(
        shape,
        "underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-fg",
      )}
    >
      {body}
    </Link>
  );
}
