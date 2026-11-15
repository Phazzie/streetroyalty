import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { BoardScreen } from "@/components/lab/board-screen";
import { Splash } from "@/components/lab/chrome";
import { HubScreen } from "@/components/lab/hub-screen";
import { LockScreen } from "@/components/lab/lock-screen";
import { LookScreen } from "@/components/lab/look-screen";
import { RunwayScreen } from "@/components/lab/runway-screen";
import { copy } from "@/lib/copy";
import { hydrate, useLab, wearShopPiece } from "@/lib/store";
import { urlToDataUrl } from "@/lib/gfx/canvas";
import { getProductPhoto } from "@/lib/storefront/api";
import { REQUIRED_SLOTS } from "@/lib/types";

export function LabApp({ wear }: { wear?: string }) {
  const ready = useLab((state) => state.ready);
  const view = useLab((state) => state.view);
  const refs = useLab((state) => state.refs);
  const locked = REQUIRED_SLOTS.every((slot) => refs.some((ref) => ref.id === slot));
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const worn = useRef("");
  const here = useRef(true);

  useEffect(() => {
    here.current = true;
    return () => {
      here.current = false;
    };
  }, []);

  useEffect(() => {
    void hydrate();
  }, []);

  useEffect(() => {
    if (sessionStorage.getItem("sr-open") === "1") setOpen(true);
  }, []);

  // A piece sent over from the shop goes on the board once the face is locked.
  useEffect(() => {
    if (!wear || !ready || !locked || worn.current === wear) return;
    worn.current = wear;
    sessionStorage.setItem("sr-open", "1");
    setOpen(true);
    void getProductPhoto({ data: { slug: wear } })
      .then(async (photo) => {
        const image = photo?.image ?? (photo?.path ? await urlToDataUrl(photo.path) : "");
        if (photo && image) await wearShopPiece({ slug: wear, name: photo.name, kind: photo.kind, image });
        else useLab.getState().setStatus("That piece did not come over from the shop.");
      })
      .catch(() => useLab.getState().setStatus("That piece did not come over from the shop."))
      .finally(() => {
        // Tidy the address only if the visitor is still in the lab.
        if (here.current) void navigate({ to: "/lab", search: {}, replace: true });
      });
  }, [wear, ready, locked, navigate]);

  useEffect(() => {
    if (wear) setOpen(true);
  }, [wear]);

  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  useEffect(() => {
    const titles: Record<string, string> = {
      lock: copy.yourFace,
      hub: copy.title,
      board: copy.board,
      look: copy.look,
      runway: copy.runway,
    };
    document.title = open ? `${titles[view] ?? copy.title} · ${copy.lab}` : copy.title;
  }, [open, view]);

  if (!ready) return <Splash />;
  if (!open) {
    return (
      <Splash
        onEnter={() => {
          sessionStorage.setItem("sr-open", "1");
          setOpen(true);
        }}
      />
    );
  }
  if (!locked || view === "lock") return <LockScreen />;
  if (view === "board") return <BoardScreen />;
  if (view === "look") return <LookScreen />;
  if (view === "runway") return <RunwayScreen />;
  return <HubScreen />;
}