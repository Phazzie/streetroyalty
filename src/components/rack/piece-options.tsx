import type { ShopPiece } from "@/lib/studio/models";

/**
 * Colorway picker, fabric line, and matched-set summary for a rack piece.
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
          ? " · all-over sublimation"
          : ` · ${piece.colorName} · ${piece.placement} print`}
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
                  <span className="inline-block size-3 border border-ink" style={{ background: colorway.colors.body }} />
                  <span className="inline-block size-3 border border-ink" style={{ background: colorway.colors.contrast }} />
                  <span className="inline-block size-3 border border-ink" style={{ background: colorway.colors.trim }} />
                </span>
                {colorway.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {piece.set ? (
        <div className="mt-4 border-2 border-ink p-3">
          <p className="font-display text-xs tracking-wide uppercase">Matched set · {piece.set.provider}</p>
          <p className="mt-1 text-sm">{piece.set.title}</p>
          <ul className="mt-2 text-sm text-muted">
            {piece.set.pieces.map((item) => (
              <li key={item.id}>
                {item.productType}: {item.title}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
