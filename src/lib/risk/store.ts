import { create } from "zustand";
import { persist } from "zustand/middleware";
import { defaultAgentsForMedium } from "./agents";
import { overnightSummary, runCouncilRound } from "./council";
import type {
  AgentPersona,
  ConnectorConfig,
  Medium,
  OvernightJob,
  Proposal,
  SessionBrief,
  SessionPhase,
} from "./types";

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

const defaultBrief = (): SessionBrief => ({
  medium: "video_clips",
  goal: "",
  constraints: "",
  boldnessTarget: 70,
});

type RiskState = {
  phase: SessionPhase;
  brief: SessionBrief;
  agents: AgentPersona[];
  proposals: Proposal[];
  round: number;
  overdrive: number;
  overnightQueue: OvernightJob[];
  councilBusy: boolean;
  lastAction: string | null;
  enterDesk: () => void;
  setPhase: (phase: SessionPhase) => void;
  patchBrief: (patch: Partial<SessionBrief>) => void;
  setMedium: (medium: Medium) => void;
  toggleAgent: (id: string) => void;
  setConnector: (id: string, connector: ConnectorConfig) => void;
  setOverdrive: (value: number) => void;
  setBoldnessTarget: (value: number) => void;
  runPropose: () => void;
  runPushHarder: () => void;
  rerunWithOverdrive: () => void;
  queueOvernight: () => void;
  setOvernightStatus: (id: string, status: OvernightJob["status"]) => void;
  clearBoard: () => void;
  resetSession: () => void;
};

export const useRiskStore = create<RiskState>()(
  persist(
    (set, get) => ({
      phase: "landing",
      brief: defaultBrief(),
      agents: defaultAgentsForMedium("video_clips"),
      proposals: [],
      round: 0,
      overdrive: 35,
      overnightQueue: [],
      councilBusy: false,
      lastAction: null,

      enterDesk: () => set({ phase: "brief" }),

      setPhase: (phase) => set({ phase }),

      patchBrief: (patch) =>
        set((s) => ({
          brief: { ...s.brief, ...patch },
        })),

      setMedium: (medium) =>
        set((s) => ({
          brief: { ...s.brief, medium },
          agents: defaultAgentsForMedium(medium).map((a) => {
            const prev = s.agents.find((p) => p.role === a.role);
            return prev
              ? { ...a, connected: prev.connected, connector: prev.connector }
              : a;
          }),
        })),

      toggleAgent: (id) =>
        set((s) => ({
          agents: s.agents.map((a) =>
            a.id === id ? { ...a, connected: !a.connected } : a,
          ),
        })),

      setConnector: (id, connector) =>
        set((s) => ({
          agents: s.agents.map((a) => (a.id === id ? { ...a, connector } : a)),
        })),

      setOverdrive: (value) => set({ overdrive: Math.max(0, Math.min(100, value)) }),

      setBoldnessTarget: (value) =>
        set((s) => ({
          brief: { ...s.brief, boldnessTarget: Math.max(0, Math.min(100, value)) },
        })),

      runPropose: () => {
        const s = get();
        if (s.councilBusy) return;
        const connected = s.agents.filter((a) => a.connected);
        if (connected.length < 2) {
          set({ lastAction: "Connect at least two agents before running the council." });
          return;
        }
        set({ councilBusy: true, lastAction: "Council proposing…" });
        const round = s.round + 1;
        // sync mock tick for UI motion
        window.setTimeout(() => {
          const proposals = runCouncilRound({
            brief: s.brief,
            agents: s.agents,
            round,
            overdrive: s.overdrive,
            mode: "propose",
          });
          set({
            proposals,
            round,
            phase: "board",
            councilBusy: false,
            lastAction: `Round ${round}: proposals + peer review locked.`,
          });
        }, 420);
      },

      runPushHarder: () => {
        const s = get();
        if (s.councilBusy || s.proposals.length === 0) return;
        set({ councilBusy: true, lastAction: "Pushing harder…" });
        const round = s.round + 1;
        window.setTimeout(() => {
          const proposals = runCouncilRound({
            brief: get().brief,
            agents: get().agents,
            round,
            overdrive: Math.max(get().overdrive, 50),
            prior: get().proposals,
            mode: "push",
          });
          set({
            proposals,
            round,
            overdrive: Math.max(get().overdrive, 50),
            councilBusy: false,
            lastAction: `Round ${round}: push-harder rewrites issued.`,
          });
        }, 480);
      },

      rerunWithOverdrive: () => {
        const s = get();
        if (s.councilBusy) return;
        const bumped = Math.min(100, s.overdrive + 18);
        set({ overdrive: bumped, councilBusy: true, lastAction: `Overdrive ${bumped}% — re-running…` });
        const round = s.round + 1;
        window.setTimeout(() => {
          const proposals = runCouncilRound({
            brief: get().brief,
            agents: get().agents,
            round,
            overdrive: bumped,
            mode: "propose",
          });
          set({
            proposals,
            round,
            phase: "board",
            councilBusy: false,
            lastAction: `Round ${round} at overdrive ${bumped}%.`,
          });
        }, 500);
      },

      queueOvernight: () => {
        const s = get();
        if (!s.brief.goal.trim()) {
          set({ lastAction: "Add a goal before queuing overnight.", phase: "brief" });
          return;
        }
        const job: OvernightJob = {
          id: uid("night"),
          brief: { ...s.brief },
          status: "queued",
          createdAt: Date.now(),
          notes: overnightSummary(s.brief),
        };
        set({
          overnightQueue: [job, ...s.overnightQueue].slice(0, 12),
          phase: "overnight",
          lastAction: "Overnight session stashed.",
        });
      },

      setOvernightStatus: (id, status) =>
        set((s) => ({
          overnightQueue: s.overnightQueue.map((j) =>
            j.id === id
              ? {
                  ...j,
                  status,
                  completedAt: status === "done" ? Date.now() : j.completedAt,
                }
              : j,
          ),
        })),

      clearBoard: () => set({ proposals: [], round: 0, lastAction: "Board cleared." }),

      resetSession: () =>
        set({
          phase: "landing",
          brief: defaultBrief(),
          agents: defaultAgentsForMedium("video_clips"),
          proposals: [],
          round: 0,
          overdrive: 35,
          councilBusy: false,
          lastAction: null,
        }),
    }),
    {
      name: "risk-desk-v1",
      partialize: (s) => ({
        phase: s.phase === "landing" ? "landing" : s.phase,
        brief: s.brief,
        agents: s.agents,
        proposals: s.proposals,
        round: s.round,
        overdrive: s.overdrive,
        overnightQueue: s.overnightQueue,
      }),
    },
  ),
);
