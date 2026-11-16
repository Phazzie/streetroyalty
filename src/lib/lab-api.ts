import { createServerFn } from "@tanstack/react-start";
import { isCategory } from "@/lib/split-pieces";
import { SCENES, type Reaction, type Scene } from "@/lib/types";

type Fail = { ok: false; kind: "unavailable" | "missed" | "limit" };

const MISSED: Fail = { ok: false, kind: "missed" };

/** Counts one paid call. Returns the refusal to send back, or null to go ahead. */
async function refuse(kind: "image" | "video"): Promise<Fail | null> {
  const { admit } = await import("./ai/guard.server.ts");
  const verdict = await admit(kind);
  return verdict === "ok" ? null : { ok: false, kind: verdict };
}

function asDataImage(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!value.startsWith("data:image/")) return null;
  if (value.length > 1_400_000) return null;
  return value;
}

function takeImages(values: unknown, limit: number): string[] {
  if (!Array.isArray(values)) return [];
  const images: string[] = [];
  for (const value of values) {
    const image = asDataImage(value);
    if (!image) continue;
    images.push(image);
    if (images.length >= limit) break;
  }
  return images;
}

function isReaction(value: unknown): value is Reaction {
  return value === "cheer" || value === "boo" || value === "both";
}

export const generatePiece = createServerFn({ method: "POST" })
  .validator((input: { spoken?: string; category?: string }) => ({
    spoken: String(input?.spoken ?? "").trim().slice(0, 800),
    category: String(input?.category ?? ""),
  }))
  .handler(async ({ data }) => {
    // A request that could never produce a picture is turned away before it is counted.
    if (!data.spoken || !isCategory(data.category)) return MISSED;
    const refusal = await refuse("image");
    if (refusal) return refusal;
    const { runPiece } = await import("./imagine.server.ts");
    return runPiece(data);
  });

export const generateLook = createServerFn({ method: "POST" })
  .validator(
    (input: {
      mode?: string;
      spoken?: string;
      baseSpoken?: string;
      characterImages?: unknown;
      clothingImages?: unknown;
      lookImage?: unknown;
    }) => ({
      mode: input?.mode === "tweak" ? ("tweak" as const) : ("look" as const),
      spoken: String(input?.spoken ?? "").trim().slice(0, 1600),
      baseSpoken: String(input?.baseSpoken ?? "").trim().slice(0, 1600),
      characterImages: takeImages(input?.characterImages, 3),
      clothingImages: takeImages(input?.clothingImages, 4),
      lookImage: asDataImage(input?.lookImage),
    }),
  )
  .handler(async ({ data }) => {
    if (!data.spoken) return MISSED;
    if (data.mode === "tweak" ? !data.lookImage : data.characterImages.length === 0) return MISSED;
    const refusal = await refuse("image");
    if (refusal) return refusal;
    const { runLook } = await import("./imagine.server.ts");
    return runLook(data);
  });

export const startRunway = createServerFn({ method: "POST" })
  .validator((input: { lookImage?: unknown; faceImage?: unknown; spoken?: string; reaction?: string; scene?: string }) => ({
    lookImage: asDataImage(input?.lookImage),
    faceImage: asDataImage(input?.faceImage),
    spoken: String(input?.spoken ?? "").trim().slice(0, 800),
    reaction: (isReaction(input?.reaction) ? input.reaction : "both") satisfies Reaction,
    scene: (SCENES.find((scene) => scene === input?.scene) ?? "runway") satisfies Scene,
  }))
  .handler(async ({ data }): Promise<
    { ok: true; requestId: string; prompt: string } | Fail
  > => {
    if (!data.lookImage) return MISSED;
    const refusal = await refuse("video");
    if (refusal) return refusal;
    const { runStart } = await import("./imagine.server.ts");
    return runStart(data);
  });

export const pollRunway = createServerFn({ method: "POST" })
  .validator((input: { requestId?: string }) => ({
    requestId: String(input?.requestId ?? ""),
  }))
  .handler(async ({ data }) => {
    const { runPoll } = await import("./imagine.server.ts");
    return runPoll(data.requestId);
  });
