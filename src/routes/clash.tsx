import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ClashMachine } from "@/components/clash/machine";
import { StudioShell } from "@/components/studio/shell";
import { decodeColorway, DEFAULT_COLORWAY, encodeColorway, type Colorway } from "@/lib/clash";

/** `?c=b9a3ee-f6ecd9-ff8a3d`: body, panels, piping. Anything else falls back to the Lilac sweatsuit. */
export const Route = createFileRoute("/clash")({
  validateSearch: (search: Record<string, unknown>): { c?: string } => {
    const colors = decodeColorway(search.c);
    return colors ? { c: encodeColorway(colors) } : {};
  },
  component: ClashPage,
});

function ClashPage() {
  const { c } = Route.useSearch();
  const navigate = useNavigate({ from: "/clash" });
  const colors = decodeColorway(c) ?? DEFAULT_COLORWAY;

  return (
    <StudioShell current="/clash">
      <p className="tag">Colour toy</p>
      <h1 className="mt-3 font-display text-4xl leading-none">The clash machine</h1>
      <p className="mt-2 mb-4 max-w-xl text-muted">
        Pull for a colourway. The score says how hard it fights, and a high one is not a warning.
        This is a toy for colour: the full garment designer is being built, so nothing here can be
        ordered yet.
      </p>
      <ClashMachine
        colors={colors}
        onChange={(next: Colorway) => {
          void navigate({ search: { c: encodeColorway(next) }, replace: true, resetScroll: false });
        }}
      />
    </StudioShell>
  );
}
