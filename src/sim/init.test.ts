// @vitest-environment node
//
// Each test gets FRESH module state (vi.resetModules + dynamic import) so the
// per-test memoization assertions are about that test's own calls, not
// leftovers from a sibling test. The real vendor bundle + real wasm bytes are
// used everywhere except the reject-retry tests, which vi.doMock the bundle's
// `initWasm` with a fail-once-then-succeed stub — that keeps init.ts's OWN
// memo-clear/retry branching under test (initWasm is the external boundary).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServer, type Server } from 'node:http';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WASM_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'vendor/pkg/uma_sim_wasm_bg.wasm'
);

async function freshInit() {
  vi.resetModules();
  return await import('./init');
}

/** Serve the committed wasm bytes over local http; counts requests. */
function serveWasm(): Promise<{ url: string; server: Server; requests: () => number }> {
  const bytes = readFileSync(WASM_PATH);
  let count = 0;
  return new Promise((resolve) => {
    const server = createServer((_req, res) => {
      count += 1;
      res.writeHead(200, { 'Content-Type': 'application/wasm' });
      res.end(bytes);
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve({
        url: `http://127.0.0.1:${port}/uma_sim_wasm_bg.wasm`,
        server,
        requests: () => count,
      });
    });
  });
}

const cleanups: Array<() => Promise<void> | void> = [];
afterEach(async () => {
  while (cleanups.length > 0) {
    await cleanups.pop()!();
  }
  vi.doUnmock('./vendor/umalator-wasm.bundle.mjs');
  vi.unstubAllGlobals();
});

function withServer(): Promise<{ url: string; requests: () => number }> {
  return serveWasm().then(({ url, server, requests }) => {
    cleanups.push(() => new Promise<void>((r) => server.close(() => r())));
    return { url, requests };
  });
}

/** Stub the bundle's initWasm to reject `failures` times, then succeed. */
function mockBundleInitWasm(failures: number) {
  let calls = 0;
  const initWasm = vi.fn(() => {
    calls += 1;
    return calls <= failures
      ? Promise.reject(new Error(`init boom ${calls}`))
      : Promise.resolve(undefined);
  });
  vi.doMock('./vendor/umalator-wasm.bundle.mjs', () => ({ initWasm }));
  return initWasm;
}

describe('initEngineFromFs', () => {
  it('resolves', async () => {
    const { initEngineFromFs } = await freshInit();
    await expect(initEngineFromFs()).resolves.toBeUndefined();
  });

  it('is idempotent — a second call returns the same (already-settled) promise', async () => {
    const { initEngineFromFs } = await freshInit();
    const first = initEngineFromFs();
    const second = initEngineFromFs();
    expect(second).toBe(first);
    await expect(second).resolves.toBeUndefined();
  });

  it('does NOT cache a rejection — a failed init retries on the next call and can succeed', async () => {
    mockBundleInitWasm(1);
    const { initEngineFromFs } = await freshInit();
    await expect(initEngineFromFs()).rejects.toThrow('init boom 1');
    // Memo must be cleared at BOTH layers (fsReady + initEngine's ready):
    // if either still held the rejected promise, this second call would
    // replay 'init boom 1' instead of reaching the now-succeeding initWasm.
    await expect(initEngineFromFs()).resolves.toBeUndefined();
  });
});

describe('initEngineFromUrl', () => {
  it('resolves against a real http server and is idempotent (same promise, no re-fetch)', async () => {
    const { url, requests } = await withServer();
    const { initEngineFromUrl } = await freshInit();
    const first = initEngineFromUrl(url);
    await expect(first).resolves.toBeUndefined();
    const fetches = requests();
    expect(fetches).toBeGreaterThanOrEqual(1);
    const second = initEngineFromUrl(url);
    expect(second).toBe(first);
    await expect(second).resolves.toBeUndefined();
    expect(requests()).toBe(fetches); // memoized — no additional fetch
  });

  it('falls back to fetch+buffer+compile when compileStreaming fails', async () => {
    const { url, requests } = await withServer();
    const { initEngineFromUrl } = await freshInit();
    const origCompileStreaming = WebAssembly.compileStreaming;
    WebAssembly.compileStreaming = () => {
      throw new Error('streaming unavailable');
    };
    cleanups.push(() => {
      WebAssembly.compileStreaming = origCompileStreaming;
    });
    await expect(initEngineFromUrl(url)).resolves.toBeUndefined();
    // Streaming attempt fetched once, then the fallback fetched again —
    // proving the catch branch (buffer + WebAssembly.compile) actually ran.
    expect(requests()).toBe(2);
  });

  it('does NOT cache a rejection — a transient fetch failure retries on the next call', async () => {
    const { url, requests } = await withServer();
    const { initEngineFromUrl } = await freshInit();
    const realFetch = globalThis.fetch;
    let networkDown = true;
    vi.stubGlobal('fetch', (...args: Parameters<typeof fetch>) =>
      networkDown ? Promise.reject(new Error('network down')) : realFetch(...args)
    );
    // Both the streaming attempt AND the buffer fallback fail while the
    // network is down, so the whole attempt rejects...
    await expect(initEngineFromUrl(url)).rejects.toThrow('network down');
    expect(requests()).toBe(0);
    // ...and the memo is cleared: once the network is back, the next call
    // re-fetches and succeeds (instead of replaying the cached rejection).
    networkDown = false;
    await expect(initEngineFromUrl(url)).resolves.toBeUndefined();
    expect(requests()).toBeGreaterThanOrEqual(1);
  });
});
