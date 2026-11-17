import { setupServer } from "msw/node";

/**
 * One network for every integration test. A request with no handler fails the
 * test, so nothing here can reach Stripe, Printful, Fourthwall or xAI by accident.
 */
export const server = setupServer();

export type Seen = { method: string; url: string; body: string; headers: Headers };

/** Every request that left the app during the current test. */
export const seen: Seen[] = [];

server.events.on("request:start", ({ request }) => {
  const copy = request.clone();
  const entry: Seen = { method: copy.method, url: copy.url, body: "", headers: copy.headers };
  seen.push(entry);
  void copy.text().then((text) => {
    entry.body = text;
  });
});

export function seenTo(host: string): Seen[] {
  return seen.filter((entry) => new URL(entry.url).host === host);
}
