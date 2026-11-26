import { createServerFn } from "@tanstack/react-start";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The address customers write to, from SHOP_EMAIL. Null until the shop sets one. */
export function shopEmail(env: NodeJS.ProcessEnv = process.env): string | null {
  const value = String(env.SHOP_EMAIL ?? "").trim();
  return EMAIL.test(value) ? value : null;
}

export const getShopContact = createServerFn({ method: "GET" }).handler(async () => ({
  email: shopEmail(),
}));
