import { arcLayout, clampFx, outlineStyle, type TextFx } from "@/lib/studio/textfx";

/** One character per cell, using the same geometry as the print file. */
export function CurvedText({
  text,
  fx,
  color,
  fontFamily,
}: {
  text: string;
  fx: TextFx;
  color: string;
  fontFamily: string;
}) {
  const clamped = clampFx(fx);
  const cells = arcLayout(text, clamped);
  const outline = clamped.outline ? outlineStyle(color) : undefined;
  if (Math.abs(clamped.arc) < 0.001) {
    return (
      <span
        className="block max-w-full text-center font-display text-sm leading-tight whitespace-nowrap"
        style={{ fontFamily, color, letterSpacing: `${clamped.tracking}em`, ...outline }}
      >
        {text}
      </span>
    );
  }
  const lifts = cells.map((cell) => cell.lift);
  const minLift = Math.min(0, ...lifts);
  const maxLift = Math.max(0, ...lifts);
  return (
    <span
      className="relative block font-display text-sm leading-tight"
      style={{ fontFamily, height: `${1.4 + maxLift - minLift}em`, width: "12em" }}
      aria-label={text}
    >
      {cells.map((cell, index) => (
        <span
          key={`${cell.char}-${index}`}
          aria-hidden="true"
          className="absolute top-0 left-1/2"
          style={{
            color,
            ...outline,
            transform: `translate(-50%, 0) translate(${cell.along}em, ${cell.lift - minLift}em) rotate(${cell.rotate}deg)`,
          }}
        >
          {cell.char === " " ? "\u00a0" : cell.char}
        </span>
      ))}
    </span>
  );
}
