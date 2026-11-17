import { urlToDataUrl } from "@/lib/gfx/canvas";
import { hydrate, useLab } from "@/lib/store";
import { pickFaces } from "./words.ts";

/** Browser only. Who the mirror shows: the visitor if the lab has their face, otherwise the house model. */

const HOUSE_MODEL = ["/model/lilac.jpg", "/wild/side-lilac.jpg"];

/**
 * Waits until the lab's saved state is really in memory. hydrate() returns at
 * once when another part of the page already started it, which can be before
 * the faces have been read, so this waits for the store to say it is ready.
 */
export async function labReady(): Promise<void> {
  await hydrate();
  if (useLab.getState().ready) return;
  await new Promise<void>((resolve) => {
    const done = () => {
      stop();
      clearTimeout(timer);
      resolve();
    };
    const stop = useLab.subscribe((state) => {
      if (state.ready) done();
    });
    // A stuck store must not leave the mirror waiting: carry on with the house model.
    const timer = setTimeout(done, 3000);
  });
}

/** The face photos locked in the lab on this device, best first. Empty when none are locked. */
export async function lockedFaces(): Promise<string[]> {
  await labReady();
  return pickFaces(useLab.getState().refs);
}

export async function tryOnFaces(): Promise<{ images: string[]; yours: boolean }> {
  const locked = await lockedFaces();
  if (locked.length > 0) return { images: locked, yours: true };
  return { images: await Promise.all(HOUSE_MODEL.map((url) => urlToDataUrl(url))), yours: false };
}
