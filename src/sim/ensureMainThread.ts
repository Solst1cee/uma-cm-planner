// Main-thread engine-init seam. run.ts's SYNC entries (evalSkillDelta /
// runPlannerCompare, used by M2's rankBaskets on the main thread) deliberately
// do NOT auto-init — calling one before the wasm engine is initialized throws
// from the uninitialized pkg glue. The worker inits via `engine.worker.ts`, but
// that is a separate module graph/instance and does not help a main-thread
// caller. This module is the main-thread counterpart of that worker init.
//
// Like `engine.worker.ts`, this is the ONLY main-thread file that imports the
// wasm asset URL (Vite's `?url` emits it as a hashed asset). To keep that asset
// OUT of every eager UI chunk, this module must be reached ONLY via a dynamic
// `import('@/sim/ensureMainThread')` from an already-lazy chunk (the M2
// optimizer chunk) — never statically imported by eager UI code.
import wasmUrl from './vendor/pkg/uma_sim_wasm_bg.wasm?url';
import { initEngineFromUrl } from './init';

/**
 * Ensure the wasm engine is initialized on the MAIN thread. Idempotent +
 * retry-on-reject via `initEngineFromUrl`'s own memo (a second call returns the
 * same settled promise; a rejected attempt clears the memo so the next call
 * retries the fetch). Every main-thread engine consumer (M2's `rankBaskets`
 * under REAL_DEPS) MUST await this before invoking a sync `run.ts` entry.
 */
export function ensureMainThreadEngine(): Promise<void> {
  return initEngineFromUrl(wasmUrl);
}
