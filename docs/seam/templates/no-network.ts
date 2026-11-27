// Seam kit test setup. LOCKED in build phase (it lives in tests/).
// In mock mode (the default) every network door is shut, so a "green" test can only mean the code works
// against the saved probe fixtures. A test that secretly calls a real service fails loudly here.
// In real mode (npm run test:real) nothing is blocked.
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';

const mode = process.env.SEAM_MODE === 'real' ? 'real' : 'mock';

class NetworkBlockedError extends Error {
  constructor(what: string) {
    super(`[seam] Network is blocked in mock mode (${what}). Use a mock built from probes/fixtures, or move this test to tests/real/.`);
    this.name = 'NetworkBlockedError';
  }
}

function isLoopback(host: unknown): boolean {
  return host === undefined || host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

if (mode === 'mock') {
  globalThis.fetch = (input: string | URL | Request) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    return Promise.reject(new NetworkBlockedError(`fetch ${url}`));
  };
  const block = (name: string) => () => {
    throw new NetworkBlockedError(name);
  };
  http.request = block('http.request') as typeof http.request;
  http.get = block('http.get') as typeof http.get;
  https.request = block('https.request') as typeof https.request;
  https.get = block('https.get') as typeof https.get;
  const realConnect = net.Socket.prototype.connect;
  net.Socket.prototype.connect = function patchedConnect(this: net.Socket, ...args: unknown[]) {
    const first = Array.isArray(args[0]) ? (args[0] as unknown[])[0] : args[0]; // Node passes [options, cb] internally
    let host: unknown;
    let isPipe = false;
    if (typeof first === 'number') host = typeof args[1] === 'string' ? args[1] : undefined;
    else if (typeof first === 'string') isPipe = true; // connect(path): local pipe/unix socket
    else if (first && typeof first === 'object') {
      const o = first as { host?: unknown; path?: unknown };
      isPipe = o.path !== undefined;
      host = o.host;
    }
    if (!isPipe && !isLoopback(host)) throw new NetworkBlockedError(`socket connect ${String(host)}`);
    return (realConnect as (...a: unknown[]) => net.Socket).apply(this, args);
  } as typeof net.Socket.prototype.connect;
  if ('WebSocket' in globalThis) {
    (globalThis as { WebSocket: unknown }).WebSocket = class {
      constructor(url: string) {
        throw new NetworkBlockedError(`WebSocket ${url}`);
      }
    };
  }
}
