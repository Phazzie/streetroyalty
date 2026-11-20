import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, Check, Copy, Download, Plus, Trash2 } from "lucide-react";
import { boardBlob, drawBoard } from "@/components/episodes/reference-board";
import { cn } from "@/lib/cn";
import { boardFileName } from "@/lib/episodes/board";
import {
  activeCharacter,
  addCharacter,
  characterLabel,
  defaultCast,
  MAX_CHARACTERS,
  MAX_NAME,
  MAX_PIECES,
  parseSavedCast,
  removeCharacter,
  renameActive,
  SAVED_CAST_KEY,
  selectCharacter,
  togglePiece,
  type SavedCast,
} from "@/lib/episodes/saved-cast";
import {
  buildWardrobeSheet,
  isMissing,
  resolveRefs,
  sheetPieceFromDesign,
  sheetPieceFromProduct,
  type SheetPiece,
} from "@/lib/episodes/sheet";
import { refKey } from "@/lib/episodes/types";
import type { SheetProduct } from "@/lib/episodes/sheet";
import { shopList } from "@/lib/studio/api";
import type { DesignSummary } from "@/lib/studio/models";

const RACK_PREVIEW = 6;

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const done = document.execCommand("copy");
      area.remove();
      return done;
    } catch {
      return false;
    }
  }
}

function CopyButton({
  text,
  label,
  primary = false,
}: {
  text: string;
  label: string;
  primary?: boolean;
}) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  return (
    <button
      type="button"
      onClick={() => {
        void copyText(text).then((done) => {
          setState(done ? "done" : "failed");
          if (timer.current) window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => setState("idle"), 2200);
        });
      }}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 px-3 font-display text-xs tracking-wider uppercase",
        primary
          ? "bg-accent text-accent-fg"
          : "border-2 border-ink bg-transparent text-fg hover:bg-fg/10",
      )}
    >
      {state === "done" ? (
        <Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" />
      ) : (
        <Copy className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
      )}
      <span aria-live="polite">
        {state === "done" ? "Copied" : state === "failed" ? "Select it and copy by hand" : label}
      </span>
    </button>
  );
}

function PickCard({
  piece,
  on,
  full,
  onToggle,
}: {
  piece: SheetPiece;
  on: boolean;
  full: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="ep-pick p-1.5"
      aria-pressed={on}
      disabled={!on && full}
      onClick={onToggle}
    >
      <span className="relative block aspect-[4/5] overflow-hidden bg-cream">
        {piece.imageUrl ? (
          <img
            src={piece.imageUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : null}
        {on ? (
          <span className="eyebrow absolute top-0 left-0 flex items-center gap-1 bg-ink px-2 py-1 text-bg">
            <Check className="h-3 w-3" strokeWidth={4} aria-hidden="true" />
            Wearing
          </span>
        ) : null}
      </span>
      <span className="mt-1.5 block px-0.5 font-display text-xs leading-tight uppercase">
        {piece.name}
      </span>
      <span className="flex items-center gap-1.5 px-0.5 pb-0.5 text-xs text-muted">
        {piece.baseColor?.hex ? (
          <span
            className="inline-block h-3 w-3 shrink-0 border border-ink"
            style={{ background: piece.baseColor.hex }}
            aria-hidden="true"
          />
        ) : null}
        <span className="truncate">{piece.baseColor?.name ?? piece.garment}</span>
      </span>
    </button>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="border-t-2 border-ink pt-4">
      <h3 className="flex items-baseline gap-3">
        <span className="ep-tc text-sm text-subtle">{String(n).padStart(2, "0")}</span>
        <span className="display text-4xl">{title}</span>
      </h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/**
 * The wardrobe sheet builder. Name a character, pick what they wear, and take
 * away a reference board and a block of words that keep the outfit the same in
 * every shot. Nothing is sent anywhere: the cast is kept in this browser.
 */
export function WardrobeBuilder({ products }: { products: SheetProduct[] }) {
  const [cast, setCast] = useState<SavedCast>(defaultCast);
  const [ready, setReady] = useState(false);
  const [rack, setRack] = useState<DesignSummary[] | null>(null);
  const [rackError, setRackError] = useState(false);
  const [allRack, setAllRack] = useState(false);
  const [noPicture, setNoPicture] = useState<string[]>([]);
  const [boardNote, setBoardNote] = useState("");
  const [ticks, setTicks] = useState<Record<string, boolean>>({});
  const [shot, setShot] = useState(1);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const run = useRef(0);

  useEffect(() => {
    try {
      setCast(parseSavedCast(window.localStorage.getItem(SAVED_CAST_KEY)));
    } catch {
      // Private windows can refuse storage. The builder still works, it just forgets.
    }
    setReady(true);
    void shopList()
      .then(setRack)
      .catch(() => {
        setRack([]);
        setRackError(true);
      });
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(SAVED_CAST_KEY, JSON.stringify(cast));
    } catch {
      // See above.
    }
  }, [cast, ready]);

  const active = activeCharacter(cast);
  const have = useMemo(() => ({ products, rack: rack ?? [] }), [products, rack]);
  const resolved = useMemo(() => resolveRefs(active.pieces, have), [active.pieces, have]);
  // A rack piece cannot be told from a missing one until the rack has loaded.
  const pending = rack === null && active.pieces.some((ref) => ref.kind === "rack");
  const gone = pending ? [] : resolved.filter(isMissing);
  const pieces = useMemo(
    () => resolved.filter((piece): piece is SheetPiece => !isMissing(piece)),
    [resolved],
  );
  const sheet = useMemo(
    () => buildWardrobeSheet({ character: active.name, pieces }),
    [active.name, pieces],
  );
  const drop = useMemo(() => products.map(sheetPieceFromProduct), [products]);
  const customs = useMemo(() => (rack ?? []).map(sheetPieceFromDesign), [rack]);
  const shownCustoms = allRack ? customs : customs.slice(0, RACK_PREVIEW);
  const wearing = new Set(active.pieces.map(refKey));
  const full = active.pieces.length >= MAX_PIECES;
  const boardKey = pieces.map((piece) => refKey(piece.ref)).join("|");

  useEffect(() => {
    const node = canvas.current;
    // Bumped even for an empty outfit, so a board still loading for the last one is dropped.
    const mine = (run.current += 1);
    setBoardNote("");
    if (!node || pieces.length === 0) {
      setNoPicture([]);
      return;
    }
    void drawBoard(node, { character: active.name, pieces }, () => run.current !== mine)
      .then((result) => {
        if (!result || run.current !== mine) return;
        setNoPicture(result.withoutPicture);
      })
      .catch(() => {
        if (run.current === mine) {
          setBoardNote("The board could not be drawn in this browser. The words below still work.");
        }
      });
    // pieces is covered by boardKey: same keys, same pieces.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardKey, active.name]);

  const checked = sheet.checklist.filter((item) => ticks[item]).length;

  const sheetTop = useRef<HTMLDivElement | null>(null);
  const toSheet = () => {
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    sheetTop.current?.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
  };

  const download = async () => {
    const node = canvas.current;
    if (!node) return;
    const blob = await boardBlob(node);
    if (!blob) {
      setBoardNote("This browser would not save the board. Take a screenshot of it instead.");
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = boardFileName(sheet.character);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
    setBoardNote(`Saved as ${link.download}.`);
  };

  return (
    <div className="grid gap-10 lg:grid-cols-2 lg:gap-12">
      <div className="flex min-w-0 flex-col gap-8">
        <Step n={1} title="Who is it">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Cast">
            {cast.characters.map((character, index) => (
              <button
                key={character.id}
                type="button"
                aria-pressed={character.id === active.id}
                onClick={() => setCast((before) => selectCharacter(before, character.id))}
                className={cn(
                  "min-h-11 max-w-full truncate border-2 border-ink px-3 font-display text-xs tracking-wider uppercase",
                  character.id === active.id
                    ? "bg-ink text-bg"
                    : "bg-transparent text-fg hover:bg-fg/10",
                )}
              >
                {characterLabel(character, index)}
                <span className="ep-tc ml-2 opacity-70">{character.pieces.length}</span>
              </button>
            ))}
            {cast.characters.length < MAX_CHARACTERS ? (
              <button
                type="button"
                onClick={() => setCast(addCharacter)}
                className="inline-flex min-h-11 items-center gap-1.5 border-2 border-dashed border-ink px-3 font-display text-xs tracking-wider uppercase hover:bg-fg/10"
              >
                <Plus className="h-4 w-4" strokeWidth={3} aria-hidden="true" />
                Add a character
              </button>
            ) : null}
          </div>
          <div className="mt-4 flex items-end gap-2">
            <label className="min-w-0 flex-1">
              <span className="eyebrow text-subtle">Character name</span>
              <input
                type="text"
                value={active.name}
                maxLength={MAX_NAME}
                onChange={(event) => setCast((before) => renameActive(before, event.target.value))}
                placeholder="What they are called on screen"
                autoComplete="off"
                className="mt-1 h-12 w-full border-2 border-ink bg-surface px-3 font-sans text-base text-fg placeholder:text-subtle"
              />
            </label>
            <button
              type="button"
              onClick={() => setCast((before) => removeCharacter(before, active.id))}
              className="grid h-12 w-12 shrink-0 place-items-center border-2 border-ink hover:bg-fg/10"
              aria-label={
                cast.characters.length > 1
                  ? `Remove ${characterLabel(active, cast.characters.indexOf(active))}`
                  : "Clear this character"
              }
            >
              <Trash2 className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <p className="mt-2 text-sm text-muted">Kept in this browser. Nothing is sent anywhere.</p>
        </Step>

        <Step n={2} title="What they wear">
          <p className="text-sm text-muted">
            Tap a piece to put it on, tap again to take it off. Up to {MAX_PIECES}, so the board
            stays readable.{" "}
            <span className="ep-tc text-fg">
              {active.pieces.length}/{MAX_PIECES}
            </span>
          </p>

          <h4 className="eyebrow mt-5">The sets</h4>
          {drop.length === 0 ? (
            <p className="mt-2 border-2 border-dashed border-line px-3 py-4 text-sm text-muted">
              The sets are empty right now.
            </p>
          ) : (
            <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {drop.map((piece) => (
                <PickCard
                  key={refKey(piece.ref)}
                  piece={piece}
                  on={wearing.has(refKey(piece.ref))}
                  full={full}
                  onToggle={() => setCast((before) => togglePiece(before, piece.ref))}
                />
              ))}
            </div>
          )}

          <h4 className="eyebrow mt-6">The rack</h4>
          {rack === null ? (
            <p className="mt-2 text-sm text-muted">Loading the rack.</p>
          ) : rackError ? (
            <p className="mt-2 border-2 border-dashed border-line px-3 py-4 text-sm text-muted">
              The rack did not load. The sets above still work.
            </p>
          ) : customs.length === 0 ? (
            <p className="mt-2 border-2 border-dashed border-line px-3 py-4 text-sm text-muted">
              Nothing is on the rack yet. Pieces published from the studio show up here.
            </p>
          ) : (
            <>
              <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {shownCustoms.map((piece) => (
                  <PickCard
                    key={refKey(piece.ref)}
                    piece={piece}
                    on={wearing.has(refKey(piece.ref))}
                    full={full}
                    onToggle={() => setCast((before) => togglePiece(before, piece.ref))}
                  />
                ))}
              </div>
              {customs.length > RACK_PREVIEW ? (
                <button
                  type="button"
                  onClick={() => setAllRack((value) => !value)}
                  className="mt-3 inline-flex min-h-11 items-center border-b-2 border-fg font-display text-xs tracking-wider uppercase"
                  aria-expanded={allRack}
                >
                  {allRack ? "Show fewer" : `Show all ${customs.length}`}
                </button>
              ) : null}
            </>
          )}
          {gone.length > 0 ? (
            <div className="mt-4 border-2 border-ink bg-surface px-3 py-3 text-sm">
              <p>
                {gone.length === 1 ? "One saved piece is" : `${gone.length} saved pieces are`} no
                longer on the site and {gone.length === 1 ? "is" : "are"} left off the sheet.
              </p>
              <button
                type="button"
                onClick={() =>
                  setCast((before) =>
                    gone.reduce((next, piece) => togglePiece(next, piece.ref), before),
                  )
                }
                className="mt-1 inline-flex min-h-11 items-center border-b-2 border-fg font-display text-xs tracking-wider uppercase"
              >
                Take {gone.length === 1 ? "it" : "them"} off
              </button>
            </div>
          ) : null}
          {pieces.length > 0 ? (
            <button
              type="button"
              onClick={toSheet}
              className="sticky bottom-3 z-10 mt-5 flex min-h-12 w-full items-center justify-between gap-3 border-2 border-ink bg-ink px-4 text-left text-bg shadow-[4px_4px_0_var(--color-pipe)] lg:hidden"
            >
              <span className="min-w-0">
                <span className="ep-tc block text-xs opacity-80">
                  {pieces.length} on {sheet.character}
                </span>
                <span className="block font-display text-xs tracking-wider uppercase">
                  See the board and the words
                </span>
              </span>
              <ArrowDown className="h-5 w-5 shrink-0" strokeWidth={3} aria-hidden="true" />
            </button>
          ) : null}
        </Step>
      </div>

      <div ref={sheetTop} className="flex min-w-0 scroll-mt-20 flex-col gap-8">
        <Step n={3} title="Take it to the shoot">
          {pieces.length === 0 ? (
            <div className="border-2 border-dashed border-ink px-5 py-12 text-center">
              <p className="display text-4xl">No outfit yet.</p>
              <p className="mx-auto mt-3 max-w-xs text-muted">
                Pick at least one piece. The board and the words show up here.
              </p>
            </div>
          ) : null}

          <div className={pieces.length === 0 ? "hidden" : undefined}>
            <h4 className="eyebrow">Reference board</h4>
            <p className="mt-1 text-sm text-muted">
              Upload this picture as the image reference for every shot of {sheet.character}.
            </p>
            <canvas
              ref={canvas}
              width={1920}
              height={1080}
              className="mt-3 block h-auto w-full border-2 border-ink bg-surface"
              role="img"
              aria-label={`Reference board for ${sheet.character}: ${pieces.map((piece) => piece.name).join(", ")}`}
            />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void download()}
                className="inline-flex min-h-11 items-center gap-2 bg-accent px-4 font-display text-xs tracking-wider text-accent-fg uppercase"
              >
                <Download className="h-4 w-4" strokeWidth={3} aria-hidden="true" />
                Download the board
              </button>
              <span className="ep-tc text-xs text-subtle">PNG 1920 x 1080</span>
            </div>
            <p className="mt-2 min-h-5 text-sm text-muted" aria-live="polite">
              {boardNote}
            </p>
            {noPicture.length > 0 ? (
              <p className="mt-1 text-sm text-muted">
                No picture could be loaded for {noPicture.join("; ")}. The board shows the base
                colour instead, so attach a picture of {noPicture.length === 1 ? "it" : "them"} by
                hand.
              </p>
            ) : null}
            <p className="mt-1 text-sm text-muted">
              The small swatches on the board are measured from each picture, so they are a guide.
              The words below only use colours on record. Pictures of the sets are generated, not
              photos of finished garments.
            </p>
          </div>

          {pieces.length > 0 ? (
            <>
              <div className="mt-8">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="eyebrow">Wardrobe block</h4>
                  <CopyButton text={sheet.block} label="Copy the block" />
                </div>
                <pre className="ep-pre mt-2 border-2 border-ink bg-surface p-3" tabIndex={0}>
                  {sheet.block}
                </pre>
              </div>

              <div className="mt-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="eyebrow">Continuity</h4>
                  <CopyButton text={sheet.continuity} label="Copy continuity" />
                </div>
                <pre className="ep-pre mt-2 border-2 border-ink bg-surface p-3" tabIndex={0}>
                  {sheet.continuity}
                </pre>
              </div>

              <div className="mt-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="eyebrow">
                    Check every shot ·{" "}
                    <span className="ep-tc">Shot {String(shot).padStart(2, "0")}</span>
                  </h4>
                  <span className="ep-tc text-sm text-subtle" aria-live="polite">
                    {checked}/{sheet.checklist.length}
                  </span>
                </div>
                <ul className="mt-2 border-2 border-ink bg-surface">
                  {sheet.checklist.map((item) => (
                    <li key={item} className="border-b border-line last:border-b-0">
                      <label className="flex min-h-11 cursor-pointer items-start gap-3 px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={Boolean(ticks[item])}
                          onChange={(event) =>
                            setTicks((before) => ({ ...before, [item]: event.target.checked }))
                          }
                          className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-ink)]"
                        />
                        <span className={ticks[item] ? "text-muted line-through" : undefined}>
                          {item}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTicks({});
                      setShot((value) => value + 1);
                    }}
                    className="min-h-11 border-2 border-ink px-3 font-display text-xs tracking-wider uppercase hover:bg-fg/10"
                  >
                    Next shot
                  </button>
                  <CopyButton
                    text={sheet.checklist.map((item) => `[ ] ${item}`).join("\n")}
                    label="Copy the checklist"
                  />
                </div>
              </div>

              <div className="mt-8 border-t-2 border-ink pt-4">
                <CopyButton text={sheet.text} label="Copy all of it" primary />
              </div>
            </>
          ) : null}
        </Step>
      </div>
    </div>
  );
}
