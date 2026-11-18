import { GarmentFlat } from "@/components/studio/garment-flat";
import { materialLine, type Colorway, type GarmentDesign } from "@/lib/studio/garments";

export type SetPieceView = {
  name: string;
  garment: GarmentDesign;
};

/** Hoodie and joggers (or a jacket) sharing one colorway. */
export function SetBoard({
  title,
  colorways,
  activeColorwayId,
  pieces,
  onPick,
}: {
  title: string;
  colorways: Colorway[];
  activeColorwayId: string;
  pieces: SetPieceView[];
  onPick?: (colorwayId: string) => void;
}) {
  return (
    <div>
      <p className="tag">Matched set · one maker</p>
      <h2 className="mt-2 font-display text-3xl leading-none">{title}</h2>
      <ul className="mt-3 max-w-xl text-sm text-muted">
        {pieces.map((piece) => (
          <li key={piece.garment.templateId}>
            {piece.name}: {materialLine(piece.garment.templateId)}
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2" role="listbox" aria-label="Colorway">
        {colorways.map((colorway) => (
          <button
            key={colorway.id}
            type="button"
            role="option"
            aria-selected={colorway.id === activeColorwayId}
            onClick={() => onPick?.(colorway.id)}
            className={`chip ${colorway.id === activeColorwayId ? "chip-on" : ""}`}
          >
            <span className="mr-2 inline-flex gap-1 align-middle">
              <span
                className="inline-block size-3 border border-ink"
                style={{ background: colorway.colors.body }}
              />
              <span
                className="inline-block size-3 border border-ink"
                style={{ background: colorway.colors.contrast }}
              />
              <span
                className="inline-block size-3 border border-ink"
                style={{ background: colorway.colors.trim }}
              />
            </span>
            {colorway.name}
          </button>
        ))}
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {pieces.map((piece) => (
          <figure key={piece.garment.templateId} className="border-2 border-ink bg-bg p-3">
            <GarmentFlat
              garment={{ ...piece.garment, colorways, activeColorwayId }}
              face="front"
              label={piece.name}
            />
            <figcaption className="mt-2 font-display text-xs tracking-wide uppercase">
              {piece.name}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
