import { evalSkillDelta, runVacuumCompare, runPlannerCompare, runSkillTrace, skillImpact, runRaceCompare } from './run';
import type { SimRequest, SimResponse } from './types';

/** Pure request handler — unit-testable without a real Worker. */
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

// Worker shell (ignored under the node test environment, which has no `self`).
declare const self: { onmessage: ((e: { data: SimRequest }) => void) | null; postMessage: (m: SimResponse) => void } | undefined;
if (typeof self !== 'undefined' && 'postMessage' in (self as object)) {
  (self as NonNullable<typeof self>).onmessage = (e) => {
    (self as NonNullable<typeof self>).postMessage(handleSimRequest(e.data));
  };
}
