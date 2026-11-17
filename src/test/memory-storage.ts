/**
 * The Web Storage API, in memory. Component tests use this for localStorage and
 * sessionStorage instead of whatever the runtime offers, because that differs:
 * older Node has none, and newer Node has a built-in localStorage that is
 * undefined unless Node is started with a storage file, and it shadows the one
 * the DOM test environment would provide.
 */
export class MemoryStorage implements Storage {
  #items = new Map<string, string>();

  get length(): number {
    return this.#items.size;
  }

  clear(): void {
    this.#items.clear();
  }

  getItem(key: string): string | null {
    return this.#items.get(String(key)) ?? null;
  }

  key(index: number): string | null {
    return [...this.#items.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.#items.delete(String(key));
  }

  setItem(key: string, value: string): void {
    this.#items.set(String(key), String(value));
  }
}

/** Give the test its own empty localStorage and sessionStorage, whatever the runtime had there. */
export function installStorage(): void {
  for (const name of ["localStorage", "sessionStorage"] as const) {
    const storage = new MemoryStorage();
    for (const target of new Set([globalThis, globalThis.window].filter(Boolean))) {
      Object.defineProperty(target, name, { value: storage, configurable: true, writable: true });
    }
  }
}
