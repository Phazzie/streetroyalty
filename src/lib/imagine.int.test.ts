import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runArt, runLook, runPiece, runPoll, runStart } from "./imagine.server.ts";
import { TINY_JPEG_B64, xaiImage, xaiVideoStarted } from "../test/fixtures/xai.ts";
import { seen, seenTo, server } from "../test/msw/server.ts";

/**
 * The picture and video calls. Every one of these costs money when it reaches
 * xAI, so the tests are as much about what is NOT sent as about what is.
 */

const IMAGES = "https://api.x.ai/v1/images/generations";
const EDITS = "https://api.x.ai/v1/images/edits";
const VIDEOS = "https://api.x.ai/v1/videos/generations";
const FACE = `data:image/jpeg;base64,${TINY_JPEG_B64}`;

async function bodies(): Promise<Record<string, unknown>[]> {
  await vi.waitFor(() =>
    expect(seen.every((call) => call.method === "GET" || call.body !== "")).toBe(true),
  );
  return seenTo("api.x.ai").map((call) => (call.body ? JSON.parse(call.body) : {}));
}

beforeEach(() => {
  process.env.XAI_API_KEY = "xai-test-key";
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("making a piece", () => {
  it("asks for one low-cost square picture and returns it as a data image", async () => {
    server.use(http.post(IMAGES, () => HttpResponse.json(xaiImage())));
    const result = await runPiece({ spoken: "pink satin bomber", category: "Tops" });
    expect(result).toMatchObject({ ok: true, image: `data:image/jpeg;base64,${TINY_JPEG_B64}` });
    const [body] = await bodies();
    expect(body).toMatchObject({
      model: "grok-imagine-image-2.0",
      n: 1,
      aspect_ratio: "1:1",
      resolution: "1k",
      quality: "low",
      response_format: "b64_json",
    });
    expect(String(body?.prompt)).toContain("pink satin bomber");
  });

  it.each([
    ["no words", { spoken: "", category: "Tops" }],
    ["a category that does not exist", { spoken: "jacket", category: "weapon" }],
  ])("sends nothing for %s", async (_what, input) => {
    expect(await runPiece(input)).toEqual({ ok: false, kind: "missed" });
    expect(seenTo("api.x.ai")).toEqual([]);
  });

  it("sends nothing and says unavailable without a key", async () => {
    delete process.env.XAI_API_KEY;
    expect(await runPiece({ spoken: "jacket", category: "Tops" })).toEqual({
      ok: false,
      kind: "unavailable",
    });
    expect(await runArt({ idea: "a crown", style: "ink" })).toEqual({
      ok: false,
      kind: "unavailable",
    });
    expect(seenTo("api.x.ai")).toEqual([]);
  });

  it.each([400, 404])("tries the older model once when the new one answers %s", async (status) => {
    let calls = 0;
    server.use(
      http.post(IMAGES, () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json({ error: "unknown model" }, { status })
          : HttpResponse.json(xaiImage());
      }),
    );
    expect((await runPiece({ spoken: "jacket", category: "Tops" })).ok).toBe(true);
    const sent = await bodies();
    expect(sent.map((body) => body.model)).toEqual([
      "grok-imagine-image-2.0",
      "grok-imagine-image",
    ]);
    expect(sent[1]).not.toHaveProperty("quality");
  });

  it.each([401, 429, 500])("does not pay for a second try when xAI answers %s", async (status) => {
    server.use(http.post(IMAGES, () => HttpResponse.json({ error: "no" }, { status })));
    expect(await runPiece({ spoken: "jacket", category: "Tops" })).toEqual({
      ok: false,
      kind: "missed",
    });
    expect(seenTo("api.x.ai")).toHaveLength(1);
  });

  it("gives up after the fallback also fails, with two calls and no more", async () => {
    server.use(http.post(IMAGES, () => HttpResponse.json({ error: "no" }, { status: 400 })));
    expect(await runPiece({ spoken: "jacket", category: "Tops" })).toEqual({
      ok: false,
      kind: "missed",
    });
    expect(seenTo("api.x.ai")).toHaveLength(2);
  });

  it.each([
    ["an empty result", { data: [] }],
    ["a result with no image in it", { data: [{}] }],
    ["an image link that is not https", { data: [{ url: "http://cdn.x.ai/a.jpg" }] }],
  ])("reports a miss on %s", async (_what, payload) => {
    server.use(http.post(IMAGES, () => HttpResponse.json(payload)));
    expect(await runPiece({ spoken: "jacket", category: "Tops" })).toEqual({
      ok: false,
      kind: "missed",
    });
  });

  it("downloads a linked image and returns it inline", async () => {
    server.use(
      http.post(IMAGES, () => HttpResponse.json({ data: [{ url: "https://cdn.x.ai/a.png" }] })),
      http.get(
        "https://cdn.x.ai/a.png",
        () =>
          new HttpResponse(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/png" } }),
      ),
    );
    const result = await runPiece({ spoken: "jacket", category: "Tops" });
    expect(result).toMatchObject({ ok: true, image: "data:image/png;base64,AQID" });
  });
});

describe("putting pieces on a person", () => {
  const look = {
    mode: "look" as const,
    spoken: "night out",
    baseSpoken: "",
    characterImages: [FACE],
    clothingImages: [FACE, FACE],
    lookImage: null,
  };

  it("sends the face and the clothes as references", async () => {
    server.use(http.post(EDITS, () => HttpResponse.json(xaiImage())));
    expect((await runLook(look)).ok).toBe(true);
    const [body] = await bodies();
    expect(body).toMatchObject({
      model: "grok-imagine-image-2.0",
      aspect_ratio: "2:3",
      quality: "low",
    });
    expect(body?.images).toHaveLength(3);
  });

  it("never sends more than five reference pictures", async () => {
    server.use(http.post(EDITS, () => HttpResponse.json(xaiImage())));
    await runLook({
      ...look,
      characterImages: [FACE, FACE, FACE],
      clothingImages: Array.from({ length: 9 }, () => FACE),
    });
    const [body] = await bodies();
    expect(body?.images).toHaveLength(5);
  });

  it.each([
    ["no face locked", { ...look, characterImages: [] }],
    ["nothing said", { ...look, spoken: "" }],
    ["a tweak with no look to tweak", { ...look, mode: "tweak" as const }],
  ])("sends nothing with %s", async (_what, input) => {
    expect(await runLook(input)).toEqual({ ok: false, kind: "missed" });
    expect(seenTo("api.x.ai")).toEqual([]);
  });
});

describe("the runway video", () => {
  const start = {
    lookImage: FACE,
    faceImage: FACE,
    spoken: "night out",
    reaction: "cheer" as const,
  };

  it("starts one six-second clip and hands back its id", async () => {
    server.use(http.post(VIDEOS, () => HttpResponse.json(xaiVideoStarted("req_12345678"))));
    expect(await runStart(start)).toMatchObject({ ok: true, requestId: "req_12345678" });
    const [body] = await bodies();
    expect(body).toMatchObject({
      model: "grok-imagine-video-1.5",
      duration: 6,
      aspect_ratio: "9:16",
      resolution: "720p",
    });
    expect(seenTo("api.x.ai")).toHaveLength(1);
  });

  it("sends nothing without a look to walk", async () => {
    expect(await runStart({ ...start, lookImage: null })).toEqual({ ok: false, kind: "missed" });
    expect(seenTo("api.x.ai")).toEqual([]);
  });

  it("tries once more without the face when the first request is refused", async () => {
    let calls = 0;
    server.use(
      http.post(VIDEOS, () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json({ error: "no" }, { status: 400 })
          : HttpResponse.json(xaiVideoStarted());
      }),
    );
    expect((await runStart(start)).ok).toBe(true);
    const sent = await bodies();
    expect(sent).toHaveLength(2);
    expect(sent[0]).toHaveProperty("reference_images");
    expect(sent[1]).not.toHaveProperty("reference_images");
  });

  it("does not retry when there was no face to drop", async () => {
    server.use(http.post(VIDEOS, () => HttpResponse.json({ error: "no" }, { status: 500 })));
    expect(await runStart({ ...start, faceImage: null })).toEqual({ ok: false, kind: "missed" });
    expect(seenTo("api.x.ai")).toHaveLength(1);
  });

  it.each(["", "short", "../../v1/models", "id with spaces", "x".repeat(81)])(
    "will not ask xAI about the run id %j",
    async (id) => {
      expect(await runPoll(id)).toEqual({ ok: false, kind: "missed" });
      expect(seenTo("api.x.ai")).toEqual([]);
    },
  );

  it("reports pending, failed and expired runs", async () => {
    const answer = (status: string) =>
      server.use(
        http.get("https://api.x.ai/v1/videos/req_12345678", () => HttpResponse.json({ status })),
      );
    answer("pending");
    expect(await runPoll("req_12345678")).toEqual({ ok: true, status: "pending" });
    answer("failed");
    expect(await runPoll("req_12345678")).toEqual({ ok: true, status: "failed" });
    answer("expired");
    expect(await runPoll("req_12345678")).toEqual({ ok: true, status: "failed" });
  });

  const done = (clip: () => Response) =>
    server.use(
      http.get("https://api.x.ai/v1/videos/req_12345678", () =>
        HttpResponse.json({ status: "done", video: { url: "https://vidgen.x.ai/clip.mp4" } }),
      ),
      http.get("https://vidgen.x.ai/clip.mp4", clip),
    );

  it("returns a finished clip inline so it plays without a second host", async () => {
    done(
      () =>
        new HttpResponse(new Uint8Array([0, 0, 0, 1]), {
          headers: { "content-type": "video/mp4" },
        }),
    );
    expect(await runPoll("req_12345678")).toEqual({
      ok: true,
      status: "done",
      url: "data:video/mp4;base64,AAAAAQ==",
    });
  });

  it.each([
    [
      "is declared larger than the cap",
      () =>
        new HttpResponse(null, {
          headers: { "content-type": "video/mp4", "content-length": "900000000" },
        }),
    ],
    [
      "is not a video",
      () => new HttpResponse("<html>", { headers: { "content-type": "text/html" } }),
    ],
    ["cannot be downloaded", () => new HttpResponse(null, { status: 403 })],
  ])("links to the clip instead when it %s", async (_what, clip) => {
    done(clip);
    expect(await runPoll("req_12345678")).toEqual({
      ok: true,
      status: "done",
      url: "https://vidgen.x.ai/clip.mp4",
    });
  });
});
