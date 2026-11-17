import type { FulfillmentResult } from "../pod/order-flow.ts";

/**
 * What to tell a buyer who has just come back from Stripe. The server's answer
 * is not always "it worked", and saying so when the money has not cleared, or
 * the order is on hold, sends people away thinking a shirt is coming.
 */
export function returnNote(result: FulfillmentResult): string {
  if (result.ok) return "Payment landed. The print order was submitted.";
  switch (result.reason) {
    case "in_progress":
      return "Payment landed. The print order is going in now.";
    case "unpaid":
      return "The payment has not cleared yet. Nothing prints until it does. Check back here shortly.";
    case "amount_mismatch":
    case "canceled":
    case "needs_review":
      return "Payment was taken but this order is on hold and has not gone to print. We are looking at it.";
    default:
      return "Payment could not be matched to a print order yet. If you were charged, nothing is lost: contact us with the order below.";
  }
}
