/**
 * A live studio checkout opens a Printful draft. Sandbox starts stay local and are not counted.
 * The numbers match the shop: 40 starts for one account, 5000 for the site, per day.
 * The shop counts kind "checkout". The studio uses its own kind so one counter cannot fill the other.
 */

export const STUDIO_CHECKOUT_KIND = "studio-checkout";

export const CHECKOUT_START_CAP = { visitor: 40, global: 5000 };

export const CHECKOUT_LIMIT_MESSAGE = "Too many checkouts started today. Try again tomorrow.";

/** Live checkouts open a Printful draft, test checkouts open a Stripe session: both are capped. */
export function metersLiveCheckout(
  podMode: "live" | "sandbox",
  paymentsMode: "live" | "test" | "sandbox",
): boolean {
  return paymentsMode === "test" || (podMode === "live" && paymentsMode === "live");
}

export async function assertCheckoutStartAllowed(
  podMode: "live" | "sandbox",
  paymentsMode: "live" | "test" | "sandbox",
  userId: string,
): Promise<void> {
  if (!metersLiveCheckout(podMode, paymentsMode)) return;
  const { count } = await import("../ai/guard.server.ts");
  const verdict = await count(STUDIO_CHECKOUT_KIND, CHECKOUT_START_CAP, userId, {
    onStoreError: "closed",
  });
  if (!verdict.ok) throw new Error(CHECKOUT_LIMIT_MESSAGE);
}
