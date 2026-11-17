/**
 * The mirror in the fitting room. Before a try-on it shows the piece held up
 * against a paper-doll outline. While a picture is being made the curtain is
 * drawn across it with a pair of sneakers shuffling underneath, and it pulls
 * back to show the picture when it lands. The curtain is the waiting state:
 * there is no spinner.
 */

export type CurtainState =
  /** Tied back at the sides: the mirror is free. */
  | "parted"
  /** Drawn shut and moving: someone is changing. */
  | "changing"
  /** Pulled right off: look at the picture. */
  | "wide"
  /** Drawn shut and still: the room is closed. */
  | "shut";

const CSS = `
.sr-fit { position: relative; padding-top: 12px; }
.sr-fit-rail {
  position: absolute; top: 0; left: -8px; right: -8px; height: 12px; z-index: 3;
  border: 2px solid var(--color-ink);
  background:
    radial-gradient(circle at 50% 50%, var(--color-bg) 0 2.5px, transparent 3px) 0 0 / 20px 100%,
    var(--color-ink);
}
.sr-fit-mirror {
  position: relative; aspect-ratio: 2 / 3; overflow: hidden;
  border: 2px solid var(--color-ink); border-top: 0;
  background: var(--color-cream);
  box-shadow: 6px 6px 0 var(--color-line);
}
.sr-fit-glass {
  position: absolute; inset: 0;
  background:
    linear-gradient(112deg, transparent 0 34%, rgb(255 255 255 / 0.06) 34% 41%, transparent 41% 47%, rgb(255 255 255 / 0.035) 47% 50%, transparent 50%),
    var(--color-cream);
}
.sr-fit-doll { position: absolute; left: 12%; top: 4%; width: 76%; height: 86%; color: var(--color-subtle); }
.sr-fit-floor {
  position: absolute; left: 0; right: 0; bottom: 0; height: 9%; z-index: 1;
  border-top: 2px solid var(--color-line);
  background: repeating-linear-gradient(90deg, var(--color-bg) 0 38px, var(--color-cream) 38px 40px);
}
.sr-fit-hold {
  position: absolute; left: 50%; top: 27%; width: 54%;
  transform: translateX(-50%) rotate(-2.5deg); transform-origin: 50% -18px;
  animation: sr-fit-hold 3.6s ease-in-out infinite alternate;
}
.sr-fit-hold::before {
  content: ""; position: absolute; left: 50%; top: -18px; width: 16px; height: 18px;
  transform: translateX(-50%);
  border: 2px solid var(--color-ink); border-bottom: 0; border-radius: 9px 9px 0 0;
}
.sr-fit-held {
  display: block; width: 100%; aspect-ratio: 1 / 1; object-fit: contain;
  border: 2px solid var(--color-ink); background: var(--color-surface);
}
.sr-fit-shot { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.sr-fit-stamp {
  position: absolute; left: 14px; bottom: 12px; z-index: 1;
  border: 2px solid #17101f; background: #f5ebdd; color: #17101f;
  font-family: var(--font-display); font-size: 0.68rem; letter-spacing: 0.08em; text-transform: uppercase;
  padding: 0.2rem 0.45rem;
}
.sr-fit-drape {
  position: absolute; top: 0; bottom: 6.5%; width: 50.5%; z-index: 2;
  background:
    linear-gradient(to top, #3d2896 0 12px, transparent 12px),
    repeating-linear-gradient(90deg, #7c5cff 0 13px, #6748ec 13px 21px, #9079ff 21px 28px, #5438c9 28px 32px);
  transition: transform 0.85s cubic-bezier(0.22, 0.8, 0.2, 1);
}
.sr-fit-drape-l { left: 0; transform-origin: left center; border-right: 2px solid #2c1c75; }
.sr-fit-drape-r { right: 0; transform-origin: right center; border-left: 2px solid #2c1c75; }
.sr-fit-mirror[data-curtain="parted"] .sr-fit-drape { transform: scaleX(0.16); }
.sr-fit-mirror[data-curtain="wide"] .sr-fit-drape { transform: scaleX(0.05); }
.sr-fit-mirror[data-curtain="shut"] .sr-fit-drape { transform: scaleX(1); }
.sr-fit-mirror[data-curtain="changing"] .sr-fit-drape { transform: scaleX(1); }
.sr-fit-mirror[data-curtain="changing"] .sr-fit-drape-l { animation: sr-fit-sway 1.7s 0.85s ease-in-out infinite alternate; }
.sr-fit-mirror[data-curtain="changing"] .sr-fit-drape-r { animation: sr-fit-sway 2.1s 0.85s ease-in-out infinite alternate-reverse; }
.sr-fit-sign {
  position: absolute; left: 50%; top: 34%; z-index: 3; transform: translateX(-50%) rotate(-3deg);
  transform-origin: 50% -30px; white-space: nowrap;
  border: 2px solid #17101f; background: #f5ebdd; color: #17101f;
  font-family: var(--font-display); font-size: 0.82rem; letter-spacing: 0.08em; text-transform: uppercase;
  padding: 0.5rem 0.8rem; box-shadow: 4px 4px 0 #17101f;
}
.sr-fit-sign::before {
  content: ""; position: absolute; left: 50%; bottom: 100%; width: 2px; height: 30px; background: #f5ebdd;
}
.sr-fit-mirror[data-curtain="changing"] .sr-fit-sign { animation: sr-fit-swing 1.9s ease-in-out infinite alternate; }
.sr-fit-feet {
  position: absolute; left: 50%; bottom: 1.2%; z-index: 2; width: 44%;
  display: flex; justify-content: center; gap: 9%; transform: translateX(-50%);
}
.sr-fit-foot { width: 42%; height: auto; overflow: visible; }
.sr-fit-foot-l { transform: scaleX(-1); animation: sr-fit-step-l 1.5s ease-in-out infinite; }
.sr-fit-foot-r { animation: sr-fit-step-r 1.5s ease-in-out infinite; }
.sr-fit-ticket {
  position: absolute; right: 13%; top: 10px; z-index: 4; width: 46px; height: 46px;
  display: grid; place-items: center; text-align: center; line-height: 1;
  border: 2px solid #17101f; border-radius: 9999px; background: #f5ebdd; color: #17101f;
  font-family: var(--font-display); transform: rotate(7deg); transform-origin: 50% -14px;
}
.sr-fit-ticket::before {
  content: ""; position: absolute; left: 50%; bottom: 100%; width: 2px; height: 14px;
  margin-left: -1px; background: var(--color-ink);
}
.sr-fit-ticket b { display: block; font-size: 1.05rem; font-weight: 400; }
.sr-fit-ticket i { display: block; font-size: 0.5rem; font-style: normal; letter-spacing: 0.08em; text-transform: uppercase; }
@keyframes sr-fit-step-l {
  0%, 40%, 100% { transform: scaleX(-1) translateY(0) rotate(0deg); }
  18% { transform: scaleX(-1) translateY(-7px) rotate(-9deg); }
}
@keyframes sr-fit-step-r {
  0%, 50%, 90%, 100% { transform: translateY(0) rotate(0deg); }
  68% { transform: translateY(-7px) rotate(-9deg); }
}
@keyframes sr-fit-hold {
  from { transform: translateX(-50%) rotate(-2.5deg); }
  to { transform: translateX(-50%) rotate(1.5deg); }
}
@keyframes sr-fit-sway {
  from { transform: scaleX(1.02) skewX(0deg); }
  to { transform: scaleX(1.06) skewX(-1.4deg); }
}
@keyframes sr-fit-swing {
  from { transform: translateX(-50%) rotate(-5deg); }
  to { transform: translateX(-50%) rotate(4deg); }
}
@media (prefers-reduced-motion: reduce) {
  .sr-fit-drape { transition: none; }
  .sr-fit-hold, .sr-fit-sign, .sr-fit-drape, .sr-fit-foot { animation: none !important; }
}
`;

/** A paper-doll outline: someone to hold the piece up against. */
function Doll() {
  return (
    <svg
      className="sr-fit-doll"
      viewBox="0 0 200 300"
      preserveAspectRatio="xMidYMid meet"
      fill="none"
      aria-hidden="true"
    >
      <g stroke="currentColor" strokeWidth="2" strokeDasharray="7 6" strokeLinejoin="round">
        <circle cx="100" cy="36" r="24" fill="rgb(255 255 255 / 0.03)" />
        <path
          d="M100 66 C70 66 50 80 46 106 L36 180 L54 183 L63 124 L64 184 L58 292 L93 292 L100 204 L107 292 L142 292 L136 184 L137 124 L146 183 L164 180 L154 106 C150 80 130 66 100 66 Z"
          fill="rgb(255 255 255 / 0.03)"
        />
      </g>
    </svg>
  );
}

/** One white sneaker, seen under the curtain while someone changes behind it. */
function Sneaker({ side }: { side: "l" | "r" }) {
  return (
    <svg className={`sr-fit-foot sr-fit-foot-${side}`} viewBox="0 0 50 24" fill="none">
      <path
        d="M3 19 L3 8 C3 5 6 4 9 5 L18 9 C25 12 35 11 42 14 C46 15 47 17 47 19 Z"
        fill="#f5ebdd"
        stroke="#17101f"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M14 8 L17 12 M19 10 L22 13" stroke="#17101f" strokeWidth="1.5" />
      <rect x="2" y="19" width="46" height="4" fill="#ff2d95" stroke="#17101f" strokeWidth="1.5" />
    </svg>
  );
}

export function FittingMirror({
  curtain,
  mockupUrl,
  title,
  result,
  resultAlt,
}: {
  curtain: CurtainState;
  mockupUrl: string | null;
  title: string;
  /** The generated picture, or an empty string when there is none to show. */
  result: string;
  resultAlt: string;
}) {
  const drawn = curtain === "changing" || curtain === "shut";
  return (
    <div className="sr-fit mx-auto w-full max-w-[19rem]">
      <style>{CSS}</style>
      <div className="sr-fit-rail" aria-hidden="true" />
      <div className="sr-fit-mirror" data-curtain={curtain}>
        <div className="sr-fit-glass">
          {result ? (
            <>
              <img className="sr-fit-shot" src={result} alt={resultAlt} />
              <span className="sr-fit-stamp">Generated picture</span>
            </>
          ) : (
            <>
              <Doll />
              <div className="sr-fit-hold">
                {mockupUrl ? (
                  <img
                    className="sr-fit-held"
                    src={mockupUrl}
                    alt={`${title}, held up to the mirror`}
                    decoding="async"
                  />
                ) : (
                  <span className="sr-fit-held" />
                )}
              </div>
            </>
          )}
        </div>
        {result ? null : <span className="sr-fit-floor" aria-hidden="true" />}
        {curtain === "changing" ? (
          <span className="sr-fit-feet" aria-hidden="true">
            <Sneaker side="l" />
            <Sneaker side="r" />
          </span>
        ) : null}
        <span className="sr-fit-drape sr-fit-drape-l" aria-hidden="true" />
        <span className="sr-fit-drape sr-fit-drape-r" aria-hidden="true" />
        {drawn ? (
          <span className="sr-fit-sign" aria-hidden="true">
            {curtain === "shut" ? "Closed for now" : "Changing"}
          </span>
        ) : null}
        {curtain === "parted" || curtain === "changing" ? (
          <span className="sr-fit-ticket" aria-hidden="true">
            <span>
              <b>1</b>
              <i>piece</i>
            </span>
          </span>
        ) : null}
      </div>
    </div>
  );
}
