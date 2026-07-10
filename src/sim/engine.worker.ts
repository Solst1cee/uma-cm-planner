// The real Worker entry point. Kicks off the wasm engine init immediately on
// module load (Vite's `?url` import emits the wasm as a hashed asset — this
// is the ONLY file that imports it, keeping every other chunk lazy/engine-free)
// and awaits it at the head of the message handler, so requests arriving
// before init completes are QUEUED (via promise chaining), never dropped.
//
// Deliberately no client-side ready-handshake: the protocol (`SimRequest` in,
// `SimResponse` out) is unchanged from before this task. `handleSimRequest`
// itself lives in `./worker-core` (not here) so node-environment tests can
// import the pure dispatcher without pulling in this `?url` asset import,
// which needs a real fetchable URL that only exists under a real Worker/browser
// (or the Vite dev/build pipeline) — not plain node vitest.
import wasmUrl from './vendor/pkg/uma_sim_wasm_bg.wasm?url';
import { initEngineFromUrl } from './init';
import { handleSimRequest } from './worker-core';
import type { SimRequest, SimResponse } from './types';

const ready = initEngineFromUrl(wasmUrl);

declare const self: { onmessage: ((e: { data: SimRequest }) => void) | null; postMessage: (m: SimResponse) => void } | undefined;
if (typeof self !== 'undefined' && 'postMessage' in (self as object)) {
  const worker = self as NonNullable<typeof self>;
  worker.onmessage = (e) => {
    const req = e.data;
    // Await init before dispatching; on init failure, reply with an honest
    // error SimResponse instead of leaving the caller's promise hanging.
    ready
      .then(() => handleSimRequest(req))
      .catch((err: unknown): SimResponse => ({
        id: req.id,
        ok: false,
        error: `sim engine failed to initialize: ${err instanceof Error ? err.message : String(err)}`,
      }))
      .then((res) => worker.postMessage(res));
  };
}
