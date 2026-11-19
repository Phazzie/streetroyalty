import { CROWN_PATH } from "@/lib/qr/mark";

/** The label's crown, from the same path the code carries in its centre. */
export function CrownMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 22" className={className} aria-hidden="true" fill="currentColor">
      <path d={CROWN_PATH} />
    </svg>
  );
}
