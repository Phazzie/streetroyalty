import { createHash } from "node:crypto";
import type { Recipient } from "../pod/types.ts";

export type CheckoutLineId = {
  designId: string;
  variantId: string;
  quantity: number;
  colorwayId?: string;
};

/** Same account, same cart, same ship-to. A retry matches. A new address does not. */
export function checkoutAttemptKey(
  userId: string,
  lines: CheckoutLineId[],
  shippingMethod: string,
  recipient: Recipient,
): string {
  const cart = [...lines]
    .map((line) => `${line.designId}:${line.variantId}:${line.colorwayId ?? ""}:${line.quantity}`)
    .sort()
    .join("|");
  const shipTo = [
    recipient.name,
    recipient.address1,
    recipient.address2 ?? "",
    recipient.city,
    recipient.stateCode,
    recipient.countryCode,
    recipient.zip,
    recipient.email ?? "",
    shippingMethod,
  ].join("|");
  return createHash("sha256").update(`${userId}|${cart}|${shipTo}`).digest("hex");
}
