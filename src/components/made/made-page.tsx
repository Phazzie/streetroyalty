import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Diagram, DIAGRAM_CSS, PrintedOrSewn } from "@/components/made/diagrams";
import { SiteShell } from "@/components/site/shell";
import { ENTRIES, type Entry } from "@/lib/made/glossary";
import { MAKERS, METHODS, sourcesOf, type Claim, type Maker } from "@/lib/made/makers";
import { getStudioConfig } from "@/lib/studio/api";

const PAGE_CSS = `
.mw-card{position:relative;display:flex;flex-direction:column;border:2px solid var(--color-ink);background:var(--color-surface)}
.mw-stage{border-bottom:2px solid var(--color-ink);padding:0.9rem 1.1rem;
  background:radial-gradient(color-mix(in srgb,var(--color-fg) 22%,transparent) 1px,transparent 1.2px) 0 0/9px 9px}
.mw-no{position:absolute;top:-2px;right:-2px;border:2px solid var(--color-ink);background:var(--color-bg);
  padding:0.1rem 0.45rem;font-family:var(--font-display);font-size:0.68rem;letter-spacing:0.12em}
.mw-card:target{box-shadow:6px 6px 0 var(--color-pipe)}
.mw-jump{scroll-margin-top:5.5rem}
.mw-yes{display:inline-block;width:0.85rem;height:0.85rem;background:var(--color-fg);vertical-align:-1px}
.mw-unknown{display:inline-block;width:0.85rem;height:0.85rem;border:2px dashed var(--color-subtle);vertical-align:-1px}
html{scroll-behavior:smooth}
@media (prefers-reduced-motion: reduce){html{scroll-behavior:auto}}
`;

const JUMPS = [
  { href: "#words", label: "The words" },
  { href: "#today", label: "Today and soon" },
  { href: "#printed-or-sewn", label: "Printed or sewn" },
  { href: "#who", label: "Who makes what" },
];

function EntryCard({ entry, index }: { entry: Entry; index: number }) {
  return (
    <article id={entry.id} className="mw-card mw-jump">
      <span className="mw-no" aria-hidden="true">
        No. {String(index + 1).padStart(2, "0")}
      </span>
      <div className="mw-stage">
        <Diagram id={entry.id} label={entry.drawing} />
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="display text-4xl">{entry.short}</h3>
        <p className="eyebrow mt-1.5 text-subtle">{entry.name}</p>
        <p className="mt-3 text-[0.98rem] leading-relaxed">{entry.body}</p>
      </div>
    </article>
  );
}

function Mark({ claim }: { claim: Claim }) {
  if (claim.status === "says-yes") {
    return (
      <a
        href={claim.sourceUrl}
        target="_blank"
        rel="noreferrer"
        title={claim.saw}
        className="flex min-h-11 items-center justify-center gap-1.5 font-display text-xs uppercase underline decoration-2 underline-offset-4"
      >
        <span aria-hidden="true" className="mw-yes" />
        Yes
      </a>
    );
  }
  return (
    <span className="flex min-h-11 items-center justify-center gap-1.5 text-xs text-subtle">
      <span aria-hidden="true" className="mw-unknown" />
      <span className="sr-only sm:not-sr-only">Not checked</span>
    </span>
  );
}

function Receipts({ maker }: { maker: Maker }) {
  const rows: { label: string; claim: Claim }[] = [
    { label: "Who does the making", claim: maker.whoMakesIt },
    { label: "One piece at a time", claim: maker.noMinimum },
    ...METHODS.map((method) => ({ label: method.label, claim: maker.methods[method.id] })),
  ];
  return (
    <details className="border-2 border-ink bg-surface">
      <summary className="flex min-h-12 items-center justify-between gap-3 px-4 font-display text-sm uppercase">
        <span>{maker.name}</span>
        <span className="font-sans text-xs tracking-normal text-subtle normal-case">
          checked {maker.checkedOn}
        </span>
      </summary>
      <ul className="grid gap-3 border-t-2 border-line px-4 py-3 text-sm">
        {rows.map((row) => (
          <li key={row.label}>
            <span className="font-bold">{row.label}.</span>{" "}
            {row.claim.status === "says-yes" ? (
              <>
                {row.claim.saw} {row.claim.note ? `${row.claim.note} ` : ""}
                <a
                  href={row.claim.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all underline decoration-2 underline-offset-4"
                >
                  {row.claim.sourceUrl.replace(/^https:\/\/(www\.)?/, "")}
                </a>
              </>
            ) : (
              <span className="text-subtle">Not checked.</span>
            )}
          </li>
        ))}
        <li className="text-xs text-subtle">
          {sourcesOf(maker).length} pages read on {maker.name}'s own site, {maker.checkedOn}.
        </li>
      </ul>
    </details>
  );
}

export function MadePage() {
  const [mode, setMode] = useState<"sandbox" | "live" | "">("");

  useEffect(() => {
    void getStudioConfig()
      .then((config) => setMode(config.podMode))
      .catch(() => setMode(""));
  }, []);

  const methods = ENTRIES.filter((entry) => entry.group === "method");
  const words = ENTRIES.filter((entry) => entry.group === "word");

  return (
    <SiteShell theme="night">
      <style>{DIAGRAM_CSS + PAGE_CSS}</style>

      <header className="mx-auto w-full max-w-7xl px-4 pt-10 pb-12 sm:px-6 lg:pt-16">
        <p className="eyebrow text-subtle">Field guide</p>
        <h1 className="display mt-3 text-7xl sm:text-8xl lg:text-9xl">How it's made</h1>
        <p className="mt-5 max-w-xl text-lg text-muted">
          Print shops talk in letters. DTG. DTF. AOP. Here is what each one means, what it does
          to the cloth, and what the studio can and can not make today.
        </p>
        <nav aria-label="On this page" className="mt-6 flex flex-wrap gap-2">
          {JUMPS.map((jump) => (
            <a key={jump.href} href={jump.href} className="chip">
              {jump.label}
            </a>
          ))}
        </nav>
        <p className="mt-6 max-w-xl text-sm text-subtle">
          How to read the drawings: the garment is drawn in plain line. Whatever the method adds,
          ink or thread or dye, is drawn in pink. Dotted means it is not there yet.
        </p>
      </header>

      <section id="words" className="paper mw-jump border-y-2 border-ink">
        <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6">
          <h2 className="display text-5xl sm:text-6xl">Seven ways to put a design on cloth</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {methods.map((entry, index) => (
              <EntryCard key={entry.id} entry={entry} index={index} />
            ))}
          </div>
          <h2 className="display mt-16 text-5xl sm:text-6xl">Six words you will meet in the studio</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {words.map((entry, index) => (
              <EntryCard key={entry.id} entry={entry} index={methods.length + index} />
            ))}
          </div>
        </div>
      </section>

      <section id="today" className="mw-jump mx-auto w-full max-w-7xl px-4 py-14 sm:px-6">
        <h2 className="display text-5xl sm:text-6xl">What we can make today</h2>
        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <div className="border-2 border-ink bg-surface p-5">
            <p className="eyebrow text-subtle">Today</p>
            <p className="display mt-2 text-4xl">One graphic on a blank</p>
            <ul className="mt-4 grid gap-2">
              <li>Your art and your words, placed on a tee, a hoodie, a crewneck or a hat.</li>
              <li>Tees, hoodies and crewnecks are printed. The hat is stitched.</li>
              <li>You pick the blank, its colour and where the graphic sits.</li>
              <li>Each piece is made after it is paid for. Printing goes through Printful.</li>
            </ul>
            <p role="status" className="mt-4 border-2 border-ink bg-bg px-3 py-2 text-sm">
              {mode === "live"
                ? "Right now the studio is live. Orders print for real."
                : mode === "sandbox"
                  ? "Right now the studio is in sandbox. That is a practice mode: you can design and check out, but nothing prints and no card is charged."
                  : "Without its printer and payment keys the studio runs in sandbox, a practice mode where nothing prints and no card is charged."}
            </p>
            <Link
              to="/studio"
              className="mt-5 inline-flex h-14 items-center gap-2 bg-accent px-5 font-display text-sm tracking-wider text-accent-fg uppercase"
            >
              Open the studio
              <ArrowRight className="h-4 w-4" strokeWidth={3} />
            </Link>
          </div>
          <div className="border-2 border-dashed border-ink p-5">
            <p className="eyebrow text-subtle">What is coming</p>
            <p className="display mt-2 text-4xl">The whole garment</p>
            <ul className="mt-4 grid gap-2">
              <li>A full-garment designer. It is being built now.</li>
              <li>Colour every panel: body, sleeves, hood, cuffs, pocket.</li>
              <li>All-over print on polyester fleece, so a pattern can run edge to edge.</li>
            </ul>
            <p className="mt-4 text-sm text-muted">
              It is not in the studio yet, and there is no date. This page will change when it is.
            </p>
          </div>
        </div>
      </section>

      <section id="printed-or-sewn" className="paper mw-jump border-y-2 border-ink">
        <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6">
          <h2 className="display text-5xl sm:text-6xl">Printed or sewn</h2>
          <p className="mt-4 max-w-2xl text-lg text-muted">
            Two hoodies can look the same in a picture and be built in different ways. Cut through
            the side of each and this is what you would see.
          </p>
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <div className="mw-card">
              <div className="mw-stage">
                <PrintedOrSewn kind="printed" />
              </div>
              <div className="p-4">
                <h3 className="display text-4xl">Printed panels</h3>
                <p className="eyebrow mt-1.5 text-subtle">What the new designer will make</p>
                <ul className="mt-3 grid gap-2">
                  <li>
                    The panels and stripes are printed onto white polyester fleece. Then the fleece
                    is cut and sewn into the piece.
                  </li>
                  <li>They are not separate fabrics. A stripe is colour, not a strip of cloth.</li>
                  <li>It is not heavy cotton. Polyester fleece is lighter and smoother.</li>
                  <li>It can be made one at a time.</li>
                </ul>
              </div>
            </div>
            <div className="mw-card">
              <div className="mw-stage">
                <PrintedOrSewn kind="sewn" />
              </div>
              <div className="p-4">
                <h3 className="display text-4xl">Sewn panels</h3>
                <p className="eyebrow mt-1.5 text-subtle">What needs a factory run</p>
                <ul className="mt-3 grid gap-2">
                  <li>Each panel is its own piece of dyed fabric, joined at a seam.</li>
                  <li>
                    Piping is a real cord of fabric sewn into that seam. You can pinch it between
                    two fingers.
                  </li>
                  <li>
                    Sewn-in piping in your own colours means a factory makes a batch. It can not
                    be made one at a time through the studio.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="who" className="mw-jump mx-auto w-full max-w-7xl px-4 py-14 sm:px-6">
        <h2 className="display text-5xl sm:text-6xl">Who makes what</h2>
        <p className="mt-4 max-w-2xl text-muted">
          Four companies that make clothes to order. Yes means their own site said so when we read
          it on 17 Nov 2026, and the word links to the page. Not checked is not a no. It means we
          have not read it there yet. No prices, because we did not confirm any.
        </p>
        <table className="mt-8 w-full table-fixed border-2 border-ink text-left">
          <caption className="sr-only">
            Which maker says it offers which method, checked on 17 Nov 2026
          </caption>
          <thead>
            <tr className="border-b-2 border-ink bg-surface">
              <th scope="col" className="w-[30%] px-2 py-3 sm:px-4">
                <span className="sr-only">Method</span>
              </th>
              {MAKERS.map((maker) => (
                <th
                  key={maker.id}
                  scope="col"
                  className="px-0.5 py-3 text-center font-display text-[0.62rem] uppercase sm:text-sm"
                >
                  {maker.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {METHODS.map((method) => (
              <tr key={method.id} className="border-b-2 border-line">
                <th scope="row" className="px-2 py-1 text-sm font-bold sm:px-4">
                  {method.label}
                </th>
                {MAKERS.map((maker) => (
                  <td key={maker.id} className="px-0.5">
                    <Mark claim={maker.methods[method.id]} />
                  </td>
                ))}
              </tr>
            ))}
            <tr className="border-b-2 border-line">
              <th scope="row" className="px-2 py-1 text-sm font-bold sm:px-4">
                One piece at a time
              </th>
              {MAKERS.map((maker) => (
                <td key={maker.id} className="px-0.5">
                  <Mark claim={maker.noMinimum} />
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row" className="px-2 py-3 text-sm font-bold sm:px-4">
                The studio sends orders here
              </th>
              {MAKERS.map((maker) => (
                <td key={maker.id} className="px-0.5 text-center text-xs">
                  {maker.wiredIn ? <span className="font-display uppercase">Today</span> : "Not yet"}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
        <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-subtle">
          <span>
            <span aria-hidden="true" className="mw-yes" /> Their site says yes
          </span>
          <span>
            <span aria-hidden="true" className="mw-unknown" /> Not checked
          </span>
        </p>

        <h3 className="mt-10 font-display text-sm tracking-wider uppercase">
          What their sites said, and where
        </h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {MAKERS.map((maker) => (
            <Receipts key={maker.id} maker={maker} />
          ))}
        </div>

        <div className="mt-12 border-t-2 border-line pt-8">
          <p className="display text-4xl">Want to know what a piece could earn you</p>
          <Link
            to="/math"
            className="mt-4 inline-flex min-h-11 items-center gap-2 font-display text-sm tracking-wider uppercase"
          >
            <span className="border-b-2 border-fg pb-0.5">Do the math</span>
            <ArrowRight className="h-4 w-4" strokeWidth={3} />
          </Link>
        </div>
      </section>
    </SiteShell>
  );
}
