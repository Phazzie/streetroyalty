/**
 * Seller dashboard aggregates over the seller's own designs and orders.
 * Test-mode honest: every number here is a sum of real rows the seller
 * owns — no projected views, no invented traffic.
 */
import type { DesignSummary, OrderSummary } from "../studio/models.ts";
import { pipelineFor, PIPELINE_STAGES } from "./drops.ts";

export type DashboardStats = {
  published: number;
  drafts: number;
  /** Forks sitting on this seller's own rack (credit attached). */
  forks: number;
  orders: number;
  paidOrders: number;
  revenueCents: number;
  units: number;
  /** Orders per pipeline stage, in stage order. */
  pipeline: { stage: string; count: number; blocked: number }[];
  bestMovers: { title: string; units: number; revenueCents: number }[];
};

export function dashboardStats(designs: DesignSummary[], orders: OrderSummary[]): DashboardStats {
  const pipeline = PIPELINE_STAGES.map((stage) => ({ stage, count: 0, blocked: 0 }));
  let revenueCents = 0;
  let units = 0;
  let paidOrders = 0;
  const byTitle = new Map<string, { units: number; revenueCents: number }>();
  for (const order of orders) {
    const state = pipelineFor(order);
    const bucket = pipeline[state.stageIndex];
    if (bucket) {
      bucket.count += 1;
      if (state.blocked) bucket.blocked += 1;
    }
    if (order.paymentStatus !== "paid") continue;
    paidOrders += 1;
    revenueCents += order.totalCents;
    for (const item of order.items) {
      units += item.quantity;
      const entry = byTitle.get(item.title) ?? { units: 0, revenueCents: 0 };
      entry.units += item.quantity;
      entry.revenueCents += item.quantity * item.unitCents;
      byTitle.set(item.title, entry);
    }
  }
  return {
    published: designs.filter((design) => design.status === "published").length,
    drafts: designs.filter((design) => design.status === "draft").length,
    forks: designs.filter((design) => Boolean(design.forkedFromTitle)).length,
    orders: orders.length,
    paidOrders,
    revenueCents,
    units,
    pipeline,
    bestMovers: [...byTitle.entries()]
      .map(([title, entry]) => ({ title, ...entry }))
      .sort((a, b) => b.units - a.units || b.revenueCents - a.revenueCents)
      .slice(0, 5),
  };
}
