import { houseBlank, houseBlankByPrintfulId } from "@/lib/pod/house-blanks";
import type { ShopPiece } from "@/lib/studio/models";

/** "leg_front_left" reads "left leg, front", the way the studio names the spot. */
function spotTitles(piece: ShopPiece): string {
  const blank = houseBlank(piece.templateId) ?? houseBlankByPrintfulId(piece.productId);
  const spots = piece.placements?.length ? piece.placements : [piece.placement];
  const titles = spots.map((key) =>
    (blank?.placements.find((spot) => spot.placement === key)?.title ?? key.replaceAll("_", " ")).toLowerCase(),
  );
  if (titles.length === 1) return `${titles[0]} print`;
  return `printed on ${titles.slice(0, -1).join(", ")} and ${titles[titles.length - 1]}`;
}

/**
 * Colorway picker and fabric line for a rack piece.
 * The rack route itself is Claude's for this round. Mount this under the title
 * on `src/routes/rack.$slug.tsx` and pass the selected colorway id into cartAdd.
 */
export function PieceOptions({
  piece,
  colorwayId,
  onColorway,
}: {
  piece: ShopPiece;
  colorwayId: string;
  onColorway: (id: string) => void;
}) {
  return (
    <div>
      {piece.materialNote ? <p className="mt-3 max-w-md text-sm">{piece.materialNote}</p> : null}
      <p className="mt-2 text-muted">
        {piece.productName}
        {piece.construction === "aop"
          ? " · all-over print"
          : ` · ${piece.colorName} · ${spotTitles(piece)}`}
      </p>
      {piece.colorways.length > 0 ? (
        <div className="mt-4">
          <p className="text-sm text-muted">Colorway</p>
          <div className="mt-2 flex flex-wrap gap-2" role="listbox" aria-label="Colorway">
            {piece.colorways.map((colorway) => (
              <button
                key={colorway.id}
                type="button"
                role="option"
                aria-selected={colorway.id === colorwayId}
                onClick={() => onColorway(colorway.id)}
                className={`chip ${colorway.id === colorwayId ? "chip-on" : ""}`}
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
        </div>
      ) : null}
    </div>
  );
}
