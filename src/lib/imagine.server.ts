import { isCategory } from "@/lib/split-pieces";
import { lookPrompt, piecePrompt, tweakPrompt, videoPrompt } from "@/lib/tickets";
import type { Reaction } from "@/lib/types";

type Fail = { ok: false; kind: "unavailable" | "missed" };
type ImageOk = { ok: true; image: string; prompt: string };
export type StartOk = { ok: true; requestId: string; prompt: string };
export type PollOk = { ok: true; status: "pending" | "done" | "failed"; url?: string };
export type ImageResult = ImageOk | Fail;

const IMAGE_MODEL = "grok-imagine-image-2.0";
const IMAGE_FALLBACK = "grok-imagine-image";
const VIDEO_MODEL = "grok-imagine-video-1.5";

function key(): string | undefined {
  const value = process.env.XAI_API_KEY;
  return value && value.trim() ? value : undefined;
}

async function postJson(path: string, body: unknown): Promise<{ status: number; json: unknown } | null> {
  const apiKey = key();
  if (!apiKey) return null;
  try {
    const res = await fetch(`https://api.x.ai${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90_000),
    });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    if (!res.ok) console.error("xai", path, res.status, text.slice(0, 400));
    return { status: res.status, json };
  } catch (error) {
    console.error("xai", path, error);
    return { status: 0, json: null };
  }
}

function bytesToDataUrl(bytes: Uint8Array, mime: string): string {
  let binary = "";
  const size = 0x8000;
  for (let i = 0; i < bytes.length; i += size) {
    binary += String.fromCharCode(...bytes.subarray(i, i + size));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

async function imageFromPayload(json: unknown): Promise<string | null> {
  const data = (json as { data?: { b64_json?: string; url?: string }[] } | null)?.data?.[0];
  if (!data) return null;
  if (data.b64_json) {
    return data.b64_json.startsWith("data:") ? data.b64_json : `data:image/jpeg;base64,${data.b64_json}`;
  }
  if (!data.url?.startsWith("https://")) return null;
  try {
    const res = await fetch(data.url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) return null;
    const mime = res.headers.get("content-type")?.split(";")[0] || "image/jpeg";
    return bytesToDataUrl(new Uint8Array(await res.arrayBuffer()), mime);
  } catch (error) {
    console.error("xai image fetch", error);
    return null;
  }
}

async function generateImage(
  path: "/v1/images/generations" | "/v1/images/edits",
  body: Record<string, unknown>,
): Promise<ImageResult> {
  if (!key()) return { ok: false, kind: "unavailable" };
  let result = await postJson(path, body);
  if (!result) return { ok: false, kind: "unavailable" };
  if ((result.status === 400 || result.status === 404) && body.model === IMAGE_MODEL) {
    const fallback: Record<string, unknown> = { ...body, model: IMAGE_FALLBACK };
    delete fallback.quality;
    result = await postJson(path, fallback);
    if (!result) return { ok: false, kind: "unavailable" };
  }
  if (result.status < 200 || result.status >= 300) return { ok: false, kind: "missed" };
  const image = await imageFromPayload(result.json);
  if (!image) return { ok: false, kind: "missed" };
  return { ok: true, image, prompt: String(body.prompt ?? "") };
}

export async function runPiece(input: { spoken: string; category: string }): Promise<ImageResult> {
  if (!input.spoken || !isCategory(input.category)) return { ok: false, kind: "missed" };
  const prompt = piecePrompt(input.spoken, input.category);
  return generateImage("/v1/images/generations", {
    model: IMAGE_MODEL,
    prompt,
    n: 1,
    aspect_ratio: "1:1",
    resolution: "1k",
    quality: "low",
    response_format: "b64_json",
  });
}

export async function runLook(input: {
  mode: "look" | "tweak";
  spoken: string;
  baseSpoken: string;
  characterImages: string[];
  clothingImages: string[];
  lookImage: string | null;
}): Promise<ImageResult> {
  if (!input.spoken) return { ok: false, kind: "missed" };
  const faces = input.characterImages.slice(0, 2);
  let images: { type: "image_url"; url: string }[] = [];
  let prompt = "";
  if (input.mode === "tweak") {
    if (!input.lookImage) return { ok: false, kind: "missed" };
    const refs = [input.lookImage, ...faces].slice(0, 5);
    images = refs.map((url) => ({ type: "image_url", url }));
    prompt = tweakPrompt(input.baseSpoken || input.spoken, input.spoken);
  } else {
    if (faces.length === 0) return { ok: false, kind: "missed" };
    const clothes = input.clothingImages.slice(0, Math.max(0, 5 - faces.length));
    const refs = [...faces, ...clothes];
    images = refs.map((url) => ({ type: "image_url", url }));
    prompt = lookPrompt(input.spoken, faces.length, refs.length);
  }
  return generateImage("/v1/images/edits", {
    model: IMAGE_MODEL,
    prompt,
    images,
    aspect_ratio: "2:3",
    resolution: "1k",
    quality: "low",
    response_format: "b64_json",
  });
}

export async function runStart(input: {
  lookImage: string | null;
  faceImage: string | null;
  spoken: string;
  reaction: Reaction;
}): Promise<StartOk | Fail> {
  if (!input.lookImage) return { ok: false, kind: "missed" };
  if (!key()) return { ok: false, kind: "unavailable" };
  const hasFace = Boolean(input.faceImage);
  const prompt = videoPrompt(input.reaction, input.spoken, hasFace);
  const primary = hasFace
    ? {
        model: VIDEO_MODEL,
        prompt,
        reference_images: [input.lookImage, input.faceImage]
          .filter((url): url is string => Boolean(url))
          .map((url) => ({ url })),
        duration: 6,
        aspect_ratio: "9:16",
        resolution: "720p",
      }
    : {
        model: VIDEO_MODEL,
        prompt,
        image: { url: input.lookImage },
        duration: 6,
        aspect_ratio: "9:16",
        resolution: "720p",
      };
  let result = await postJson("/v1/videos/generations", primary);
  if (!result) return { ok: false, kind: "unavailable" };
  if (hasFace && (result.status < 200 || result.status >= 300)) {
    result = await postJson("/v1/videos/generations", {
      model: VIDEO_MODEL,
      prompt: videoPrompt(input.reaction, input.spoken, false),
      image: { url: input.lookImage },
      duration: 6,
      aspect_ratio: "9:16",
      resolution: "720p",
    });
    if (!result) return { ok: false, kind: "unavailable" };
  }
  const requestId = (result.json as { request_id?: string } | null)?.request_id;
  if (!requestId || result.status < 200 || result.status >= 300) return { ok: false, kind: "missed" };
  return { ok: true, requestId, prompt };
}

export async function runPoll(requestId: string): Promise<PollOk | Fail> {
  if (!/^[\w-]{8,80}$/.test(requestId)) return { ok: false, kind: "missed" };
  const apiKey = key();
  if (!apiKey) return { ok: false, kind: "unavailable" };
  try {
    const res = await fetch(`https://api.x.ai/v1/videos/${requestId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(20_000),
    });
    const json = (await res.json()) as { status?: string; video?: { url?: string } };
    if (!res.ok) {
      console.error("xai poll", res.status);
      return { ok: false, kind: "missed" };
    }
    if (json.status === "done" && json.video?.url) return { ok: true, status: "done", url: json.video.url };
    if (json.status === "failed" || json.status === "expired") return { ok: true, status: "failed" };
    return { ok: true, status: "pending" };
  } catch (error) {
    console.error("xai poll", error);
    return { ok: false, kind: "missed" };
  }
}
