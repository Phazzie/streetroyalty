import { useEffect, useState } from "react";
import { BoardScreen } from "@/components/lab/board-screen";
import { Splash } from "@/components/lab/chrome";
import { HubScreen } from "@/components/lab/hub-screen";
import { LockScreen } from "@/components/lab/lock-screen";
import { LookScreen } from "@/components/lab/look-screen";
import { RunwayScreen } from "@/components/lab/runway-screen";
import { copy } from "@/lib/copy";
import { hydrate, useLab } from "@/lib/store";
import { REQUIRED_SLOTS } from "@/lib/types";

export function LabApp() {
  const ready = useLab((state) => state.ready);
  const view = useLab((state) => state.view);
  const refs = useLab((state) => state.refs);
  const locked = REQUIRED_SLOTS.every((slot) => refs.some((ref) => ref.id === slot));
  const [open, setOpen] = useState(false);

  useEffect(() => {
    void hydrate();
  }, []);

  useEffect(() => {
    if (sessionStorage.getItem("sr-open") === "1") setOpen(true);
  }, []);

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