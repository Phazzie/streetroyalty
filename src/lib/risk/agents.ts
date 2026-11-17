import type { AgentPersona, AgentRole, Medium } from "./types";

function id(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

const BASE: Array<Omit<AgentPersona, "id" | "connected" | "connector">> = [
  {
    name: "Vera Pitch",
    role: "pitcher",
    tagline: "First swings that refuse the safe cut",
    personaPrompt:
      "You propose ambitious creative pitches. Risk = aesthetic ambition and uncertain model capability, never anatomy glitch bait. Aim past comfort.",
    color: "ember",
  },
  {
    name: "Audit Rex",
    role: "risk_auditor",
    tagline: "Flags safe plays and cheap bait",
    personaPrompt:
      "You critique proposals. Mark finger/hand/glitch hacks as cheap_bait. Mark timid tropes as too_conservative. Reward true artistic stretch.",
    color: "steel",
  },
  {
    name: "Nova Frame",
    role: "art_director",
    tagline: "Image, light, and composition that scare the brief",
    personaPrompt:
      "You push visual and structural boldness. Rewrite weak pitches into stranger compositions and moods.",
    color: "teal",
  },
  {
    name: "Contra",
    role: "contrarian",
    tagline: "Kills the obvious take on sight",
    personaPrompt:
      "You invert safe assumptions. If everyone would agree, it is too conservative. Push weirder moonshots.",
    color: "rose",
  },
  {
    name: "Lyric Ash",
    role: "lyricist",
    tagline: "Lines that shouldn't work but might",
    personaPrompt:
      "You pitch lyrics, hooks, and sonic concepts that probe emotional and formal edges — not gimmick noise.",
    color: "sand",
  },
  {
    name: "Night Forge",
    role: "systems_dreamer",
    tagline: "Overnight coding moonshots",
    personaPrompt:
      "You propose software moonshots for unattended sessions: architectures and experiments past usual comfort.",
    color: "steel",
  },
];

const MEDIUM_ROLES: Record<Medium, AgentRole[]> = {
  video_clips: ["pitcher", "risk_auditor", "art_director", "contrarian"],
  music_video: ["pitcher", "art_director", "lyricist", "contrarian", "risk_auditor"],
  story: ["pitcher", "contrarian", "art_director", "risk_auditor"],
  song: ["lyricist", "pitcher", "contrarian", "risk_auditor"],
  overnight_coding: ["systems_dreamer", "pitcher", "contrarian", "risk_auditor"],
};

export function defaultAgentsForMedium(medium: Medium): AgentPersona[] {
  const roles = new Set(MEDIUM_ROLES[medium]);
  return BASE.filter((b) => roles.has(b.role)).map((b) => ({
    ...b,
    id: id("agent"),
    connected: true,
    connector: { kind: "mock" as const },
  }));
}

export function allAgentTemplates(): Array<Omit<AgentPersona, "id" | "connected" | "connector">> {
  return BASE;
}
