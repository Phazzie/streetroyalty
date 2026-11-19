import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArtEffects, ArtMaker, WornPreview } from "@/components/studio/art-tools";
import { AopStage } from "@/components/studio/aop-stage";
import { CurvedText } from "@/components/studio/curved-text";
import { PreflightPanel } from "@/components/studio/preflight-panel";
import { SetBoard } from "@/components/studio/set-board";
import { Note, Panel } from "@/components/studio/shell";
import { renderPrintFile } from "@/components/studio/print-file";
import { luminance } from "@/lib/color";
import { fitPng, loadPixels } from "@/lib/gfx/canvas";
import { copy } from "@/lib/copy";
import { compressDataUrl, readFileAsDataUrl } from "@/lib/images";
import type { CatalogProduct, DesignLayer, PrintArea } from "@/lib/pod/types";
import { formatMoney } from "@/lib/pod/money";
import {
  addCollection,
  cartAdd,
  getCatalogProduct,
  listCatalog,
  makeMockup,
  myCollections,
  myDesign,
  publishPiece,
  savePiece,
} from "@/lib/studio/api";
import { suggestLines } from "@/lib/ai/api";
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
  getTemplate,
  setPartner,
  withSharedColorways,
  type GarmentDesign,
} from "@/lib/studio/garments";
import { canPublish, preflightVerdict, runPrintChecks, type ImageFacts } from "@/lib/studio/preflight";
import { TEXT_PRESETS, clampFx, isFlatText } from "@/lib/studio/textfx";
import { MAX_LAYERS, STUDIO_FONTS } from "@/lib/studio/validate";

type CatalogCard = {
  id: string;
  name: string;
  type: string;
  imageUrl?: string;
  construction?: "placement" | "aop";
};

const starter: DesignLayer = {
  id: "tagline",
  type: "text",
  text: "STREET ROYALTY",
  font: "Archivo Black",
  color: "#d6ff3c",
  x: 0.5,
  y: 0.46,
  scale: 1,
  rotation: -8,
};

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : "That did not land.";
}

function setPieces(garment: GarmentDesign, productName?: string) {
  const partnerId = setPartner(garment.templateId);
  const pieces = [{ name: productName ?? "This piece", garment }];
  if (!partnerId) return pieces;
  pieces.push({
    name: getTemplate(partnerId)?.shortName ?? "The match",
    garment: withSharedColorways(
      defaultGarment(partnerId),
      garment.colorways,
      garment.activeColorwayId,
    ),
  });
  return pieces;
}

export function Editor({ designId }: { designId: string }) {
  const navigate = useNavigate();
  const ai = useAiPrompt();
  const areaRef = useRef<HTMLDivElement>(null);
  const [catalog, setCatalog] = useState<CatalogCard[]>([]);
  const [product, setProduct] = useState<CatalogProduct | null>(null);
  const [variantId, setVariantId] = useState("");
  const [placement, setPlacement] = useState("front");
  const [layers, setLayers] = useState<DesignLayer[]>([starter]);
  const [garment, setGarment] = useState<GarmentDesign | null>(null);
  const [showSet, setShowSet] = useState(false);
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
  const flight = useRef(createSingleFlight());
  // The untouched picture behind each image layer, so a print effect can always start over.
  const originals = useRef(new Map<string, string>());

  useEffect(() => {
    for (const layer of layers) {
      if (layer.type === "image" && !originals.current.has(layer.id)) {
        originals.current.set(layer.id, layer.src);
      }
    }
  }, [layers]);

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
          {
            id: `art-${Date.now()}`,
            type: "image",
            src: art,
            x: 0.5,
            y: 0.42,
            scale: 0.9,
            rotation: 0,
          },
        ];
      });
    } else {
      void myDesign({ data: { designId } })
        .then(async (design) => {
          setSavedId(design.id);
          setTitle(design.title);
          setLayers(design.layers);
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
  const colors = product
    ? [...new Map(product.variants.map((item) => [item.color, item])).values()]
    : [];
  const sizes = product?.variants.filter((item) => item.color === variant?.color) ?? [];
  const area: PrintArea = useMemo(
    () =>
      variant?.printAreas.find((item) => item.placement === placement) ??
      variant?.printAreas[0] ?? { placement, widthIn: 12, heightIn: 16, dpi: 150 },
    [placement, variant],
  );
  const active = layers.find((layer) => layer.id === selected) ?? null;
  const atLayerLimit = layers.length >= MAX_LAYERS;

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!active) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) {
        return;
      }
      const step = event.shiftKey ? 0.04 : 0.015;
      const move =
        event.key === "ArrowLeft"
          ? { x: Math.max(0.08, active.x - step) }
          : event.key === "ArrowRight"
            ? { x: Math.min(0.92, active.x + step) }
            : event.key === "ArrowUp"
              ? { y: Math.max(0.08, active.y - step) }
              : event.key === "ArrowDown"
                ? { y: Math.min(0.92, active.y + step) }
                : null;
      if (!move) return;
      event.preventDefault();
      patchLayer(active.id, move);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

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
  }, [
    garment,
    layers,
    mockupUrl,
    placement,
    product?.aopTemplateId,
    product?.construction,
    product?.id,
    variantId,
  ]);

  function patchLayer(id: string, patch: Partial<DesignLayer>) {
    setLayers((current) =>
      current.map((layer) => (layer.id === id ? ({ ...layer, ...patch } as DesignLayer) : layer)),
    );
  }

  function onPointerDown(event: React.PointerEvent, id: string) {
    const bounds = areaRef.current?.getBoundingClientRect();
    if (!bounds) return;
    setSelected(id);
    event.currentTarget.setPointerCapture(event.pointerId);
    const move = (ev: PointerEvent) => {
      const x = Math.min(0.92, Math.max(0.08, (ev.clientX - bounds.left) / bounds.width));
      const y = Math.min(0.92, Math.max(0.08, (ev.clientY - bounds.top) / bounds.height));
      patchLayer(id, { x, y });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  async function onUpload(file: File | undefined) {
    if (!file) return;
    if (layers.length >= MAX_LAYERS) {
      setNote("Eight layers is the limit.");
      return;
    }
    try {
      const raw = await readFileAsDataUrl(file);
      // A PNG, WebP or GIF can carry a transparent backdrop. Keeping it as a PNG keeps that; a JPEG would fill it in.
      const keepsAlpha = /^image\/(png|webp|gif)$/.test(file.type);
      const src = keepsAlpha ? fitPng(await loadPixels(raw, 1000)) : await compressDataUrl(raw, 1200, 0.85);
      addArt(src, src);
    } catch (error) {
      setNote(errorText(error));
    }
  }

  function addArt(src: string, original: string) {
    if (layers.length >= MAX_LAYERS) {
      setNote("Eight layers is the limit.");
      return;
    }
    const id = `img-${Date.now()}`;
    originals.current.set(id, original);
    setLayers((current) => {
      if (current.length >= MAX_LAYERS) return current;
      return [...current, { id, type: "image" as const, src, x: 0.5, y: 0.42, scale: 0.85, rotation: 0 }];
    });
    setSelected(id);
  }

  async function exportPrint() {
    return renderPrintFile(area, layers);
  }

  async function onMockup() {
    if (!product || !variant) return;
    await flight.current(async () => {
    setBusy(true);
    setNote("Printing the mockup.");
    try {
      const printFile = await exportPrint();
      const result = await makeMockup({
        data: {
          productId: product.id,
          variantId: variant.id,
          placement,
          layers,
          printFile,
          garment: aop ? garment : undefined,
        },
      });
      const key = designVisualKey({
        productId: product.id,
        variantId: variant.id,
        placement,
        layers,
        garment: aop ? garment : null,
      });
      mockupStamp.current = key;
      setMockupUrl(result.mockupUrl);
      setNote("Mockup is up.");
    } catch (error) {
      setNote(errorText(error));
    } finally {
      setBusy(false);
    }
    });
  }

  async function onSave() {
    if (!product || !variant) return;
    await flight.current(async () => {
    setBusy(true);
    try {
      const printFile = await exportPrint();
      const saved = await savePiece({
        data: {
          id: savedId || undefined,
          title,
          collectionId: collectionId || null,
          productId: product.id,
          variantId: variant.id,
          placement,
          layers,
          printFile,
          mockupUrl: mockupUrl || null,
          garment: aop ? garment : undefined,
        },
      });
      setSavedId(saved.id);
      setNote(saved.warnings?.length ? saved.warnings.join(" ") : "Saved to your rack.");
      return saved.id;
    } catch (error) {
      setNote(errorText(error));
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
      const printFile = await exportPrint();
      const key = designVisualKey({
        productId: product.id,
        variantId: variant.id,
        placement,
        layers,
        garment: aop ? garment : null,
      });
      let url = mockupStamp.current === key ? mockupUrl : "";
      if (!url) {
        const result = await makeMockup({
          data: {
            productId: product.id,
            variantId: variant.id,
            placement,
            layers,
            printFile,
            garment: aop ? garment : undefined,
          },
        });
        url = result.mockupUrl;
        mockupStamp.current = key;
        setMockupUrl(url);
      }
      const saved = await savePiece({
        data: {
          id: savedId || undefined,
          title,
          collectionId: collectionId || null,
          productId: product.id,
          variantId: variant.id,
          placement,
          layers,
          printFile,
          mockupUrl: url,
          garment: aop ? garment : undefined,
        },
      });
      setSavedId(saved.id);
      await publishPiece({ data: { designId: saved.id } });
      setNote("On the shop rack.");
      void navigate({ to: "/rack" });
    } catch (error) {
      setNote(errorText(error));
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
          const printFile = await exportPrint();
          const saved = await savePiece({
            data: {
              title,
              collectionId: collectionId || null,
              productId: product.id,
              variantId: variant.id,
              placement,
              layers,
              printFile,
              mockupUrl: mockupUrl || null,
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
        setNote(errorText(error));
      } finally {
        setBusy(false);
      }
    });
  }

  const aop = product?.construction === "aop" && Boolean(product.aopTemplateId);
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
  const ink = variant && luminance(variant.colorHex) > 0.62 ? "#141018" : "#f6f1ff";

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

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-[16rem_minmax(0,1fr)_20rem]">
      <Panel title="Blanks">
        <div className="flex w-full min-w-0 gap-3 overflow-x-auto lg:flex-col lg:overflow-visible">
          {catalog.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() =>
                void chooseProduct(item.id).catch((error) => setNote(errorText(error)))
              }
              className={`studio-card min-w-40 shrink-0 border-2 p-2 text-left ${product?.id === item.id ? "border-accent" : "border-line"}`}
            >
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="mb-2 aspect-square w-full object-cover"
                />
              ) : null}
              <span className="block font-display text-xs uppercase">{item.type}</span>
              <span className="block text-sm">{item.name}</span>
              {item.construction === "aop" ? (
                <span className="block text-xs text-muted">All-over print</span>
              ) : null}
            </button>
          ))}
        </div>
      </Panel>

      <div className="flex flex-col gap-4">
        <Panel title={product ? product.name : "Loading the rack"}>
          {aop && garment ? (
            <AopStage
              garment={garment}
              label={layers.find((layer) => layer.type === "text")?.text}
              onChange={setGarment}
              onPreviewSet={() => setShowSet(true)}
            />
          ) : (
          <div className="mx-auto w-full max-w-md">
            <div
              className="relative mx-auto aspect-[4/5] w-full border-2 border-ink"
              style={{ background: variant?.colorHex ?? "#141414", color: ink }}
            >
              <GarmentHint type={product?.type ?? "T-Shirt"} />
              <div
                ref={areaRef}
                className="absolute inset-[18%_22%_16%_22%] overflow-hidden border border-dashed border-current"
              >
                {layers.map((layer) => (
                  <button
                    key={layer.id}
                    type="button"
                    aria-label={layer.type === "text" ? layer.text : "Artwork"}
                    onPointerDown={(event) => onPointerDown(event, layer.id)}
                    className={`absolute max-w-[90%] cursor-grab touch-none ${selected === layer.id ? "outline-2 outline-offset-2 outline-cyan" : ""}`}
                    style={{
                      left: `${layer.x * 100}%`,
                      top: `${layer.y * 100}%`,
                      transform: `translate(-50%, -50%) rotate(${layer.rotation}deg) scale(${layer.scale})`,
                      color: layer.type === "text" ? layer.color : undefined,
                      fontFamily: layer.type === "text" ? layer.font : undefined,
                    }}
                  >
                    {layer.type === "text" ? (
                      isFlatText(clampFx({ arc: layer.arc, outline: layer.outline, tracking: layer.tracking })) ? (
                        <span className="block max-w-full text-center font-display text-sm leading-tight">
                          {layer.text}
                        </span>
                      ) : (
                        <CurvedText
                          text={layer.text}
                          fx={clampFx({ arc: layer.arc, outline: layer.outline, tracking: layer.tracking })}
                          color={layer.color}
                          fontFamily={layer.font}
                        />
                      )
                    ) : (
                      <img src={layer.src} alt="" className="h-24 w-24 object-contain" />
                    )}
                  </button>
                ))}
              </div>
            </div>
            <p className="mt-2 text-center text-sm text-muted">
              Print area {area.widthIn}" × {area.heightIn}". Drag a layer, or use the arrow keys. It stays inside the
              dashed box.
            </p>
          </div>
          )}
          {note ? (
            <div className="mt-3">
              <Note>{note}</Note>
            </div>
          ) : null}
        </Panel>
        {mockupUrl ? (
          <Panel title="Mockup">
            <img
              src={mockupUrl}
              alt="Product mockup"
              className="mx-auto max-h-[28rem] w-full object-contain"
            />
          </Panel>
        ) : null}
        <Panel title="On a person">
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
        </Panel>
        {showSet && garment ? (
          <Panel title="The set">
            <SetBoard
              title={`${title} set`}
              colorways={garment.colorways}
              activeColorwayId={garment.activeColorwayId}
              onPick={(id) => setGarment({ ...garment, activeColorwayId: id })}
              pieces={setPieces(garment, product?.name)}
            />
          </Panel>
        ) : null}
      </div>

      <div className="flex flex-col gap-4">
        <Panel title="Piece">
          <label className="mb-2 block text-sm text-muted" htmlFor="piece-title">
            Name
          </label>
          <Input
            id="piece-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
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
          <p className="mt-4 text-sm text-muted">Color</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {colors.map((item) => (
              <button
                key={item.color}
                type="button"
                aria-label={item.color}
                aria-pressed={variant?.color === item.color}
                onClick={() => {
                  const match =
                    product?.variants.find(
                      (entry) => entry.color === item.color && entry.size === variant?.size,
                    ) ?? item;
                  setVariantId(match.id);
                }}
                className="size-11 border-2 border-ink"
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
            {variant?.retailCents != null ? formatMoney(variant.retailCents) : "—"}
          </p>
          <p className="text-sm text-muted">
            {variant?.wholesaleCents != null
              ? `Print cost ${formatMoney(variant.wholesaleCents)}`
              : "Price lands with the catalog."}
          </p>
        </Panel>

        <Panel title="Layers">
          <div className="mb-3 flex flex-wrap gap-2">
            <Button
              variant="ghost"
              disabled={atLayerLimit}
              onClick={() => {
                if (layers.length >= MAX_LAYERS) return;
                const id = `text-${Date.now()}`;
                setLayers((current) => {
                  if (current.length >= MAX_LAYERS) return current;
                  return [
                    ...current,
                    {
                      id,
                      type: "text",
                      text: "NEW",
                      font: "Archivo Black",
                      color: "#ff2d95",
                      x: 0.5,
                      y: 0.62,
                      scale: 0.8,
                      rotation: 4,
                    },
                  ];
                });
                setSelected(id);
              }}
            >
              Add text
            </Button>
            <label
              className={`chip ${atLayerLimit ? "pointer-events-none opacity-50" : "cursor-pointer"}`}
            >
              Upload art
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={atLayerLimit}
                onChange={(event) => {
                  void onUpload(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </label>
          </div>
          <div className="mb-3">
            <ArtMaker full={atLayerLimit} onArt={addArt} onNote={setNote} />
          </div>
          <ul className="flex flex-col gap-2">
            {layers.map((layer) => (
              <li key={layer.id}>
                <button
                  type="button"
                  onClick={() => setSelected(layer.id)}
                  aria-pressed={selected === layer.id}
                  className={`chip w-full justify-start ${selected === layer.id ? "chip-on" : ""}`}
                >
                  {layer.type === "text" ? layer.text : "Artwork"}
                </button>
              </li>
            ))}
          </ul>
          {active ? (
            <div className="mt-4 flex flex-col gap-3">
              {active.type === "text" ? (
                <>
                  <Input
                    aria-label="Layer text"
                    value={active.text}
                    onChange={(event) =>
                      patchLayer(active.id, { text: event.target.value.slice(0, 80) })
                    }
                  />
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
                    {copy.writeLine}
                  </Button>
                  {ai.showSignIn ? <SignInCall /> : null}
                  {lines.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
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
                  <label className="text-sm text-muted" htmlFor="layer-font">
                    Font
                  </label>
                  <select
                    id="layer-font"
                    value={active.font}
                    onChange={(event) => patchLayer(active.id, { font: event.target.value })}
                    className="h-12 border-2 border-ink bg-cream px-3 text-fg"
                  >
                    {STUDIO_FONTS.map((font) => (
                      <option key={font} value={font}>
                        {font}
                      </option>
                    ))}
                  </select>
                  <label className="text-sm text-muted" htmlFor="layer-color">
                    Ink
                  </label>
                  <input
                    id="layer-color"
                    type="color"
                    value={active.color}
                    onChange={(event) => patchLayer(active.id, { color: event.target.value })}
                    className="h-12 w-full border-2 border-ink bg-cream"
                  />
                  <p className="text-sm text-muted">Curve</p>
                  <div className="flex flex-wrap gap-2">
                    {TEXT_PRESETS.map((preset) => (
                      <button
                        key={preset.name}
                        type="button"
                        className="chip"
                        title={preset.note}
                        onClick={() => patchLayer(active.id, preset.fx)}
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                  <label className="text-sm text-muted" htmlFor="layer-arc">
                    Arc {active.arc ?? 0}°
                  </label>
                  <input
                    id="layer-arc"
                    type="range"
                    min={-120}
                    max={120}
                    step={1}
                    value={active.arc ?? 0}
                    onChange={(event) => patchLayer(active.id, { arc: Number(event.target.value) })}
                  />
                  <label className="text-sm text-muted" htmlFor="layer-tracking">
                    Tracking
                  </label>
                  <input
                    id="layer-tracking"
                    type="range"
                    min={-0.05}
                    max={0.6}
                    step={0.01}
                    value={active.tracking ?? 0}
                    onChange={(event) => patchLayer(active.id, { tracking: Number(event.target.value) })}
                  />
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={Boolean(active.outline)}
                      onChange={(event) => patchLayer(active.id, { outline: event.target.checked })}
                    />
                    Outline only
                  </label>
                </>
              ) : (
                <ArtEffects
                  key={active.id}
                  original={originals.current.get(active.id) ?? active.src}
                  onResult={(src) => patchLayer(active.id, { src })}
                  onNote={setNote}
                />
              )}
              <label className="text-sm text-muted" htmlFor="layer-scale">
                Scale
              </label>
              <input
                id="layer-scale"
                type="range"
                min={0.2}
                max={2.4}
                step={0.05}
                value={active.scale}
                onChange={(event) => patchLayer(active.id, { scale: Number(event.target.value) })}
              />
              <label className="text-sm text-muted" htmlFor="layer-rotate">
                Rotate
              </label>
              <input
                id="layer-rotate"
                type="range"
                min={-180}
                max={180}
                step={1}
                value={active.rotation}
                onChange={(event) =>
                  patchLayer(active.id, { rotation: Number(event.target.value) })
                }
              />
              <Button
                variant="ghost"
                onClick={() => {
                  originals.current.delete(active.id);
                  setLayers((current) => current.filter((layer) => layer.id !== active.id));
                  setSelected("");
                }}
              >
                Drop layer
              </Button>
            </div>
          ) : null}
        </Panel>

        <Panel title="Print check">
          <PreflightPanel
            checks={checks}
            verdict={verdict}
            override={printOverride}
            onOverride={setPrintOverride}
            notPrintingYet={
              aop && product && !canOrderProduct(product.id) ? AOP_ORDER_CLOSED : undefined
            }
          />
        </Panel>

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
                .catch((error) => setNote(errorText(error)));
            }}
          >
            New collection
          </Button>
          <div className="grid gap-2">
            <Button disabled={busy} onClick={() => void onMockup()}>
              Mockup
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

function GarmentHint({ type }: { type: string }) {
  const name = type.toLowerCase();
  const label = name.includes("hat")
    ? "cap"
    : name.includes("jog")
      ? "joggers"
      : name.includes("tote")
        ? "tote"
        : name.includes("jacket")
          ? "jacket"
          : name.includes("long")
            ? "long sleeve"
            : name.includes("hood")
              ? "hoodie"
              : "tee";
  return (
    <span className="pointer-events-none absolute top-3 left-3 font-display text-xs tracking-widest uppercase opacity-70">
      {label}
    </span>
  );
}
