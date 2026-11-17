import { cn } from "@/lib/cn";

/**
 * Every maker gets a crown of their own, cut from their handle. Same handle, same
 * crown, every time: the number of points, how tall each stands, whether the tips
 * carry stones, and the colour of the card it is stamped on.
 */

const CARDS = ["#b9a3ee", "#a5dccb", "#f5ebdd", "#ffb020", "#3df0ff", "#ff9a3c", "#c084fc"];
const INK = "#14081c";

function hashOf(text: string): number {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function roller(seed: number): () => number {
  let state = seed || 1;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

export type CrownCut = {
  path: string;
  stones: { x: number; y: number }[];
  card: string;
  tilt: number;
  split: boolean;
};

/** The crown for a handle, as drawing instructions in a 32 by 24 box. */
export function crownCut(handle: string): CrownCut {
  const roll = roller(hashOf(handle.toLowerCase()));
  const points = 3 + Math.floor(roll() * 3);
  const step = 26 / (points - 1);
  const tips: { x: number; y: number }[] = [];
  for (let index = 0; index < points; index += 1) {
    const edge = index === 0 || index === points - 1;
    tips.push({
      x: 3 + step * index,
      y: Number((edge ? 4 + roll() * 5 : 1.5 + roll() * 5).toFixed(2)),
    });
  }
  const dip = 10 + roll() * 4;
  let path = `M2 18.5 L${tips[0]?.x ?? 3} ${tips[0]?.y ?? 5}`;
  for (let index = 1; index < tips.length; index += 1) {
    const tip = tips[index];
    const before = tips[index - 1];
    if (!tip || !before) continue;
    const valley = (before.x + tip.x) / 2;
    path += ` L${valley.toFixed(2)} ${(dip + roll() * 2).toFixed(2)} L${tip.x.toFixed(2)} ${tip.y}`;
  }
  path += " L30 18.5 Z";
  const stoned = roll() > 0.45;
  const stones = stoned ? tips.filter((_, index) => index % 2 === 0 || roll() > 0.5) : [];
  return {
    path,
    stones,
    card: CARDS[Math.floor(roll() * CARDS.length)] ?? "#b9a3ee",
    tilt: Math.round(roll() * 10 - 5),
    split: roll() > 0.6,
  };
}

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
        color: INK,
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
