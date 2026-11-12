import { create } from "zustand";
import { copy } from "@/lib/copy";
import { idbGet, idbSet } from "@/lib/idb";
import { compressDataUrl } from "@/lib/images";
import { generateLook, generatePiece, pollRunway, startRunway } from "@/lib/lab-api";
import { settleRetry } from "@/lib/piece-batch";
import { interpret, isLookChange, paidPlan, type Intent } from "@/lib/split-pieces";
import { LOCK_LINE, runwayTicketOutput } from "@/lib/tickets";
import type {
  Category,
  CharacterRef,
  LastJob,
  Look,
  Piece,
  PieceDraft,
  Reaction,
  Slot,
  Ticket,
  View,
} from "@/lib/types";
import { REQUIRED_SLOTS } from "@/lib/types";
import { hush, speak } from "@/lib/voice";

type Persisted = {
  refs: CharacterRef[];
  pieces: Piece[];
  looks: Look[];
  tickets: Ticket[];
  seq: number;
  view: View;
  draft: Look | null;
  reaction: Reaction;
  lastJob: LastJob | null;
};

type LabState = Persisted & {
  ready: boolean;
  busy: boolean;
  status: string;
  setStatus: (status: string) => void;
  setView: (view: View) => void;
  setReaction: (reaction: Reaction) => void;
  setRef: (ref: CharacterRef) => void;
  togglePiece: (id: string) => void;
  dropPiece: (id: string) => void;
  lockIn: () => void;
  saveDraft: () => void;
  openSaved: (id: string) => void;
  dropLook: (id: string) => void;
  handleTranscript: (text: string) => void;
  requestLook: () => void;
  requestRunway: () => void;
  retryReaction: () => void;
};

const CATEGORY_RANK: Record<Category, number> = {
  Tops: 0,
  Bottoms: 1,
  Shoes: 2,
  Outer: 3,
  Hats: 4,
  Accessories: 5,
};

const SLOT_RANK: Slot[] = ["front", "side", "threequarter", "extra"];

let token = 0;
let hydrated = false;
let persistQueue: Promise<void> = Promise.resolve();

function snapshot(state: LabState): Persisted {
  return {
    refs: state.refs,
    pieces: state.pieces,
    looks: state.looks,
    tickets: state.tickets,
    seq: state.seq,
    view: state.view,
    draft: state.draft,
    reaction: state.reaction,
    lastJob: state.lastJob,
  };
}

function persist() {
  const data = snapshot(useLab.getState());
  persistQueue = persistQueue
    .then(() => idbSet("lab", data))
    .catch((error: unknown) => {
      const name = error instanceof DOMException ? error.name : "";
      if (name === "QuotaExceededError") useLab.setState({ status: copy.storageFull });
    });
}

function sameScreen(stage: View, next: View): View {
  return useLab.getState().view === stage ? next : useLab.getState().view;
}

function failLine(result: { ok: boolean; kind?: string } | null): string {
  return result && !result.ok && result.kind === "unavailable" ? copy.cantBuild : copy.missed;
}

async function shrink(image: string): Promise<string> {
  try {
    return await compressDataUrl(image);
  } catch {
    return image;
  }
}

function buildingLine(drafts: PieceDraft[]): string {
  if (drafts.length === 1) {
    const name = drafts[0].spoken.trim().slice(0, 80);
    return `Got it. Building ${name}.`;
  }
  return `Got it. Building ${drafts.length} pieces.`;
}

function patch(partial: Partial<LabState>, remember = true) {
  useLab.setState(partial);
  if (remember) persist();
}

function nextId(prefix: string): string {
  const seq = useLab.getState().seq + 1;
  useLab.setState({ seq });
  return `${prefix}-${String(seq).padStart(4, "0")}`;
}

function begin(): number {
  token += 1;
  useLab.setState({ busy: true });
  return token;
}

function alive(my: number): boolean {
  return my === token;
}

function finish(my: number) {
  if (alive(my)) useLab.setState({ busy: false });
}

export function stopGeneration() {
  token += 1;
  hush();
  useLab.setState({ busy: false, status: copy.stopped });
}

function faces(): string[] {
  const refs = useLab.getState().refs;
  return SLOT_RANK.map((slot) => refs.find((ref) => ref.id === slot)?.dataUrl).filter(
    (url): url is string => Boolean(url),
  );
}

function selectedPieces(): Piece[] {
  return useLab.getState()
    .pieces.filter((piece) => piece.selected)
    .sort((a, b) => CATEGORY_RANK[a.category] - CATEGORY_RANK[b.category] || a.createdAt - b.createdAt);
}

function spokenFrom(pieces: Piece[]): string {
  return pieces.map((piece) => piece.spoken).join(", ");
}

function rememberTicket(ticket: Ticket) {
  const tickets = [ticket, ...useLab.getState().tickets].slice(0, 40);
  patch({ tickets });
}

function noteStatus(status: string, line?: string) {
  useLab.setState({ status });
  if (line) speak(line);
}

async function buildPieces(drafts: PieceDraft[], transcript: string, thenWear: boolean, again: boolean) {
  const my = begin();
  const started = useLab.getState().view;
  const previous = useLab.getState().lastJob;
  const previousIds = again && previous?.kind === "pieces" ? (previous.pieceIds ?? []) : [];
  const line = buildingLine(drafts);
  noteStatus(line, line);
  patch({ lastJob: { kind: "pieces", drafts, transcript, thenWear, pieceIds: previousIds } });
  const outcomes: (string | null)[] = [];
  let missed = 0;
  for (const draft of drafts) {
    if (!alive(my)) return;
    const ticketId = nextId("GEN");
    let result: Awaited<ReturnType<typeof generatePiece>> | null = null;
    try {
      result = await generatePiece({ data: { spoken: draft.spoken, category: draft.category } });
    } catch (error) {
      console.error(error);
      result = null;
    }
    if (!alive(my)) return;
    if (!result || !result.ok) {
      missed += 1;
      outcomes.push(null);
      continue;
    }
    const image = await shrink(result.image);
    if (!alive(my)) return;
    const id = nextId("piece");
    const piece: Piece = {
      id,
      category: draft.category,
      spoken: draft.spoken,
      sourceTranscript: transcript,
      image,
      selected: true,
      ticketId,
      createdAt: Date.now(),
    };
    const pieces = [piece, ...useLab.getState().pieces].slice(0, 30);
    patch({ pieces });
    rememberTicket({
      id: ticketId,
      type: "Piece",
      category: draft.category,
      characterRefIds: [],
      pieceRefIds: [],
      spokenDescription: draft.spoken,
      prompt: result.prompt,
      consistencyLocks: LOCK_LINE,
      output: id,
      status: again ? "Regenerated" : "Generated",
      createdAt: Date.now(),
    });
    outcomes.push(id);
  }
  if (!alive(my)) return;
  const settled = settleRetry(previousIds, outcomes);
  if (settled.replaced.length) {
    patch({
      pieces: useLab.getState().pieces.filter((piece) => !settled.replaced.includes(piece.id)),
    });
  }
  patch({ lastJob: { kind: "pieces", drafts, transcript, thenWear, pieceIds: settled.nextIds } });
  if (!settled.nextIds.some(Boolean)) {
    noteStatus(copy.missed, copy.missed);
    finish(my);
    return;
  }
  if (!thenWear) {
    const done = missed ? copy.partial : copy.onBoard;
    noteStatus(done, done);
    patch({ view: sameScreen(started, "board") });
    finish(my);
    return;
  }
  await buildLook(my, again);
}

async function buildLook(my = begin(), again = false) {
  const picked = selectedPieces();
  if (picked.length === 0) {
    noteStatus(copy.pick);
    finish(my);
    return;
  }
  const spoken = spokenFrom(picked);
  noteStatus(copy.puttingOn, copy.puttingOn);
  patch({ lastJob: { kind: "look" }, view: "look" });
  const stage: View = "look";
  const ticketId = nextId("GEN");
  let result: Awaited<ReturnType<typeof generateLook>> | null = null;
  try {
    result = await generateLook({
      data: {
        mode: "look",
        spoken,
        characterImages: faces().slice(0, 2),
        clothingImages: picked.map((piece) => piece.image),
      },
    });
  } catch (error) {
    console.error(error);
    result = null;
  }
  if (!alive(my)) return;
  if (!result || !result.ok) {
    const missedLine = failLine(result);
    noteStatus(missedLine, missedLine);
    finish(my);
    return;
  }
  const image = await shrink(result.image);
  if (!alive(my)) return;
  const draft: Look = {
    id: nextId("look"),
    image,
    spoken,
    pieceIds: picked.map((piece) => piece.id),
    ticketId,
    createdAt: Date.now(),
  };
  patch({ draft, view: sameScreen(stage, "look") });
  rememberTicket({
    id: ticketId,
    type: "Full Look",
    category: "Full",
    characterRefIds: useLab.getState().refs.map((ref) => ref.id),
    pieceRefIds: draft.pieceIds,
    spokenDescription: spoken,
    prompt: result.prompt,
    consistencyLocks: LOCK_LINE,
    output: draft.id,
    status: again ? "Regenerated" : "Generated",
    createdAt: Date.now(),
  });
  noteStatus(copy.sharp, copy.sharp);
  finish(my);
}

async function tweakLook(change: string, my = begin(), again = false) {
  const current = useLab.getState().draft;
  if (!current) {
    noteStatus(copy.noLook);
    finish(my);
    return;
  }
  noteStatus(copy.puttingOn, copy.puttingOn);
  patch({ lastJob: { kind: "tweak", change } });
  const ticketId = nextId("GEN");
  let result: Awaited<ReturnType<typeof generateLook>> | null = null;
  try {
    result = await generateLook({
      data: {
        mode: "tweak",
        spoken: change,
        baseSpoken: current.spoken,
        characterImages: faces().slice(0, 2),
        lookImage: current.image,
      },
    });
  } catch (error) {
    console.error(error);
    result = null;
  }
  if (!alive(my)) return;
  if (!result || !result.ok) {
    const missedLine = failLine(result);
    noteStatus(missedLine, missedLine);
    finish(my);
    return;
  }
  const image = await shrink(result.image);
  if (!alive(my)) return;
  const draft: Look = {
    id: nextId("look"),
    image,
    spoken: `${current.spoken}. ${change}`,
    pieceIds: current.pieceIds,
    ticketId,
    createdAt: Date.now(),
  };
  patch({ draft, view: sameScreen("look", "look") });
  rememberTicket({
    id: ticketId,
    type: "Full Look",
    category: "Full",
    characterRefIds: useLab.getState().refs.map((ref) => ref.id),
    pieceRefIds: draft.pieceIds,
    spokenDescription: change,
    prompt: result.prompt,
    consistencyLocks: LOCK_LINE,
    output: draft.id,
    status: again ? "Regenerated" : "Generated",
    createdAt: Date.now(),
  });
  noteStatus(copy.sharp, copy.sharp);
  finish(my);
}

async function walk(my = begin(), again = false) {
  const draft = useLab.getState().draft;
  if (!draft) {
    noteStatus(copy.noWalk);
    finish(my);
    return;
  }
  const reaction = useLab.getState().reaction;
  noteStatus(copy.walking, copy.walking);
  patch({ lastJob: { kind: "video" }, view: "runway" });
  const stage: View = "runway";
  const ticketId = nextId("GEN");
  let started: Awaited<ReturnType<typeof startRunway>> | null = null;
  try {
    started = await startRunway({
      data: {
        lookImage: draft.image,
        faceImage: faces()[0],
        spoken: draft.spoken,
        reaction,
      },
    });
  } catch (error) {
    console.error(error);
    started = null;
  }
  if (!alive(my)) return;
  if (!started || !started.ok) {
    const missedLine = failLine(started);
    noteStatus(missedLine, missedLine);
    finish(my);
    return;
  }
  rememberTicket({
    id: ticketId,
    type: "Runway Video",
    category: "Video",
    characterRefIds: useLab.getState().refs.map((ref) => ref.id),
    pieceRefIds: draft.pieceIds,
    spokenDescription: draft.spoken,
    prompt: started.prompt,
    consistencyLocks: LOCK_LINE,
    status: "Pending",
    createdAt: Date.now(),
  });
  let misses = 0;
  for (let attempt = 0; attempt < 45; attempt += 1) {
    if (!alive(my)) return;
    await new Promise((resolve) => setTimeout(resolve, 4000));
    if (!alive(my)) return;
    let polled: Awaited<ReturnType<typeof pollRunway>> | null = null;
    try {
      polled = await pollRunway({ data: { requestId: started.requestId } });
    } catch (error) {
      console.error(error);
      polled = null;
    }
    if (!alive(my)) return;
    if (!polled || !polled.ok) {
      misses += 1;
      if (misses >= 3) {
        noteStatus(copy.missed, copy.missed);
        finish(my);
        return;
      }
      continue;
    }
    misses = 0;
    if (polled.status === "failed") {
      noteStatus(copy.missed, copy.missed);
      finish(my);
      return;
    }
    if (polled.status === "done" && polled.url) {
      const videoUrl = polled.url;
      const latest = useLab.getState().draft;
      if (latest && latest.id === draft.id) {
        const next = { ...latest, videoUrl, videoReaction: reaction };
        const looks = useLab.getState().looks.map((look) =>
          look.id === next.id ? { ...look, videoUrl, videoReaction: reaction } : look,
        );
        patch({ draft: next, looks });
      }
      const tickets = useLab.getState().tickets.map((ticket) =>
        ticket.id === ticketId
          ? {
              ...ticket,
              status: again ? ("Regenerated" as const) : ("Generated" as const),
              output: runwayTicketOutput(videoUrl, started.requestId),
            }
          : ticket,
      );
      patch({ tickets, view: sameScreen(stage, "runway") });
      noteStatus(copy.runwayUp);
      finish(my);
      return;
    }
  }
  if (!alive(my)) return;
  noteStatus(copy.missed, copy.missed);
  finish(my);
}

function runIntent(intent: Intent, view: View, text: string) {
  if (intent.type === "stop") {
    stopGeneration();
    return;
  }
  if (useLab.getState().busy) {
    useLab.setState({ status: copy.stillBuilding });
    return;
  }
  if (intent.type === "again") {
    const job = useLab.getState().lastJob;
    if (!job) {
      useLab.setState({ status: copy.unclear });
      return;
    }
    if (job.kind === "pieces") void buildPieces(job.drafts, job.transcript, Boolean(job.thenWear), true);
    if (job.kind === "look") void buildLook(begin(), true);
    if (job.kind === "tweak") void tweakLook(job.change, begin(), true);
    if (job.kind === "video") void walk(begin(), true);
    return;
  }
  if (intent.type === "save") {
    useLab.getState().saveDraft();
    return;
  }
  if (intent.type === "reaction") {
    patch({ reaction: intent.reaction });
    const status =
      intent.reaction === "boo" ? "Boo it is." : intent.reaction === "cheer" ? "Cheer it is." : "Both. Loud.";
    useLab.setState({ status });
    return;
  }
  if (intent.type === "runway") {
    if (intent.reaction) patch({ reaction: intent.reaction });
    void walk();
    return;
  }
  if (intent.type === "wear") {
    void buildLook();
    return;
  }
  if (view === "look" && (intent.type === "unclear" || intent.type === "pieces")) {
    const plan = paidPlan(text, view);
    if (plan.kind === "pieces") {
      const wear = intent.type === "pieces" && intent.thenWear;
      void buildPieces(plan.pieces, text, wear, false);
      return;
    }
    if (plan.kind === "tweak" && isLookChange(text)) {
      void tweakLook(text);
      return;
    }
    useLab.setState({ status: copy.unclear });
    return;
  }
  if (view === "runway" && intent.type === "pieces") {
    useLab.setState({ status: copy.boardForPieces });
    return;
  }
  if (intent.type === "pieces") {
    void buildPieces(intent.pieces, intent.transcript, intent.thenWear, false);
    return;
  }
  useLab.setState({ status: copy.unclear });
}

export async function hydrate() {
  if (hydrated) return;
  hydrated = true;
  try {
    const data = await idbGet<Persisted>("lab");
    if (!data) {
      useLab.setState({ ready: true, view: "lock", status: "" });
      return;
    }
    const locked = REQUIRED_SLOTS.every((slot) => data.refs?.some((ref) => ref.id === slot));
    const view = locked ? (data.view === "lock" ? "hub" : data.view) : "lock";
    useLab.setState({
      ...data,
      refs: data.refs ?? [],
      pieces: data.pieces ?? [],
      looks: data.looks ?? [],
      tickets: data.tickets ?? [],
      seq: data.seq ?? 0,
      draft: data.draft ?? null,
      reaction: data.reaction ?? "both",
      lastJob: data.lastJob ?? null,
      view,
      ready: true,
      busy: false,
      status: "",
    });
  } catch {
    useLab.setState({ ready: true, view: "lock" });
  }
}

export const useLab = create<LabState>((set, get) => ({
  refs: [],
  pieces: [],
  looks: [],
  tickets: [],
  seq: 0,
  view: "lock",
  draft: null,
  reaction: "both",
  lastJob: null,
  ready: false,
  busy: false,
  status: "",
  setStatus: (status) => set({ status }),
  setView: (view) => {
    set({ view, status: "" });
    persist();
  },
  setReaction: (reaction) => {
    set({ reaction });
    persist();
  },
  setRef: (ref) => {
    const refs = [...get().refs.filter((item) => item.id !== ref.id), ref];
    set({ refs });
    persist();
  },
  togglePiece: (id) => {
    const pieces = get().pieces.map((piece) =>
      piece.id === id ? { ...piece, selected: !piece.selected } : piece,
    );
    set({ pieces });
    persist();
  },
  dropPiece: (id) => {
    set({ pieces: get().pieces.filter((piece) => piece.id !== id) });
    persist();
  },
  lockIn: () => {
    const ready = REQUIRED_SLOTS.every((slot) => get().refs.some((ref) => ref.id === slot));
    if (!ready) return;
    set({ view: "hub", status: "" });
    persist();
    speak(copy.lockedIn);
  },
  saveDraft: () => {
    const draft = get().draft;
    if (!draft) {
      set({ status: copy.noLook });
      return;
    }
    if (get().looks.some((look) => look.image === draft.image)) {
      set({ status: copy.already });
      speak(copy.saved);
      return;
    }
    const looks = [{ ...draft }, ...get().looks].slice(0, 12);
    const tickets = get().tickets.map((ticket) =>
      ticket.id === draft.ticketId ? { ...ticket, status: "Accepted" as const } : ticket,
    );
    set({ looks, tickets, status: copy.saved });
    persist();
    speak(copy.saved);
  },
  openSaved: (id) => {
    const look = get().looks.find((item) => item.id === id);
    if (!look) return;
    set({ draft: look, view: "look", status: copy.sharp });
    persist();
  },
  dropLook: (id) => {
    set({ looks: get().looks.filter((look) => look.id !== id) });
    persist();
  },
  handleTranscript: (text) => {
    const cleaned = text.trim();
    if (!cleaned) return;
    runIntent(interpret(cleaned), get().view, cleaned);
  },
  requestLook: () => {
    if (get().busy) {
      set({ status: copy.stillBuilding });
      return;
    }
    void buildLook();
  },
  requestRunway: () => {
    if (get().busy) {
      set({ status: copy.stillBuilding });
      return;
    }
    const draft = get().draft;
    if (draft?.videoUrl) {
      set({ view: "runway", status: copy.runwayUp });
      persist();
      return;
    }
    void walk();
  },
  retryReaction: () => {
    if (get().busy) {
      set({ status: copy.stillBuilding });
      return;
    }
    const draft = get().draft;
    if (!draft) {
      set({ status: copy.noWalk });
      return;
    }
    void walk(begin(), true);
  },
}));

