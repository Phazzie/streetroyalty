export const CATEGORIES = [
  "Tops",
  "Bottoms",
  "Outer",
  "Hats",
  "Shoes",
  "Accessories",
] as const;

export type Category = (typeof CATEGORIES)[number];

export type Reaction = "cheer" | "boo" | "both";

export type View = "lock" | "hub" | "board" | "look" | "runway";

export type Slot = "front" | "side" | "threequarter" | "extra";

export const SLOTS: Slot[] = ["front", "side", "threequarter", "extra"];

export const REQUIRED_SLOTS: Slot[] = ["front", "side", "threequarter"];

export type CharacterRef = {
  id: Slot;
  dataUrl: string;
  createdAt: number;
};

export type Piece = {
  id: string;
  category: Category;
  spoken: string;
  sourceTranscript: string;
  image: string;
  selected: boolean;
  ticketId: string;
  createdAt: number;
};

export type Look = {
  id: string;
  image: string;
  spoken: string;
  pieceIds: string[];
  ticketId?: string;
  videoUrl?: string;
  createdAt: number;
};

export type TicketType = "Piece" | "Full Look" | "Runway Video";

export type TicketStatus = "Pending" | "Generated" | "Accepted" | "Regenerated";

export type Ticket = {
  id: string;
  type: TicketType;
  category: Category | "Full" | "Video";
  characterRefIds: string[];
  pieceRefIds: string[];
  spokenDescription: string;
  prompt: string;
  consistencyLocks: string;
  output?: string;
  status: TicketStatus;
  createdAt: number;
};

export type PieceDraft = {
  category: Category;
  spoken: string;
};

export type LastJob =
  | { kind: "pieces"; drafts: PieceDraft[]; transcript: string }
  | { kind: "look" }
  | { kind: "tweak"; change: string }
  | { kind: "video" };
