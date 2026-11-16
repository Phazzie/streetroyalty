import { useState } from "react";
import { dnaLabel, variantFamily, type Dna } from "@/lib/moon/dna";

/**
 * Remix Dice: roll a family of variants from the current design's DNA.
 * Same seed, same family — a roll someone loves is never lost.
 */
export function RemixDice({ base, onLoad }: { base: Dna; onLoad: (dna: Dna) => void }) {
  const [seed, setSeed] = useState(7);
  const [family, setFamily] = useState<Dna[]>([]);
  return (
    <div>
      <p className="mb-2 text-sm text-muted">
        Your design is genes: garment × colorway × placement × text style × finish × skin. Roll the
        dice, deal a family, load the one that talks.
      </p>
      <div className="mb-3 flex items-center gap-2">
        <label className="text-sm text-muted" htmlFor="dice-seed">
          Seed
        </label>
        <input
          id="dice-seed"
          type="number"
          value={seed}
          onChange={(event) => setSeed(Number(event.target.value) || 0)}
          className="h-10 w-24 border-2 border-ink bg-cream px-2 text-fg"
        />
        <button
          type="button"
          className="chip chip-on"
          onClick={() => setFamily(variantFamily(base, 4, seed))}
        >
          Roll the dice
        </button>
      </div>
      {family.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {family.map((variant, index) => (
            <li key={index} className="flex flex-wrap items-center gap-2 border-2 border-line bg-bg px-2 py-2">
              <span className="inline-block size-5 border border-ink" style={{ background: variant.garmentHex }} aria-hidden="true" />
              <span className="inline-block size-5 border border-ink" style={{ background: variant.inkHex }} aria-hidden="true" />
              <span className="text-sm">{dnaLabel(variant)}</span>
              <button type="button" className="chip ml-auto" onClick={() => onLoad(variant)}>
                Load it
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
