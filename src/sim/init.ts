// Engine init plumbing for the v0.27.0 wasm-pack engine. `initEngine` is the
// shared idempotent core; `initEngineFromFs` (Node — tests, headless scripts)
// and `initEngineFromUrl` (worker/browser) are the two real entry points, and
// both funnel through `initEngine` so a second call anywhere returns the SAME
// promise (never re-inits, never re-reads/re-fetches the wasm bytes).
//
// Like the rest of `src/sim`, this module statically imports the vendor
// bundle (see `adapter.ts`'s precedent) — the lazy-engine discipline is
// callers only reaching this module via a dynamic `import('@/sim/init')` (or,
// for the worker, being the worker chunk itself), not this file dynamically
// importing its own bundle.
//
// Deliberately does NOT run a throwaway warm-up `runCompare` after init: the
// pkg's first `runCompare` call on a fresh instance can differ from later
// calls on that same instance (a one-time lazy-static warm-up inside the Rust
// engine, root-caused in Task 0 — fresh-process determinism holds regardless).
// Init only needs to make the module callable; every real caller already runs
// its own first compare, so an extra warm-up call here would just burn cycles
// without changing anything for the caller.
import { initWasm } from './vendor/umalator-wasm.bundle.mjs';

let ready: Promise<void> | null = null;

/**
 * Initialize the wasm engine exactly once. `source`, when given, is a
 * precompiled `WebAssembly.Module` (skips wasm-bindgen's own fetch+compile).
 * Idempotent: every call after the first returns the SAME promise, regardless
 * of `source` — the engine only ever gets initialized once per realm.
 */
export function initEngine(source?: WebAssembly.Module): Promise<void> {
  if (!ready) {
    ready = (async () => {
      await initWasm(source === undefined ? undefined : { module_or_path: source });
    })();
  }
  return ready;
}

let fsReady: Promise<void> | null = null;

/**
 * Node-only: read the committed wasm bytes from disk, compile, then init.
 * Memoized independently of `initEngine`'s own idempotency — a second call
 * returns the SAME promise instantly, without re-reading the file or
 * re-compiling the module (not just "the engine only inits once").
 */
export function initEngineFromFs(): Promise<void> {
  if (typeof process === 'undefined') {
    throw new Error('initEngineFromFs() is Node-only');
  }
  if (!fsReady) {
    fsReady = (async () => {
      const { readFileSync } = await import('node:fs');
      const path = await import('node:path');
      const { fileURLToPath } = await import('node:url');
      const wasmPath = path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        'vendor/pkg/uma_sim_wasm_bg.wasm'
      );
      const bytes = readFileSync(wasmPath);
      const compiled = await WebAssembly.compile(bytes);
      await initEngine(compiled);
    })();
  }
  return fsReady;
}

let urlReady: Promise<void> | null = null;

/**
 * Worker/browser: fetch + compile the wasm asset from a URL (e.g. Vite's
 * `?url` import of `vendor/pkg/uma_sim_wasm_bg.wasm`), then init. Memoized
 * the same way as `initEngineFromFs` — a second call (even with a different
 * `url`) returns the SAME promise instantly, no re-fetch. Prefers
 * `compileStreaming`; falls back to a plain fetch+buffer+compile if streaming
 * compilation isn't available or the response's Content-Type isn't
 * `application/wasm` (mirrors the pkg glue's own internal fallback).
 */
export function initEngineFromUrl(url: string): Promise<void> {
  if (!urlReady) {
    urlReady = (async () => {
      let compiled: WebAssembly.Module;
      try {
        compiled = await WebAssembly.compileStreaming(fetch(url));
      } catch {
        const bytes = await (await fetch(url)).arrayBuffer();
        compiled = await WebAssembly.compile(bytes);
      }
      await initEngine(compiled);
    })();
  }
  return urlReady;
}
