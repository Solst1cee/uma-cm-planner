import { evalSkillDelta, runVacuumCompare, runPlannerCompare, runSkillTrace, skillImpact, runRaceCompare } from './run';
import type { SimRequest, SimResponse } from './types';

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
