import type {
  AgentPersona,
  Critique,
  CritiqueVerdict,
  Medium,
  Proposal,
  SessionBrief,
} from "./types";

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length]!;
}

const BAIT_MARKERS = [
  /\bfingers?\b/i,
  /\bhands?\b/i,
  /\banatomy\b/i,
  /\bglitch\b/i,
  /\bextra limbs?\b/i,
  /\bwarped face\b/i,
  /\bdeformed\b/i,
];

const SAFE_MARKERS = [
  /\bgeneric\b/i,
  /\bstandard\b/i,
  /\bsafe\b/i,
  /\bclassic montage\b/i,
  /\bproduct shot\b/i,
  /\bstraightforward\b/i,
];

type PitchSeed = {
  title: string;
  body: string;
  baseRisk: number;
};

const PITCH_BANK: Record<Medium, PitchSeed[]> = {
  video_clips: [
    {
      title: "Single-take myth in a laundromat",
      body: "One continuous clip where folklore logic rewrites the machines — soap becomes weather, dryers open onto night fields. No dialogue. Ambient hum as score.",
      baseRisk: 62,
    },
    {
      title: "Editorial weather as character",
      body: "Treat wind direction as the protagonist. Cut only on pressure changes. Wardrobe and color grade respond to barometric fiction.",
      baseRisk: 71,
    },
    {
      title: "Safe: brand-friendly b-roll pack",
      body: "Straightforward product shots and a classic montage of smiling creators. Generic lifestyle inserts.",
      baseRisk: 18,
    },
    {
      title: "Probe: impossible depth of field narrative",
      body: "Tell a breakup as shifting focal planes that models usually flatten — foreground memory, midground denial, infinity as the other person leaving frame forever.",
      baseRisk: 84,
    },
  ],
  music_video: [
    {
      title: "Chorus as architecture collapse",
      body: "Each chorus rebuilds the set from a different century while the hook stays locked. Camera refuses reverse shots.",
      baseRisk: 76,
    },
    {
      title: "Lip-sync in negative space only",
      body: "Performer never centered; mouths appear in reflections, puddles, and instrument bodies. Risk: models may lose sync identity.",
      baseRisk: 81,
    },
    {
      title: "Safe: warehouse dance cut",
      body: "Standard warehouse location, classic montage of moves, product-adjacent merch flashes. Straightforward.",
      baseRisk: 22,
    },
  ],
  story: [
    {
      title: "Second-person archive that lies",
      body: "You are a librarian filing futures that rewrite when read aloud. Chapters only unlock if a prior sentence is contradicted.",
      baseRisk: 73,
    },
    {
      title: "Safe: hero journey beat sheet",
      body: "Generic call to adventure, mentor, ordeal, return. Standard three-act with no formal experiment.",
      baseRisk: 15,
    },
    {
      title: "Unreliable light as narrator",
      body: "Every paragraph is lit by a source that remembers differently. Truth is whatever the last lamp invents.",
      baseRisk: 79,
    },
  ],
  song: [
    {
      title: "Hook that changes key mid-syllable",
      body: "Write a chorus where emotional pivot happens inside one held vowel — lyric lines that shouldn't scan but feel inevitable.",
      baseRisk: 68,
    },
    {
      title: "Safe: verse-chorus radio sketch",
      body: "Straightforward love song, classic montage imagery in lyrics, generic bridge. Standard form.",
      baseRisk: 20,
    },
    {
      title: "Duet with an absent voice",
      body: "Second vocal is only silence shaped by arrangement — listeners hallucinate the partner. Probe whether models can imply presence.",
      baseRisk: 86,
    },
  ],
  overnight_coding: [
    {
      title: "Self-rewriting build journal",
      body: "Overnight agent keeps a living architecture diary that refactors the app when confidence drops below a aesthetic threshold — not error rate.",
      baseRisk: 77,
    },
    {
      title: "Safe: CRUD polish pass",
      body: "Straightforward lint fixes and standard form validation. Generic cleanup. No moonshot.",
      baseRisk: 12,
    },
    {
      title: "Compiler of unfinished ideas",
      body: "Queue half-baked UI sketches; overnight run synthesizes a coherent interaction language the model may not fully nail — artistic stretch over correctness.",
      baseRisk: 88,
    },
  ],
};

const REWRITES: Record<Medium, string[]> = {
  video_clips: [
    "Escalate: forbid establishing shots. Open already mid-consequence. Let the medium invent physics the model has rarely sustained for 8+ seconds.",
    "Push harder: cast weather as antagonist and location as accomplice. Cut only when the idea gets stranger.",
  ],
  music_video: [
    "Rewrite: the chorus must change the rules of space. If the set still makes sense after the hook, it is too conservative.",
    "Bolder: remove the performer from the A-roll. The song is danced by objects negotiating gravity.",
  ],
  story: [
    "Push: structure must be the experiment. If the plot could be pitched in one sentence without form, start over weirder.",
    "Rewrite: give the narrator a sensory channel models struggle to keep consistent across chapters.",
  ],
  song: [
    "Harder: the hook should feel wrong on paper and right in the mouth. Kill every rhyme that arrives on schedule.",
    "Rewrite: make silence a featured instrument and force the lyric to argue with the beat.",
  ],
  overnight_coding: [
    "Moonshot: optimize for surprising coherence, not ticket closure. Leave a strange new primitive by morning.",
    "Push: the overnight job should invent a metaphor the codebase then has to live inside.",
  ],
};

function hashBrief(brief: SessionBrief, round: number, agentId: string) {
  const s = `${brief.medium}|${brief.goal}|${brief.constraints}|${round}|${agentId}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

function applyGoal(body: string, goal: string, constraints: string) {
  const g = goal.trim();
  const c = constraints.trim();
  let out = body;
  if (g) out += ` Anchored to brief: “${g.slice(0, 120)}${g.length > 120 ? "…" : ""}.”`;
  if (c) out += ` Respect constraint: ${c.slice(0, 100)}${c.length > 100 ? "…" : ""}.`;
  return out;
}

export function detectBait(text: string): boolean {
  return BAIT_MARKERS.some((re) => re.test(text));
}

export function detectSafe(text: string, risk: number): boolean {
  if (risk < 35) return true;
  return SAFE_MARKERS.some((re) => re.test(text));
}

export function scoreVerdict(proposal: Proposal): CritiqueVerdict {
  const text = `${proposal.title} ${proposal.body}`;
  if (detectBait(text)) return "cheap_bait";
  if (detectSafe(text, proposal.riskPastComfort)) return "too_conservative";
  if (proposal.riskPastComfort >= 65) return "true_stretch";
  if (proposal.riskPastComfort < 45) return "too_conservative";
  return "true_stretch";
}

export function generateProposals(args: {
  brief: SessionBrief;
  agents: AgentPersona[];
  round: number;
  overdrive: number;
}): Proposal[] {
  const { brief, agents, round, overdrive } = args;
  const bank = PITCH_BANK[brief.medium];
  const pitchers = agents.filter(
    (a) =>
      a.connected &&
      (a.role === "pitcher" ||
        a.role === "lyricist" ||
        a.role === "systems_dreamer" ||
        a.role === "art_director"),
  );
  const authors = pitchers.length > 0 ? pitchers : agents.filter((a) => a.connected);

  return authors.map((agent, i) => {
    const seed = hashBrief(brief, round, agent.id) + i * 17 + overdrive * 3;
    const base = pick(bank, seed);
    // Overdrive steers away from safe bank entries and boosts risk
    let choice = base;
    if (overdrive >= 40 || brief.boldnessTarget >= 70) {
      const bold = bank.filter((p) => p.baseRisk >= 60);
      choice = pick(bold.length ? bold : bank, seed + overdrive);
    }
    if (overdrive < 55 && round === 1 && i === authors.length - 1) {
      // keep one conservative foil early so critique has something to reject
      const safe = bank.find((p) => p.baseRisk < 30);
      if (safe) choice = safe;
    }

    const riskBoost = Math.round(overdrive * 0.35 + (brief.boldnessTarget - 50) * 0.2);
    const riskPastComfort = clamp(choice.baseRisk + riskBoost + (round - 1) * 4, 5, 98);
    const title =
      overdrive >= 70 && choice.baseRisk >= 60
        ? `${choice.title} — overdrive cut`
        : choice.title;

    return {
      id: uid("prop"),
      agentId: agent.id,
      title,
      body: applyGoal(choice.body, brief.goal, brief.constraints),
      riskPastComfort,
      round,
      createdAt: Date.now(),
      critiques: [],
    } satisfies Proposal;
  });
}

function critiqueComment(verdict: CritiqueVerdict, agent: AgentPersona, proposal: Proposal): string {
  if (verdict === "cheap_bait") {
    return `${agent.name}: Reject. This leans on technical failure-mode bait (anatomy/glitch). Risk Desk wants aesthetic ambition, not finger theater.`;
  }
  if (verdict === "too_conservative") {
    return `${agent.name}: Too safe. “${proposal.title}” could ship from any default helper. Crank past model comfort — stranger form, not prettier polish.`;
  }
  return `${agent.name}: True stretch. This probes capability and taste. Keep the weird spine; refine execution without sanding off the risk.`;
}

function rewriteFor(brief: SessionBrief, proposal: Proposal, seed: number): string {
  const line = pick(REWRITES[brief.medium], seed);
  return `${line} Starting from “${proposal.title}”: raise the % past comfort and remove every beat a stock model would suggest first.`;
}

export function generateCritiques(args: {
  brief: SessionBrief;
  agents: AgentPersona[];
  proposals: Proposal[];
  overdrive: number;
}): Proposal[] {
  const { brief, agents, proposals, overdrive } = args;
  const critics = agents.filter(
    (a) =>
      a.connected &&
      (a.role === "risk_auditor" ||
        a.role === "contrarian" ||
        a.role === "art_director"),
  );
  const bench = critics.length ? critics : agents.filter((a) => a.connected);

  return proposals.map((proposal, pi) => {
    const critiques: Critique[] = bench
      .filter((c) => c.id !== proposal.agentId)
      .slice(0, 3)
      .map((agent, ci) => {
        let verdict = scoreVerdict(proposal);
        // Overdrive makes critics harsher on mid risk
        if (overdrive >= 55 && verdict === "true_stretch" && proposal.riskPastComfort < 70) {
          verdict = "too_conservative";
        }
        const seed = hashBrief(brief, proposal.round, agent.id) + pi * 13 + ci;
        const needsRewrite = verdict === "too_conservative" || verdict === "cheap_bait";
        return {
          id: uid("crit"),
          proposalId: proposal.id,
          agentId: agent.id,
          verdict,
          comment: critiqueComment(verdict, agent, proposal),
          rewrite: needsRewrite ? rewriteFor(brief, proposal, seed) : undefined,
          createdAt: Date.now(),
        } satisfies Critique;
      });

    return { ...proposal, critiques };
  });
}

/** Apply push-harder rewrites into new proposals for the next round */
export function applyPushHarder(args: {
  brief: SessionBrief;
  agents: AgentPersona[];
  proposals: Proposal[];
  round: number;
  overdrive: number;
}): Proposal[] {
  const { brief, agents, proposals, round, overdrive } = args;
  const pushed: Proposal[] = [];

  for (const proposal of proposals) {
    const pushNotes = proposal.critiques.filter((c) => c.rewrite);
    if (pushNotes.length === 0) {
      if (proposal.riskPastComfort >= 65) {
        pushed.push({
          ...proposal,
          id: uid("prop"),
          round,
          createdAt: Date.now(),
          critiques: [],
          riskPastComfort: clamp(proposal.riskPastComfort + 3 + Math.round(overdrive * 0.05), 5, 99),
          title: `${proposal.title}`,
          body: `${proposal.body} Refined without diluting stretch.`,
        });
      }
      continue;
    }
    const rewrite = pushNotes[0]!.rewrite!;
    const author =
      agents.find((a) => a.id === proposal.agentId) ?? agents.find((a) => a.connected);
    if (!author) continue;
    pushed.push({
      id: uid("prop"),
      agentId: author.id,
      title: `Bolder: ${proposal.title.replace(/^Bolder:\s*/i, "").replace(/\s— overdrive cut$/i, "")}`,
      body: `${rewrite} Prior risk ${proposal.riskPastComfort}%. Goal remains: ${brief.goal || "artistic excellence past comfort."}`,
      riskPastComfort: clamp(
        proposal.riskPastComfort + 12 + Math.round(overdrive * 0.15),
        20,
        99,
      ),
      round,
      createdAt: Date.now(),
      critiques: [],
    });
  }

  // If everything was true_stretch and no pushes, mint one overdrive pitch
  if (pushed.length === 0) {
    const fresh = generateProposals({ brief, agents, round, overdrive: Math.max(overdrive, 60) });
    return fresh;
  }
  return pushed;
}

export function runCouncilRound(args: {
  brief: SessionBrief;
  agents: AgentPersona[];
  round: number;
  overdrive: number;
  prior?: Proposal[];
  mode: "propose" | "push";
}): Proposal[] {
  const { brief, agents, round, overdrive, prior, mode } = args;
  const draft =
    mode === "push" && prior && prior.length > 0
      ? applyPushHarder({ brief, agents, proposals: prior, round, overdrive })
      : generateProposals({ brief, agents, round, overdrive });
  return generateCritiques({ brief, agents, proposals: draft, overdrive });
}

export function overnightSummary(brief: SessionBrief): string {
  return `Queued unattended run · ${brief.medium.replaceAll("_", " ")} · boldness target ${brief.boldnessTarget}% past comfort. Council will propose, critique, and push until stretch density clears the target.`;
}
