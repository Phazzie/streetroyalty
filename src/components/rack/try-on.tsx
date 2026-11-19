import { useEffect, useId, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { SignInCall } from "@/components/ai/sign-in-call";
import { usePaidAiAccess } from "@/components/ai/use-paid-ai";
import { Button } from "@/components/ui/button";
import { isUnauthorized } from "@/lib/ai/access";
import { FittingMirror, type CurtainState } from "@/components/tryon/mirror";
import { generateLook } from "@/lib/lab-api";
import { tryOnStatus } from "@/lib/tryon/api";
import { labReady, tryOnFaces } from "@/lib/tryon/faces";
import { mockupReference } from "@/lib/tryon/reference";
import {
  askSentence,
  buildTryOn,
  failKind,
  failSentence,
  pickFaces,
  type TryOnFail,
} from "@/lib/tryon/words";
import { useLab } from "@/lib/store";
import { createSingleFlight } from "@/lib/ui/single-flight";

type Step = "idle" | "asking" | "dressing" | "shown";

/**
 * The fitting room on a rack piece page. Hold the piece up to the mirror, ask
 * to try it on, wait behind the curtain, and see a generated picture of it worn:
 * on the visitor if their face is locked in the lab, otherwise on the house model.
 */
export function TryOn({
  slug,
  title,
  mockupUrl,
  productType,
  colorName,
  placement,
}: {
  slug: string;
  title: string;
  mockupUrl: string | null;
  productType: string;
  colorName: string;
  placement: string;
}) {
  const headingId = useId();
  const [step, setStep] = useState<Step>("idle");
  /** Null until the server has said whether try-on is on. */
  const [open, setOpen] = useState<boolean | null>(null);
  const [perDay, setPerDay] = useState<number | null>(null);
  /** Null until this device's lab has been read. It follows the lab's own store, so it is right whoever read the lab first. */
  const labRead = useLab((state) => state.ready);
  const labRefs = useLab((state) => state.refs);
  const hasFace = labRead ? pickFaces(labRefs).length > 0 : null;
  /** Undefined while the reference is being drawn, null when the mockup cannot be read. */
  const [reference, setReference] = useState<string | null | undefined>(undefined);
  const [image, setImage] = useState("");
  const [yours, setYours] = useState(false);
  const [exact, setExact] = useState(true);
  const [fail, setFail] = useState<TryOnFail | null>(null);
  const flight = useRef(createSingleFlight());
  const { signedOut } = usePaidAiAccess();
  const [forcedSignIn, setForcedSignIn] = useState(false);
  const showSignIn = signedOut || forcedSignIn;
  /** Counts fittings, so a picture that lands after the visitor moved to another piece is dropped. */
  const fitting = useRef(0);
  const askRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    void tryOnStatus()
      .then((status) => {
        if (!live) return;
        setOpen(status.on !== false);
        setPerDay(typeof status.perDay === "number" ? status.perDay : null);
      })
      // If the check itself fails the paid call still answers for itself, so the room stays open.
      .catch(() => live && setOpen(true));
    void labReady();
    return () => {
      live = false;
    };
  }, []);

  // A different piece is a different fitting: clear the last picture and draw a new reference.
  useEffect(() => {
    let live = true;
    fitting.current += 1;
    setStep("idle");
    setImage("");
    setFail(null);
    setReference(undefined);
    void mockupReference(mockupUrl).then((next) => live && setReference(next));
    return () => {
      live = false;
    };
  }, [slug, mockupUrl]);

  function ask() {
    setFail(null);
    setStep("asking");
  }

  useEffect(() => {
    if (step === "asking") askRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [step]);

  function wear() {
    if (showSignIn) return;
    void flight.current(async () => {
      const mine = fitting.current;
      const moved = () => mine !== fitting.current;
      setStep("dressing");
      setFail(null);
      try {
        const [who, clothing] = await Promise.all([
          tryOnFaces(),
          reference === undefined ? mockupReference(mockupUrl) : Promise.resolve(reference),
        ]);
        const request = buildTryOn({
          piece: { productType, colorName, placement },
          faces: who.images,
          reference: clothing,
        });
        if (!request) {
          setFail("missed");
          setStep("idle");
          return;
        }
        // Moved on to another piece while the pictures were being read: spend nothing.
        if (moved()) return;
        const result = await generateLook({ data: request });
        if (moved()) return;
        if (!result.ok) {
          const kind = failKind(result.kind);
          if (kind === "off") setOpen(false);
          setFail(kind);
          setStep("idle");
          return;
        }
        setImage(result.image);
        setYours(who.yours);
        setExact(request.clothingImages.length > 0);
        setStep("shown");
      } catch (reason) {
        if (moved()) return;
        if (isUnauthorized(reason)) {
          setForcedSignIn(true);
          setStep("idle");
          return;
        }
        setFail("offline");
        setStep("idle");
      }
    });
  }

  const closed = open === false;
  const spent = fail === "limit";
  const curtain: CurtainState = closed
    ? "shut"
    : step === "dressing"
      ? "changing"
      : step === "shown"
        ? "wide"
        : "parted";
  const who = hasFace ? "you" : "the house model";
  const note =
    fail && !closed
      ? failSentence(fail)
      : step === "dressing"
        ? "Changing behind the curtain."
        : step === "shown"
          ? "The picture is in the mirror."
          : "";

  return (
    <section aria-labelledby={headingId} className="border-t-2 border-line pt-8">
      <div className="grid gap-6 sm:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] sm:items-center md:gap-10">
        <FittingMirror
          curtain={curtain}
          mockupUrl={mockupUrl}
          title={title}
          result={step === "shown" ? image : ""}
          resultAlt={`${title}, worn by ${yours ? "you" : "the house model"}. A generated picture.`}
        />

        <div className="flex min-w-0 flex-col items-start gap-4">
          <p className="tag">The fitting room</p>
          <h2 id={headingId} className="font-display text-4xl leading-none sm:text-5xl">
            See it on you
          </h2>

          {showSignIn && !closed ? (
            <SignInCall>
              Sign in to see this piece on you. It uses the studio's daily allowance.
            </SignInCall>
          ) : closed ? (
            <>
              <p className="max-w-prose text-fg">{failSentence("off")}</p>
              <p className="max-w-prose text-sm text-muted">
                The picture of the piece shows the real placement.
              </p>
            </>
          ) : step === "shown" ? (
            <>
              <p className="max-w-prose text-fg">
                {yours
                  ? "That is you in it."
                  : "That is the house model. Lock your face in the lab to see it on you."}
              </p>
              <p className="max-w-prose text-sm text-muted">
                A generated picture. Not a photo and not a print proof.{" "}
                {exact
                  ? "The picture of the piece shows the real placement."
                  : "The print could not be read, so this shows the cut and colour only."}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" onClick={ask}>
                  Try it again
                </Button>
                <a
                  className="chip min-h-12"
                  href={image}
                  download={`street-royalty-${slug}-try-on.jpg`}
                >
                  Save picture
                </a>
                {yours ? null : (
                  <Link to="/lab" className="chip min-h-12">
                    Lock your face
                  </Link>
                )}
              </div>
            </>
          ) : step === "asking" ? (
            <div
              ref={askRef}
              className="flex w-full max-w-prose flex-col gap-3 border-2 border-ink bg-surface p-4"
            >
              <p className="text-fg">{askSentence(perDay, reference !== null)}</p>
              <div className="flex flex-wrap gap-3">
                <Button onClick={wear}>Yes, make it</Button>
                <Button variant="ghost" onClick={() => setStep("idle")}>
                  Not now
                </Button>
              </div>
            </div>
          ) : (
            <>
              {spent ? null : (
                <p className="max-w-prose text-fg">
                  {hasFace === null
                    ? "Hold the piece up to the mirror, then try it on."
                    : hasFace
                      ? "Your face is locked in the lab, so the mirror shows you."
                      : "No face is locked yet, so the mirror shows the house model."}
                </p>
              )}
              {spent ? null : (
                <div className="flex flex-wrap gap-3">
                  <Button disabled={open === null || step === "dressing"} onClick={ask}>
                    {step === "dressing"
                      ? "Changing"
                      : hasFace === false
                        ? "See it on the house model"
                        : "See it on you"}
                  </Button>
                  {hasFace === false && step !== "dressing" ? (
                    <Link to="/lab" className="chip min-h-12">
                      Lock your face in the lab
                    </Link>
                  ) : null}
                </div>
              )}
              {spent ? null : (
                <p className="max-w-prose text-sm text-muted">
                  {step === "dressing"
                    ? `Putting it on ${who} behind the curtain. Give it a moment.`
                    : "It makes one generated picture, and it asks before it spends."}
                </p>
              )}
            </>
          )}

          <p
            role="status"
            aria-live="polite"
            className={
              fail && !closed
                ? "max-w-prose border-2 border-ink bg-surface p-3 text-sm text-fg"
                : "sr-only"
            }
          >
            {note}
          </p>
        </div>
      </div>
    </section>
  );
}
