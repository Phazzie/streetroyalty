import { useRef, useState } from "react";
import { SignInCall } from "@/components/ai/sign-in-call";
import { useAiPrompt } from "@/components/ai/use-paid-ai";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { generateArt } from "@/lib/ai/art";
import { copy } from "@/lib/copy";
import { ART_STYLES, type ArtStyleId } from "@/lib/ai/art-styles";
import { fitPng, garmentPreview, loadPixels, urlToDataUrl } from "@/lib/gfx/canvas";
import {
  halftone,
  hexToRgb,
  inkLightMarks,
  knockout,
  oneColor,
  type Pixels,
} from "@/lib/gfx/effects";
import { generateLook } from "@/lib/lab-api";
import { hydrate, useLab } from "@/lib/store";
import type { GarmentDesign } from "@/lib/studio/garments";
import { allOverSheet } from "@/lib/tryon/flat";
import { allOverWords, placementWords } from "@/lib/tryon/garment";
import { mockupReference } from "@/lib/tryon/reference";
import { createSingleFlight } from "@/lib/ui/single-flight";

function failText(kind: string): string {
  if (kind === "limit") return "The studio hit today's art limit. It opens again tomorrow.";
  if (kind === "unavailable") return "Art needs the AI key. Upload a picture instead.";
  return "That one did not land. Try different words.";
}

/** Types an idea, gets print art back with the backdrop already cut out. */
export function ArtMaker({
  full,
  onArt,
  onNote,
}: {
  full: boolean;
  onArt: (src: string, original: string) => void;
  onNote: (text: string) => void;
}) {
  const [idea, setIdea] = useState("");
  const [style, setStyle] = useState<ArtStyleId>("ink");
  const [busy, setBusy] = useState(false);
  const flight = useRef(createSingleFlight());
  const ai = useAiPrompt();

  function make() {
    if (ai.blocked) return;
    const words = idea.trim();
    if (!words) {
      onNote("Say what the art is first. A panther in a crown, a rose on fire.");
      return;
    }
    void flight.current(async () => {
      setBusy(true);
      onNote("Drawing it. This takes a few seconds.");
      try {
        const result = await generateArt({ data: { idea: words, style } });
        if (!result.ok) {
          onNote(failText(result.kind));
          return;
        }
        const pixels = await loadPixels(result.image, 1600);
        const cut = fitPng(knockout(pixels));
        onArt(cut, cut);
        onNote(
          "Art is on the piece with the white cut away. Pick an ink below to make it one colour.",
        );
      } catch (reason: unknown) {
        if (ai.refused(reason)) {
          onNote(copy.signInToDraw);
          return;
        }
        onNote(reason instanceof Error ? reason.message : "That one did not land.");
      } finally {
        setBusy(false);
      }
    });
  }

  return (
    <form
      className="flex flex-col gap-2 border-2 border-line p-3"
      onSubmit={(event) => {
        event.preventDefault();
        make();
      }}
    >
      <label className="font-display text-xs tracking-wide uppercase" htmlFor="art-idea">
        Make art
      </label>
      <Input
        id="art-idea"
        value={idea}
        maxLength={240}
        onChange={(event) => setIdea(event.target.value)}
        placeholder="A panther wearing a crown"
      />
      <div className="flex flex-wrap gap-2" role="group" aria-label="Art style">
        {ART_STYLES.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={style === item.id}
            onClick={() => setStyle(item.id)}
            className={`chip ${style === item.id ? "chip-on" : ""}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      {ai.showSignIn ? <SignInCall /> : null}
      <Button type="submit" disabled={busy || full || ai.blocked}>
        {busy ? "Drawing" : "Make it"}
      </Button>
      {full ? (
        <p className="text-sm text-muted">Eight layers is the limit. Drop one first.</p>
      ) : null}
    </form>
  );
}

const INKS = [
  { name: "Lime", hex: "#d6ff3c" },
  { name: "Pink", hex: "#ff2d95" },
  { name: "Cream", hex: "#f6f1ff" },
  { name: "Night", hex: "#141018" },
  { name: "Lilac", hex: "#b9a3ee" },
  { name: "Mint", hex: "#a5dccb" },
] as const;

type Effect = "cut" | "ink" | "dots";

/** Print treatments for one picture layer. Every button starts again from the untouched picture. */
export function ArtEffects({
  original,
  onResult,
  onNote,
}: {
  original: string;
  onResult: (src: string) => void;
  onNote: (text: string) => void;
}) {
  const [ink, setInk] = useState<string>(INKS[0].hex);
  const [last, setLast] = useState<Effect | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(effect: Effect, hex = ink) {
    setBusy(true);
    try {
      const pixels = await loadPixels(original, 1800);
      const cut: Pixels = knockout(pixels);
      let out = cut;
      if (effect !== "cut") {
        const invert = inkLightMarks(pixels);
        out =
          effect === "ink"
            ? oneColor(cut, hexToRgb(hex), { invert })
            : halftone(cut, hexToRgb(hex), { invert });
      }
      onResult(fitPng(out));
      setLast(effect);
      onNote(
        effect === "cut"
          ? "Backdrop cut away."
          : effect === "ink"
            ? "One ink. Dark parts print, light parts are bare cloth."
            : "Halftone. The picture is rebuilt from dots of one ink.",
      );
    } catch (reason: unknown) {
      onNote(reason instanceof Error ? reason.message : "That picture could not be changed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 border-2 border-line p-3">
      <p className="font-display text-xs tracking-wide uppercase">Print it as</p>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="ghost" disabled={busy} onClick={() => void run("cut")}>
          Cut out
        </Button>
        <Button variant="ghost" disabled={busy} onClick={() => void run("ink")}>
          One ink
        </Button>
        <Button variant="ghost" disabled={busy} onClick={() => void run("dots")}>
          Halftone
        </Button>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => {
            onResult(original);
            setLast(null);
            onNote("Back to the picture as it came in.");
          }}
        >
          Original
        </Button>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Ink colour">
        {INKS.map((item) => (
          <button
            key={item.hex}
            type="button"
            aria-label={`${item.name} ink`}
            aria-pressed={ink === item.hex}
            disabled={busy}
            onClick={() => {
              setInk(item.hex);
              if (last === "ink" || last === "dots") void run(last, item.hex);
            }}
            className={`h-11 w-11 rounded-full border-2 p-0.5 ${ink === item.hex ? "border-accent" : "border-line"}`}
          >
            <span
              className="block h-full w-full rounded-full"
              style={{ backgroundColor: item.hex }}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

const HOUSE_MODEL = ["/model/lilac.jpg", "/wild/side-lilac.jpg"];

async function faces(): Promise<{ images: string[]; yours: boolean }> {
  await hydrate();
  const refs = useLab.getState().refs;
  const locked = ["front", "side", "threequarter"]
    .map((slot) => refs.find((ref) => ref.id === slot)?.dataUrl)
    .filter((url): url is string => Boolean(url));
  if (locked.length > 0) return { images: locked.slice(0, 2), yours: true };
  return { images: await Promise.all(HOUSE_MODEL.map((url) => urlToDataUrl(url))), yours: false };
}

/**
 * The picture and the words the picture maker gets for a piece. A placement piece is its print
 * on the blank's colour; an all-over piece is the whole garment, front and back, in its colourway.
 * Null when the all-over picture could not be drawn, so nothing is spent on a wrong one.
 */
async function clothing(input: {
  print: string;
  colorHex: string;
  colorName: string;
  productType: string;
  productName?: string;
  placement: string;
  garment?: GarmentDesign | null;
}): Promise<{ reference: string; spoken: string } | null> {
  if (input.garment) {
    const reference = await mockupReference(allOverSheet(input.garment, input.print));
    if (!reference) return null;
    return { reference, spoken: allOverWords({ ...input, garment: input.garment }) };
  }
  return {
    reference: await garmentPreview(input.print, input.colorHex),
    spoken: placementWords(input),
  };
}

/** Shows the design worn: on the visitor's own locked face if the lab has one, otherwise on the house model. */
export function WornPreview({
  ready,
  exportPrint,
  colorHex,
  colorName,
  productType,
  productName,
  placement,
  garment,
  onNote,
}: {
  ready: boolean;
  exportPrint: () => Promise<string>;
  colorHex: string;
  colorName: string;
  productType: string;
  productName?: string;
  placement: string;
  /** The all-over garment, when the piece is one. The picture maker then sees all of it. */
  garment?: GarmentDesign | null;
  onNote: (text: string) => void;
}) {
  const [image, setImage] = useState("");
  const [yours, setYours] = useState(false);
  const [busy, setBusy] = useState(false);
  const flight = useRef(createSingleFlight());
  const ai = useAiPrompt();

  function wear() {
    if (ai.blocked) return;
    void flight.current(async () => {
      setBusy(true);
      onNote("Putting it on the model. Give it a moment.");
      try {
        const [print, who] = await Promise.all([exportPrint(), faces()]);
        const piece = await clothing({
          print,
          colorHex,
          colorName,
          productType,
          productName,
          placement,
          garment,
        });
        if (!piece) {
          onNote("The whole garment could not be drawn for the model. Nothing was spent.");
          return;
        }
        const result = await generateLook({
          data: {
            mode: "look",
            spoken: piece.spoken,
            characterImages: who.images,
            clothingImages: [piece.reference],
          },
        });
        if (!result.ok) {
          onNote(failText(result.kind));
          return;
        }
        setImage(result.image);
        setYours(who.yours);
        onNote(
          who.yours
            ? "That is you in it."
            : "That is the house model. Lock your face in the lab to see it on you.",
        );
      } catch (reason: unknown) {
        if (ai.refused(reason)) {
          onNote(copy.signInToDraw);
          return;
        }
        onNote(reason instanceof Error ? reason.message : "That one did not land.");
      } finally {
        setBusy(false);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {image ? (
        <>
          <img
            src={image}
            alt={yours ? "Your design, worn by you" : "Your design, worn by the house model"}
            className="mx-auto max-h-[32rem] w-full object-contain"
          />
          <p className="text-sm text-muted">
            A generated picture, not a print proof. The mockup shows the real placement.
          </p>
        </>
      ) : (
        <p className="text-sm text-muted">
          See the piece on a person before you print it. If your face is locked in the lab, it is
          you.
        </p>
      )}
      {ai.showSignIn ? (
        <SignInCall>Sign in to see this piece worn. It uses the studio's daily allowance.</SignInCall>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button variant={image ? "ghost" : "primary"} disabled={busy || !ready || ai.blocked} onClick={wear}>
          {busy ? "Dressing" : image ? "Try again" : "See it worn"}
        </Button>
        {image ? (
          <a className="chip" href={image} download="street-royalty-worn.jpg">
            Save picture
          </a>
        ) : null}
      </div>
    </div>
  );
}
