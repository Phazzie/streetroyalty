import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Note, Panel } from "@/components/studio/shell";
import { renderPrintFile } from "@/components/studio/print-file";
import { luminance } from "@/lib/color";
import { copy } from "@/lib/copy";
import { compressDataUrl, readFileAsDataUrl } from "@/lib/images";
import type { CatalogProduct, DesignLayer, PrintArea } from "@/lib/pod/types";
import {
  addCollection,
  cartAdd,
  getCatalogProduct,
  getStudioConfig,
  listCatalog,
  makeMockup,
  myCollections,
  myDesign,
  publishPiece,
  savePiece,
} from "@/lib/studio/api";
import { PriceTicker } from "@/components/moon/price-ticker";
import { PreflightPanel } from "@/components/moon/preflight-panel";
import { CurvedText } from "@/components/moon/curved-text";
import { priceTicker, type Finish } from "@/lib/moon/pricing";
import { canPublish, preflightVerdict, runPrintChecks, type ImageFacts } from "@/lib/moon/preflight";
import { colorwaysFromPalette, extractPalette, nearestColor, CURATED_COLORWAYS, type Colorway } from "@/lib/moon/colorway";
import { clampFx, TEXT_PRESETS } from "@/lib/moon/textfx";
import { RemixDice } from "@/components/moon/remix-dice";
import { dnaFrom, type Dna } from "@/lib/moon/dna";
import { suggestLines } from "@/lib/ai/api";
import { createSingleFlight } from "@/lib/ui/single-flight";
import { designVisualKey } from "@/lib/studio/design-key";
import { MAX_LAYERS, STUDIO_FONTS } from "@/lib/studio/validate";

type CatalogCard = {
  id: string;
  name: string;
  type: string;
  imageUrl?: string;
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

export function Editor({ designId }: { designId: string }) {
  const navigate = useNavigate();
  const areaRef = useRef<HTMLDivElement>(null);
  const [catalog, setCatalog] = useState<CatalogCard[]>([]);
  const [product, setProduct] = useState<CatalogProduct | null>(null);
  const [variantId, setVariantId] = useState("");
  const [placement, setPlacement] = useState("front");
  const [layers, setLayers] = useState<DesignLayer[]>([starter]);
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
  const [markup, setMarkup] = useState(2.2);
  const [finish, setFinish] = useState<Finish>("print");
  const [override, setOverride] = useState(false);
  const [artPalette, setArtPalette] = useState<string[]>([]);
  const [imageFacts, setImageFacts] = useState<ImageFacts[]>([]);

  useEffect(() => {
    void getStudioConfig()
      .then((config) => setMarkup(config.markup))
      .catch(() => setMarkup(2.2));
  }, []);

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
          setPlacement(design.placement);
          setCollectionId(design.collectionId ?? "");
          setMockupUrl("");
          await chooseProduct(design.productId, design.variantId);
          const key = designVisualKey({
            productId: design.productId,
            variantId: design.variantId,
            placement: design.placement,
            layers: design.layers,
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
  const area: PrintArea = variant?.printAreas.find((item) => item.placement === placement) ??
    variant?.printAreas[0] ?? { placement, widthIn: 12, heightIn: 16, dpi: 150 };
  const active = layers.find((layer) => layer.id === selected) ?? null;
  const atLayerLimit = layers.length >= MAX_LAYERS;

  const checks = useMemo(
    () =>
      runPrintChecks({
        layers,
        area: variant?.printAreas.find((item) => item.placement === placement) ??
          variant?.printAreas[0] ?? { placement, widthIn: 12, heightIn: 16, dpi: 150 },
        garmentHex: variant?.colorHex ?? "#141414",
        images: imageFacts,
      }),
    [layers, placement, variant, imageFacts],
  );
  const verdict = preflightVerdict(checks);
  const ticker = useMemo(
    () =>
      priceTicker({
        wholesaleCents: variant?.wholesaleCents ?? null,
        markup,
        layerCount: layers.length,
        finish,
        oversize: checks.some((check) => check.key === "bounds" && check.level === "warn"),
      }),
    [variant, markup, layers.length, finish, checks],
  );
  const artColorways = useMemo(() => colorwaysFromPalette(artPalette), [artPalette]);

  function applyColorway(way: Colorway) {
    if (!product || !variant) return;
    const target = nearestColor(way.garmentHex, product.colors.map((color) => ({ hex: color.hex, name: color.name })));
    if (target) {
      const match =
        product.variants.find((entry) => entry.color === target.name && entry.size === variant.size) ??
        product.variants.find((entry) => entry.color === target.name);
      if (match) setVariantId(match.id);
    }
    setLayers((current) =>
      current.map((layer) => (layer.type === "text" ? { ...layer, color: way.inkHex } : layer)),
    );
    setNote(`Colorway on: ${way.name}. Garment and ink moved together.`);
  }


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
    });
    if (mockupStamp.current !== key) {
      mockupStamp.current = "";
      setMockupUrl("");
    }
  }, [layers, mockupUrl, placement, product?.id, variantId]);

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
      const src = await compressDataUrl(raw, 1200, 0.85);
      const id = `img-${Date.now()}`;
      // Measure the art once: Print Check needs real pixels, the colorway
      // engine needs its palette. Both read the same loaded image.
      const probe = new Image();
      probe.onload = () => {
        setImageFacts((current) => [
          ...current.filter((facts) => facts.layerId !== id),
          { layerId: id, widthPx: probe.naturalWidth, heightPx: probe.naturalHeight },
        ]);
        try {
          const canvas = document.createElement("canvas");
          canvas.width = 48;
          canvas.height = 48;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(probe, 0, 0, 48, 48);
            setArtPalette(extractPalette(ctx.getImageData(0, 0, 48, 48).data, 5));
          }
        } catch {
          // Palette is a bonus; the design does not depend on it.
        }
      };
      probe.src = src;
      setLayers((current) => {
        if (current.length >= MAX_LAYERS) return current;
        return [...current, { id, type: "image" as const, src, x: 0.5, y: 0.42, scale: 0.85, rotation: 0 }];
      });
      setSelected(id);
    } catch (error) {
      setNote(errorText(error));
    }
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
        data: { productId: product.id, variantId: variant.id, placement, layers, printFile },
      });
      const key = designVisualKey({
        productId: product.id,
        variantId: variant.id,
        placement,
        layers,
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
    if (!canPublish(verdict, override)) {
      setNote("Print Check failed. Fix the red, or tick the override in Print Check and publish loud.");
      return;
    }
    await flight.current(async () => {
    setBusy(true);
    try {
      const printFile = await exportPrint();
      const key = designVisualKey({
        productId: product.id,
        variantId: variant.id,
        placement,
        layers,
      });
      let url = mockupStamp.current === key ? mockupUrl : "";
      if (!url) {
        const result = await makeMockup({
          data: { productId: product.id, variantId: variant.id, placement, layers, printFile },
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
        },
      });
      setSavedId(saved.id);
      await publishPiece({ data: { designId: saved.id } });
      setNote("On the shop rack.");
      void navigate({ to: "/shop" });
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

  const ink = variant && luminance(variant.colorHex) > 0.62 ? "#141018" : "#f6f1ff";

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
            </button>
          ))}
        </div>
      </Panel>

      <div className="flex flex-col gap-4">
        <Panel title={product ? product.name : "Loading the rack"}>
          <div className="mx-auto w-full max-w-md">
            <div
              className="relative mx-auto aspect-[4/5] w-full border-2 border-ink"
              style={{
                background: variant?.colorHex ?? "#141414",
                color: ink,
                filter: finish === "vintage" ? "sepia(0.35) contrast(0.92) brightness(1.06)" : undefined,
              }}
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
                      layer.arc || layer.outline || layer.tracking ? (
                        <CurvedText
                          text={layer.text}
                          fx={clampFx(layer)}
                          color={layer.color}
                          fontFamily={layer.font}
                        />
                      ) : (
                        <span className="block max-w-full text-center font-display text-sm leading-tight">
                          {layer.text}
                        </span>
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
          <div className="mt-4">
            <PriceTicker breakdown={ticker} />
          </div>
          <p className="mt-4 text-sm text-muted">Finish</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(
              [
                { id: "print", label: "Print" },
                { id: "embroidery", label: "Embroidery" },
                { id: "vintage", label: "Vintage wash" },
              ] as { id: Finish; label: string }[]
            ).map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={finish === option.id}
                onClick={() => setFinish(option.id)}
                className={`chip ${finish === option.id ? "chip-on" : ""}`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-subtle">
            Finish is a studio preview + meter estimate today; the catalog technique on the blank is
            what prints.
          </p>
        </Panel>

        <Panel title="Colorways">
          <p className="mb-2 text-sm text-muted">
            One click moves the garment and the ink together. Nothing pairs that cannot be read.
          </p>
          {artColorways.length > 0 ? (
            <>
              <p className="mb-1 font-display text-xs tracking-wide uppercase">From your art</p>
              <div className="mb-3 flex flex-wrap gap-2">
                {artColorways.map((way) => (
                  <button
                    key={way.name}
                    type="button"
                    onClick={() => applyColorway(way)}
                    className="chip"
                    title={`${way.name} — contrast ${Math.round(way.contrast * 10) / 10}:1`}
                  >
                    <span className="mr-2 inline-block size-3 border border-ink" style={{ background: way.garmentHex }} />
                    <span className="mr-1 inline-block size-3 border border-ink" style={{ background: way.inkHex }} />
                    {way.name}
                  </button>
                ))}
              </div>
            </>
          ) : null}
          <p className="mb-1 font-display text-xs tracking-wide uppercase">House palettes</p>
          <div className="flex flex-wrap gap-2">
            {CURATED_COLORWAYS.map((way) => (
              <button
                key={way.name}
                type="button"
                onClick={() => applyColorway(way)}
                className="chip"
                title={`${way.name} — contrast ${Math.round(way.contrast * 10) / 10}:1`}
              >
                <span className="mr-2 inline-block size-3 border border-ink" style={{ background: way.garmentHex }} />
                <span className="mr-1 inline-block size-3 border border-ink" style={{ background: way.inkHex }} />
                {way.name}
              </button>
            ))}
          </div>
        </Panel>

        <Panel title="Print Check">
          <PreflightPanel checks={checks} verdict={verdict} override={override} onOverride={setOverride} />
        </Panel>

        <Panel title="Remix Dice">
          <RemixDice
            base={dnaFrom({
              garment: product?.type ?? "T-Shirt",
              garmentHex: variant?.colorHex,
              inkHex: (() => {
                const text = layers.find((layer) => layer.type === "text");
                return text && text.type === "text" ? text.color : undefined;
              })(),
              placement,
              finish,
            })}
            onLoad={(dna: Dna) => {
              const way = CURATED_COLORWAYS.find((entry) => entry.name === dna.colorwayName);
              if (way) applyColorway(way);
              const preset = TEXT_PRESETS.find((entry) => entry.name === dna.textStyle);
              if (preset) {
                setLayers((current) =>
                  current.map((layer) =>
                    layer.type === "text"
                      ? { ...layer, arc: preset.fx.arc, outline: preset.fx.outline, tracking: preset.fx.tracking }
                      : layer,
                  ),
                );
              }
              if (product?.placements.some((entry) => entry.placement === dna.placement)) {
                setPlacement(dna.placement);
              }
              setFinish(dna.finish);
              setNote(`Loaded: ${dna.colorwayName} · ${dna.textStyle} · ${dna.placement} · ${dna.finish}.`);
            }}
          />
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
                    disabled={busy}
                    onClick={() => {
                      void suggestLines({ data: { seed: `${title} ${active.text}` } })
                        .then((result) => {
                          setLines(result.lines);
                          setNote(result.source === "grok" ? "Lines from the crown." : "Lines from the house, no key needed.");
                        })
                        .catch((error) => setNote(errorText(error)));
                    }}
                  >
                    {copy.writeLine}
                  </Button>
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
                  <p className="text-sm text-muted">Text power</p>
                  <div className="flex flex-wrap gap-2">
                    {TEXT_PRESETS.map((preset) => (
                      <button
                        key={preset.name}
                        type="button"
                        title={preset.note}
                        onClick={() =>
                          patchLayer(active.id, {
                            arc: preset.fx.arc,
                            outline: preset.fx.outline,
                            tracking: preset.fx.tracking,
                          })
                        }
                        className="chip"
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                  <label className="text-sm text-muted" htmlFor="layer-arc">
                    Curve {Math.round(clampFx(active).arc)}°
                  </label>
                  <input
                    id="layer-arc"
                    type="range"
                    min={-120}
                    max={120}
                    step={2}
                    value={clampFx(active).arc}
                    onChange={(event) => patchLayer(active.id, { arc: Number(event.target.value) })}
                  />
                  <label className="text-sm text-muted" htmlFor="layer-tracking">
                    Letter spacing
                  </label>
                  <input
                    id="layer-tracking"
                    type="range"
                    min={-0.05}
                    max={0.6}
                    step={0.01}
                    value={clampFx(active).tracking}
                    onChange={(event) =>
                      patchLayer(active.id, { tracking: Number(event.target.value) })
                    }
                  />
                  <button
                    type="button"
                    aria-pressed={Boolean(active.outline)}
                    onClick={() => patchLayer(active.id, { outline: !active.outline })}
                    className={`chip ${active.outline ? "chip-on" : ""}`}
                  >
                    Hollow (outline only)
                  </button>
                </>
              ) : null}
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
                  setLayers((current) => current.filter((layer) => layer.id !== active.id));
                  setSelected("");
                }}
              >
                Drop layer
              </Button>
            </div>
          ) : null}
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


function GarmentHint({ type }: { type: string }) {
  const lower = type.toLowerCase();
  const label = lower.includes("hat")
    ? "cap"
    : lower.includes("hood")
      ? "hoodie"
      : lower.includes("tote")
        ? "tote"
        : lower.includes("jogger")
          ? "joggers"
          : lower.includes("long")
            ? "long-sleeve"
            : "tee";
  return (
    <span className="pointer-events-none absolute top-3 left-3 font-display text-xs tracking-widest uppercase opacity-70">
      {label}
    </span>
  );
}
