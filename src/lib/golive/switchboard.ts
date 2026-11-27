import { readLimits, type AiKind, type AiLimits } from "../ai/limits.ts";
import { assertLivePaymentHasPrinter } from "../pod/order-flow.ts";
import { readPaymentsMode, readPodMode, stripeKeyMismatch } from "../pod/index.ts";
import { printSigningSecret } from "../pod/print-access.ts";
import type { PaymentsMode, PodMode } from "../pod/types.ts";
import { SERVICES, serviceSpec, type ServiceId } from "./services.ts";

/**
 * What is on, what is off and what is missing, read from the environment.
 *
 * Pure: it takes the environment as an argument and returns plain data. It
 * decides with the same functions the app itself runs on (readPodMode,
 * readPaymentsMode, printSigningSecret, assertLivePaymentHasPrinter,
 * readLimits), so the board cannot say live while checkout says
 * sandbox.
 *
 * It reports the NAMES of settings and whether each one is present. It never
 * returns a setting's value, its length or any part of it. The daily caps are
 * the one exception: they are plain numbers, not secrets, and are reported as
 * the app parsed them.
 */

export type Lamp = "on" | "partly" | "off";

export type Env = Record<string, string | undefined>;

export type VariableReport = {
  name: string;
  need: "needed" | "optional";
  /** Present and not blank. Nothing else about it is known to the caller. */
  set: boolean;
};

export type ServiceReport = {
  id: ServiceId;
  lamp: Lamp;
  /** What it unlocks for a customer, in one plain sentence. */
  unlocks: string;
  /** What is true right now. */
  now: string;
  /** Names of needed settings that are not there. */
  missing: string[];
  variables: VariableReport[];
  /** Other switches this one is held back by. */
  waitsOn: ServiceId[];
  /** Anything odd, such as a mode setting holding a ready service in sandbox. */
  notes: string[];
};

export type Switchboard = {
  services: ServiceReport[];
  /** The first switch that is not fully on, in the order to do them. */
  next: ServiceId | null;
  /** True when a customer can get through checkout with a real card. */
  canPay: boolean;
  /** True when an order outlives a server restart. A paid order that does not is a lost order. */
  ordersKept: boolean;
  podMode: PodMode | "unset";
  paymentsMode: PaymentsMode;
  caps: AiLimits;
};

function has(env: Env, name: string): boolean {
  return Boolean(env[name]?.trim());
}

function throws(run: () => unknown): boolean {
  try {
    run();
    return false;
  } catch {
    return true;
  }
}

type Reading = {
  lamp: Lamp;
  now: string;
  waitsOn?: ServiceId[];
  notes?: string[];
  /** Settings that are present but hold nothing usable, and so count as missing. */
  empty?: string[];
};

function build(id: ServiceId, env: Env, reading: Reading): ServiceReport {
  const spec = serviceSpec(id);
  const variables = spec.variables.map((variable) => ({
    name: variable.name,
    need: variable.need,
    set: has(env, variable.name) && !reading.empty?.includes(variable.name),
  }));
  return {
    id,
    lamp: reading.lamp,
    unlocks: spec.unlocks,
    now: reading.now,
    missing: variables
      .filter((variable) => variable.need === "needed" && !variable.set)
      .map((variable) => variable.name),
    variables,
    waitsOn: reading.waitsOn ?? [],
    notes: reading.notes ?? [],
  };
}

function readAdmins(env: Env): Reading {
  // The same split isStudioAdmin does: a list of blanks and commas is no list.
  const listed = (env.STUDIO_ADMIN_EMAILS ?? "").split(",").some((item) => item.trim());
  return listed
    ? { lamp: "on", now: "The emails on the list can read this board live." }
    : { lamp: "off", now: serviceSpec("admins").without, empty: ["STUDIO_ADMIN_EMAILS"] };
}

function readDatabase(env: Env): Reading {
  // db.ts treats a blank DATABASE_URL as unset and falls back to memory.
  return has(env, "DATABASE_URL")
    ? { lamp: "on", now: "Accounts, saved designs and orders are kept." }
    : { lamp: "off", now: serviceSpec("database").without };
}

function readSignIn(env: Env, databaseOn: boolean): Reading {
  if (env.VITE_AUTH_ENABLED?.trim() === "false") {
    return {
      lamp: "off",
      now: "Sign-in is switched off for the whole site.",
      notes: ["VITE_AUTH_ENABLED is set to false. Delete it to let people sign in."],
    };
  }
  const secret = has(env, "BETTER_AUTH_SECRET");
  const url = has(env, "BETTER_AUTH_URL");
  if (!secret && !url) return { lamp: "off", now: serviceSpec("signin").without };
  if (!secret)
    return { lamp: "partly", now: "Everyone is signed out whenever the server restarts." };
  if (!url) return { lamp: "partly", now: "Sign-in may refuse your real web address." };
  if (!databaseOn) {
    return {
      lamp: "partly",
      now: "Sign-in is set, but accounts still vanish when the server restarts.",
      waitsOn: ["database"],
    };
  }
  return { lamp: "on", now: "People make an account once and stay signed in." };
}

function readPrinting(env: Env): Reading {
  let mode: PodMode;
  try {
    mode = readPodMode(env);
  } catch (error) {
    return {
      lamp: "off",
      now:
        error instanceof Error
          ? error.message
          : "Set POD_MODE to sandbox or live.",
    };
  }
  if (mode === "sandbox") {
    return {
      lamp: "off",
      now: serviceSpec("printing").without,
      notes: has(env, "PRINTFUL_API_KEY")
        ? [
            "POD_MODE is set to sandbox, so the Printful key is ignored. Set POD_MODE to live to print for real.",
          ]
        : [],
    };
  }
  if (!has(env, "PRINTFUL_API_KEY")) {
    return {
      lamp: "partly",
      now: "Printing is switched to live with no Printful key, so the studio cannot load anything.",
      notes: ["POD_MODE is set to live. Add the key, or set POD_MODE to sandbox to practice."],
    };
  }
  if (!has(env, "PRINTFUL_STORE_ID")) {
    return {
      lamp: "partly",
      now: "Printing is switched to live with no Printful store, so orders have nowhere to go.",
      empty: ["PRINTFUL_STORE_ID"],
    };
  }
  if (throws(() => printSigningSecret(env, mode))) {
    return {
      lamp: "partly",
      now: "Printful is connected, but the site will not hand over print files without PRINT_FILE_SIGNING_SECRET, so mockups and publishing fail.",
    };
  }
  if (!has(env, "APP_PUBLIC_URL")) {
    return {
      lamp: "partly",
      now: "The site is guessing its own address. Printful downloads print files from it, so set APP_PUBLIC_URL.",
    };
  }
  if (!has(env, "PRINTFUL_WEBHOOK_SECRET")) {
    return {
      lamp: "partly",
      now: "Orders get made and shipped, but the site never hears about it, so the orders page stays stuck.",
    };
  }
  return { lamp: "on", now: "Paid orders go to Printful to be made and shipped." };
}

function readPodModeOrUnset(env: Env): PodMode | "unset" {
  try {
    return readPodMode(env);
  } catch {
    return "unset";
  }
}

function readPayments(env: Env, databaseOn: boolean): Reading {
  const mode = readPaymentsMode(env);
  if (mode === "sandbox") {
    return {
      lamp: "off",
      now: serviceSpec("payments").without,
      notes: has(env, "STRIPE_SECRET_KEY")
        ? [
            "PAYMENTS_MODE is not set to test or live, so the Stripe key is ignored. Set it to test to try Stripe with test cards, or live to take real cards.",
          ]
        : [],
    };
  }
  if (!has(env, "STRIPE_SECRET_KEY")) {
    return {
      lamp: "partly",
      now: `Checkout is switched to ${mode} with no Stripe key, so it fails for everyone.`,
      notes: [
        `PAYMENTS_MODE is set to ${mode}. Add the key, or set PAYMENTS_MODE to sandbox to practice.`,
      ],
    };
  }
  const mismatch = stripeKeyMismatch(mode, env.STRIPE_SECRET_KEY);
  if (mismatch) {
    return {
      lamp: "partly",
      now: "Checkout refuses to start because the Stripe key is the wrong kind.",
      notes: [mismatch],
    };
  }
  if (mode === "test") {
    if (readPodModeOrUnset(env) === "live") {
      return {
        lamp: "partly",
        now: "Stripe test cards are on, but printing is live, so checkout refuses: a test card must never order a real garment.",
        notes: ["Set POD_MODE to sandbox while testing, or PAYMENTS_MODE to live with a live key."],
      };
    }
    if (!has(env, "STRIPE_WEBHOOK_SECRET")) {
      return {
        lamp: "partly",
        now: "Checkout opens Stripe with test cards. No real money moves. Add the webhook secret so a closed tab still records the order.",
        notes: ["Test mode. Switch PAYMENTS_MODE to live with a live key to take real cards."],
      };
    }
    return {
      lamp: "partly",
      now: "Checkout runs through Stripe with test cards (4242 4242 4242 4242). No real money moves and nothing is printed.",
      notes: ["Test mode. Switch PAYMENTS_MODE to live with a live key to take real cards."],
    };
  }
  if (throws(() => assertLivePaymentHasPrinter(readPodMode(env), mode))) {
    return {
      lamp: "partly",
      now: "Stripe is ready, but checkout refuses real money while printing is in sandbox.",
      waitsOn: ["printing"],
    };
  }
  if (!databaseOn) {
    return {
      lamp: "partly",
      now: "People can pay, but the order is only held in the server's memory and is lost when it restarts.",
      waitsOn: ["database"],
    };
  }
  if (!has(env, "STRIPE_WEBHOOK_SECRET")) {
    return {
      lamp: "partly",
      now: "People can pay. But if someone closes the tab before the site sees them come back, their order is never sent to print.",
    };
  }
  return { lamp: "on", now: "People can pay with a real card." };
}

const KIND_WORDS: Record<AiKind, string> = {
  image: "pictures",
  video: "video",
  text: "written answers",
};

function readPictures(env: Env, caps: AiLimits): Reading {
  if (!has(env, "XAI_API_KEY")) return { lamp: "off", now: serviceSpec("pictures").without };
  const kinds: AiKind[] = ["image", "video", "text"];
  const zeroed = kinds.filter((kind) => caps[kind].visitor === 0 || caps[kind].global === 0);
  if (zeroed.length > 0) {
    const words = zeroed.map((kind) => KIND_WORDS[kind]).join(" and ");
    return {
      lamp: "partly",
      now: `Switched on, but ${words} ${zeroed.length === 1 && zeroed[0] === "video" ? "is" : "are"} capped at zero, which turns ${zeroed.length === 1 ? "it" : "them"} off.`,
    };
  }
  return {
    lamp: "on",
    now: "People can generate art, try pieces on and walk a look, up to the daily caps.",
  };
}

export function switchboard(env: Env): Switchboard {
  const caps = readLimits(env);
  const podMode = readPodModeOrUnset(env);
  const paymentsMode = readPaymentsMode(env);
  const database = readDatabase(env);
  const readings: Record<ServiceId, Reading> = {
    admins: readAdmins(env),
    database,
    signin: readSignIn(env, database.lamp === "on"),
    payments: readPayments(env, database.lamp === "on"),
    printing: readPrinting(env),
    pictures: readPictures(env, caps),
  };
  const services = SERVICES.map((spec) => build(spec.id, env, readings[spec.id]));
  const canPay =
    paymentsMode === "live" &&
    podMode === "live" &&
    has(env, "STRIPE_SECRET_KEY") &&
    stripeKeyMismatch("live", env.STRIPE_SECRET_KEY) === null &&
    has(env, "PRINTFUL_API_KEY");
  return {
    services,
    next: services.find((service) => service.lamp !== "on")?.id ?? null,
    canPay,
    ordersKept: database.lamp === "on",
    podMode,
    paymentsMode,
    caps,
  };
}
