import { createSandboxProvider } from "@/lib/pod/sandbox.ts";
import { PodError, type PodProvider } from "@/lib/pod/types.ts";

export type FakePrinter = PodProvider & {
  /** Orders the printer has accepted for printing. */
  confirmed: Set<string>;
  /** Every confirm request, accepted or not, in order. */
  asked: string[];
  /** While true the printer refuses everything, like an outage. */
  down: boolean;
  /** While true, reading an order back fails too. */
  blind: boolean;
  /** What it says when asked to confirm an order it already has. */
  repeatMessage: string;
};

/**
 * A printer that keeps score. It behaves like the sandbox for everything but
 * confirmation, where it records each request so a test can say how many times
 * an order was sent to print.
 */
export function fakePrinter(): FakePrinter {
  const base = createSandboxProvider(new Map());
  const printer: FakePrinter = {
    ...base,
    confirmed: new Set(),
    asked: [],
    down: false,
    blind: false,
    repeatMessage: "Order is already confirmed",
    async confirmOrder(orderId) {
      printer.asked.push(orderId);
      if (printer.down) throw new PodError("Printer is unavailable", 503);
      if (printer.confirmed.has(orderId)) throw new PodError(printer.repeatMessage, 409);
      printer.confirmed.add(orderId);
      return { id: orderId, status: "pending", confirmed: true };
    },
    async getOrder(orderId) {
      if (printer.blind || printer.down) throw new PodError("Printer is unavailable", 503);
      const confirmed = printer.confirmed.has(orderId);
      return { id: orderId, status: confirmed ? "pending" : "draft", confirmed };
    },
  };
  return printer;
}
