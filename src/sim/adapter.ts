// Pure, engine-free build→engine mapping helpers shared by the v0.27.0 WASM
// adapter (`wasmAdapter.ts`). Deliberately carries NO runtime import of the
// vendored engine bundle (the type-only imports below are erased at build) so it
// stays a tiny chunk — `courseData.ts`/`courseCatalog.ts` (lazily imported by UI)
// and `wasmAdapter.ts` (the worker) all reach it without dragging in the engine.
//
// The old TS-engine-only exports (`toRunnerState`/`resolveCourse`/`bashinStatsFrom`)
// were removed when the v0.14.2 bundle was deleted: the WASM path builds runners via
// `wasmAdapter.toWasmRunner`, resolves courses via `courseData`/`wasmAdapter`, and
// projects stats inside `run.ts` (its own local `bashinStatsFrom` over the WASM
// compare rounds).
import type { IRunnerState, RaceDef } from '@/sim/vendor/umalator-wasm.bundle.mjs';
import type { Strategy, SimRaceParams } from './types';

export const STRATEGY_LABEL: Record<Strategy, IRunnerState['strategy']> = {
  front: 'Front Runner',
  pace: 'Pace Chaser',
  late: 'Late Surger',
  end: 'End Closer',
};

export function toRaceDef(race: SimRaceParams): RaceDef {
  return {
    ground: race.ground ?? 1,
    weather: race.weather ?? 1,
    season: race.season ?? 3,
    time: race.time ?? 2,
    grade: race.grade ?? 100,
  };
}
