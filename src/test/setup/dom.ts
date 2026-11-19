import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";
import { installStorage } from "../memory-storage.ts";

// Fresh, empty storage for every test, the same on every Node version.
installStorage();

beforeEach(() => {
  installStorage();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
