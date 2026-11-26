// Renders the label's launch pieces (src/lib/label/launch.ts) to print files with the
// studio's own exporter, in a real browser with the studio fonts, into src/lib/label/prints.
// Needs the dev server: `npm run dev`, then `node scripts/label/render-launch.mjs [origin]`.
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const origin = process.argv[2] ?? "http://127.0.0.1:8080";
const out = new URL("../../src/lib/label/prints/", import.meta.url);
const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;

const browser = await chromium.launch(
  {
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    ...(proxy ? { proxy: { server: proxy, bypass: "127.0.0.1,localhost" } } : {}),
  },
);
try {
  const page = await browser.newPage({ ignoreHTTPSErrors: true });
  await page.goto(`${origin}/sizes`, { waitUntil: "networkidle" });
  const files = await page.evaluate(async () => {
    const fontsReady = await Promise.all([
      document.fonts.load('80px "Archivo Black"'),
      document.fonts.load('80px "Outfit"'),
    ]);
    if (fontsReady.some((faces) => faces.length === 0)) throw new Error("Studio fonts did not load.");
    const { renderPrintFile } = await import("/src/components/studio/print-file.ts");
    const { LAUNCH_PIECES, launchLayers, printName } = await import("/src/lib/label/launch.ts");
    const { houseBlank, houseAreas } = await import("/src/lib/pod/house-blanks.ts");
    const result = [];
    for (const piece of LAUNCH_PIECES) {
      const blank = houseBlank(piece.blank);
      if (!blank) throw new Error(`No blank ${piece.blank}`);
      for (const spot of piece.spots) {
        const area = houseAreas(blank).find((item) => item.placement === spot.placement);
        if (!area) throw new Error(`${piece.blank} has no ${spot.placement}`);
        result.push({
          name: printName(piece, spot.placement),
          url: await renderPrintFile(area, launchLayers(spot)),
        });
      }
    }
    return result;
  });
  await mkdir(out, { recursive: true });
  for (const file of files) {
    const bytes = Buffer.from(file.url.split(",")[1], "base64");
    await writeFile(new URL(file.name, out), bytes);
    console.log(file.name, Math.round(bytes.length / 1024), "KB");
  }
} finally {
  await browser.close();
}
