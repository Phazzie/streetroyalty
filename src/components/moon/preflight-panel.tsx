import type { CheckLevel, PrintCheck } from "@/lib/moon/preflight";

const GLYPH: Record<CheckLevel, string> = { pass: "✓", warn: "!", fail: "✕" };
const TONE: Record<CheckLevel, string> = {
  pass: "border-lime text-lime",
  warn: "border-amber text-amber",
  fail: "border-pipe text-pipe",
};

/**
 * Print Check — preflight, said out loud. A fail does not quietly block:
 * it names the problem, and publishing anyway takes a deliberate override.
 */
export function PreflightPanel({
  checks,
  verdict,
  override,
  onOverride,
}: {
  checks: PrintCheck[];
  verdict: CheckLevel;
  override: boolean;
  onOverride: (value: boolean) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-sm text-muted">
        {verdict === "pass"
          ? "Clean. It prints the way it looks."
          : verdict === "warn"
            ? "It will print. Know what you are accepting."
            : "Something here will not survive the press."}
      </p>
      <ul className="flex flex-col gap-2">
        {checks.map((check) => (
          <li key={check.key} className={`border-2 bg-bg p-2 ${TONE[check.level]}`}>
            <p className="font-display text-xs tracking-wide uppercase">
              {GLYPH[check.level]} {check.label}
            </p>
            <p className="mt-1 text-sm text-fg">{check.detail}</p>
          </li>
        ))}
      </ul>
      {verdict === "fail" ? (
        <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={override}
            onChange={(event) => onOverride(event.target.checked)}
            className="mt-1 size-4 accent-[#ff2d95]"
          />
          <span>
            I read the failures. Publish loud anyway — the soft print / invisible ink is my call.
          </span>
        </label>
      ) : null}
    </div>
  );
}
