/**
 * The arena's own CSS, kept beside the component so the shared stylesheet stays untouched.
 * Every class starts with `btl-`.
 *
 * The frame is a size container: each picture is sized from the frame (cqw / cqh), not
 * from its own half, so when the seam slides to the split the pictures hold still and the
 * seam cuts across them like a curtain.
 */
export const ARENA_CSS = `
.btl-arena {
  --btl-plate: 4.5rem;
  --btl-seam: 12px;
  container-type: size;
  position: relative;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  height: clamp(27rem, 64dvh, 38rem);
  overflow: hidden;
  border: 2px solid var(--color-ink);
  background: #120a1c;
}
.btl-wait {
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  text-align: center;
}
.btl-side {
  position: relative;
  flex: var(--btl-left, 50) 1 0;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  padding: 0;
  text-align: left;
  font-family: var(--font-sans);
  color: var(--color-fg);
  background: #120a1c;
  transition: flex-grow 820ms var(--ease-out-expo);
  -webkit-tap-highlight-color: transparent;
}
.btl-side-right {
  flex-grow: var(--btl-right, 50);
}
.btl-side[aria-disabled="true"] {
  cursor: default;
}
/* The ring is drawn on top of the picture and the plate, where an outline would sit under them. */
.btl-side:focus-visible {
  outline: none;
}
.btl-side:focus-visible::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 4;
  border: 4px solid var(--color-accent);
  box-shadow: inset 0 0 0 2px #14081c;
  pointer-events: none;
}
/* Each picture is pinned to the outer edge of its side, so it holds still while the seam moves. */
.btl-shot {
  position: absolute;
  bottom: var(--btl-plate);
  left: 0;
  width: 100cqw;
  height: calc(50cqh - var(--btl-plate) - var(--btl-seam) / 2);
  transition:
    filter 520ms ease,
    transform 520ms var(--ease-out-expo);
}
.btl-shot img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  user-select: none;
}
.btl-noshot {
  display: grid;
  height: 100%;
  place-items: center;
  color: var(--color-subtle);
  font-family: var(--font-display);
  font-size: 0.78rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.btl-side[data-lost="true"] .btl-shot {
  filter: grayscale(1) brightness(0.38);
}
.btl-side[data-lost="true"] .btl-plate {
  color: var(--color-subtle);
}
.btl-plate {
  position: absolute;
  inset: auto 0 0 0;
  display: flex;
  height: var(--btl-plate);
  align-items: center;
  gap: 0.75rem;
  padding: 0 0.75rem;
  border-top: 2px solid var(--color-ink);
  background: var(--color-bg);
}
.btl-go {
  display: inline-flex;
  min-height: 2.75rem;
  flex: none;
  align-items: center;
  padding: 0 0.85rem;
  border: 2px solid var(--color-ink);
  background: var(--color-accent);
  color: var(--color-accent-fg);
  box-shadow: 3px 3px 0 var(--color-pipe);
  font-family: var(--font-display);
  font-size: 0.78rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  transition: transform 160ms ease, box-shadow 160ms ease;
}
.btl-go[data-quiet="true"] {
  background: var(--color-surface);
  color: var(--color-fg);
  box-shadow: none;
}
.btl-key {
  position: absolute;
  top: 0.75rem;
  display: none;
  width: 2.25rem;
  height: 2.25rem;
  place-items: center;
  border: 2px solid var(--color-line);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  color: var(--color-muted);
  font-family: var(--font-display);
  font-size: 0.95rem;
}
/* Stacked, the first piece wears its name plate on top, so the seam runs between the two pictures. */
.btl-side-left .btl-shot {
  top: var(--btl-plate);
  bottom: auto;
}
.btl-side-left .btl-plate {
  inset: 0 0 auto 0;
  border-top: 0;
  border-bottom: 2px solid var(--color-ink);
}
.btl-side-left .btl-pct {
  inset: var(--btl-plate) 0 0 0;
}
.btl-side-left .btl-mine {
  top: calc(var(--btl-plate) + 0.85rem);
}
.btl-side-left .btl-key { left: 0.75rem; }
.btl-side-right .btl-key { right: 0.75rem; }
.btl-mine {
  position: absolute;
  top: 0.85rem;
  left: 0.75rem;
  z-index: 2;
  animation: btl-tape 420ms var(--ease-out-expo) both;
}
.btl-pct {
  position: absolute;
  inset: 0 0 var(--btl-plate) 0;
  display: grid;
  place-items: center;
  pointer-events: none;
  font-size: clamp(4rem, 23cqw, 7rem);
  color: var(--color-fg);
  text-shadow: 5px 5px 0 var(--color-pipe);
  /*
   * The number lands by counting up and by its shadow stepping out. It is not scaled or
   * faded in: a transform here made Chromium repaint the name plate in the wrong place
   * while the seam was still moving.
   */
  animation: btl-land 620ms var(--ease-out-expo) both;
}
.btl-pct small {
  font-size: 0.42em;
  margin-left: 0.04em;
}
.btl-side[data-lost="true"] .btl-pct {
  color: var(--color-subtle);
  text-shadow: none;
  animation: none;
}
.btl-seam {
  position: relative;
  z-index: 3;
  flex: 0 0 var(--btl-seam);
  background: var(--color-pipe);
}
.btl-seam::before {
  content: "";
  position: absolute;
  inset: 5px 0;
  background: repeating-linear-gradient(90deg, #14081c 0 12px, transparent 12px 20px);
}
.btl-vs {
  position: absolute;
  top: 50%;
  left: 50%;
  display: grid;
  width: 4rem;
  height: 4rem;
  place-items: center;
  border: 2px solid var(--color-ink);
  background: var(--color-bg);
  color: var(--color-fg);
  box-shadow: 4px 4px 0 var(--color-pipe);
  font-size: 2rem;
  transform: translate(-50%, -50%) rotate(-8deg);
  transition:
    opacity 260ms ease,
    transform 420ms var(--ease-out-expo);
}
/* Once the vote is in the seam is the scoreline, so the mark steps out of the way. */
.btl-arena[data-phase="reveal"] .btl-vs {
  opacity: 0;
  transform: translate(-50%, -50%) rotate(40deg) scale(0.3);
}
.btl-next {
  position: relative;
  display: inline-flex;
  min-height: 3rem;
  align-items: center;
  overflow: hidden;
  padding: 0 1.1rem;
  border: 2px solid var(--color-ink);
  border-radius: var(--radius-md);
  background: var(--color-accent);
  color: var(--color-accent-fg);
  box-shadow: 4px 4px 0 var(--color-pipe);
  font-family: var(--font-display);
  font-size: 0.85rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.btl-next:active { transform: scale(0.98); }
.btl-fuse {
  position: absolute;
  inset: auto 0 0 0;
  height: 5px;
  background: var(--color-accent-fg);
  transform-origin: left;
  animation: btl-fuse ${2800}ms linear both;
}
.btl-ask {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  border: 2px solid var(--color-ink);
  background: var(--color-surface);
  padding: 0.75rem;
}
.btl-ask[data-asked="true"] {
  border-color: var(--color-pipe);
  box-shadow: 4px 4px 0 var(--color-pipe);
  animation: btl-knock 420ms var(--ease-out-expo) both;
}

/* A new pair starts level: nothing eases over from the last result. */
.btl-arena[data-phase="enter"] .btl-side,
.btl-arena[data-phase="enter"] .btl-shot {
  transition: none;
}

/* The pair crashes in from both ends and leaves the way it came. */
.btl-arena[data-phase="enter"] .btl-side-left { animation: btl-in-a 560ms var(--ease-out-expo) both; }
.btl-arena[data-phase="enter"] .btl-side-right { animation: btl-in-b 560ms var(--ease-out-expo) both; }
.btl-arena[data-phase="enter"] .btl-vs { animation: btl-stamp 380ms 330ms var(--ease-out-expo) both; }
.btl-arena[data-phase="enter"] { animation: btl-thud 300ms 380ms ease-out both; }
.btl-arena[data-phase="leave"] .btl-side-left { animation: btl-out-a 260ms cubic-bezier(0.6, 0, 0.9, 0.3) both; }
.btl-arena[data-phase="leave"] .btl-side-right { animation: btl-out-b 260ms cubic-bezier(0.6, 0, 0.9, 0.3) both; }
.btl-arena[data-phase="leave"] .btl-vs { opacity: 0; }

@keyframes btl-in-a { from { transform: translateY(-104%); } to { transform: none; } }
@keyframes btl-in-b { from { transform: translateY(104%); } to { transform: none; } }
@keyframes btl-out-a { from { transform: none; } to { transform: translateY(-104%); } }
@keyframes btl-out-b { from { transform: none; } to { transform: translateY(104%); } }
@keyframes btl-stamp {
  from { opacity: 0; transform: translate(-50%, -50%) rotate(26deg) scale(3); }
  to { opacity: 1; transform: translate(-50%, -50%) rotate(-8deg) scale(1); }
}
@keyframes btl-thud {
  0% { transform: none; }
  35% { transform: scale(1.014); }
  100% { transform: none; }
}
@keyframes btl-land {
  from { text-shadow: 0 0 0 var(--color-pipe); letter-spacing: 0.08em; }
  to { text-shadow: 5px 5px 0 var(--color-pipe); letter-spacing: -0.012em; }
}
@keyframes btl-tape {
  from { opacity: 0; transform: rotate(-14deg) translateY(-140%); }
  to { opacity: 1; transform: rotate(-2deg); }
}
@keyframes btl-fuse { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes btl-knock {
  0% { transform: translateX(0); }
  25% { transform: translateX(-6px); }
  55% { transform: translateX(5px); }
  100% { transform: none; }
}

@media (hover: hover) {
  .btl-arena[data-phase="ready"] .btl-side:hover .btl-shot { transform: scale(1.045); }
  .btl-arena[data-phase="ready"] .btl-side:hover .btl-go {
    transform: translate(-1px, -2px);
    box-shadow: 5px 5px 0 var(--color-pipe);
  }
}

@media (min-width: 640px) {
  .btl-arena {
    flex-direction: row;
    height: clamp(24rem, 56dvh, 38rem);
  }
  .btl-shot {
    top: 0;
    right: 0;
    bottom: auto;
    left: auto;
    width: calc(50cqw - var(--btl-seam) / 2);
    height: calc(100cqh - var(--btl-plate));
  }
  .btl-pct { font-size: clamp(5rem, 15cqw, 11rem); }
  .btl-side-left .btl-shot {
    top: 0;
    right: auto;
    bottom: auto;
    left: 0;
  }
  .btl-side-left .btl-plate {
    inset: auto 0 0 0;
    border-top: 2px solid var(--color-ink);
    border-bottom: 0;
  }
  .btl-side-left .btl-pct {
    inset: 0 0 var(--btl-plate) 0;
  }
  .btl-side-left .btl-mine {
    top: 0.85rem;
  }
  .btl-seam::before {
    inset: 0 5px;
    background: repeating-linear-gradient(180deg, #14081c 0 12px, transparent 12px 20px);
  }
  .btl-plate { padding: 0 1rem; }
  @keyframes btl-in-a { from { transform: translateX(-104%); } to { transform: none; } }
  @keyframes btl-in-b { from { transform: translateX(104%); } to { transform: none; } }
  @keyframes btl-out-a { from { transform: none; } to { transform: translateX(-104%); } }
  @keyframes btl-out-b { from { transform: none; } to { transform: translateX(104%); } }
}
@media (min-width: 640px) and (hover: hover) {
  .btl-key { display: grid; }
  .btl-mine { left: 3.6rem; }
  .btl-side-right .btl-mine { left: 0.75rem; }
}

@media (prefers-reduced-motion: reduce) {
  .btl-arena,
  .btl-arena *,
  .btl-ask,
  .btl-next {
    animation: none !important;
    transition: none !important;
  }
  .btl-fuse { display: none; }
  .btl-arena[data-phase="leave"] .btl-vs { opacity: 1; }
}
`;
