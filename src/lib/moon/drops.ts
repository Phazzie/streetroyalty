/**
 * Drops, the Cutting Room Floor, and the production pipeline.
 * Pure rules over design/order summaries — no invented scarcity, no
 * fake stock counts. Every label here can be traced to a stated rule.
 */
import type { DesignSummary, OrderSummary } from "../studio/models.ts";

/** A collection with a drop date is a Drop. Group its pieces, soonest first. */
export type Drop = {
  collectionId: string;
  name: string;
  dropAt: string;
  pieces: DesignSummary[];
  /** True once the drop date has passed — the board is open. */
  live: boolean;
};

export function groupDrops(
  pieces: DesignSummary[],
  collections: { id: string; name: string; dropAt?: string | null }[],
  now: Date = new Date(),
): Drop[] {
  const drops: Drop[] = [];
  for (const collection of collections) {
    if (!collection.dropAt) continue;
    const members = pieces.filter((piece) => piece.collectionId === collection.id);
    if (members.length === 0) continue;
    drops.push({
      collectionId: collection.id,
      name: collection.name,
      dropAt: collection.dropAt,
      pieces: members,
      live: new Date(collection.dropAt).getTime() <= now.getTime(),
    });
  }
  return drops.sort((a, b) => a.dropAt.localeCompare(b.dropAt));
}

export const FLOOR_MIN_AGE_DAYS = 21;

/**
 * Cutting Room Floor rule, stated on the section itself: a published piece
 * lands on the floor when it belongs to no collection (no Drop is keeping
 * it) and it has sat on the rack the longest — oldest first, capped.
 * It is the director's cut, not a clearance bin: no fake discounts.
 */
export function cuttingRoomFloor(pieces: DesignSummary[], cap = 4, now: Date = new Date()): DesignSummary[] {
  const cutoff = now.getTime() - FLOOR_MIN_AGE_DAYS * 24 * 60 * 60 * 1000;
  return pieces
    .filter((piece) => piece.status === "published" && !piece.collectionId)
    .filter((piece) => {
      const updated = new Date(piece.updatedAt).getTime();
      return Number.isNaN(updated) || updated <= cutoff;
    })
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
    .slice(0, cap);
}

/** The five production stages an order walks, Fourthwall-style. */
export const PIPELINE_STAGES = ["Design locked", "Sample", "Print", "QC", "Shipped"] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export type PipelineState = {
  stageIndex: number;
  stage: PipelineStage;
  /** True when the order is stuck and needs a human, not a stage. */
  blocked: boolean;
  label: string;
};

/**
 * Map an order's stored status onto the visible pipeline. Statuses come
 * from orders.server / provider webhooks: draft-ish and unpaid states sit
 * at Design locked; paid + submitted moves to Print; provider shipment
 * states finish the walk. Failed/needs-review orders are blocked, never
 * dressed up as progress.
 */
export function pipelineFor(order: Pick<OrderSummary, "status" | "paymentStatus" | "providerStatus" | "trackingNumber">): PipelineState {
  const status = order.status.toLowerCase();
  const provider = (order.providerStatus ?? "").toLowerCase();
  if (status === "failed" || status === "needs_review") {
    return { stageIndex: 2, stage: "Print", blocked: true, label: "Held at Print — needs a human" };
  }
  if (status === "canceled" || status === "cancelled") {
    return { stageIndex: 0, stage: "Design locked", blocked: true, label: "Canceled before print" };
  }
  if (order.trackingNumber || provider.includes("shipped") || provider.includes("delivered") || status === "shipped" || status === "delivered") {
    return { stageIndex: 4, stage: "Shipped", blocked: false, label: "Shipped — out the door" };
  }
  if (provider.includes("qc") || provider.includes("quality")) {
    return { stageIndex: 3, stage: "QC", blocked: false, label: "On the QC table" };
  }
  if (order.paymentStatus === "paid") {
    if (provider.includes("sample")) {
      return { stageIndex: 1, stage: "Sample", blocked: false, label: "Sample pulled" };
    }
    return { stageIndex: 2, stage: "Print", blocked: false, label: "Paid — on the press" };
  }
  return { stageIndex: 0, stage: "Design locked", blocked: false, label: "Locked — waiting on payment" };
}
