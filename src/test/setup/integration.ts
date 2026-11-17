import { afterAll, afterEach, beforeAll, beforeEach, vi } from "vitest";
import { seen, server } from "../msw/server.ts";
import { resetRequest } from "../request.ts";

vi.mock("@tanstack/react-start/server", async () => {
  const request = await import("../request.ts");
  return {
    getRequest: () => request.currentRequest(),
    getCookie: (name: string) => {
      const header = request.currentRequest().headers.get("cookie") ?? "";
      for (const part of header.split(";")) {
        const [key, ...rest] = part.trim().split("=");
        if (key === name) return decodeURIComponent(rest.join("="));
      }
      return undefined;
    },
    setCookie: () => undefined,
  };
});

/** Anything a developer's shell or CI might carry that would change which mode the app runs in. */
const AMBIENT = [
  "XAI_API_KEY",
  "POD_MODE",
  "PAYMENTS_MODE",
  "PRINTFUL_API_KEY",
  "PRINTFUL_STORE_ID",
  "PRINTFUL_WEBHOOK_SECRET",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "PRINT_FILE_SIGNING_SECRET",
  "APP_PUBLIC_URL",
  "STUDIO_MARKUP",
  "STUDIO_ADMIN_EMAILS",
  "FOURTHWALL_STOREFRONT_TOKEN",
  "FOURTHWALL_CHECKOUT_DOMAIN",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "AI_VISITOR_IMAGE",
  "AI_VISITOR_VIDEO",
  "AI_VISITOR_TEXT",
  "AI_DAILY_IMAGE",
  "AI_DAILY_VIDEO",
  "AI_DAILY_TEXT",
];

/** Module-level caches the app keeps on globalThis so they survive hot reloads. */
const CACHES = [
  "__srStorefront__",
  "__srProductPhotos__",
  "__srAiUsage__",
  "__srSandboxOrders",
  "__srSandboxSeq",
];

let envBefore: NodeJS.ProcessEnv = {};

process.env.TZ = "UTC";

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});

beforeEach(() => {
  envBefore = { ...process.env };
  for (const name of AMBIENT) delete process.env[name];
  resetRequest();
  seen.length = 0;
});

afterEach(() => {
  server.resetHandlers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  for (const name of Object.keys(process.env)) {
    if (!(name in envBefore)) delete process.env[name];
  }
  Object.assign(process.env, envBefore);
  const globals = globalThis as Record<string, unknown>;
  for (const name of CACHES) delete globals[name];
});

afterAll(() => {
  server.close();
});
