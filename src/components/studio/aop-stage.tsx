import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GarmentFlat } from "@/components/studio/garment-flat";
import { pictureForPanel } from "@/components/studio/panel-picture";
import {
  AOP_ORDER_CLOSED,
  COLOR_ROLES,
  canOrderProduct,
  activeColorway,
  addColorway,
  getTemplate,
  printfulCard,
  removeColorway,
  renderPrintSheets,
  setPanelFill,
  setRoleColor,
  updateColorway,
  visiblePanels,
  type ColorRole,
  type GarmentDesign,
  type PanelFill,
} from "@/lib/studio/garments";

const ROLE_LABEL: Record<ColorRole, string> = {
  body: "Body",
  contrast: "Stripes and side panels",
  trim: "Piping, cuffs and bands",
  mark: "Logo ink",
};

const PLACEMENT_LABEL: Record<string, string> = {
  front: "Front",
  back: "Back",
  hood: "Hood",
  pocket: "Pocket",
  label_panel: "Neck panel",
  sleeve_left: "Left sleeve",
  sleeve_right: "Right sleeve",
  leg_left: "Left leg",
  leg_right: "Right leg",
  details: "Collar and zip facings",
};

/** Print sheets, drawn small for the screen. The server draws the same sheets at full size. */
function PrintSheets({ garment }: { garment: GarmentDesign }) {
  const sheets = useMemo(
    () =>
      renderPrintSheets(garment, { widthPx: 360, showLogoBox: true, paper: true }).map((sheet) => ({
        ...sheet,
        href: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sheet.svg)}`,
      })),
    [garment],
  );
  return (
    <div className="mt-4">
      <p className="font-display text-xs tracking-wide uppercase">Print sheets</p>
      <p className="mt-1 text-sm text-muted">
        These are the real pieces the printer cuts, in the colorway you have on. Each sheet is
        printed at full size, about 40 inches across, and colour runs a little past every cut line
        so a shifted cut still lands in colour. The dashed box is where your logo layers print.
      </p>
      <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label="Print sheets">
        {sheets.map((sheet) => (
          <li key={sheet.placement} className="border-2 border-line bg-cream p-1">
            <img
              src={sheet.href}
              alt={`${PLACEMENT_LABEL[sheet.placement] ?? sheet.placement} print sheet`}
              className="aspect-square w-full object-contain"
            />
            <a
              className="block px-1 pt-1 text-xs text-ink underline"
              href={sheet.href}
              download={`${garment.templateId}-${sheet.placement}.svg`}
            >
              {PLACEMENT_LABEL[sheet.placement] ?? sheet.placement}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Per-panel designer for an all-over garment. */
export function AopStage({
  garment,
  label,
  onChange,
}: {
  garment: GarmentDesign;
  label?: string;
  onChange: (next: GarmentDesign) => void;
}) {
  const template = getTemplate(garment.templateId);
  const [face, setFace] = useState<"front" | "back">("front");
  const [selected, setSelected] = useState(template?.panels[0]?.id ?? "");
  const [colorwayName, setColorwayName] = useState("");
  const [showSheets, setShowSheets] = useState(false);
  const [pictureNote, setPictureNote] = useState("");
  if (!template) return null;
  const linked = printfulCard(template.id);
  const colorway = activeColorway(garment);
  const panelDef = template.panels.find((item) => item.id === selected) ?? template.panels[0];
  const fill = garment.panels.find((item) => item.id === panelDef?.id)?.fill ?? {
    kind: "role" as const,
  };

  function paintFill(next: PanelFill) {
    if (!panelDef) return;
    onChange(setPanelFill(garment, panelDef.id, next));
  }

  return (
    <div>
      {linked ? <p className="mb-3 text-sm text-muted">{linked.materialLine}</p> : null}
      <p className="mb-3 text-sm text-muted">
        {linked ? `Matched to Printful product ${linked.catalogProductId}, ${linked.name}. ` : ""}
        Tap a part to change it. Each one can follow the colorway, take its own color, a pattern, or
        a picture.
      </p>
      {canOrderProduct(template.id) ? null : <p className="mb-3 text-sm">{AOP_ORDER_CLOSED}</p>}
      <div className="mb-3 flex flex-wrap gap-2">
        {(["front", "back"] as const).map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={face === item}
            onClick={() => setFace(item)}
            className={`chip ${face === item ? "chip-on" : ""}`}
          >
            {item}
          </button>
        ))}
      </div>
      <GarmentFlat
        garment={garment}
        face={face}
        selected={selected}
        onSelect={setSelected}
        label={label}
      />
      <div className="mt-3 flex flex-wrap gap-2">
        {visiblePanels(template, face).map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={item.id === selected}
            onClick={() => setSelected(item.id)}
            className={`chip ${item.id === selected ? "chip-on" : ""}`}
          >
            {item.title}
          </button>
        ))}
      </div>
      {panelDef ? (
        <div className="mt-4 border-2 border-line p-3">
          <p className="font-display text-xs tracking-wide uppercase">{panelDef.title}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className={`chip ${fill.kind === "role" ? "chip-on" : ""}`}
              onClick={() => paintFill({ kind: "role" })}
            >
              {panelDef.kind === "mark" ? "Logo only" : "Follow colorway"}
            </button>
            <button
              type="button"
              className={`chip ${fill.kind === "pattern" && fill.pattern === "stripe" ? "chip-on" : ""}`}
              onClick={() =>
                paintFill({
                  kind: "pattern",
                  pattern: "stripe",
                  hex: colorway.colors.body,
                  accent: colorway.colors.contrast,
                })
              }
            >
              Stripes
            </button>
            <button
              type="button"
              className={`chip ${fill.kind === "pattern" && fill.pattern === "checker" ? "chip-on" : ""}`}
              onClick={() =>
                paintFill({
                  kind: "pattern",
                  pattern: "checker",
                  hex: colorway.colors.body,
                  accent: colorway.colors.trim,
                })
              }
            >
              Checker
            </button>
          </div>
          {panelDef.kind === "mark" ? (
            <p className="mt-2 text-sm text-muted">
              Your text and art layers print here. Pick a color or pattern to print a patch behind
              them.
            </p>
          ) : null}
          <label className="mt-3 block text-sm text-muted" htmlFor="panel-color">
            Own color
          </label>
          <input
            id="panel-color"
            type="color"
            value={fill.kind === "color" ? fill.hex : colorway.colors[panelDef.role]}
            onChange={(event) => paintFill({ kind: "color", hex: event.target.value })}
            className="mt-1 h-12 w-full border-2 border-ink bg-cream"
          />
          <label className="mt-3 block text-sm text-muted" htmlFor="panel-picture">
            Picture {fill.kind === "art" ? "(on)" : ""}
          </label>
          <input
            id="panel-picture"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="mt-1 block w-full text-sm"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              setPictureNote("Fitting the picture…");
              void pictureForPanel(file)
                .then((src) => {
                  paintFill({ kind: "art", src });
                  setPictureNote("");
                })
                .catch((error: unknown) =>
                  setPictureNote(
                    error instanceof Error ? error.message : "That picture did not load.",
                  ),
                );
            }}
          />
          {pictureNote ? <p className="mt-1 text-sm text-muted">{pictureNote}</p> : null}
        </div>
      ) : null}
      <div className="mt-4">
        <p className="font-display text-xs tracking-wide uppercase">Colorways</p>
        <div className="mt-2 flex flex-wrap gap-2" role="listbox" aria-label="Colorway">
          {garment.colorways.map((item) => (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={item.id === garment.activeColorwayId}
              onClick={() => onChange({ ...garment, activeColorwayId: item.id })}
              className={`chip ${item.id === garment.activeColorwayId ? "chip-on" : ""}`}
            >
              {item.name}
            </button>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {COLOR_ROLES.map((role) => (
            <label key={role} className="text-sm text-muted">
              {ROLE_LABEL[role]}
              <input
                aria-label={ROLE_LABEL[role]}
                type="color"
                value={colorway.colors[role]}
                onChange={(event) =>
                  onChange(
                    updateColorway(garment, setRoleColor(colorway, role, event.target.value)),
                  )
                }
                className="mt-1 h-12 w-full border-2 border-ink bg-cream"
              />
            </label>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Input
            aria-label="New colorway name"
            value={colorwayName}
            placeholder="Name a colorway"
            onChange={(event) => setColorwayName(event.target.value)}
          />
          <Button
            variant="ghost"
            onClick={() => {
              try {
                onChange(addColorway(garment, colorwayName));
                setColorwayName("");
              } catch {
                /* The name field stays so they can fix it. */
              }
            }}
          >
            Save colorway
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              try {
                onChange(removeColorway(garment, garment.activeColorwayId));
              } catch {
                /* The last colorway stays. */
              }
            }}
          >
            Drop colorway
          </Button>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          aria-expanded={showSheets}
          onClick={() => setShowSheets((now) => !now)}
        >
          {showSheets ? "Hide print sheets" : "See print sheets"}
        </Button>
      </div>
      {showSheets ? <PrintSheets garment={garment} /> : null}
    </div>
  );
}
