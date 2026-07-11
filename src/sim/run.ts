// The `src/sim` public entries, rewritten onto the v0.27.0 Rust/WASM engine
// (Task 4 of the sim-wasm-replatform). Every export keeps its EXACT old
// signature + semantics contract — consumers (worker-core, M2 optimizer, the
// M4 hooks) receive byte-compatible shapes.
//
// INIT RESPONSIBILITY: these entries call the bundle's SYNCHRONOUS `runCompare`
// directly and assume the wasm engine has already been initialized by the
// caller — the worker (Task 5) does `initEngineFromUrl` at startup; node tests
// do `beforeAll(initEngineFromFs)`. run.ts deliberately does NOT auto-init: it
// stays free of any coupling to `init.ts` (which owns the fs/url/worker split)
// and the lazy-engine discipline. Calling an entry before init surfaces the
// wasm glue's own uninitialized error; we do not wrap it (a catch-and-rethrow
// here would mask genuine runCompare failures, and every real caller inits
// first). See init.ts's header for the memoization contract.
import {
  runCompare,
  wasmCompareRoundDataToCollected,
  reduceCompareRoundsPublic,
  createCompareSettings,
  compareSettingsToWasm,
  isSameSkill,
  isSimulatable,
  computePositionDiff,
} from '@/sim/vendor/umalator-wasm.bundle.mjs';
import type {
  CompareRounds,
  CompareResult,
  CollectedRunnerRoundData,
  SimulationRun,
  SimulationSettings,
  WasmCompareData,
  WasmCompareRoundData,
} from '@/sim/vendor/umalator-wasm.bundle.mjs';
import { toWasmRunner, toWasmRace } from './wasmAdapter';
import type {
  SimBuild, SimRaceParams, BashinStats, VacuumResult, VacuumOpts, SkillTrace, SkillTraceRun,
  SkillFrame, SkillImpact, SkillImpactSample, RaceCompare, RaceCompareRun, RaceActivation, GapPoint,
} from './types';

const EMPTY: BashinStats = { mean: 0, median: 0, min: 0, max: 0, nsamples: 0, results: [] };

/** Drop baseline skills the engine can't simulate. `isSimulatable` returns false
 *  (no throw) for unknown ids, so this neutralizes the crash vector on the old
 *  engine and stays a faithful filter on the wasm engine (which drops unresolved
 *  ids in `sundayRunnerToWasm`, but the guard mirrors today's behavior exactly).
 *  Kept identical to the pre-wasm contract (drops e.g. inherited-unique 9… ids). */
export function simulatableBase(build: SimBuild): SimBuild {
  return { ...build, skills: build.skills.filter((id) => isSimulatable(id)) };
}

// --- shared vacuum-compare core -------------------------------------------------

/** Locate a contested runner by its 0/1 runnerId (insertion order = uma1/uma2).
 *  Mirrors upstream's `findComparedRunner` (wasm-compare.ts). */
function findComparedRunner(
  runners: WasmCompareRoundData[], runnerId: number, roundIndex: number,
): WasmCompareRoundData {
  const runner = runners.find((r) => r.runnerId === runnerId);
  if (!runner) {
    throw new Error(
      `Missing compared runner ${runnerId} in compare round ${roundIndex}; got [${runners
        .map((r) => r.runnerId).join(', ')}]`,
    );
  }
  return runner;
}

/** Split a WASM compare batch into aligned A/B primary-runner rounds (runnerId 0 = A,
 *  1 = B). Mirrors upstream's `splitContestedCompareRounds`. */
function collectRounds(data: WasmCompareData): CompareRounds {
  const roundsA: CollectedRunnerRoundData[] = [];
  const roundsB: CollectedRunnerRoundData[] = [];
  data.rounds.forEach((round, i) => {
    roundsA.push(wasmCompareRoundDataToCollected(findComparedRunner(round.runners, 0, i)));
    roundsB.push(wasmCompareRoundDataToCollected(findComparedRunner(round.runners, 1, i)));
  });
  return { roundsA, roundsB };
}

/** The single vacuum compare-family primitive shared by every entry: build the two
 *  runners (uma1=a, uma2=b) + course/params/settings, run the SYNC wasm batch, and
 *  return both the raw per-round A/B telemetry and the reduced compare result.
 *  Stamina is always ON (`healthSystem: true`) as it was on the old engine
 *  (`ignoreStaminaConsumption: false`). Multi-fire (`cooldownReactivation`) defaults
 *  ON in the wasm settings — no override here. `settings` overrides (downhill /
 *  staminaDrainOverrides) and per-runner injected debuffs thread through unchanged. */
function vacuumRounds(
  a: SimBuild, b: SimBuild, race: SimRaceParams, nsamples: number, seed: number,
  opts?: {
    settings?: Partial<Omit<SimulationSettings, 'mode'>>;
    aDebuffs?: Array<{ skillId: string; position: number }>;
    bDebuffs?: Array<{ skillId: string; position: number }>;
  },
): { rounds: CompareRounds; result: CompareResult } {
  const { course, parameters } = toWasmRace(race);
  const settings = compareSettingsToWasm(createCompareSettings({ healthSystem: true, ...opts?.settings }));
  const data = runCompare({
    course, parameters, settings,
    runners: [
      toWasmRunner(a, 'uma1', opts?.aDebuffs && opts.aDebuffs.length ? { injectedDebuffs: opts.aDebuffs } : undefined),
      toWasmRunner(b, 'uma2', opts?.bDebuffs && opts.bDebuffs.length ? { injectedDebuffs: opts.bDebuffs } : undefined),
    ],
    nsamples,
    masterSeed: seed,
  });
  const rounds = collectRounds(data);
  const result = reduceCompareRoundsPublic(rounds, nsamples);
  return { rounds, result };
}

function _mean(xs: number[]): number { return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0; }
function _median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  const lo = s[m - 1] ?? 0;
  const hi = s[m] ?? 0;
  return s.length % 2 ? hi : (lo + hi) / 2;
}

/** Project a reduced compare result onto our honest BashinStats. The reduction's
 *  `results` is already sorted ascending (so results[0]=min, last=max); `activated`
 *  is decided by the caller from the per-round B activation keys. */
function bashinStatsFrom(result: CompareResult, activated: boolean): BashinStats {
  const results = result.results;
  return {
    mean: _mean(results),
    median: _median(results),
    min: results[0] ?? 0,
    max: results[results.length - 1] ?? 0,
    nsamples: results.length,
    results,
    activated,
  };
}

/** Did any of `skillIds` activate (≥1 logged effect) in any runner-B round? */
function activatedInRoundsB(rounds: CompareRounds, skillIds: string[]): boolean {
  return rounds.roundsB.some((round) =>
    Object.entries(round.skillActivations).some(
      ([key, logs]) => logs.length > 0 && skillIds.some((id) => isSameSkill(key, id)),
    ),
  );
}

// --- public entries -------------------------------------------------------------

/** With-vs-without bashin delta for adding `skillId` to `build` on `race`'s course. */
export function evalSkillDelta(
  build: SimBuild, race: SimRaceParams, skillId: string, nsamples: number, seed = 0,
): BashinStats {
  return evalSkillDeltaWithSettings(build, race, skillId, nsamples, seed);
}

/** TEST-ONLY seam (fidelity re-baseline, Task 6): `evalSkillDelta` with an explicit
 *  engine-settings override — e.g. `{ cooldownReactivation: false }` to pin the
 *  upstream-identical single-fire path for the flag-OFF fidelity anchor. NOT part of
 *  the public sim API: production callers (worker, M2 optimizer) use `evalSkillDelta`,
 *  which runs engine defaults (multi-fire ON). Kept here rather than exposing
 *  `vacuumRounds` itself so the golden exercises the entire real entry path. */
export function evalSkillDeltaWithSettings(
  build: SimBuild, race: SimRaceParams, skillId: string, nsamples: number, seed = 0,
  settings?: Partial<Omit<SimulationSettings, 'mode'>>,
): BashinStats {
  if (nsamples < 1) return { ...EMPTY };
  if (!isSimulatable(skillId)) return { ...EMPTY };
  const base = simulatableBase(build);
  const { rounds, result } = vacuumRounds(
    base, { ...base, skills: [...base.skills, skillId] }, race, nsamples, seed,
    settings ? { settings } : undefined,
  );
  return bashinStatsFrom(result, activatedInRoundsB(rounds, [skillId]));
}

/** A-vs-B head-to-head (M1 inheritance compare, M2 vs-veteran).
 *  opts.downhill → downhill saving mode for both runners.
 *  opts.injectedDebuffs → per-runner injected debuffs (bypass simulatableBase).
 *  opts.staminaDrainOverrides → per-skill stamina-drain multipliers.
 *  aFinalHp/bFinalHp are per-sample (run-ordered) finish HP; the rates come back
 *  as percents from the reduction and are normalized to [0,1] as today. */
export function runVacuumCompare(
  a: SimBuild, b: SimBuild, race: SimRaceParams, nsamples: number, seed = 0,
  opts?: VacuumOpts,
): VacuumResult {
  const { rounds, result } = vacuumRounds(
    simulatableBase(a), simulatableBase(b), race, nsamples, seed,
    {
      settings: {
        downhill: opts?.downhill ?? false,
        ...(opts?.staminaDrainOverrides ? { staminaDrainOverrides: opts.staminaDrainOverrides } : {}),
      },
      aDebuffs: opts?.injectedDebuffs?.uma1,
      bDebuffs: opts?.injectedDebuffs?.uma2,
    },
  );
  const results = result.results;
  return {
    mean: _mean(results), median: _median(results),
    min: results[0] ?? 0,
    max: results[results.length - 1] ?? 0,
    nsamples: results.length, results,
    aFirstPlaceRate: result.firstUmaStats.uma1.firstPlaceRate / 100,
    bFirstPlaceRate: result.firstUmaStats.uma2.firstPlaceRate / 100,
    aStaminaSurvival: result.staminaStats.uma1.staminaSurvivalRate / 100,
    bStaminaSurvival: result.staminaStats.uma2.staminaSurvivalRate / 100,
    aFullSpurtRate: result.staminaStats.uma1.fullSpurtRate / 100,
    bFullSpurtRate: result.staminaStats.uma2.fullSpurtRate / 100,
    aFinalHp: rounds.roundsA.map((r) => r.hp[r.hp.length - 1] ?? 0),
    bFinalHp: rounds.roundsB.map((r) => r.hp[r.hp.length - 1] ?? 0),
  };
}

/** Multi-candidate delta (M2 basket sims). */
export function runPlannerCompare(
  build: SimBuild, race: SimRaceParams, candidateSkills: string[], nsamples: number, seed = 0,
): BashinStats {
  const { rounds, result } = vacuumRounds(
    build, { ...build, skills: [...build.skills, ...candidateSkills] }, race, nsamples, seed,
  );
  return bashinStatsFrom(result, activatedInRoundsB(rounds, candidateSkills));
}

function emptyRun(): SkillTraceRun {
  return { withSkill: [], without: [], activation: [], L: 0 };
}
const EMPTY_TRACE: SkillTrace = {
  runs: { min: emptyRun(), max: emptyRun(), mean: emptyRun(), median: emptyRun() },
  meanL: 0,
  nsamples: 0,
};

function zipFrames(run: SimulationRun, runner: 0 | 1): SkillFrame[] {
  const t = run.time[runner], v = run.velocity[runner], pos = run.position[runner], hp = run.hp[runner];
  const n = Math.min(t.length, v.length, pos.length, hp.length);
  const out: SkillFrame[] = [];
  for (let i = 0; i < n; i++) {
    out.push({ t: t[i] ?? 0, v: v[i] ?? 0, pos: pos[i] ?? 0, hp: hp[i] ?? 0 });
  }
  return out;
}

function activationRegions(run: SimulationRun, skillId: string): { start: number; end: number }[] {
  const logs = run.skillActivations[1]?.[skillId] ?? [];
  return logs.map((l) => ({ start: l.start, end: l.end }));
}

function mapRun(run: SimulationRun, skillId: string, L: number): SkillTraceRun {
  return { withSkill: zipFrames(run, 1), without: zipFrames(run, 0), activation: activationRegions(run, skillId), L };
}

/** Per-sample activation data for the position-resolved impact/frequency charts
 *  (umalator-style). From N samples: each activating sample carries the total バ身
 *  it gained and the positions (metres) where the tracked skill fired. Only samples
 *  where the tracked skill fired at least once become entries; the activation rate is
 *  samples.length / nsamples. */
export function skillImpact(
  build: SimBuild, race: SimRaceParams, skillId: string, nsamples: number, seed = 0,
): SkillImpact {
  if (nsamples < 1 || build.stats.spd <= 0) return { samples: [], nsamples: 0, distance: 0 };
  if (!isSimulatable(skillId)) return { samples: [], nsamples: 0, distance: 0 };
  const base = simulatableBase(build);
  const { rounds } = vacuumRounds(
    base, { ...base, skills: [...base.skills, skillId] }, race, nsamples, seed,
  );
  const distance = toWasmRace(race).course.distance;
  const samples: SkillImpactSample[] = [];
  for (let i = 0; i < rounds.roundsB.length; i++) {
    const roundA = rounds.roundsA[i];
    const roundB = rounds.roundsB[i];
    if (!roundA || !roundB) continue;
    const positions: number[] = [];
    for (const [key, logs] of Object.entries(roundB.skillActivations)) {
      if (!isSameSkill(key, skillId)) continue;
      for (const log of logs) positions.push(log.start);
    }
    if (positions.length === 0) continue; // only activating samples become impact samples
    // positionDiff is metres (B ahead of A); バ身 = m / 2.5 — the same conversion the
    // reduction uses for its `results`, so horseLength matches the old engine's
    // per-sample skillActivations[id].horseLength (which was バ身 directly).
    const horseLength = computePositionDiff(roundA.position, roundB.position) / 2.5;
    samples.push({ horseLength, positions });
  }
  return { samples, nsamples, distance: typeof distance === 'number' ? distance : 0 };
}

/** Per-frame with-vs-without trace for adding `skillId` to `build` (curves + activation zones). */
export function runSkillTrace(
  build: SimBuild, race: SimRaceParams, skillId: string, nsamples: number, seed = 0,
): SkillTrace {
  if (nsamples < 1 || build.stats.spd <= 0) return EMPTY_TRACE;
  if (!isSimulatable(skillId)) return EMPTY_TRACE;
  const base = simulatableBase(build);
  const { result } = vacuumRounds(
    base, { ...base, skills: [...base.skills, skillId] }, race, nsamples, seed,
  );
  const results = result.results; // reduction returns these sorted ascending
  const min = results[0] ?? 0;
  const max = results[results.length - 1] ?? 0;
  return {
    runs: {
      min: mapRun(result.runData.minrun, skillId, min),
      max: mapRun(result.runData.maxrun, skillId, max),
      mean: mapRun(result.runData.meanrun, skillId, _mean(results)),
      median: mapRun(result.runData.medianrun, skillId, _median(results)),
    },
    meanL: _mean(results),
    nsamples: results.length,
  };
}

export function allActivationRegions(run: SimulationRun, runner: 0 | 1): RaceActivation[] {
  const acts = run.skillActivations[runner] ?? {};
  const out: RaceActivation[] = [];
  for (const [skillId, logs] of Object.entries(acts)) {
    // One activation can log MULTIPLE effects at the same start position; collapse them to a
    // single marker (umalator's buildSelfSkillRegions), keeping the longest as the representative
    // window. Genuine multi-fire (distinct starts) stays as separate regions.
    const byStart = new Map<number, { start: number; end: number }>();
    for (const l of logs) {
      const prev = byStart.get(l.start);
      if (!prev || l.end - l.start > prev.end - prev.start) byStart.set(l.start, { start: l.start, end: l.end });
    }
    for (const r of byStart.values()) out.push({ skillId, start: r.start, end: r.end });
  }
  return out;
}

function gapCurve(run: SimulationRun): GapPoint[] {
  const p1 = run.position[0], p2 = run.position[1];
  const n = Math.min(p1.length, p2.length);
  const out: GapPoint[] = [];
  for (let i = 0; i < n; i++) {
    const a = p1[i] ?? 0, b = p2[i] ?? 0;
    out.push({ pos: a, bashin: (a - b) / 2.5 });
  }
  return out;
}

function mapCompareRun(run: SimulationRun): RaceCompareRun {
  return {
    uma1Frames: zipFrames(run, 0),
    uma2Frames: zipFrames(run, 1),
    uma1Acts: allActivationRegions(run, 0),
    uma2Acts: allActivationRegions(run, 1),
    gap: gapCurve(run),
  };
}

function emptyCompareRun(): RaceCompareRun {
  return { uma1Frames: [], uma2Frames: [], uma1Acts: [], uma2Acts: [], gap: [] };
}
const EMPTY_RACE_COMPARE: RaceCompare = {
  runs: { min: emptyCompareRun(), max: emptyCompareRun(), mean: emptyCompareRun(), median: emptyCompareRun() },
  distance: 0, nsamples: 0, meanBashin: 0,
};

/** Full-race two-build comparison (umalator main view): both runners' per-frame
 *  trace + all-skill activations + バ身-gap curve, from one compare batch. */
export function runRaceCompare(
  uma1: SimBuild, uma2: SimBuild, race: SimRaceParams, nsamples: number, seed = 0,
): RaceCompare {
  if (nsamples < 1 || uma1.stats.spd <= 0 || uma2.stats.spd <= 0) return EMPTY_RACE_COMPARE;
  const { result } = vacuumRounds(
    // simulatableBase drops engine-unknown ids (inherited-unique 9… / JP-only / imported)
    // so one bad id can't blank the overlay — mirrors runVacuumCompare.
    simulatableBase(uma1), simulatableBase(uma2), race, nsamples, seed,
  );
  const distance = toWasmRace(race).course.distance;
  return {
    runs: {
      min: mapCompareRun(result.runData.minrun),
      max: mapCompareRun(result.runData.maxrun),
      mean: mapCompareRun(result.runData.meanrun),
      median: mapCompareRun(result.runData.medianrun),
    },
    distance: typeof distance === 'number' ? distance : 0,
    nsamples: result.results.length,
    meanBashin: _mean(result.results),
  };
}
