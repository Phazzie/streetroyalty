import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArtEffects, ArtMaker, WornPreview } from "@/components/studio/art-tools";
import { AopStage } from "@/components/studio/aop-stage";
import { DesignStage, type StageView } from "@/components/studio/design-stage";
import { LayerInspector, type AlignKind } from "@/components/studio/layer-inspector";
import { PreflightPanel } from "@/components/studio/preflight-panel";
import { Note, Panel } from "@/components/studio/shell";
import { renderPreview, renderPrintFile } from "@/components/studio/print-file";
import { garmentMockupSvg } from "@/lib/gfx/garments";
import "@/components/studio/studio-fonts.css";
import { fitPng, loadPixels } from "@/lib/gfx/canvas";
import { copy } from "@/lib/copy";
import { compressDataUrl, readFileAsDataUrl } from "@/lib/images";
import { AOP_DPI } from "@/lib/pod/aop-printful";
import type { CatalogProduct, DesignLayer, PrintArea } from "@/lib/pod/types";
import { formatMoney } from "@/lib/pod/money";
import {
  addCollection,
  cartAdd,
  getCatalogProduct,
  getStudioConfig,
  keepSpotFile,
  listCatalog,
  makeMockup,
  myCollections,
  myDesign,
  photoMockup,
  photoMockupStatus,
  publishPiece,
  savePiece,
} from "@/lib/studio/api";
import { suggestLines } from "@/lib/ai/api";
import { isUnauthorized } from "@/lib/ai/access";
import { SignInCall } from "@/components/ai/sign-in-call";
import { useAiPrompt } from "@/components/ai/use-paid-ai";
import { createSingleFlight } from "@/lib/ui/single-flight";
import { designVisualKey } from "@/lib/studio/design-key";
import {
  garmentInk,
  printGround,
  restoreInk,
  restoreNote,
  swapForAllOver,
  swapNote,
  type InkSwap,
} from "@/lib/studio/ink";
import {
  AOP_ORDER_CLOSED,
  canOrderProduct,
  defaultGarment,
  type GarmentDesign,
} from "@/lib/studio/garments";
import {
  canPublish,
  effectiveDpi,
  layerReach,
  preflightVerdict,
  runPrintChecks,
  type ImageFacts,
} from "@/lib/studio/preflight";
import { fontShorthand } from "@/lib/studio/fonts";
import { MAX_LAYERS } from "@/lib/studio/validate";

type CatalogCard = {
  id: string;
  name: string;
  type: string;
  imageUrl?: string;
  construction?: "placement" | "aop";
};

type Snapshot = {
  placement: string;
  layers: DesignLayer[];
  spotLayers: Record<string, DesignLayer[]>;
};

type Photos = { key: string; photos: { placement: string; url: string }[] };

const starter: DesignLayer = {
  id: "tagline",
  type: "text",
  text: "STREET ROYALTY",
  font: "Archivo Black",
  color: "#d6ff3c",
  x: 0.5,
  y: 0.3,
  scale: 1,
  rotation: -8,
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function errorText(error: unknown): string {
  if (isUnauthorized(error)) return "Sign in to keep this. Your design stays right here while you do.";
  return error instanceof Error ? error.message : "That did not land.";
}

function newId(kind: string): string {
  return `${kind}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function Editor({ designId }: { designId: string }) {
  const navigate = useNavigate();
  const ai = useAiPrompt();
  const [catalog, setCatalog] = useState<CatalogCard[]>([]);
  const [product, setProduct] = useState<CatalogProduct | null>(null);
  const [variantId, setVariantId] = useState("");
  const [placement, setPlacement] = useState("front");
  const [layers, setLayers] = useState<DesignLayer[]>([starter]);
  // Art on the spots that are not on screen right now, by placement. A regular
  // piece prints every spot that has art.
  const [spotLayers, setSpotLayers] = useState<Record<string, DesignLayer[]>>({});
  const [garment, setGarment] = useState<GarmentDesign | null>(null);
  const [printOverride, setPrintOverride] = useState(false);
  const [imageFacts, setImageFacts] = useState<ImageFacts[]>([]);
  const [selected, setSelected] = useState("tagline");
  const [title, setTitle] = useState("Night shift tee");
  const [savedId, setSavedId] = useState(designId);
  const [collectionId, setCollectionId] = useState("");
  const [collections, setCollections] = useState<{ id: string; name: string }[]>([]);
  const [mockupUrl, setMockupUrl] = useState("");
  const mockupStamp = useRef("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  const [tab, setTab] = useState<"design" | "photo" | "worn">("design");
  const [view, setView] = useState<StageView>("garment");
  // A phone has little room: it opens on the print area itself, big enough to work on.
  useEffect(() => {
    if (window.matchMedia?.("(max-width: 639px)").matches) setView("flat");
  }, []);
  const [pinned, setPinned] = useState(true);
  const [photoReady, setPhotoReady] = useState(false);
  const [photos, setPhotos] = useState<Photos | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [needSignIn, setNeedSignIn] = useState(false);
  const flight = useRef(createSingleFlight());
  const textRef = useRef<HTMLInputElement>(null);
  // The untouched picture behind each image layer, so a print effect can always start over.
  const originals = useRef(new Map<string, string>());

  useEffect(() => {
    for (const layer of layers) {
      if (layer.type === "image" && !originals.current.has(layer.id)) {
        originals.current.set(layer.id, layer.src);
      }
    }
  }, [layers]);

  useEffect(() => {
    void Promise.resolve()
      .then(() => getStudioConfig())
      .then((config) => setPhotoReady(Boolean(config?.photoMockups)))
      .catch(() => setPhotoReady(false));
  }, []);

  /* ------------------------------------------------------------ history */

  const history = useRef({
    undo: [] as Snapshot[],
    redo: [] as Snapshot[],
    settled: null as Snapshot | null,
    pendingFrom: null as Snapshot | null,
    timer: 0,
    restoring: false,
    armed: false,
  });
  const [, setHistoryTick] = useState(0);

  const settle = useCallback(() => {
    const h = history.current;
    window.clearTimeout(h.timer);
    if (!h.pendingFrom) return;
    h.undo.push(h.pendingFrom);
    if (h.undo.length > 80) h.undo.shift();
    h.pendingFrom = null;
    h.redo = [];
    setHistoryTick((tick) => tick + 1);
  }, []);

  useEffect(() => {
    const h = history.current;
    const now = { placement, layers, spotLayers };
    if (h.restoring) {
      h.restoring = false;
      h.settled = now;
      return;
    }
    if (!h.armed || !h.settled) {
      h.settled = now;
      return;
    }
    if (!h.pendingFrom) {
      h.pendingFrom = h.settled;
      setHistoryTick((tick) => tick + 1);
    }
    h.settled = now;
    window.clearTimeout(h.timer);
    h.timer = window.setTimeout(settle, 450);
  }, [layers, placement, settle, spotLayers]);

  function restore(target: Snapshot) {
    history.current.restoring = true;
    setPlacement(target.placement);
    setLayers(target.layers);
    setSpotLayers(target.spotLayers);
    if (!target.layers.some((layer) => layer.id === selected)) setSelected("");
    setHistoryTick((tick) => tick + 1);
  }

  function undo() {
    settle();
    const h = history.current;
    const target = h.undo.pop();
    if (!target || !h.settled) return;
    h.redo.push(h.settled);
    restore(target);
  }

  function redo() {
    settle();
    const h = history.current;
    const target = h.redo.pop();
    if (!target || !h.settled) return;
    h.undo.push(h.settled);
    restore(target);
  }

  const canUndo = history.current.undo.length > 0 || history.current.pendingFrom != null;
  const canRedo = history.current.redo.length > 0;
  const arm = () => {
    history.current.armed = true;
  };

  /* ------------------------------------------------------------ catalog */

  const chooseProduct = useCallback(async (productId: string, nextVariant?: string) => {
    const detail = await getCatalogProduct({ data: { productId } });
    setProduct(detail);
    const variant = detail.variants.find((item) => item.id === nextVariant) ?? detail.variants[0];
    setVariantId(variant?.id ?? "");
    setPlacement((current) =>
      detail.placements.some((item) => item.placement === current)
        ? current
        : (detail.placements[0]?.placement ?? "front"),
    );
  }, []);

  useEffect(() => {
    void listCatalog({ data: { offset: 0, limit: 24 } })
      .then((page) => {
        setCatalog(page.products);
        if (!designId && page.products[0]) void chooseProduct(page.products[0].id);
      })
      .catch((error) => setNote(errorText(error)));
    void myCollections()
      .then(setCollections)
      .catch(() => setCollections([]));
  }, [chooseProduct, designId]);

  useEffect(() => {
    if (!designId) {
      const art = sessionStorage.getItem("sr-print-art");
      if (!art) return;
      sessionStorage.removeItem("sr-print-art");
      setLayers((current) => {
        if (current.length >= MAX_LAYERS) return current;
        return [
          ...current,
          { id: `art-${Date.now()}`, type: "image", src: art, x: 0.5, y: 0.5, scale: 0.9, rotation: 0 },
        ];
      });
    } else {
      void myDesign({ data: { designId } })
        .then(async (design) => {
          setSavedId(design.id);
          setTitle(design.title);
          setLayers(design.layers);
          setSelected("");
          setSpotLayers(
            Object.fromEntries(
              (design.spots ?? [])
                .filter((spot) => spot.placement !== design.placement)
                .map((spot) => [spot.placement, spot.layers]),
            ),
          );
          setGarment(design.garment);
          setPlacement(design.placement);
          setCollectionId(design.collectionId ?? "");
          setMockupUrl("");
          await chooseProduct(design.productId, design.variantId);
          const key = designVisualKey({
            productId: design.productId,
            variantId: design.variantId,
            placement: design.placement,
            layers: design.layers,
            garment: design.garment,
          });
          mockupStamp.current = design.mockupUrl ? key : "";
          setMockupUrl(design.mockupUrl ?? "");
        })
        .catch((error) => setNote(errorText(error)));
    }
  }, [chooseProduct, designId]);

  const variant = product?.variants.find((item) => item.id === variantId) ?? null;
  const colorKey = (item: { color: string; colorCode?: string }) => item.colorCode ?? item.color;
  const colors = product
    ? [...new Map(product.variants.map((item) => [colorKey(item), item])).values()]
    : [];
  const sizes =
    product?.variants.filter((item) => colorKey(item) === (variant ? colorKey(variant) : "")) ?? [];
  const area: PrintArea = useMemo(
    () =>
      variant?.printAreas.find((item) => item.placement === placement) ??
      variant?.printAreas[0] ?? { placement, widthIn: 12, heightIn: 16, dpi: AOP_DPI },
    [placement, variant],
  );
  const active = layers.find((layer) => layer.id === selected) ?? null;
  const atLayerLimit = layers.length >= MAX_LAYERS;
  const aop = product?.construction === "aop" && Boolean(product.aopTemplateId);

  /* ------------------------------------------------------------- layers */

  function patchLayer(id: string, patch: Partial<DesignLayer>) {
    setLayers((current) =>
      current.map((layer) => {
        if (layer.id !== id) return layer;
        const next = { ...layer, ...patch } as DesignLayer;
        // Undefined means "take it off", so the saved layer does not carry an empty key.
        for (const key of Object.keys(patch) as (keyof DesignLayer)[]) {
          if (patch[key] === undefined) delete (next as Record<string, unknown>)[key];
        }
        return next;
      }),
    );
  }

  function addText() {
    if (layers.length >= MAX_LAYERS) return;
    arm();
    const id = newId("text");
    const ink = layers.find((layer) => layer.type === "text")?.color === "#ff2d95" ? "#d6ff3c" : "#ff2d95";
    setLayers((current) =>
      current.length >= MAX_LAYERS
        ? current
        : [
            ...current,
            {
              id,
              type: "text",
              text: "NEW",
              font: "Archivo Black",
              color: ink,
              x: 0.5,
              y: current.length === 0 ? 0.3 : 0.62,
              scale: 0.8,
              rotation: 0,
            },
          ],
    );
    setSelected(id);
    window.setTimeout(() => {
      textRef.current?.focus();
      textRef.current?.select();
    }, 30);
  }

  async function onUpload(file: File | undefined) {
    if (!file) return;
    if (layers.length >= MAX_LAYERS) {
      setNote("Eight layers is the limit.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setNote("That is not a picture. Use a PNG, JPEG or WebP.");
      return;
    }
    try {
      setNote("Reading the picture.");
      const raw = await readFileAsDataUrl(file);
      // A PNG, WebP or GIF can carry a transparent backdrop. Keeping it as a PNG keeps that; a JPEG would fill it in.
      // Kept as large as the upload limit allows, so it prints sharp at a bigger size.
      const keepsAlpha = /^image\/(png|webp|gif)$/.test(file.type);
      const src = keepsAlpha
        ? fitPng(await loadPixels(raw, 2400))
        : await compressDataUrl(raw, 2400, 0.9);
      addArt(src, src);
      setNote("");
    } catch (error) {
      setNote(errorText(error));
    }
  }

  function addArt(src: string, original: string) {
    if (layers.length >= MAX_LAYERS) {
      setNote("Eight layers is the limit.");
      return;
    }
    arm();
    const id = newId("img");
    originals.current.set(id, original);
    setLayers((current) => {
      if (current.length >= MAX_LAYERS) return current;
      return [...current, { id, type: "image" as const, src, x: 0.5, y: 0.45, scale: 1, rotation: 0 }];
    });
    setSelected(id);
  }

  function duplicate(id: string) {
    const layer = layers.find((item) => item.id === id);
    if (!layer || layers.length >= MAX_LAYERS) return;
    const copyId = newId(layer.type === "text" ? "text" : "img");
    if (layer.type === "image") originals.current.set(copyId, originals.current.get(id) ?? layer.src);
    const twin = { ...layer, id: copyId, x: clamp(layer.x + 0.05, 0, 1), y: clamp(layer.y + 0.05, 0, 1) };
    setLayers((current) => {
      const at = current.findIndex((item) => item.id === id);
      return [...current.slice(0, at + 1), twin, ...current.slice(at + 1)];
    });
    setSelected(copyId);
  }

  function drop(id: string) {
    originals.current.delete(id);
    setLayers((current) => current.filter((layer) => layer.id !== id));
    setSelected("");
  }

  /** Moves a layer up (towards the front) or down the stack. */
  function restack(id: string, towardsFront: boolean) {
    setLayers((current) => {
      const at = current.findIndex((layer) => layer.id === id);
      const to = towardsFront ? at + 1 : at - 1;
      if (at < 0 || to < 0 || to >= current.length) return current;
      const next = [...current];
      [next[at], next[to]] = [next[to]!, next[at]!];
      return next;
    });
  }

  const factsFor = (id: string) => imageFacts.find((item) => item.layerId === id);

  function align(kind: AlignKind) {
    if (!active) return;
    const reach = layerReach(active, area, factsFor(active.id));
    if (kind === "left") patchLayer(active.id, { x: clamp(reach.x, 0, 1) });
    else if (kind === "right") patchLayer(active.id, { x: clamp(1 - reach.x, 0, 1) });
    else if (kind === "centre") patchLayer(active.id, { x: 0.5 });
    else if (kind === "top") patchLayer(active.id, { y: clamp(reach.y, 0, 1) });
    else if (kind === "bottom") patchLayer(active.id, { y: clamp(1 - reach.y, 0, 1) });
    else if (kind === "middle") patchLayer(active.id, { y: 0.5 });
    else {
      // Grow or shrink until the layer spans the area, then centre it.
      const grow = 0.96 / Math.max(0.02, reach.x * 2);
      const scale = clamp(active.scale * grow, 0.15, 3);
      patchLayer(active.id, { scale: Math.round(scale * 100) / 100, x: 0.5 });
    }
  }

  /* ----------------------------------------------------------- keyboard */

  const keys = useRef({ undo, redo, duplicate, drop, patchLayer, active });
  keys.current = { undo, redo, duplicate, drop, patchLayer, active };

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)
      ) {
        return;
      }
      const k = keys.current;
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      if (mod && key === "z") {
        event.preventDefault();
        history.current.armed = true;
        if (event.shiftKey) k.redo();
        else k.undo();
        return;
      }
      if (mod && key === "y") {
        event.preventDefault();
        k.redo();
        return;
      }
      const layer = k.active;
      if (!layer) return;
      history.current.armed = true;
      if (mod && key === "d") {
        event.preventDefault();
        k.duplicate(layer.id);
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        k.drop(layer.id);
        return;
      }
      if (event.key === "Escape") {
        setSelected("");
        return;
      }
      const step = event.shiftKey ? 0.03 : 0.005;
      const move =
        event.key === "ArrowLeft"
          ? { x: clamp(layer.x - step, 0, 1) }
          : event.key === "ArrowRight"
            ? { x: clamp(layer.x + step, 0, 1) }
            : event.key === "ArrowUp"
              ? { y: clamp(layer.y - step, 0, 1) }
              : event.key === "ArrowDown"
                ? { y: clamp(layer.y + step, 0, 1) }
                : null;
      if (!move) return;
      event.preventDefault();
      k.patchLayer(layer.id, move);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ------------------------------------------------------------ mockups */

  useEffect(() => {
    if (!mockupUrl) return;
    const key = designVisualKey({
      productId: product?.id ?? "",
      variantId,
      placement,
      layers,
      garment: product?.construction === "aop" && product.aopTemplateId ? garment : null,
    });
    if (mockupStamp.current !== key) {
      mockupStamp.current = "";
      setMockupUrl("");
    }
  }, [garment, layers, mockupUrl, placement, product?.aopTemplateId, product?.construction, product?.id, variantId]);

  async function exportPrint() {
    return renderPrintFile(area, layers);
  }

  function areaFor(key: string): PrintArea {
    return (
      variant?.printAreas.find((item) => item.placement === key) ??
      variant?.printAreas[0] ?? { placement: key, widthIn: 12, heightIn: 16, dpi: AOP_DPI }
    );
  }

  /** Puts the art on screen away under its spot and brings up the art of the next one. */
  function switchSpot(next: string) {
    if (next === placement) return;
    const incoming = spotLayers[next] ?? [];
    setSpotLayers((current) => {
      const { [next]: _taken, ...rest } = current;
      return layers.length > 0 ? { ...rest, [placement]: layers } : rest;
    });
    setLayers(incoming);
    setSelected(incoming[incoming.length - 1]?.id ?? "");
    setPlacement(next);
  }

  // Every spot of this product that has art, in the product's own order.
  const spots = (product?.placements ?? [])
    .map((item) => ({
      placement: item.placement,
      layers: item.placement === placement ? layers : (spotLayers[item.placement] ?? []),
    }))
    .filter((spot) => spot.layers.length > 0);

  /**
   * Everything a save sends. The first spot with art travels with the save;
   * every other spot's print file goes up first on its own, so no single
   * request carries more than one picture.
   */
  async function savePayload() {
    if (aop || spots.length <= 1) {
      const only = spots[0] ?? { placement, layers };
      return {
        placement: only.placement,
        layers: only.layers,
        printFile: await renderPrintFile(areaFor(only.placement), only.layers),
        spots: [],
      };
    }
    const [first, ...rest] = spots;
    const printFile = await renderPrintFile(areaFor(first!.placement), first!.layers);
    const extra = [];
    for (const spot of rest) {
      const file = await renderPrintFile(areaFor(spot.placement), spot.layers);
      const kept = await keepSpotFile({ data: { printFile: file } });
      extra.push({ placement: spot.placement, layers: spot.layers, printFileId: kept.id });
    }
    return { placement: first!.placement, layers: first!.layers, printFile, spots: extra };
  }

  const photoKey = JSON.stringify({
    product: product?.id,
    variantId,
    spots: spots.map((spot) => designVisualKey({ productId: "", variantId: "", placement: spot.placement, layers: spot.layers, garment: null })),
  });
  const photosCurrent = photos != null && photos.key === photoKey;

  function failed(error: unknown) {
    if (isUnauthorized(error)) setNeedSignIn(true);
    setNote(errorText(error));
  }

  /** Printful's own photos of every printed spot. Null when Printful is still busy. */
  async function shootPhotos(): Promise<Photos["photos"] | null> {
    if (!product || !variant) return null;
    const sent = [];
    for (const spot of spots) {
      const file = await renderPrintFile(areaFor(spot.placement), spot.layers);
      const kept = await keepSpotFile({ data: { printFile: file } });
      sent.push({ placement: spot.placement, printFileId: kept.id });
    }
    let result = await photoMockup({
      data: { productId: product.id, variantId: variant.id, spots: sent },
    });
    for (let tries = 0; result.status === "pending" && tries < 12; tries += 1) {
      await wait(2500);
      result = await photoMockupStatus({ data: { taskId: result.taskId } });
    }
    if (result.photos.length === 0) return null;
    // The spot on screen first, so the rack shows what the maker was looking at.
    const photos = [...result.photos].sort(
      (a, b) => Number(b.placement === spots[0]?.placement) - Number(a.placement === spots[0]?.placement),
    );
    setPhotos({ key: photoKey, photos });
    return photos;
  }

  /**
   * The drawn mockup. A regular piece is drawn here from the same paint as the print file,
   * so the type is the type that prints; an all-over piece is drawn by the server from its panels.
   */
  async function drawMockup(): Promise<string> {
    if (!product || !variant) return "";
    let url: string;
    if (aop) {
      const result = await makeMockup({
        data: { productId: product.id, variantId: variant.id, placement, layers, printFile: await exportPrint(), garment },
      });
      url = result.mockupUrl;
    } else {
      const front = spots[0] ?? { placement, layers };
      const print = await renderPreview(areaFor(front.placement), front.layers);
      url = garmentMockupSvg({
        shape: product.type,
        colorHex: variant.colorHex,
        placement: front.placement,
        printArea: areaFor(front.placement),
        layers: [{ id: "print", type: "image", src: print, x: 0.5, y: 0.5, scale: 1 / 0.52, rotation: 0 }],
      });
    }
    mockupStamp.current = designVisualKey({
      productId: product.id,
      variantId: variant.id,
      placement,
      layers,
      garment: aop ? garment : null,
    });
    setMockupUrl(url);
    return url;
  }

  /** Real photos from Printful when the shop has its key; the drawn mockup otherwise. */
  async function onPhotos() {
    if (!product || !variant) return;
    setTab("photo");
    if (spots.length === 0 && !aop) {
      setNote("Put art on a spot first.");
      return;
    }
    await flight.current(async () => {
      setPhotoBusy(true);
      try {
        if (!photoReady || aop) {
          await drawMockup();
          setNote("");
          return;
        }
        setNote("Printful is shooting the piece. This takes up to half a minute.");
        const photos = await shootPhotos();
        setNote(photos ? "" : "Printful is still working on it. Try again in a minute.");
      } catch (error) {
        failed(error);
      } finally {
        setPhotoBusy(false);
      }
    });
  }

  /** The picture the rack shows: Printful's photo of the front when there is one. */
  function bestMockup(): string {
    if (photosCurrent && photos.photos[0]) return photos.photos[0].url;
    return mockupUrl;
  }

  async function onSave() {
    if (!product || !variant) return;
    await flight.current(async () => {
      setBusy(true);
      setNote("Saving.");
      try {
        const saved = await savePiece({
          data: {
            id: savedId || undefined,
            title,
            collectionId: collectionId || null,
            productId: product.id,
            variantId: variant.id,
            ...(await savePayload()),
            mockupUrl: bestMockup() || null,
            garment: aop ? garment : undefined,
          },
        });
        setSavedId(saved.id);
        setNeedSignIn(false);
        setNote(saved.warnings?.length ? saved.warnings.join(" ") : "Saved to your rack.");
        return saved.id;
      } catch (error) {
        failed(error);
        return "";
      } finally {
        setBusy(false);
      }
    });
  }

  async function onPublish() {
    if (!product || !variant) return;
    await flight.current(async () => {
      setBusy(true);
      try {
        if (!canPublish(verdict, printOverride)) {
          setNote("The print check failed. Read it, or say you are publishing anyway.");
          return;
        }
        setNote("Putting it on the rack.");
        const key = designVisualKey({
          productId: product.id,
          variantId: variant.id,
          placement,
          layers,
          garment: aop ? garment : null,
        });
        let url = bestMockup();
        if (url && !photosCurrent && mockupStamp.current !== key) url = "";
        if (!url && photoReady && !aop) {
          setNote("Printful is shooting the piece for the rack.");
          url = (await shootPhotos())?.[0]?.url ?? "";
        }
        if (!url) url = await drawMockup();
        const saved = await savePiece({
          data: {
            id: savedId || undefined,
            title,
            collectionId: collectionId || null,
            productId: product.id,
            variantId: variant.id,
            ...(await savePayload()),
            mockupUrl: url,
            garment: aop ? garment : undefined,
          },
        });
        setSavedId(saved.id);
        await publishPiece({ data: { designId: saved.id } });
        setNote("On the shop rack.");
        void navigate({ to: "/rack" });
      } catch (error) {
        failed(error);
      } finally {
        setBusy(false);
      }
    });
  }

  async function onCart() {
    if (!product || !variant) return;
    await flight.current(async () => {
      setBusy(true);
      try {
        let id = savedId;
        if (!id) {
          const saved = await savePiece({
            data: {
              title,
              collectionId: collectionId || null,
              productId: product.id,
              variantId: variant.id,
              ...(await savePayload()),
              mockupUrl: bestMockup() || null,
              garment: aop ? garment : undefined,
            },
          });
          id = saved.id;
          setSavedId(id);
        }
        await cartAdd({ data: { designId: id, variantId: variant.id } });
        setNote("In the cart.");
        void navigate({ to: "/cart" });
      } catch (error) {
        failed(error);
      } finally {
        setBusy(false);
      }
    });
  }

  /* ------------------------------------------------------------- checks */

  const spotCost = (key: "extraRetailCents" | "extraWholesaleCents") =>
    aop
      ? 0
      : spots.reduce(
          (sum, spot) =>
            sum + (product?.placements.find((item) => item.placement === spot.placement)?.[key] ?? 0),
          0,
        );
  const spotExtra = spotCost("extraRetailCents");
  const spotWholesale = spotCost("extraWholesaleCents");
  // The print check measures ink against the garment actually selected, never one left over from an all-over visit.
  const groundHex = printGround({
    aopTemplateId: aop ? product?.aopTemplateId : null,
    garment,
    variantHex: variant?.colorHex,
  });
  const checks = useMemo(
    () => runPrintChecks({ layers, area, garmentHex: groundHex, images: imageFacts }),
    [area, groundHex, imageFacts, layers],
  );
  const verdict = preflightVerdict(checks);
  const want = area.dpi || 150;
  const softIds = useMemo(() => {
    const soft = new Set<string>();
    for (const layer of layers) {
      const facts = imageFacts.find((item) => item.layerId === layer.id);
      if (layer.type === "image" && facts && effectiveDpi(facts, layer, area) < want * 0.6) soft.add(layer.id);
    }
    return soft;
  }, [area, imageFacts, layers, want]);
  const activeFacts = active?.type === "image" ? factsFor(active.id) : undefined;
  const activeDpi = active && activeFacts ? effectiveDpi(activeFacts, active, area) : undefined;
  const sharpUpTo = activeFacts ? activeFacts.widthPx / (want * 0.52 * Math.max(0.5, area.widthIn)) : undefined;

  // Lime the studio swapped so it reads on an all-over body, kept so the maker's own ink comes back.
  // Null while the piece is on any other blank.
  const inkSwap = useRef<InkSwap | null>(null);
  // A saved piece opens on its own blank in the ink it was saved in.
  const opening = useRef(Boolean(designId));
  const latest = useRef({ layers, garment });
  latest.current = { layers, garment };
  const productId = product?.id;
  const aopTemplateId = product?.aopTemplateId;

  useEffect(() => {
    if (!productId) return;
    const opened = opening.current;
    opening.current = false;
    if (!aopTemplateId) {
      const swap = inkSwap.current;
      inkSwap.current = null;
      if (!swap) return;
      const back = restoreInk(latest.current.layers, swap);
      if (back.restored > 0) {
        setLayers(back.layers);
        setNote(restoreNote(back.restored));
      }
      return;
    }
    const current = latest.current.garment;
    const next = current?.templateId === aopTemplateId ? current : defaultGarment(aopTemplateId);
    setGarment((now) => (now?.templateId === aopTemplateId ? now : next));
    // Already on an all-over blank: the swap, if any, was made and told when the piece arrived.
    if (inkSwap.current) return;
    if (opened) {
      inkSwap.current = {};
      return;
    }
    const moved = swapForAllOver(latest.current.layers, garmentInk(next));
    inkSwap.current = moved.swap;
    const count = Object.keys(moved.swap).length;
    if (count > 0) {
      setLayers(moved.layers);
      setNote(swapNote(count));
    }
  }, [productId, aopTemplateId]);

  useEffect(() => {
    let cancel = false;
    void (async () => {
      const facts: ImageFacts[] = [];
      for (const layer of layers) {
        if (layer.type !== "image") continue;
        const size = await readImageSize(layer.src);
        if (size) facts.push({ layerId: layer.id, widthPx: size.width, heightPx: size.height });
      }
      if (!cancel) setImageFacts(facts);
    })();
    return () => {
      cancel = true;
    };
  }, [layers]);

  /* ------------------------------------------------------------- render */

  const placementTitle = product?.placements.find((item) => item.placement === placement)?.title ?? "Front";
  const signedOut = ai.signedOut;

  const stagePanel = (
    <section
      className={`studio-card order-1 border-2 border-ink bg-surface lg:order-none ${pinned ? "max-lg:sticky max-lg:top-16 max-lg:z-30 max-lg:shadow-[0_10px_24px_-12px_rgba(0,0,0,0.9)]" : ""}`}
      aria-label="Your piece"
    >
      <h2 className="sr-only">{product ? product.name : "Loading the rack"}</h2>
      <div className="flex items-center gap-1 border-b-2 border-line p-2 sm:gap-1.5">
        <div className="flex gap-1" role="tablist" aria-label="View">
          {(
            [
              ["design", "Design", "Design"],
              ["photo", photoReady && !aop ? "Real photo" : "Mockup", photoReady && !aop ? "Photo" : "Mockup"],
              ["worn", "On a person", "Worn"],
            ] as const
          ).map(([id, label, short]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => {
                setTab(id);
                if (id === "photo" && !photosCurrent && !mockupUrl && !photoBusy && !busy) void onPhotos();
              }}
              className={`min-h-9 border-2 px-2 font-display text-[0.62rem] tracking-[0.06em] uppercase sm:px-2.5 sm:tracking-[0.12em] ${tab === id ? "border-ink bg-accent text-accent-fg" : "border-line bg-surface text-fg hover:border-ink"}`}
            >
              <span className="sm:hidden">{short}</span>
              <span className="max-sm:hidden">{label}</span>
            </button>
          ))}
        </div>
        {tab === "design" && !aop ? (
          <div className="ml-auto flex items-center gap-1">
            <IconButton label="Undo" keys="Ctrl+Z" disabled={!canUndo} onClick={undo} path="M6 4L2 8l4 4M2 8h8a4 4 0 0 1 0 8" />
            <IconButton label="Redo" keys="Ctrl+Shift+Z" disabled={!canRedo} onClick={redo} path="M10 4l4 4-4 4M14 8H6a4 4 0 0 0 0 8" />
            <IconButton
              label={view === "garment" ? "Zoom to the print area" : "Show the whole garment"}
              pressed={view === "flat"}
              onClick={() => setView(view === "garment" ? "flat" : "garment")}
              path={view === "garment" ? "M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4" : "M6 2v4H2M10 2v4h4M6 14v-4H2M10 14v-4h4"}
            />
          </div>
        ) : null}
      </div>
      <div className="p-2 [--stage-max-h:34dvh] sm:p-3 sm:[--stage-max-h:46dvh] lg:[--stage-max-h:min(74vh,46rem)]">
        {tab === "design" ? (
          aop && garment ? (
            <AopStage
              garment={garment}
              label={layers.find((layer) => layer.type === "text")?.text}
              onChange={setGarment}
            />
          ) : (
            <>
              <DesignStage
                layers={layers}
                selected={selected}
                area={area}
                colorHex={variant?.colorHex ?? "#141414"}
                productType={product?.type ?? "T-Shirt"}
                placement={placement}
                view={view}
                softIds={softIds}
                onSelect={(id) => {
                  arm();
                  setSelected(id);
                }}
                onPatch={(id, patch) => {
                  arm();
                  patchLayer(id, patch);
                }}
                onOpen={(id) => {
                  setSelected(id);
                  window.setTimeout(() => textRef.current?.focus(), 30);
                }}
              />
              <p className={`mt-2 text-center text-xs text-muted ${pinned ? "max-sm:hidden" : ""}`}>
                {placementTitle} print area {area.widthIn}" × {area.heightIn}".
                <span className="max-sm:hidden"> Drag to move, corners to resize, the knob to turn. Arrow keys nudge.</span>
                <span className="sm:hidden"> Drag, pinch, or use the corners.</span>
              </p>
            </>
          )
        ) : tab === "photo" ? (
          <PhotoView
            photos={photosCurrent ? photos.photos : null}
            stale={photos != null && !photosCurrent}
            drawn={mockupUrl}
            busy={photoBusy || busy}
            live={photoReady && !aop}
            onMake={() => void onPhotos()}
          />
        ) : (
          <WornPreview
            ready={Boolean(product && variant) && layers.length > 0 && !busy}
            exportPrint={exportPrint}
            colorHex={variant?.colorHex ?? "#141414"}
            colorName={variant?.color ?? "black"}
            productType={product?.type ?? "T-Shirt"}
            productName={product?.name}
            placement={placement}
            garment={aop && garment?.templateId === product?.aopTemplateId ? garment : null}
            onNote={setNote}
          />
        )}
        {note ? (
          <div className="mt-2">
            <Note>{note}</Note>
          </div>
        ) : null}
        {needSignIn ? (
          <div className="mt-2">
            <SignInCall>Sign in to save, publish or buy. Your design stays right here.</SignInCall>
          </div>
        ) : null}
      </div>
      {product && !aop ? (
        <div className="flex gap-1.5 overflow-x-auto border-t-2 border-line p-2 no-scrollbar" role="group" aria-label="Print spots">
          {product.placements.map((item) => {
            const inked = spots.some((spot) => spot.placement === item.placement);
            return (
              <button
                key={item.placement}
                type="button"
                aria-pressed={placement === item.placement}
                aria-label={inked ? `${item.title}, has art` : item.title}
                onClick={() => {
                  arm();
                  switchSpot(item.placement);
                  setTab("design");
                }}
                className={`min-h-9 shrink-0 border-2 px-2.5 font-display text-[0.66rem] tracking-[0.12em] uppercase ${placement === item.placement ? "border-ink bg-accent text-accent-fg" : "border-line bg-surface text-fg hover:border-ink"}`}
              >
                {item.title}
                {inked ? <span aria-hidden="true"> ●</span> : null}
              </button>
            );
          })}
          <span className="ml-auto lg:hidden">
            <IconButton
              label={pinned ? "Let the canvas scroll away" : "Keep the canvas on screen"}
              pressed={pinned}
              onClick={() => setPinned(!pinned)}
              path="M8 10v5M4 10h8M5 10l1-7h4l1 7"
            />
          </span>
        </div>
      ) : null}
    </section>
  );

  const layersPanel = (
    <Panel title={aop ? "Logo layers" : `Layers · ${placementTitle}`}>
      <div className="mb-3 grid grid-cols-2 gap-2">
        <Button variant="primary" disabled={atLayerLimit} onClick={addText}>
          Add text
        </Button>
        <label
          className={`inline-flex h-12 items-center justify-center rounded-md border-2 border-ink bg-surface px-4 font-bold ${atLayerLimit ? "pointer-events-none opacity-50" : "cursor-pointer hover:bg-cream"}`}
        >
          Upload art
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="sr-only"
            disabled={atLayerLimit}
            onChange={(event) => {
              arm();
              void onUpload(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </label>
      </div>
      {layers.length === 0 ? (
        <p className="mb-3 text-sm text-muted">
          Nothing on the {placementTitle.toLowerCase()} yet. Add text or art, or leave it bare.
        </p>
      ) : (
        <ul className="mb-3 flex flex-col gap-1.5" aria-label="Layers, top first">
          {[...layers].reverse().map((layer, index) => {
            const on = selected === layer.id;
            const top = index === 0;
            const bottom = index === layers.length - 1;
            return (
              <li key={layer.id} className={`flex items-stretch border-2 ${on ? "border-accent" : "border-line"}`}>
                <button
                  type="button"
                  onClick={() => {
                    arm();
                    setSelected(layer.id);
                  }}
                  aria-pressed={on}
                  className="flex min-h-12 min-w-0 flex-1 items-center gap-2 px-2 text-left"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden bg-night">
                    {layer.type === "text" ? (
                      <span style={{ font: fontShorthand(layer.font, 16), color: layer.color }} aria-hidden="true">
                        Aa
                      </span>
                    ) : (
                      <img src={layer.src} alt="" className="size-full object-contain" />
                    )}
                  </span>
                  <span className="truncate text-sm">{layer.type === "text" ? layer.text : "Artwork"}</span>
                  {softIds.has(layer.id) ? (
                    <span className="ml-auto shrink-0 bg-pink px-1 text-[0.6rem] font-bold text-white uppercase">Soft</span>
                  ) : null}
                </button>
                <div className="flex shrink-0 flex-col border-l-2 border-line">
                  <button
                    type="button"
                    aria-label="Bring forward"
                    title="Bring forward"
                    disabled={top}
                    onClick={() => {
                      arm();
                      restack(layer.id, true);
                    }}
                    className="flex h-6 w-9 items-center justify-center disabled:opacity-30"
                  >
                    <svg viewBox="0 0 12 12" className="size-3" aria-hidden="true">
                      <path d="M2 8l4-4 4 4" fill="none" stroke="currentColor" strokeWidth="2" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    aria-label="Send back"
                    title="Send back"
                    disabled={bottom}
                    onClick={() => {
                      arm();
                      restack(layer.id, false);
                    }}
                    className="flex h-6 w-9 items-center justify-center border-t-2 border-line disabled:opacity-30"
                  >
                    <svg viewBox="0 0 12 12" className="size-3" aria-hidden="true">
                      <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2" />
                    </svg>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {active ? (
        <div className="border-t-2 border-line pt-3" onInputCapture={arm} onClickCapture={arm}>
          <LayerInspector
            key={active.id}
            layer={active}
            area={area}
            dpi={activeDpi}
            sharpUpTo={sharpUpTo}
            full={atLayerLimit}
            onPatch={(patch) => patchLayer(active.id, patch)}
            onAlign={align}
            onDuplicate={() => duplicate(active.id)}
            onDrop={() => drop(active.id)}
            textField={
              active.type === "text" ? (
                <div className="flex flex-col gap-1">
                  <label className="font-display text-[0.68rem] tracking-[0.14em] text-muted uppercase" htmlFor="layer-text">
                    Words
                  </label>
                  <Input
                    id="layer-text"
                    ref={textRef}
                    aria-label="Layer text"
                    value={active.text}
                    maxLength={80}
                    onChange={(event) => patchLayer(active.id, { text: event.target.value.slice(0, 80) })}
                  />
                </div>
              ) : undefined
            }
            lineHelper={
              active.type === "text" ? (
                <div className="flex flex-col gap-2">
                  <Button
                    variant="ghost"
                    className="w-full"
                    disabled={busy || ai.blocked}
                    onClick={() => {
                      if (ai.blocked) return;
                      void suggestLines({ data: { seed: `${title} ${active.text}` } })
                        .then((result) => {
                          setLines(result.lines);
                          setNote(result.source === "grok" ? "Lines from the crown." : "Lines from the house, no key needed.");
                        })
                        .catch((error) => {
                          if (ai.refused(error)) setNote(copy.signInToDraw);
                          else setNote(errorText(error));
                        });
                    }}
                  >
                    {signedOut ? "Write a line (sign in)" : copy.writeLine}
                  </Button>
                  {lines.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {lines.map((line) => (
                        <button
                          key={line}
                          type="button"
                          className="chip"
                          onClick={() => patchLayer(active.id, { text: line.slice(0, 80) })}
                        >
                          {line}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : undefined
            }
            imageTools={
              active.type === "image" ? (
                <ArtEffects
                  key={active.id}
                  original={originals.current.get(active.id) ?? active.src}
                  onResult={(src) => patchLayer(active.id, { src })}
                  onNote={setNote}
                />
              ) : undefined
            }
          />
        </div>
      ) : layers.length > 0 ? (
        <p className="text-sm text-muted">Tap a layer on the piece or in the list to change it.</p>
      ) : null}
      <details className="mt-4 border-t-2 border-line pt-3">
        <summary className="cursor-pointer font-display text-xs tracking-wide uppercase">Make art with AI</summary>
        <div className="mt-3">
          <ArtMaker full={atLayerLimit} onArt={addArt} onNote={setNote} />
        </div>
      </details>
    </Panel>
  );

  return (
    <div
      className="flex min-w-0 flex-col gap-4 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)_22rem] lg:items-start"
      onPointerDownCapture={arm}
      onKeyDownCapture={arm}
    >
      {signedOut ? (
        <p className="order-7 border-2 border-line bg-surface px-3 py-2 text-sm text-muted lg:order-none lg:col-span-3">
          Design as much as you like signed out. Sign in when you want to save it, see it worn, make AI art or buy it.
        </p>
      ) : null}

      <div className="contents lg:flex lg:flex-col lg:gap-4">
        <div className="order-4 lg:order-none">
          <Panel title="Blanks">
            <div className="flex w-full min-w-0 gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
              {catalog.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={product?.id === item.id}
                  onClick={() => void chooseProduct(item.id).catch((error) => setNote(errorText(error)))}
                  className={`studio-card flex w-32 shrink-0 flex-col border-2 p-1.5 text-left lg:w-full lg:flex-row lg:items-center lg:gap-2 ${product?.id === item.id ? "border-accent" : "border-line"}`}
                >
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="mb-1 aspect-square w-full object-cover lg:mb-0 lg:size-16 lg:shrink-0"
                    />
                  ) : null}
                  <span className="min-w-0">
                    <span className="block font-display text-[0.65rem] uppercase">{item.type}</span>
                    <span className="block text-sm leading-tight">{item.name}</span>
                    {item.construction === "aop" ? <span className="block text-xs text-muted">All-over print</span> : null}
                  </span>
                </button>
              ))}
            </div>
          </Panel>
        </div>
        <div className="order-3 lg:order-none">
          <Panel title="Piece">
            <label className="mb-2 block text-sm text-muted" htmlFor="piece-title">
              Name
            </label>
            <Input id="piece-title" value={title} onChange={(event) => setTitle(event.target.value)} />
            {aop ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {product?.placements.map((item) => (
                  <button
                    key={item.placement}
                    type="button"
                    aria-pressed={placement === item.placement}
                    onClick={() => setPlacement(item.placement)}
                    className={`chip ${placement === item.placement ? "chip-on" : ""}`}
                  >
                    {item.title}
                  </button>
                ))}
              </div>
            ) : product ? (
              <p className="mt-2 text-sm text-muted">
                Each spot has its own art. Every spot with art gets printed.
                {spots.length > 1 ? ` ${spots.length} spots print on this piece.` : ""}
              </p>
            ) : null}
            <p className="mt-4 text-sm text-muted">Colour{variant ? `: ${variant.color}` : ""}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {colors.map((item) => (
                <button
                  key={item.color}
                  type="button"
                  aria-label={item.color}
                  title={item.color}
                  aria-pressed={variant?.color === item.color}
                  onClick={() => {
                    const match =
                      product?.variants.find((entry) => entry.color === item.color && entry.size === variant?.size) ?? item;
                    setVariantId(match.id);
                  }}
                  className={`size-11 border-2 ${variant?.color === item.color ? "border-accent ring-2 ring-accent/50" : "border-ink"}`}
                  style={{ background: item.colorHex }}
                />
              ))}
            </div>
            <p className="mt-4 text-sm text-muted">Size</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {sizes.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={item.id === variantId}
                  onClick={() => setVariantId(item.id)}
                  className={`chip ${item.id === variantId ? "chip-on" : ""}`}
                >
                  {item.size}
                </button>
              ))}
            </div>
            <p className="mt-4 font-display text-2xl">
              {variant?.retailCents != null ? formatMoney(variant.retailCents + spotExtra) : "—"}
            </p>
            {spotExtra > 0 ? (
              <p className="text-sm text-muted">Includes {formatMoney(spotExtra)} for the extra print spots.</p>
            ) : null}
            <p className="text-sm text-muted">
              {variant?.wholesaleCents != null
                ? `Print cost ${formatMoney(variant.wholesaleCents + spotWholesale)}`
                : "Price lands with the catalog."}
            </p>
          </Panel>
        </div>
      </div>

      <div className="contents lg:block">{stagePanel}</div>

      <div className="contents lg:flex lg:flex-col lg:gap-4">
        <div className="order-2 lg:order-none">{layersPanel}</div>

        <div className="order-5 lg:order-none">
          <Panel title="Print check">
            <PreflightPanel
              checks={checks}
              verdict={verdict}
              override={printOverride}
              onOverride={setPrintOverride}
              notPrintingYet={aop && product && !canOrderProduct(product.id) ? AOP_ORDER_CLOSED : undefined}
              scope={aop ? "These checks cover your logo layers. The panels print from the print sheets." : undefined}
            />
          </Panel>
        </div>

        <div className="order-6 lg:order-none">
          <Panel title="Keep it">
            <label className="mb-2 block text-sm text-muted" htmlFor="collection">
              Collection
            </label>
            <select
              id="collection"
              value={collectionId}
              onChange={(event) => setCollectionId(event.target.value)}
              className="mb-3 h-12 w-full border-2 border-ink bg-cream px-3 text-fg"
            >
              <option value="">No collection</option>
              {collections.map((collection) => (
                <option key={collection.id} value={collection.id}>
                  {collection.name}
                </option>
              ))}
            </select>
            <Button
              variant="ghost"
              className="mb-3 w-full"
              onClick={() => {
                const name = window.prompt("Collection name");
                if (!name) return;
                void addCollection({ data: { name } })
                  .then((collection) => {
                    setCollections((current) => [...current, collection]);
                    setCollectionId(collection.id);
                  })
                  .catch((error) => failed(error));
              }}
            >
              New collection
            </Button>
            <div className="grid gap-2">
              <Button disabled={busy || photoBusy} onClick={() => void onPhotos()}>
                {photoReady && !aop ? "Real photo" : "Mockup"}
              </Button>
              <Button variant="ghost" disabled={busy} onClick={() => void onSave()}>
                Save
              </Button>
              <Button variant="ghost" disabled={busy} onClick={() => void onPublish()}>
                Publish
              </Button>
              <Button variant="ghost" disabled={busy} onClick={() => void onCart()}>
                Add to cart
              </Button>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function IconButton({
  label,
  path,
  onClick,
  disabled,
  pressed,
  keys,
}: {
  label: string;
  path: string;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
  keys?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={keys ? `${label} (${keys})` : label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={`flex size-8 items-center justify-center border-2 border-line sm:size-9 bg-surface hover:border-ink disabled:opacity-30 ${pressed ? "border-accent" : ""}`}
    >
      <svg viewBox="0 0 16 18" className="size-4" aria-hidden="true">
        <path d={path} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

function PhotoView({
  photos,
  stale,
  drawn,
  busy,
  live,
  onMake,
}: {
  photos: { placement: string; url: string }[] | null;
  stale: boolean;
  drawn: string;
  busy: boolean;
  live: boolean;
  onMake: () => void;
}) {
  const [index, setIndex] = useState(0);
  const shown = photos?.[Math.min(index, (photos?.length ?? 1) - 1)];
  return (
    <div className="flex flex-col gap-3">
      {shown ? (
        <>
          <img
            src={shown.url}
            alt={`Printful photo of the piece, ${shown.placement.replace(/_/g, " ")}`}
            className="mx-auto max-h-[var(--stage-max-h)] w-full object-contain"
          />
          {photos && photos.length > 1 ? (
            <div className="flex flex-wrap justify-center gap-1.5">
              {photos.map((photo, at) => (
                <button
                  key={photo.url}
                  type="button"
                  aria-pressed={at === index}
                  onClick={() => setIndex(at)}
                  className={`size-14 overflow-hidden border-2 ${at === index ? "border-accent" : "border-line"}`}
                >
                  <img src={photo.url} alt={photo.placement} className="size-full object-cover" />
                </button>
              ))}
            </div>
          ) : null}
          <p className="text-center text-xs text-muted">Printful's own photo of this blank with your print files on it.</p>
        </>
      ) : drawn && !live ? (
        <>
          <img src={drawn} alt="Drawn mockup of the piece" className="mx-auto max-h-[var(--stage-max-h)] w-full object-contain" />
          <p className="text-center text-xs text-muted">
            A drawn preview. Printful's real photos switch on once the shop's Printful key is connected.
          </p>
        </>
      ) : (
        <div className="flex min-h-48 flex-col items-center justify-center gap-2 text-center text-sm text-muted">
          {busy ? <span className="size-8 animate-spin rounded-full border-4 border-line border-t-accent" /> : null}
          <p>
            {busy
              ? live
                ? "Printful is shooting your piece."
                : "Drawing it."
              : live
                ? "See your piece in Printful's own product photos."
                : "See the drawn mockup."}
          </p>
        </div>
      )}
      {stale ? <p className="text-center text-sm text-amber">The design changed since these photos.</p> : null}
      <Button variant={shown && !stale ? "ghost" : "primary"} disabled={busy} onClick={onMake}>
        {busy ? "Working" : shown || drawn ? "Shoot it again" : live ? "Get real photos" : "Draw the mockup"}
      </Button>
    </div>
  );
}

function readImageSize(src: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => resolve(null);
    image.src = src;
  });
}
