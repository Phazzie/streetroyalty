import { CROWN_INK, crownCut } from "@/components/makers/crown-cut";
import { cn } from "@/lib/cn";

/** The crown on its card. Decorative: the maker's name is always written beside it. */
export function MakerCrown({
  handle,
  size = 40,
  className,
}: {
  handle: string;
  size?: number;
  className?: string;
}) {
  const cut = crownCut(handle);
  return (
    <span
      aria-hidden="true"
      className={cn("inline-grid shrink-0 place-items-center border-2 border-ink", className)}
      style={{
        width: size,
        height: size,
        background: cut.card,
        color: CROWN_INK,
        transform: `rotate(${cut.tilt}deg)`,
      }}
    >
      <svg viewBox="0 0 32 24" width={size * 0.74} height={size * 0.56} fill="currentColor">
        <path d={cut.path} />
        {cut.split ? (
          <>
            <rect x="2" y="19.6" width="13" height="2.4" />
            <rect x="17" y="19.6" width="13" height="2.4" />
          </>
        ) : (
          <rect x="2" y="19.6" width="28" height="2.4" />
        )}
        {cut.stones.map((stone) => (
          <circle key={stone.x} cx={stone.x} cy={Math.max(1.6, stone.y - 0.4)} r="1.6" />
        ))}
      </svg>
    </span>
  );
}
