import { createServerFn } from "@tanstack/react-start";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The shop's inbox, chosen by the owner on 2026-11-26. */
export const DEFAULT_SHOP_EMAIL = "chey@cheysociety.com";

/** The address customers write to. SHOP_EMAIL overrides the shop's own inbox. */
export function shopEmail(env: NodeJS.ProcessEnv = process.env): string {
  const value = String(env.SHOP_EMAIL ?? "").trim();
  return EMAIL.test(value) ? value : DEFAULT_SHOP_EMAIL;
}

export const getShopContact = createServerFn({ method: "GET" }).handler(async () => ({
  email: shopEmail(),
}));
