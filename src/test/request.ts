/**
 * Stands in for the request TanStack Start keeps in async storage. Server code
 * reads it through getRequest(); the integration setup points that here.
 */

const DEFAULT_URL = "https://streetroyalty.test/";

let current: Request | null = null;

export function setRequest(init: { url?: string; headers?: Record<string, string> } = {}): Request {
  current = new Request(init.url ?? DEFAULT_URL, { headers: init.headers });
  return current;
}

/** A visitor at one address, which is what the AI caps count by. */
export function asVisitor(address: string): Request {
  return setRequest({ headers: { "x-real-ip": address } });
}

/** Outside any request, the way a build step or a cron call would run. */
export function clearRequest(): void {
  current = null;
}

export function currentRequest(): Request {
  if (!current) throw new Error("No request in scope.");
  return current;
}

export function resetRequest(): void {
  current = new Request(DEFAULT_URL);
}

resetRequest();
