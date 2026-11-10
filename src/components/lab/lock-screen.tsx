import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Header, Shell, Status } from "@/components/lab/chrome";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/cn";
import { compressDataUrl, frameToDataUrl, readFileAsDataUrl } from "@/lib/images";
import { useLab } from "@/lib/store";
import { REQUIRED_SLOTS, type Slot } from "@/lib/types";

const SLOT_ORDER: Slot[] = ["front", "side", "threequarter", "extra"];

export function LockScreen() {
  const refs = useLab((state) => state.refs);
  const setRef = useLab((state) => state.setRef);
  const lockIn = useLab((state) => state.lockIn);
  const status = useLab((state) => state.status);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [live, setLive] = useState(false);
  const [note, setNote] = useState("");
  const [slot, setSlot] = useState<Slot>("front");

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const ready = REQUIRED_SLOTS.every((id) => refs.some((ref) => ref.id === id));
  const got = REQUIRED_SLOTS.filter((id) => refs.some((ref) => ref.id === id)).length;
  const missing = REQUIRED_SLOTS.filter((id) => !refs.some((ref) => ref.id === id)).map((id) => copy.slots[id]);
  const active = refs.find((ref) => ref.id === slot);

  async function openCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setNote(copy.cameraBlocked);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      setLive(true);
      setNote("");
    } catch {
      setNote(copy.cameraBlocked);
    }
  }

  useEffect(() => {
    if (!live || !videoRef.current || !streamRef.current) return;
    videoRef.current.srcObject = streamRef.current;
    void videoRef.current.play().catch(() => undefined);
  }, [live]);

  async function savePhoto(dataUrl: string, target: Slot) {
    const image = await compressDataUrl(dataUrl);
    setRef({ id: target, dataUrl: image, createdAt: Date.now() });
    const next = REQUIRED_SLOTS.find(
      (id) => id !== target && !useLab.getState().refs.some((ref) => ref.id === id),
    );
    if (next) setSlot(next);
  }

  function shoot() {
    const video = videoRef.current;
    if (!video) return;
    const frame = frameToDataUrl(video, 800, 0.72, true);
    if (!frame) {
      setNote(copy.cameraWait);
      return;
    }
    setNote("");
    void savePhoto(frame, slot);
  }

  async function onFile(file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) {
      setNote(copy.notPhoto);
      return;
    }
    try {
      const raw = await readFileAsDataUrl(file);
      await savePhoto(raw, slot);
      setNote("");
    } catch {
      setNote(copy.notPhoto);
    }
  }

  return (
    <Shell>
      <Header title={copy.yourFace} />
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 *:shrink-0">
        <p>{copy.lockLead}</p>
        <div className="seam overflow-hidden bg-lilac">
          {live ? (
            <video
              ref={videoRef}
              className="aspect-4/3 max-h-56 w-full -scale-x-100 object-cover"
              playsInline
              muted
              autoPlay
              aria-label={`${copy.takePhoto}, ${copy.slots[slot]}`}
            />
          ) : active ? (
            <img src={active.dataUrl} alt="" className="aspect-4/3 max-h-56 w-full object-cover" />
          ) : (
            <div className="flex aspect-4/3 max-h-56 items-center justify-center px-4">
              <p className="text-center text-muted">{copy.slots[slot]}</p>
            </div>
          )}
        </div>
        {live ? (
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={shoot}
              aria-label={`${copy.takePhoto}, ${copy.slots[slot]}`}
              className="size-16 shrink-0 rounded-full border-4 border-fg bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ink"
            />
            <p className="font-display text-sm font-bold">
              {copy.takePhoto}: {copy.slots[slot]}
            </p>
          </div>
        ) : (
          <Button className="w-full" size="lg" onClick={() => void openCamera()}>
            {copy.openCamera}
          </Button>
        )}
        <div className="grid grid-cols-4 gap-2">
          {SLOT_ORDER.map((id) => {
            const photo = refs.find((ref) => ref.id === id);
            const label = copy.slots[id];
            return (
              <button
                key={id}
                type="button"
                onClick={() => setSlot(id)}
                aria-pressed={slot === id}
                aria-label={`${label}${id === "extra" ? `, ${copy.optional}` : ""}${photo ? ", photo added" : ", empty"}`}
                className={cn(
                  "overflow-hidden rounded-md border-2 bg-cream text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ink",
                  slot === id ? "border-pipe" : "border-line",
                )}
              >
                {photo ? (
                  <img src={photo.dataUrl} alt="" className="aspect-square w-full object-cover" />
                ) : (
                  <span className="block aspect-square bg-lilac" />
                )}
                <span className="block px-1 py-1 text-center text-xs font-bold text-ink">
                  {label}
                  {id === "extra" ? <span className="block font-medium text-muted">{copy.optional}</span> : null}
                </span>
              </button>
            );
          })}
        </div>
        <Button className="w-full" size="lg" variant="ghost" onClick={() => fileRef.current?.click()}>
          {copy.usePhoto}
        </Button>
        <input
          id="photo"
          ref={fileRef}
          type="file"
          accept="image/*"
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only"
          onChange={(event) => {
            void onFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        <Status text={note || status} />
        <p className="text-sm text-muted">{copy.stay}</p>
      </div>
      <div className="safe-bottom shrink-0 border-t border-line px-4 pt-3">
        <p className="mb-2 text-center text-sm">
          {ready ? copy.lockCount : `${got} of 3. Still need ${missing.join(", ")}.`}
        </p>
        <Button className="w-full" size="lg" disabled={!ready} onClick={lockIn}>
          {copy.usePhotos}
        </Button>
      </div>
    </Shell>
  );
}
