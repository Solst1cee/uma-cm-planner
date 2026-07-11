import { evalSkillDelta, runVacuumCompare, runPlannerCompare, runSkillTrace, skillImpact, runRaceCompare } from './run';
import type { SimRequest, SimResponse } from './types';

/**
 * Wrap an init factory into a retrying "ready gate". While the current
 * attempt is pending or has FULFILLED, every call returns that same promise
 * (one init, shared by all queued messages). After a REJECTED attempt the
 * memo clears, so the NEXT call re-invokes the factory — a transient failure
 * (e.g. a network blip fetching the wasm asset) costs the requests that were
 * pending at the time an error response, but the next message retries init
 * instead of the worker staying bricked on a permanently-rejected promise.
 * Mirrors `init.ts`'s clear-on-reject memo pattern (whose own url-level memo
 * also clears on reject, so the retried factory call genuinely re-fetches);
 * extracted here so the retry behavior is unit-testable without a Worker shell.
 */
export function createReadyGate(init: () => Promise<void>): () => Promise<void> {
  let ready: Promise<void> | null = null;
  return () => {
    if (!ready) {
      ready = init().catch((err: unknown) => {
        ready = null;
        throw err;
      });
    }
    return ready;
  };
}

/**
 * Await engine readiness, then dispatch. If init fails, resolves to an honest
 * `{ok:false}` SimResponse (never rejects, never hangs the caller) — the same
 * error channel `handleSimRequest` itself uses, so the protocol is unchanged.
 * This is the whole per-message behavior of the real worker (`engine.worker.ts`)
 * minus the `self`/postMessage shell, kept here so it's node-testable.
 */
export function dispatchWhenReady(ensureReady: () => Promise<void>, req: SimRequest): Promise<SimResponse> {
  return ensureReady().then(
    () => handleSimRequest(req),
    (err: unknown): SimResponse => ({
      id: req.id,
      ok: false,
      error: `sim engine failed to initialize: ${err instanceof Error ? err.message : String(err)}`,
    }),
  );
}

/**
 * Pure request handler — unit-testable without a real Worker. Runs the SYNC
 * wasm entries in `run.ts`, so callers must ensure the engine is already
 * initialized (the real worker inits at startup, see `engine.worker.ts`; node
 * tests do `beforeAll(initEngineFromFs)`).
 *
 * Deliberately free of any `?url`/`?worker` asset import — the worker entry
 * (`engine.worker.ts`) is the ONLY module that pulls in the wasm asset URL,
 * so this file stays importable from plain node-environment tests.
 */
export function handleSimRequest(req: SimRequest): SimResponse {
  try {
    switch (req.kind) {
      case 'skillDelta':
        return { id: req.id, ok: true, kind: 'skillDelta', stats: evalSkillDelta(req.build, req.race, req.skillId, req.nsamples, req.seed) };
      case 'planner':
        return { id: req.id, ok: true, kind: 'planner', stats: runPlannerCompare(req.build, req.race, req.candidateSkills, req.nsamples, req.seed) };
      case 'vacuum':
        return { id: req.id, ok: true, kind: 'vacuum', stats: runVacuumCompare(req.a, req.b, req.race, req.nsamples, req.seed, req.opts) };
      case 'skillTrace':
        return { id: req.id, ok: true, kind: 'skillTrace', trace: runSkillTrace(req.build, req.race, req.skillId, req.nsamples, req.seed) };
      case 'skillImpact':
        return { id: req.id, ok: true, kind: 'skillImpact', impact: skillImpact(req.build, req.race, req.skillId, req.nsamples, req.seed) };
      case 'raceCompare':
        return { id: req.id, ok: true, kind: 'raceCompare', result: runRaceCompare(req.uma1, req.uma2, req.race, req.nsamples, req.seed) };
    }
  } catch (e) {
    return { id: req.id, ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
