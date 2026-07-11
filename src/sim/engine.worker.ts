// The real Worker entry point. Kicks off the wasm engine init immediately on
// module load (Vite's `?url` import emits the wasm as a hashed asset — this
// is the ONLY file that imports it, keeping every other chunk lazy/engine-free)
// and awaits readiness at the head of the message handler, so requests
// arriving before init completes are QUEUED (via promise chaining), never
// dropped. Readiness goes through `createReadyGate` rather than a one-shot
// module-level promise: after a REJECTED init attempt (transient network blip
// fetching the wasm), the next message re-invokes `initEngineFromUrl` — whose
// own memo also clears on reject, so the retry genuinely re-fetches — instead
// of every future message chaining onto a permanently-rejected promise.
//
// Deliberately no client-side ready-handshake: the protocol (`SimRequest` in,
// `SimResponse` out) is unchanged from before this task. All per-message
// logic (`handleSimRequest`, `dispatchWhenReady`, `createReadyGate`) lives in
// `./worker-core` so node-environment tests can exercise it without pulling
// in this `?url` asset import, which needs a real fetchable URL that only
// exists under a real Worker/browser (or the Vite dev/build pipeline) — not
// plain node vitest.
import wasmUrl from './vendor/pkg/uma_sim_wasm_bg.wasm?url';
import { initEngineFromUrl } from './init';
import { createReadyGate, dispatchWhenReady } from './worker-core';
import type { SimRequest, SimResponse } from './types';

const ensureReady = createReadyGate(() => initEngineFromUrl(wasmUrl));

declare const self: { onmessage: ((e: { data: SimRequest }) => void) | null; postMessage: (m: SimResponse) => void } | undefined;
if (typeof self !== 'undefined' && 'postMessage' in (self as object)) {
  const worker = self as NonNullable<typeof self>;
  // Warm-start init eagerly at worker startup. A failure here is NOT fatal —
  // swallow it (avoids an unhandled-rejection event); each message re-checks
  // readiness via `ensureReady()`, which retries after a rejected attempt.
  void ensureReady().catch(() => {});
  worker.onmessage = (e) => {
    // On init failure the pending request resolves to an honest {ok:false}
    // error SimResponse (dispatchWhenReady) instead of hanging the caller.
    void dispatchWhenReady(ensureReady, e.data).then((res) => worker.postMessage(res));
  };
}
