export type Medium =
  | "video_clips"
  | "music_video"
  | "story"
  | "song"
  | "overnight_coding";

export type AgentRole =
  | "pitcher"
  | "risk_auditor"
  | "art_director"
  | "contrarian"
  | "lyricist"
  | "systems_dreamer";

export type ConnectorKind = "mock" | "paste" | "webhook";

export type CritiqueVerdict =
  | "too_conservative"
  | "true_stretch"
  | "cheap_bait";

export type SessionPhase =
  | "landing"
  | "brief"
  | "roster"
  | "board"
  | "overnight";

export type ConnectorConfig = {
  kind: ConnectorKind;
  /** Optional webhook URL for future real agents */
  webhookUrl?: string;
  /** Optional API key placeholder (never sent server-side in v1) */
  apiKeyHint?: string;
  /** Last paste-in reply from a real agent */
  lastPasteReply?: string;
};

export type AgentPersona = {
  id: string;
  name: string;
  role: AgentRole;
  tagline: string;
  personaPrompt: string;
  color: "ember" | "teal" | "sand" | "steel" | "rose";
  connected: boolean;
  connector: ConnectorConfig;
};

export type Critique = {
  id: string;
  proposalId: string;
  agentId: string;
  verdict: CritiqueVerdict;
  comment: string;
  rewrite?: string;
  createdAt: number;
};

export type Proposal = {
  id: string;
  agentId: string;
  title: string;
  body: string;
  /** 0–100: how far past typical model comfort */
  riskPastComfort: number;
  round: number;
  createdAt: number;
  critiques: Critique[];
};

export type SessionBrief = {
  medium: Medium;
  goal: string;
  constraints: string;
  boldnessTarget: number;
};

export type OvernightJob = {
  id: string;
  brief: SessionBrief;
  status: "queued" | "running" | "done" | "paused";
  createdAt: number;
  completedAt?: number;
  notes: string;
};

export type RiskSession = {
  id: string;
  name: string;
  brief: SessionBrief;
  agents: AgentPersona[];
  proposals: Proposal[];
  round: number;
  overdrive: number;
  createdAt: number;
  updatedAt: number;
};

export const MEDIUM_LABELS: Record<Medium, string> = {
  video_clips: "Video clips",
  music_video: "Music video",
  story: "Story",
  song: "Song",
  overnight_coding: "Overnight coding",
};

export const ROLE_LABELS: Record<AgentRole, string> = {
  pitcher: "Pitcher",
  risk_auditor: "Risk Auditor",
  art_director: "Art Director",
  contrarian: "Contrarian",
  lyricist: "Lyricist",
  systems_dreamer: "Systems Dreamer",
};

export const VERDICT_LABELS: Record<CritiqueVerdict, string> = {
  too_conservative: "Too conservative",
  true_stretch: "True artistic stretch",
  cheap_bait: "Cheap technical bait",
};
