import { createServerFn } from "@tanstack/react-start";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The shop's inbox, chosen by the owner on 2026-11-26. SHOP_EMAIL overrides it. */
export const DEFAULT_SHOP_EMAIL = "chey@cheysociety.com";

/** The address customers write to: SHOP_EMAIL when it is a real address, else the shop's inbox. */
export function shopEmail(env: NodeJS.ProcessEnv = process.env): string {
  const value = String(env.SHOP_EMAIL ?? "").trim();
  return EMAIL.test(value) ? value : DEFAULT_SHOP_EMAIL;
}

export const getShopContact = createServerFn({ method: "GET" }).handler(async () => ({
  email: shopEmail(),
}));
