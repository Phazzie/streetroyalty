import { labelAnchor, resolveGarment, type GarmentDesign, type Paint } from "@/lib/studio/garments";

function patternNode(id: string, paint: Paint) {
  if (paint.type !== "pattern") return null;
  if (paint.pattern === "checker") {
    return (
      <pattern id={`pat-${id}`} width="12" height="12" patternUnits="userSpaceOnUse">
        <rect width="12" height="12" fill={paint.hex} />
        <rect width="6" height="6" fill={paint.accent} />
        <rect x="6" y="6" width="6" height="6" fill={paint.accent} />
      </pattern>
    );
  }
  return (
    <pattern id={`pat-${id}`} width="10" height="10" patternUnits="userSpaceOnUse">
      <rect width="10" height="10" fill={paint.hex} />
      <rect width="4" height="10" fill={paint.accent} />
    </pattern>
  );
}

/** Live flat of one all-over garment. Click a panel to design it. */
export function GarmentFlat({
  garment,
  face,
  selected,
  onSelect,
  label,
}: {
  garment: GarmentDesign;
  face: "front" | "back";
  selected?: string;
  onSelect?: (panelId: string) => void;
  label?: string;
}) {
  const resolved = resolveGarment(garment, face);
  const fills = new Map(garment.panels.map((item) => [item.id, item.fill]));
  const markAt = labelAnchor(
    resolved.panels.map(({ panel }) => panel),
    label?.slice(0, 24),
  );
  return (
    <svg
      viewBox={resolved.template.viewBox}
      role="img"
      aria-label={`${resolved.template.name}, ${face}`}
      className="h-auto w-full"
    >
      <rect
        width={resolved.template.viewWidth}
        height={resolved.template.viewHeight}
        fill="#120a1c"
      />
      <defs>
        {resolved.panels.map(({ panel, paint }) => (
          <g key={panel.id}>{patternNode(panel.id, paint)}</g>
        ))}
      </defs>
      {resolved.panels.map(({ panel, paint }) => {
        const fill =
          paint.type === "solid"
            ? paint.hex
            : paint.type === "pattern"
              ? `url(#pat-${panel.id})`
              : "#f4f0e6";
        const pressed = selected === panel.id;
        // A logo with no patch is just where the layers print: drawn as a dashed box.
        const bare = panel.kind === "mark" && (fills.get(panel.id)?.kind ?? "role") === "role";
        return (
          <path
            key={panel.id}
            d={panel.d}
            fill={bare ? "transparent" : fill}
            stroke={pressed ? "#3df0ff" : bare ? resolved.colorway.colors.mark : "#141018"}
            strokeWidth={pressed ? 4 : 1.5}
            strokeDasharray={bare && !pressed ? "4 3" : undefined}
            role={onSelect ? "button" : undefined}
            tabIndex={onSelect ? 0 : undefined}
            aria-label={panel.title}
            aria-pressed={onSelect ? pressed : undefined}
            className={onSelect ? "cursor-pointer" : undefined}
            onClick={() => onSelect?.(panel.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect?.(panel.id);
              }
            }}
          />
        );
      })}
      {resolved.panels
        .filter(({ paint }) => paint.type === "art")
        .map(({ panel, paint }) =>
          paint.type === "art" ? (
            <image
              key={`${panel.id}-art`}
              href={paint.src}
              x={panel.box.x}
              y={panel.box.y}
              width={panel.box.w}
              height={panel.box.h}
              preserveAspectRatio="xMidYMid slice"
              clipPath={`url(#clip-${panel.id})`}
            />
          ) : null,
        )}
      <defs>
        {resolved.panels.map(({ panel }) => (
          <clipPath id={`clip-${panel.id}`} key={`clip-${panel.id}`}>
            <path d={panel.d} />
          </clipPath>
        ))}
      </defs>
      {label && markAt ? (
        <text
          x={markAt.x}
          y={markAt.y}
          textAnchor="middle"
          fill={resolved.colorway.colors.mark}
          // Outlined in the body colour, so the letters still read where they cross the
          // chest-logo box, which is painted in the same colour as the ink.
          stroke={resolved.colorway.colors.body}
          strokeWidth={3}
          strokeLinejoin="round"
          paintOrder="stroke"
          fontFamily="Arial Black, sans-serif"
          fontSize={markAt.size}
        >
          {label.slice(0, 24)}
        </text>
      ) : null}
    </svg>
  );
}
