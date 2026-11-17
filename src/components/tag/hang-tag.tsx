import { Eye, Repeat2, ScanLine } from "lucide-react";
import { plainLink } from "@/lib/qr/handle";
import { CrownMark } from "./crown-mark";
import { QrFigure } from "./qr-figure";
import { titleSize } from "./title-size";

/**
 * One face of the swing tag: 2 by 3.5 inches, clipped corners, a punched hole.
 * Every size inside is a share of `--in`, so the same markup is a picture on
 * screen and a true-size object on paper.
 */

export type TagFacts = {
  title: string;
  /** Without the @. */
  handle?: string;
  /** What the piece is, such as "Hoodie · Black". */
  detail: string;
  /** Where the code sends people. */
  url: string;
};

function Stitching({ color }: { color: string }) {
  return (
    <svg
      className="srt-stitch"
      viewBox="0 0 200 350"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <polygon
        points="32,8 168,8 192,32 192,342 8,342 8,32"
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeDasharray="7 4.5"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function HangTag({ face, facts }: { face: "front" | "back"; facts: TagFacts }) {
  if (face === "front") {
    return (
      <div className="srt-tag srt-front" data-face="front">
        <div className="srt-face">
          <div className="srt-in">
            <Stitching color="#ff2d95" />
            <span className="srt-hole" aria-hidden="true" />
            <CrownMark className="srt-crown" />
            <p className="srt-label">Street Royalty</p>
            <p
              className="srt-title display"
              style={{ fontSize: `calc(${titleSize(facts.title)} * var(--in))` }}
            >
              {facts.title}
            </p>
            {facts.handle ? (
              <p className="srt-maker">
                <span className="srt-label">made by</span>
                <span className="srt-handle">@{facts.handle}</span>
              </p>
            ) : null}
            <div className="srt-foot">
              <span>{facts.detail}</span>
              <span>Made to order</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="srt-tag srt-back" data-face="back">
      <div className="srt-face">
        <div className="srt-in">
          <Stitching color="#17101f" />
          <span className="srt-hole" aria-hidden="true" />
          <QrFigure
            url={facts.url}
            label={`Code for ${facts.title} on the rack`}
            className="srt-code"
          />
          <p className="srt-scan display">Scan the fit.</p>
          <p className="srt-say">See who made it. Remix it.</p>
          <ul className="srt-care" aria-hidden="true">
            <li>
              <ScanLine strokeWidth={2.4} />
              scan
            </li>
            <li>
              <Eye strokeWidth={2.4} />
              see
            </li>
            <li>
              <Repeat2 strokeWidth={2.4} />
              remix
            </li>
          </ul>
          <p className="srt-link">{plainLink(facts.url)}</p>
        </div>
      </div>
    </div>
  );
}

/** Styles for the tag, the rail it hangs from, and the sheet that prints. One copy per page. */
export function TagStyles() {
  return <style>{CSS}</style>;
}

const SHAPE = "polygon(13% 0, 87% 0, 100% 7.4%, 100% 100%, 0 100%, 0 7.4%)";

const CSS = `
.srt-stage { --in: clamp(70px, 20.5vw, 116px); }
.srt-tag {
  position: relative;
  flex: none;
  width: calc(2 * var(--in));
  height: calc(3.5 * var(--in));
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.srt-face {
  position: absolute;
  inset: 0;
  clip-path: ${SHAPE};
  background: #17101f;
}
.srt-front .srt-face { background: #f5ebdd; }
.srt-in {
  position: absolute;
  inset: calc(0.02 * var(--in));
  clip-path: ${SHAPE};
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: calc(0.5 * var(--in)) calc(0.2 * var(--in)) calc(0.2 * var(--in));
  overflow: hidden;
}
.srt-front .srt-in {
  color: #f5ebdd;
  background-color: #0b0614;
  background-image: radial-gradient(rgb(255 255 255 / 11%) 0.7px, transparent 0.8px);
  background-size: calc(0.07 * var(--in)) calc(0.07 * var(--in));
}
.srt-back .srt-in { color: #17101f; background: #f5ebdd; }
.srt-stitch { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.srt-hole {
  position: absolute;
  top: calc(0.15 * var(--in));
  left: 50%;
  width: calc(0.19 * var(--in));
  height: calc(0.19 * var(--in));
  margin-left: calc(-0.095 * var(--in));
  border-radius: 50%;
  background: var(--srt-through, #161022);
  box-shadow: 0 0 0 calc(0.035 * var(--in)) #ff2d95, 0 0 0 calc(0.05 * var(--in)) #14081c;
}
.srt-crown {
  width: calc(0.74 * var(--in));
  height: auto;
  color: #f5ebdd;
  filter: drop-shadow(calc(0.03 * var(--in)) calc(0.03 * var(--in)) 0 #ff2d95);
}
.srt-label {
  font-family: var(--font-display);
  font-size: calc(0.085 * var(--in));
  letter-spacing: 0.18em;
  text-transform: uppercase;
  line-height: 1.2;
}
.srt-front .srt-crown + .srt-label { margin-top: calc(0.1 * var(--in)); color: #b7a8d4; }
.srt-title {
  margin-top: auto;
  padding: 0 0.06em;
  max-width: 100%;
  overflow-wrap: anywhere;
}
.srt-maker {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: calc(0.14 * var(--in));
  margin-bottom: auto;
}
.srt-maker .srt-label { color: #b7a8d4; }
.srt-handle {
  font-family: var(--font-display);
  font-size: calc(0.17 * var(--in));
  line-height: 1.15;
  overflow-wrap: anywhere;
}
.srt-title:last-of-type { margin-bottom: auto; }
.srt-foot {
  display: flex;
  justify-content: space-between;
  gap: calc(0.08 * var(--in));
  width: 100%;
  margin-top: calc(0.1 * var(--in));
  padding-top: calc(0.07 * var(--in));
  border-top: calc(0.012 * var(--in)) solid #3a2d52;
  font-family: var(--font-display);
  font-size: calc(0.068 * var(--in));
  letter-spacing: 0.08em;
  text-transform: uppercase;
  text-align: left;
  color: #d5cbe8;
}
.srt-foot span:last-child { text-align: right; flex: none; }
.srt-code {
  width: calc(1.46 * var(--in));
  border: calc(0.02 * var(--in)) solid #17101f;
  background: #fffaf2;
  box-shadow: calc(0.04 * var(--in)) calc(0.04 * var(--in)) 0 #ff2d95;
}
.srt-scan {
  margin-top: calc(0.17 * var(--in));
  font-size: calc(0.27 * var(--in));
  white-space: nowrap;
}
.srt-say {
  margin-top: calc(0.06 * var(--in));
  font-size: calc(0.115 * var(--in));
  font-weight: 600;
  line-height: 1.25;
}
.srt-care {
  display: flex;
  justify-content: center;
  gap: calc(0.16 * var(--in));
  margin-top: auto;
  padding-top: calc(0.07 * var(--in));
  width: 100%;
  border-top: calc(0.012 * var(--in)) solid #17101f;
  font-family: var(--font-display);
  font-size: calc(0.06 * var(--in));
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.srt-care li { display: flex; flex-direction: column; align-items: center; gap: calc(0.02 * var(--in)); }
.srt-care svg { width: calc(0.17 * var(--in)); height: calc(0.17 * var(--in)); }
.srt-link {
  margin-top: calc(0.05 * var(--in));
  max-width: 100%;
  font-size: calc(0.058 * var(--in));
  line-height: 1.2;
  overflow-wrap: anywhere;
  color: #4a4058;
}

/* The rail and the string. */
.srt-stage {
  position: relative;
  display: flex;
  justify-content: center;
  gap: clamp(10px, 3vw, 28px);
  padding: 0 0 clamp(20px, 5vw, 36px);
  overflow: hidden;
}
.srt-rail {
  position: absolute;
  top: 14px;
  left: -2px;
  right: -2px;
  height: 10px;
  background: #f5ebdd;
  border: 2px solid #14081c;
  box-shadow: 0 4px 0 #ff2d95;
  z-index: 2;
}
.srt-hang {
  position: relative;
  padding-top: 62px;
  transform-origin: 50% 19px;
  animation: srt-drop 2.6s cubic-bezier(0.3, 0.6, 0.4, 1) both, srt-sway 5.5s ease-in-out 2.6s infinite alternate;
}
.srt-hang:nth-child(3) { animation-delay: 0.18s, 2.78s; animation-duration: 2.9s, 6.4s; }
.srt-hang::before {
  content: "";
  position: absolute;
  top: 19px;
  left: 50%;
  width: 3px;
  margin-left: -1.5px;
  height: calc(43px + 0.245 * var(--in));
  background: repeating-linear-gradient(180deg, #f5ebdd 0 5px, #d8c8b1 5px 8px);
  z-index: 3;
}
@keyframes srt-drop {
  0% { transform: translateY(-40px) rotate(11deg); opacity: 0; }
  12% { opacity: 1; }
  22% { transform: translateY(0) rotate(-7deg); }
  42% { transform: rotate(4.5deg); }
  62% { transform: rotate(-2.6deg); }
  82% { transform: rotate(1.4deg); }
  100% { transform: rotate(-0.7deg); }
}
@keyframes srt-sway {
  from { transform: rotate(-0.7deg); }
  to { transform: rotate(0.9deg); }
}
@media (prefers-reduced-motion: reduce) {
  .srt-hang { animation: none; }
}

/* The sheet only exists on paper. */
.srt-sheet { display: none; }
@media print {
  @page { margin: 0.5in; }
  html, body { background: #fff !important; }
  body::before { display: none !important; }
  body > *:not(.srt-sheet) { display: none !important; }
  .srt-sheet {
    --in: 1in;
    --srt-through: #fff;
    display: block !important;
    color: #000;
    background: #fff;
    font-family: var(--font-sans);
  }
  .srt-sheet-row { display: flex; width: 4in; }
  .srt-sheet-fold {
    width: 4in;
    margin: 0;
    padding-top: 0.08in;
    font-size: 8pt;
    text-align: center;
  }
  .srt-sheet-how { width: 4in; margin-top: 0.14in; font-size: 9pt; line-height: 1.35; }
}
`;
