import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Note, StudioShell } from "@/components/studio/shell";
import { encodeQr, qrPngDataUrl, qrSvg, svgDataUrl, tagUrl } from "@/lib/qr";
import { shopPiece } from "@/lib/studio/api";
import { HangTag, TagStyles, type TagFacts } from "./hang-tag";
import { QrFigure } from "./qr-figure";
import { drawStoryCard } from "./story-card";

type Piece = Awaited<ReturnType<typeof shopPiece>>;

function save(href: string, name: string): void {
  const link = document.createElement("a");
  link.href = href;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
}

/** The sheet that goes to the printer: both faces at true size, side by side, and nothing else. */
function PrintSheet({ facts }: { facts: TagFacts }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready) return null;
  return createPortal(
    <div className="srt-sheet" aria-hidden="true">
      <div className="srt-sheet-row">
        <HangTag face="front" facts={facts} />
        <HangTag face="back" facts={facts} />
      </div>
      <p className="srt-sheet-fold">fold here, between the two faces</p>
      <p className="srt-sheet-how">
        Street Royalty crown tag for {facts.title}. Print at 100 percent, not fit to page. Each face
        is 2 by 3.5 inches. Cut around the outside, fold down the middle, glue the halves back to
        back and punch the hole.
      </p>
    </div>,
    document.body,
  );
}

function StoryCard({ facts, piece }: { facts: TagFacts; piece: Piece }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<"drawing" | "ready" | "failed">("drawing");
  const [hasMockup, setHasMockup] = useState(true);

  useEffect(() => {
    let live = true;
    const target = canvas.current;
    if (!target) return;
    setState("drawing");
    void drawStoryCard(target, {
      title: facts.title,
      handle: facts.handle,
      detail: facts.detail,
      mockupUrl: piece.mockupUrl,
      url: facts.url,
    })
      .then((result) => {
        if (!live) return;
        setHasMockup(result.mockup);
        setState("ready");
      })
      .catch(() => {
        if (live) setState("failed");
      });
    return () => {
      live = false;
    };
  }, [facts.title, facts.handle, facts.detail, facts.url, piece.mockupUrl]);

  return (
    <section aria-labelledby="srt-story" className="border-2 border-ink bg-surface p-4">
      <h2 id="srt-story" className="font-display text-sm tracking-wide uppercase">
        The story card
      </h2>
      <p className="mt-1 text-sm text-muted">
        A tall picture for a story or a status, 1080 by 1920. The code on it scans straight off a
        screen.
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-4">
        <canvas
          ref={canvas}
          role="img"
          aria-label={`Story card for ${facts.title} with its crown tag`}
          className={`w-40 flex-none border-2 border-ink bg-bg sm:w-48 ${state === "drawing" ? "pending-pulse" : ""}`}
          style={{ aspectRatio: "9 / 16" }}
        />
        <div className="min-w-0 flex-1 basis-40">
          {state === "failed" ? <Note>The card did not draw in this browser.</Note> : null}
          {state === "ready" && !hasMockup ? (
            <p className="mb-3 text-sm text-muted">
              The picture of the piece could not be copied onto the card, so it shows the crown
              instead.
            </p>
          ) : null}
          <Button
            variant="ghost"
            className="w-full"
            disabled={state !== "ready"}
            onClick={() => {
              const target = canvas.current;
              if (!target) return;
              try {
                save(target.toDataURL("image/png"), `street-royalty-${piece.slug}-story.png`);
              } catch {
                setState("failed");
              }
            }}
          >
            {state === "drawing" ? "Drawing the card" : "Save the card"}
          </Button>
        </div>
      </div>
    </section>
  );
}

function CodeAlone({ facts, slug }: { facts: TagFacts; slug: string }) {
  const [stitched, setStitched] = useState(true);
  const [error, setError] = useState("");
  const options = {
    style: stitched ? ("stitched" as const) : ("square" as const),
    dark: "#17101f",
    light: "#fffaf2",
  };

  return (
    <section aria-labelledby="srt-code" className="border-2 border-ink bg-surface p-4">
      <h2 id="srt-code" className="font-display text-sm tracking-wide uppercase">
        The code on its own
      </h2>
      <p className="mt-1 text-sm text-muted">
        For a sticker, a flyer or your own label. Keep the pale border around it or cameras lose it.
      </p>
      <div className="mt-4 flex flex-wrap items-start gap-4">
        <QrFigure
          url={facts.url}
          label={`Code for ${facts.title} on the rack`}
          stitched={stitched}
          className="w-40 flex-none border-2 border-ink sm:w-48"
        />
        <div className="flex min-w-0 flex-1 basis-40 flex-col gap-3">
          <div className="flex flex-wrap gap-2" role="group" aria-label="How the code is drawn">
            <button
              type="button"
              aria-pressed={stitched}
              onClick={() => setStitched(true)}
              className={`chip ${stitched ? "chip-on" : ""}`}
            >
              Stitched
            </button>
            <button
              type="button"
              aria-pressed={!stitched}
              onClick={() => setStitched(false)}
              className={`chip ${stitched ? "" : "chip-on"}`}
            >
              Square
            </button>
          </div>
          <Button
            variant="ghost"
            onClick={() => {
              const svg = qrSvg(encodeQr(facts.url), {
                ...options,
                title: facts.title,
                pixels: 1024,
              });
              save(svgDataUrl(svg), `street-royalty-${slug}-tag.svg`);
            }}
          >
            Save as SVG
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setError("");
              void qrPngDataUrl(encodeQr(facts.url), 1600, options)
                .then((png) => save(png, `street-royalty-${slug}-tag.png`))
                .catch(() => setError("The picture did not save in this browser. Try the SVG."));
            }}
          >
            Save as PNG
          </Button>
          {error ? <Note>{error}</Note> : null}
        </div>
      </div>
    </section>
  );
}

export function TagPage({ slug, makerHandle }: { slug: string; makerHandle?: string }) {
  const [piece, setPiece] = useState<Piece | null>(null);
  const [problem, setProblem] = useState<"" | "missing" | "failed">("");
  const [attempt, setAttempt] = useState(0);
  const [origin, setOrigin] = useState("");
  const [swing, setSwing] = useState(0);

  useEffect(() => setOrigin(window.location.origin), []);

  useEffect(() => {
    let live = true;
    setPiece(null);
    setProblem("");
    void shopPiece({ data: { slug } })
      .then((next) => {
        if (live) setPiece(next);
      })
      .catch((reason: unknown) => {
        if (!live) return;
        // The rack says so in words when a piece is not there. Anything else is the connection.
        const gone = reason instanceof Error && /not on the rack/i.test(reason.message);
        setProblem(gone ? "missing" : "failed");
      });
    return () => {
      live = false;
    };
  }, [slug, attempt]);

  const facts: TagFacts | null =
    piece && origin
      ? {
          title: piece.title,
          handle: makerHandle,
          detail: [piece.productType, piece.colorName].filter(Boolean).join(" · "),
          colorHex: piece.colorHex,
          url: tagUrl(origin, piece.slug),
        }
      : null;

  return (
    <StudioShell current="/rack">
      <TagStyles />
      <p className="tag">Scan the fit</p>
      <h1 className="mt-3 font-display text-4xl leading-none">The crown tag</h1>

      {problem === "failed" ? (
        <div className="mt-6 max-w-xl">
          <Note>The tag did not load. Check the connection and try again.</Note>
          <Button variant="ghost" className="mt-3" onClick={() => setAttempt((count) => count + 1)}>
            Try again
          </Button>
        </div>
      ) : null}

      {problem === "missing" ? (
        <div className="empty-state mt-6 max-w-xl">
          <h2 className="font-display text-xl uppercase">No piece behind this tag</h2>
          <p className="mt-2 text-muted">
            <span className="bg-surface box-decoration-clone">
              Nothing on the rack answers to “{slug}”. The piece may have been taken down, or the
              link lost a letter on the way here.
            </span>
          </p>
          <Link to="/rack" className="chip chip-on mt-4">
            Go to the rack
          </Link>
        </div>
      ) : null}

      {!problem && !facts ? (
        <p className="pending-pulse mt-6 text-muted" role="status">
          Cutting the tag.
        </p>
      ) : null}

      {piece && facts ? (
        <>
          <p className="mt-2 max-w-xl text-muted">
            Someone sees the fit, scans the tag and lands on{" "}
            <Link to="/rack/$slug" params={{ slug: piece.slug }} className="text-fg underline">
              {piece.title}
            </Link>
            : who made it, how to buy it, how to remix it.
          </p>
          <p className="mt-3 max-w-xl border-l-4 border-pipe pl-3 text-sm text-muted">
            Printing this inside the neck is not wired to the printer yet. Today this is a tag you
            print or post yourself.
          </p>

          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
            <section aria-labelledby="srt-hang" className="min-w-0">
              <div className="border-2 border-ink bg-cream">
                <div className="srt-stage" key={swing}>
                  <span className="srt-rail" aria-hidden="true" />
                  <div className="srt-hang">
                    <HangTag face="front" facts={facts} />
                  </div>
                  <div className="srt-hang">
                    <HangTag face="back" facts={facts} />
                  </div>
                </div>
              </div>
              <h2 id="srt-hang" className="mt-4 font-display text-sm tracking-wide uppercase">
                The hang tag
              </h2>
              <p className="mt-1 max-w-xl text-sm text-muted">
                Two faces, 2 by 3.5 inches each. Print at 100 percent on card, cut it out, fold it,
                glue it and punch the hole. Only the tag prints.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button onClick={() => window.print()}>Print the tag</Button>
                <Button variant="ghost" onClick={() => setSwing((count) => count + 1)}>
                  Give it a swing
                </Button>
              </div>
            </section>

            <div className="flex min-w-0 flex-col gap-6">
              <StoryCard facts={facts} piece={piece} />
              <CodeAlone facts={facts} slug={piece.slug} />
            </div>
          </div>
          <PrintSheet facts={facts} />
        </>
      ) : null}
    </StudioShell>
  );
}
