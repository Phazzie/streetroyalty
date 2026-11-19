import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GarmentFlat } from "@/components/studio/garment-flat";
import { renderPanelProof } from "@/components/studio/panel-proof";
import {
  AOP_ORDER_CLOSED,
  COLOR_ROLES,
  canOrderProduct,
  activeColorway,
  addColorway,
  getTemplate,
  panelExportPlan,
  printfulCard,
  removeColorway,
  resolvePaint,
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
  contrast: "Side panels",
  trim: "Piping and cuffs",
  mark: "Logo",
};

/** Per-panel designer for an all-over garment. */
export function AopStage({
  garment,
  label,
  onChange,
  onPreviewSet,
}: {
  garment: GarmentDesign;
  label?: string;
  onChange: (next: GarmentDesign) => void;
  onPreviewSet: () => void;
}) {
  const template = getTemplate(garment.templateId);
  const [face, setFace] = useState<"front" | "back">("front");
  const [selected, setSelected] = useState(template?.panels[0]?.id ?? "");
  const [colorwayName, setColorwayName] = useState("");
  const [proofs, setProofs] = useState<{ title: string; href: string; note: string }[]>([]);
  const [proofNote, setProofNote] = useState("");
  if (!template) return null;
  const linked = printfulCard(template.id);
  const colorway = activeColorway(garment);
  const panelDef = template.panels.find((item) => item.id === selected) ?? template.panels[0];
  const fill = garment.panels.find((item) => item.id === panelDef?.id)?.fill ?? {
    kind: "role" as const,
  };
  const plan = panelExportPlan(template.id);

  function paintFill(next: PanelFill) {
    if (!panelDef) return;
    onChange(setPanelFill(garment, panelDef.id, next));
  }

  return (
    <div>
      {linked ? <p className="mb-3 text-sm text-muted">{linked.materialLine}</p> : null}
      <p className="mb-3 text-sm text-muted">
        {linked ? `Matched to Printful product ${linked.catalogProductId}, ${linked.name}. ` : ""}
        Each panel can take the colorway, its own color, a pattern, or art.
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
              Follow colorway
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
        <Button type="button" onClick={onPreviewSet}>
          See the set
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            void (async () => {
              const files = [];
              for (const item of plan) {
                const def = template.panels.find((panel) => panel.id === item.panelId);
                if (!def) continue;
                const paint = resolvePaint(
                  def,
                  garment.panels.find((panel) => panel.id === def.id)?.fill,
                  colorway,
                );
                const href = await renderPanelProof(
                  item.proof.widthPx,
                  item.proof.heightPx,
                  paint,
                  item.title,
                );
                files.push({ title: item.title, href, note: item.printful.todo });
              }
              setProofs(files);
              setProofNote(plan[0]?.printful.todo ?? "");
            })();
          }}
        >
          Export panel proofs
        </Button>
      </div>
      {proofNote ? <p className="mt-3 text-sm text-muted">{proofNote}</p> : null}
      {proofs.length > 0 ? (
        <ul className="mt-2 flex flex-col gap-1">
          {proofs.map((file) => (
            <li key={file.title}>
              <a
                className="text-sm underline"
                href={file.href}
                download={`${file.title.replace(/\s+/g, "-").toLowerCase()}-proof.png`}
              >
                {file.title} proof
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
