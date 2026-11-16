/** Print art styles for the studio's art maker. Pure, shared by the form and the server. */

export const ART_STYLES = [
  {
    id: "ink",
    label: "Bold ink",
    prompt:
      "Bold one-colour screen-print graphic. Solid black shapes with thick clean edges. No gradients, no grey, no shading.",
    oneColor: true,
  },
  {
    id: "marker",
    label: "Marker",
    prompt: "Hand-drawn black marker drawing. Loose, confident, uneven lines. No grey, no shading.",
    oneColor: true,
  },
  {
    id: "badge",
    label: "Badge",
    prompt:
      "Round emblem badge, like a vintage workwear patch. Solid black, bold and symmetrical. No gradients.",
    oneColor: true,
  },
  {
    id: "airbrush",
    label: "Airbrush",
    prompt: "Nineties airbrush t-shirt art. Saturated colour, soft glow, glossy highlights.",
    oneColor: false,
  },
] as const;

export type ArtStyleId = (typeof ART_STYLES)[number]["id"];

export function isArtStyle(value: unknown): value is ArtStyleId {
  return ART_STYLES.some((style) => style.id === value);
}

function quote(value: string): string {
  return value.replaceAll('"', "'").replace(/\s+/g, " ").trim();
}

/** The backdrop is always flat white, so the studio can cut it out afterwards. */
export function artPrompt(idea: string, style: ArtStyleId): string {
  const preset = ART_STYLES.find((item) => item.id === style) ?? ART_STYLES[0];
  return [
    `T-shirt print artwork of: "${quote(idea)}".`,
    preset.prompt,
    "One subject, centered, whole subject in frame with a clear margin.",
    "Isolated on a pure flat white background. No garment, no mockup, no frame, no border, no watermark.",
    "No words or letters unless the idea names the exact words to draw.",
  ].join(" ");
}
