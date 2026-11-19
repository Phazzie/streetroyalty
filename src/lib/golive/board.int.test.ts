import { beforeEach, describe, expect, it } from "vitest";
import { truncateAll } from "@/test/db.ts";
import { seedUser } from "@/test/seed.ts";
import { readBoard } from "./board.server.ts";

const VISITOR = { view: "public", signedIn: false, podMode: "sandbox", paymentsMode: "sandbox" };

describe("readBoard", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("gives a visitor the two modes the studio already shows, and nothing else", async () => {
    process.env.STUDIO_ADMIN_EMAILS = "ada@example.com";
    process.env.STRIPE_SECRET_KEY = "Hh7Qz51Nq0aXwVb";
    expect(await readBoard(null)).toEqual(VISITOR);
    process.env.PAYMENTS_MODE = "live";
    expect(await readBoard(null)).toEqual({ ...VISITOR, paymentsMode: "live" });
  });

  it("answers a visitor the same whether or not an admin list exists", async () => {
    const without = await readBoard(null);
    process.env.STUDIO_ADMIN_EMAILS = "ada@example.com";
    expect(await readBoard(null)).toEqual(without);
    expect(without).toEqual(VISITOR);
  });

  it("keeps the cover on for a signed-in member who is not on the list", async () => {
    await seedUser("bo");
    process.env.STUDIO_ADMIN_EMAILS = "ada@example.com";
    expect(await readBoard("bo")).toEqual({ ...VISITOR, signedIn: true });
  });

  it("keeps the cover on for everyone while there is no admin list", async () => {
    await seedUser("ada");
    expect(await readBoard("ada")).toEqual({ ...VISITOR, signedIn: true });
    process.env.STUDIO_ADMIN_EMAILS = " , ";
    expect(await readBoard("ada")).toEqual({ ...VISITOR, signedIn: true });
  });

  it("does not lift the cover for an id that is not an account", async () => {
    process.env.STUDIO_ADMIN_EMAILS = "ada@example.com";
    const view = await readBoard("ada@example.com");
    expect(view.view).toBe("public");
  });

  it("lifts the cover for a shop admin, whatever the case of the email", async () => {
    await seedUser("ada", "Ada@Example.com");
    process.env.STUDIO_ADMIN_EMAILS = "someone@example.com, ada@example.com ";
    const view = await readBoard("ada");
    if (view.view !== "admin") throw new Error("expected the live board");
    expect(view.board.services.map((service) => `${service.id}:${service.lamp}`)).toEqual([
      "admins:on",
      "database:off",
      "signin:partly",
      "payments:off",
      "printing:off",
      "pictures:off",
      "drop:off",
    ]);
    expect(view.board.next).toBe("database");
    expect(view.board.canPay).toBe(false);
  });

  it("shows an admin which settings are in without showing what is in them", async () => {
    await seedUser("ada");
    const secrets = {
      STUDIO_ADMIN_EMAILS: "ada@example.com",
      STRIPE_SECRET_KEY: "Hh7Qz51Nq0aXwVb",
      STRIPE_WEBHOOK_SECRET: "Jj2Xq8842KzWvQp",
      PRINTFUL_API_KEY: "Pf8Zk93bd7eQxJw",
      PRINT_FILE_SIGNING_SECRET: "Sg6Xq5d5d0b2fZwK",
      XAI_API_KEY: "Lm5Zq77c0f4e2XkV",
    };
    process.env.POD_MODE = "live";
    process.env.PAYMENTS_MODE = "live";
    Object.assign(process.env, secrets);
    const view = await readBoard("ada");
    if (view.view !== "admin") throw new Error("expected the live board");
    expect(view.board.podMode).toBe("live");
    expect(view.board.paymentsMode).toBe("live");
    expect(view.board.canPay).toBe(true);
    const printed = JSON.stringify(view);
    for (const value of Object.values(secrets)) expect(printed).not.toContain(value);
    const printing = view.board.services.find((service) => service.id === "printing");
    expect(printing?.lamp).toBe("partly");
    expect(printing?.missing).toEqual([
      "APP_PUBLIC_URL",
      "PRINTFUL_WEBHOOK_SECRET",
      "PRINTFUL_STORE_ID",
    ]);
  });
});
