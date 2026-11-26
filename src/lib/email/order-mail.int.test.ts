import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSql } from "../db.ts";
import { truncateAll } from "../../test/db.ts";
import { seedOrderRow } from "../../test/seed-order.ts";
import { dbStore } from "../studio/orders.server.ts";
import { sendOrderMail } from "./order-mail.server.ts";
import type { Email } from "./send.server.ts";

const ITEMS = [{ title: "Do Better Look Fly Tee", variantLabel: "Black / M", quantity: 2 }];

async function withRecipient(id: string, recipient: unknown) {
  const sql = await getSql();
  await sql`update orders set recipient_json = ${JSON.stringify(recipient)} where id = ${id}`;
}

beforeEach(async () => {
  await truncateAll();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("order emails", () => {
  it("sends 'it's in' once, to the address given at checkout", async () => {
    await seedOrderRow(
      { id: "o1", status: "submitted", paymentStatus: "paid", totalCents: 4095, providerOrderId: "p1" },
      { items: ITEMS },
    );
    await withRecipient("o1", { name: "Dee Royal", email: "dee@example.com" });
    const sent: Email[] = [];
    const send = vi.fn(async (email: Email) => {
      sent.push(email);
      return { sent: true as const, id: "m1" };
    });
    const sql = await getSql();
    expect(await sendOrderMail(sql, "o1", "placed", send)).toEqual({ sent: true, id: "m1" });
    expect(await sendOrderMail(sql, "o1", "placed", send)).toEqual({ sent: false, reason: "not_due" });
    expect(send).toHaveBeenCalledTimes(1);
    expect(sent[0]?.to).toBe("dee@example.com");
    expect(sent[0]?.subject).toMatch(/^\[Test\] Order O1 is in$/);
    expect(sent[0]?.text).toContain("Hey Dee,");
    expect(sent[0]?.text).toContain("2 × Do Better Look Fly Tee (Black / M)");
    expect(sent[0]?.text).toContain("$40.95");
    // Not shipped yet, so no shipping email.
    expect(await sendOrderMail(sql, "o1", "shipped", send)).toEqual({ sent: false, reason: "not_due" });
  });

  it("sends 'it shipped' with tracking when Printful says it went out", async () => {
    vi.stubEnv("APP_PUBLIC_URL", "https://shop.example");
    await seedOrderRow(
      { id: "o2", status: "submitted", paymentStatus: "paid", totalCents: 3500, providerOrderId: "p2" },
      { items: ITEMS },
    );
    await withRecipient("o2", { name: "", email: "bo@example.com" });
    const sql = await getSql();
    const sent: Email[] = [];
    const send = vi.fn(async (email: Email) => {
      sent.push(email);
      return { sent: true as const, id: "m2" };
    });
    await dbStore(sql).applyProviderUpdate("o2", {
      status: "shipped",
      trackingNumber: "1Z999",
      trackingUrl: "https://track.example/1Z999",
    });
    expect(await sendOrderMail(sql, "o2", "shipped", send)).toEqual({ sent: false, reason: "not_due" });
    // The store already claimed and tried it: without a mail key it is skipped, not resent.
    const fresh = "o3";
    await seedOrderRow(
      { id: fresh, status: "shipped", paymentStatus: "paid", totalCents: 3500, providerOrderId: "p3" },
      { items: ITEMS },
    );
    await withRecipient(fresh, { name: "Bo", email: "bo@example.com" });
    await sql`update orders set tracking_number = '1Z999', tracking_url = 'https://track.example/1Z999' where id = ${fresh}`;
    expect((await sendOrderMail(sql, fresh, "shipped", send)).sent).toBe(true);
    expect(sent[0]?.subject).toMatch(/shipped$/);
    expect(sent[0]?.text).toContain("Tracking number: 1Z999");
    expect(sent[0]?.html).toContain("https://track.example/1Z999");
  });

  it("skips an order with no usable address, and never throws", async () => {
    await seedOrderRow(
      { id: "o4", status: "submitted", paymentStatus: "paid", totalCents: 3500, providerOrderId: "p4" },
      { items: ITEMS },
    );
    const sql = await getSql();
    const send = vi.fn();
    expect(await sendOrderMail(sql, "o4", "placed", send)).toEqual({ sent: false, reason: "no_address" });
    expect(send).not.toHaveBeenCalled();

    await seedOrderRow(
      { id: "o5", status: "submitted", paymentStatus: "paid", totalCents: 3500, providerOrderId: "p5" },
      { items: ITEMS },
    );
    await withRecipient("o5", { email: "x@example.com" });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const failing = vi.fn(async () => ({ sent: false as const, reason: "domain not verified" }));
    expect(await sendOrderMail(sql, "o5", "placed", failing)).toEqual({
      sent: false,
      reason: "domain not verified",
    });
    expect(warn).toHaveBeenCalled();
    const broken = { query: () => Promise.reject(new Error("db down")) } as unknown as typeof sql;
    const brokenSql = Object.assign(() => Promise.reject(new Error("db down")), broken);
    expect(await sendOrderMail(brokenSql as unknown as typeof sql, "o6", "placed", send)).toEqual({
      sent: false,
      reason: "error",
    });
  });
});
