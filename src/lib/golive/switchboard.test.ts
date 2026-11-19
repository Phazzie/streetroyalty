import { describe, expect, it } from "vitest";
import { SERVICES, TEST_ORDER_STEPS, VARIABLE_IN_ONE_LINE, VERCEL_STEPS } from "./services.ts";
import { switchboard, type Env, type ServiceReport, type Switchboard } from "./switchboard.ts";

/** Every value is a string that could not turn up in the board by accident. */
const SECRETS: Env = {
  DATABASE_URL: "postgresql://qzxv:Zq9wJd7Kx@ep-zzyx-qqvk.jwxq.example/vvkq",
  BETTER_AUTH_SECRET: "Yk3xQw0f9d2c7b61aa48e3Zt",
  BETTER_AUTH_URL: "https://qvzk.jxwq.example",
  STRIPE_SECRET_KEY: "sk_live_Hh7Qz51Nq0aXwVb",
  STRIPE_WEBHOOK_SECRET: "whsec_Jj2Xq8842KzWv",
  PRINTFUL_API_KEY: "Pf8Zk93bd7eQxJw",
  PRINTFUL_STORE_ID: "17203355",
  PRINTFUL_WEBHOOK_SECRET: "Wb4Qza1c9e0XkJv",
  PRINT_FILE_SIGNING_SECRET: "Sg6Xq5d5d0b2fZwK",
  APP_PUBLIC_URL: "https://wqzj.kxvq.example",
  XAI_API_KEY: "xai-Lm5Zq77c0f4e2Xk",
  FOURTHWALL_STOREFRONT_TOKEN: "ptkn_Rr1Zx3e8aQwKj",
  FOURTHWALL_CHECKOUT_DOMAIN: "zzqk-xvjw.kqzx.example",
  STUDIO_ADMIN_EMAILS: "qzowner@jxwq.example, zkfriend@jxwq.example",
};

function service(board: Switchboard, id: ServiceReport["id"]): ServiceReport {
  const found = board.services.find((item) => item.id === id);
  if (!found) throw new Error(`no ${id}`);
  return found;
}

function lamps(board: Switchboard): Record<string, string> {
  return Object.fromEntries(board.services.map((item) => [item.id, item.lamp]));
}

describe("switchboard", () => {
  it("reads an empty environment as everything off and nobody able to pay", () => {
    const board = switchboard({});
    expect(lamps(board)).toEqual({
      admins: "off",
      database: "off",
      signin: "off",
      payments: "off",
      printing: "off",
      pictures: "off",
      drop: "off",
    });
    expect(board.canPay).toBe(false);
    expect(board.next).toBe("admins");
    expect(board.podMode).toBe("sandbox");
    expect(board.paymentsMode).toBe("sandbox");
    expect(service(board, "database").missing).toEqual(["DATABASE_URL"]);
    expect(service(board, "database").now).toMatch(/vanish when it restarts/);
    expect(service(board, "payments").missing).toEqual([
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
    ]);
    expect(service(board, "printing").missing).toEqual([
      "PRINTFUL_API_KEY",
      "PRINT_FILE_SIGNING_SECRET",
      "APP_PUBLIC_URL",
      "PRINTFUL_WEBHOOK_SECRET",
    ]);
  });

  it("reads a full environment as everything on", () => {
    const board = switchboard(SECRETS);
    expect(new Set(Object.values(lamps(board)))).toEqual(new Set(["on"]));
    expect(board.canPay).toBe(true);
    expect(board.next).toBeNull();
    expect(board.services.flatMap((item) => item.missing)).toEqual([]);
    expect(service(board, "payments").unlocks).toBe("People can pay.");
  });

  it("never gives back a value, a piece of one or its length", () => {
    const fixtures: Env[] = [
      SECRETS,
      { ...SECRETS, POD_MODE: "sandbox", PAYMENTS_MODE: "sandbox" },
      { ...SECRETS, PRINT_FILE_SIGNING_SECRET: "", STRIPE_WEBHOOK_SECRET: undefined },
      { ...SECRETS, FOURTHWALL_CHECKOUT_DOMAIN: "zq vv3 kxjw qqzv" },
      { ...SECRETS, DATABASE_URL: undefined },
    ];
    for (const env of fixtures) {
      const printed = JSON.stringify(switchboard(env));
      for (const [name, value] of Object.entries(env)) {
        if (!value || name === "POD_MODE" || name === "PAYMENTS_MODE") continue;
        expect(printed, `${name} leaked whole`).not.toContain(value);
        // No run of eight characters from any value, which covers prefixes and tails.
        for (let at = 0; at + 8 <= value.length; at += 1) {
          expect(printed, `${name} leaked in part`).not.toContain(value.slice(at, at + 8));
        }
      }
      // No lengths and no counts: outside the daily caps the board holds no number at all.
      const board = switchboard(env);
      expect(JSON.stringify({ ...board, caps: null })).not.toMatch(/[0-9]/);
      expect(printed).not.toContain("qzowner");
      expect(printed).not.toContain("zkfriend");
    }
  });

  it("treats a blank setting as missing", () => {
    const board = switchboard({ ...SECRETS, DATABASE_URL: "   ", STUDIO_ADMIN_EMAILS: " , ," });
    expect(service(board, "database").lamp).toBe("off");
    expect(service(board, "admins").lamp).toBe("off");
    expect(service(board, "admins").missing).toEqual(["STUDIO_ADMIN_EMAILS"]);
  });

  it("will not call payments on while a paid order would be forgotten", () => {
    const board = switchboard({ ...SECRETS, DATABASE_URL: undefined });
    const payments = service(board, "payments");
    expect(payments.lamp).toBe("partly");
    expect(payments.waitsOn).toEqual(["database"]);
    expect(payments.now).toMatch(/lost when it restarts/);
    expect(board.canPay).toBe(true);
    expect(board.ordersKept).toBe(false);
    expect(switchboard(SECRETS).ordersKept).toBe(true);
  });

  it("holds sign-in at partly until the database is on", () => {
    const board = switchboard({ ...SECRETS, DATABASE_URL: undefined });
    const signin = service(board, "signin");
    expect(signin.lamp).toBe("partly");
    expect(signin.waitsOn).toEqual(["database"]);
    expect(signin.missing).toEqual([]);
    expect(board.next).toBe("database");
  });

  it("says which half of sign-in is missing", () => {
    const noSecret = service(switchboard({ ...SECRETS, BETTER_AUTH_SECRET: "" }), "signin");
    expect(noSecret.lamp).toBe("partly");
    expect(noSecret.missing).toEqual(["BETTER_AUTH_SECRET"]);
    expect(noSecret.now).toMatch(/signed out/);
    const noUrl = service(switchboard({ ...SECRETS, BETTER_AUTH_URL: "" }), "signin");
    expect(noUrl.lamp).toBe("partly");
    expect(noUrl.missing).toEqual(["BETTER_AUTH_URL"]);
  });

  it("reads sign-in as off when the whole site has it switched off", () => {
    const signin = service(switchboard({ ...SECRETS, VITE_AUTH_ENABLED: "false" }), "signin");
    expect(signin.lamp).toBe("off");
    expect(signin.notes.join(" ")).toMatch(/VITE_AUTH_ENABLED/);
  });

  it("will not call payments on while printing is in sandbox, as checkout will not", () => {
    const board = switchboard({ ...SECRETS, PRINTFUL_API_KEY: undefined });
    expect(board.podMode).toBe("sandbox");
    expect(board.paymentsMode).toBe("live");
    const payments = service(board, "payments");
    expect(payments.lamp).toBe("partly");
    expect(payments.waitsOn).toEqual(["printing"]);
    expect(board.canPay).toBe(false);
    expect(service(board, "printing").lamp).toBe("off");
  });

  it("follows a mode setting over the keys, the way the app does", () => {
    const held = switchboard({ ...SECRETS, POD_MODE: "sandbox", PAYMENTS_MODE: "Sandbox " });
    expect(held.podMode).toBe("sandbox");
    expect(held.paymentsMode).toBe("sandbox");
    expect(service(held, "printing").lamp).toBe("off");
    expect(service(held, "printing").notes.join(" ")).toMatch(/POD_MODE is set to sandbox/);
    expect(service(held, "payments").lamp).toBe("off");
    expect(service(held, "payments").notes.join(" ")).toMatch(/PAYMENTS_MODE is set to sandbox/);
    expect(held.canPay).toBe(false);

    const forced = switchboard({ POD_MODE: "live", PAYMENTS_MODE: "live" });
    expect(service(forced, "printing").lamp).toBe("partly");
    expect(service(forced, "printing").now).toMatch(/no Printful key/);
    expect(service(forced, "payments").lamp).toBe("partly");
    expect(service(forced, "payments").now).toMatch(/no Stripe key/);
    expect(forced.canPay).toBe(false);
  });

  it("walks printing from partly to on as each piece arrives", () => {
    const base: Env = { PRINTFUL_API_KEY: "k" };
    expect(service(switchboard(base), "printing").now).toMatch(/PRINT_FILE_SIGNING_SECRET/);
    const signed = { ...base, PRINT_FILE_SIGNING_SECRET: "s" };
    expect(service(switchboard(signed), "printing").now).toMatch(/APP_PUBLIC_URL/);
    const addressed = { ...signed, APP_PUBLIC_URL: "https://shop.example" };
    const waiting = service(switchboard(addressed), "printing");
    expect(waiting.lamp).toBe("partly");
    expect(waiting.missing).toEqual(["PRINTFUL_WEBHOOK_SECRET"]);
    const done = service(switchboard({ ...addressed, PRINTFUL_WEBHOOK_SECRET: "w" }), "printing");
    expect(done.lamp).toBe("on");
    expect(done.variables.find((item) => item.name === "PRINTFUL_STORE_ID")).toEqual({
      name: "PRINTFUL_STORE_ID",
      need: "optional",
      set: false,
    });
  });

  it("warns that a payment can be lost without the Stripe webhook secret", () => {
    const board = switchboard({ ...SECRETS, STRIPE_WEBHOOK_SECRET: undefined });
    const payments = service(board, "payments");
    expect(payments.lamp).toBe("partly");
    expect(payments.missing).toEqual(["STRIPE_WEBHOOK_SECRET"]);
    expect(board.canPay).toBe(true);
  });

  it("reports the daily caps the app will enforce, and a zero as partly", () => {
    const defaults = switchboard({ XAI_API_KEY: "k" });
    expect(service(defaults, "pictures").lamp).toBe("on");
    expect(defaults.caps.image).toEqual({ visitor: 10, global: 150 });
    expect(defaults.caps.video).toEqual({ visitor: 2, global: 20 });
    expect(defaults.caps.text).toEqual({ visitor: 40, global: 1500 });
    const zeroed = switchboard({ XAI_API_KEY: "k", AI_DAILY_VIDEO: "0", AI_VISITOR_IMAGE: "12" });
    expect(zeroed.caps.video.global).toBe(0);
    expect(zeroed.caps.image.visitor).toBe(12);
    expect(service(zeroed, "pictures").lamp).toBe("partly");
    expect(service(zeroed, "pictures").now).toMatch(/video is capped at zero/);
  });

  it("reads the drop as partly when the checkout address is not one", () => {
    const bad = switchboard({ FOURTHWALL_STOREFRONT_TOKEN: "t", FOURTHWALL_CHECKOUT_DOMAIN: "x" });
    expect(service(bad, "drop").lamp).toBe("partly");
    const fine = switchboard({ FOURTHWALL_STOREFRONT_TOKEN: "t" });
    expect(service(fine, "drop").lamp).toBe("on");
  });
});

describe("the checklist", () => {
  it("lists the services in the order to switch them on", () => {
    expect(SERVICES.map((item) => item.id)).toEqual([
      "admins",
      "database",
      "signin",
      "payments",
      "printing",
      "pictures",
      "drop",
    ]);
  });

  it("names every setting once, in capitals", () => {
    const names = SERVICES.flatMap((item) => item.variables.map((variable) => variable.name));
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name).toMatch(/^[A-Z][A-Z0-9_]+$/);
  });

  it("keeps the house voice: no exclamation marks, every line ends", () => {
    const lines = [
      VARIABLE_IN_ONE_LINE,
      ...VERCEL_STEPS,
      ...TEST_ORDER_STEPS,
      ...SERVICES.flatMap((item) => [
        item.unlocks,
        item.without,
        ...item.steps,
        ...item.variables.map((variable) => variable.what),
      ]),
    ];
    for (const line of lines) {
      expect(line).not.toContain("!");
      expect(line.length).toBeGreaterThan(8);
    }
  });
});
