import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Header, Shell, Status } from "@/components/lab/chrome";
import { copy } from "@/lib/copy";
import { compressDataUrl, frameToDataUrl, readFileAsDataUrl } from "@/lib/images";
import { useLab } from "@/lib/store";
import { REQUIRED_SLOTS, SLOTS, type Slot } from "@/lib/types";
import { cn } from "@/lib/cn";

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
    const next = SLOTS.find((id) => id !== target && !useLab.getState().refs.some((ref) => ref.id === id));
    if (next) setSlot(next);
  }

  function shoot() {
    const video = videoRef.current;
    if (!video) return;
    const frame = frameToDataUrl(video);
    if (!frame) return;
    void savePhoto(frame, slot);
  }

  async function onFile(file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) {
      setNote(copy.missed);
      return;
    }
    try {
      const raw = await readFileAsDataUrl(file);
      await savePhoto(raw, slot);
      setNote("");
    } catch {
      setNote(copy.missed);
    }
  }

  return (
    <Shell>
      <Header />
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-5">
        <p className="text-base">{copy.lockLead}</p>
        <p className="text-sm text-muted">{copy.lockCount}</p>
        <div className="seam overflow-hidden bg-lilac">
          {live ? (
            <video ref={videoRef} className="aspect-square w-full object-cover" playsInline muted autoPlay />
          ) : (
            <div className="flex aspect-square flex-col items-center justify-end p-3">
              <Button className="w-full" size="lg" onClick={() => void openCamera()}>
                {copy.openCamera}
              </Button>
            </div>
          )}
        </div>
        <div className="grid grid-cols-4 gap-2">
          {SLOTS.map((id) => {
            const photo = refs.find((ref) => ref.id === id);
            return (
              <button
                key={id}
                type="button"
                onClick={() => setSlot(id)}
                className={cn(
                  "overflow-hidden rounded-md border-2 text-left",
                  slot === id ? "border-2 border-pipe" : "border-2 border-line",
                )}
              >
                {photo ? (
                  <img src={photo.dataUrl} alt={copy.slots[id]} className="aspect-square w-full object-cover" />
                ) : (
                  <span className="flex aspect-square items-end p-1.5 text-xs text-subtle">{copy.slots[id]}</span>
                )}
              </button>
            );
          })}
        </div>
        {live ? (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={shoot}
              aria-label={copy.slots[slot]}
              className="size-20 rounded-full border-4 border-fg bg-accent transition-[opacity,transform] duration-150 active:scale-[0.98]"
            />
          </div>
        ) : null}
        <Button className="w-full" size="lg" variant="ghost" onClick={() => fileRef.current?.click()}>
          {copy.usePhoto}
        </Button>
        <input
          id="photo"
          ref={fileRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(event) => {
            void onFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        <Status text={note || status} />
        <p className="text-sm text-subtle">{copy.stay}</p>
      </div>
      <div className="safe-bottom border-t border-line px-3 pt-3">
        <p className="mb-2 text-center text-sm">{got} of 3</p>
        <Button className="w-full" size="lg" disabled={!ready} onClick={lockIn}>
          {copy.lockedIn}
        </Button>
      </div>
    </Shell>
  );
}
