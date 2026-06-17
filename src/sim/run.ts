import { runSkillComparison, skillsService, runComparison, runPlannerComparison } from '@/sim/vendor/umalator.bundle.mjs';
import type { SimulationRun } from '@/sim/vendor/umalator.bundle.mjs';
import { toRunnerState, toRaceDef, resolveCourse, bashinStatsFrom } from './adapter';
import type { SimBuild, SimRaceParams, BashinStats, VacuumResult, SkillTrace, SkillTraceRun, SkillFrame, SkillRate } from './types';

const EMPTY: BashinStats = { mean: 0, median: 0, min: 0, max: 0, nsamples: 0, results: [] };

/** With-vs-without bashin delta for adding `skillId` to `build` on `race`'s course. */
export function evalSkillDelta(
  build: SimBuild, race: SimRaceParams, skillId: string, nsamples: number, seed = 0,
): BashinStats {
  if (nsamples < 1) return { ...EMPTY };
  if (!skillsService.isSimulatable(skillId)) return { ...EMPTY };
  const runnerA = toRunnerState(build);
  const runnerB = toRunnerState({ ...build, skills: [...build.skills, skillId] });
  const result = runSkillComparison({
    trackedSkillId: skillId,
    nsamples,
    course: resolveCourse(race.courseId),
    racedef: toRaceDef(race),
    runnerA,
    runnerB,
    options: { seed, ignoreStaminaConsumption: false },
  });
  return bashinStatsFrom(result);
}

/** A-vs-B head-to-head (M1 inheritance compare, M2 vs-veteran). */
export function runVacuumCompare(
  a: SimBuild, b: SimBuild, race: SimRaceParams, nsamples: number, seed = 0,
): VacuumResult {
  const r = runComparison({
    nsamples,
    course: resolveCourse(race.courseId),
    racedef: toRaceDef(race),
    uma1: toRunnerState(a),
    uma2: toRunnerState(b),
    options: { seed, ignoreStaminaConsumption: false },
  });
  return {
    mean: _mean(r.results), median: _median(r.results),
    min: r.results[0] ?? 0,
    max: r.results[r.results.length - 1] ?? 0,
    nsamples: r.results.length, results: r.results,
    aFirstPlaceRate: r.firstUmaStats.uma1.firstPlaceRate / 100,
    bFirstPlaceRate: r.firstUmaStats.uma2.firstPlaceRate / 100,
    aStaminaSurvival: r.staminaStats.uma1.staminaSurvivalRate / 100,
    bStaminaSurvival: r.staminaStats.uma2.staminaSurvivalRate / 100,
  };
}

/** Multi-candidate delta (M2 basket sims). */
export function runPlannerCompare(
  build: SimBuild, race: SimRaceParams, candidateSkills: string[], nsamples: number, seed = 0,
): BashinStats {
  const r = runPlannerComparison({
    nsamples,
    course: resolveCourse(race.courseId),
    racedef: toRaceDef(race),
    runnerA: toRunnerState(build),
    runnerB: toRunnerState({ ...build, skills: [...build.skills, ...candidateSkills] }),
    candidateSkills,
    ignoreStaminaConsumption: false,
    options: { seed },
  });
  return bashinStatsFrom(r);
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

/** Activation rate (発動率): fraction of samples in which `skillId` procs. */
export function skillActivationRate(
  build: SimBuild, race: SimRaceParams, skillId: string, nsamples: number, seed = 0,
): SkillRate {
  if (nsamples < 1 || build.stats.spd <= 0) return { rate: 0, nsamples: 0 };
  if (!skillsService.isSimulatable(skillId)) return { rate: 0, nsamples: 0 };
  const r = runSkillComparison({
    trackedSkillId: skillId,
    nsamples,
    course: resolveCourse(race.courseId),
    racedef: toRaceDef(race),
    runnerA: toRunnerState(build),
    runnerB: toRunnerState({ ...build, skills: [...build.skills, skillId] }),
    options: { seed, ignoreStaminaConsumption: false },
  });
  const activations = r.skillActivations[skillId]?.length ?? 0;
  const rate = Math.min(1, Math.max(0, activations / nsamples));
  return { rate, nsamples };
}

/** Per-frame with-vs-without trace for adding `skillId` to `build` (curves + activation zones). */
export function runSkillTrace(
  build: SimBuild, race: SimRaceParams, skillId: string, nsamples: number, seed = 0,
): SkillTrace {
  if (nsamples < 1 || build.stats.spd <= 0) return EMPTY_TRACE;
  if (!skillsService.isSimulatable(skillId)) return EMPTY_TRACE;
  const r = runComparison({
    nsamples,
    course: resolveCourse(race.courseId),
    racedef: toRaceDef(race),
    uma1: toRunnerState(build),
    uma2: toRunnerState({ ...build, skills: [...build.skills, skillId] }),
    options: { seed, ignoreStaminaConsumption: false },
  });
  const results = r.results; // engine returns these sorted ascending
  const min = results[0] ?? 0;
  const max = results[results.length - 1] ?? 0;
  return {
    runs: {
      min: mapRun(r.runData.minrun, skillId, min),
      max: mapRun(r.runData.maxrun, skillId, max),
      mean: mapRun(r.runData.meanrun, skillId, _mean(results)),
      median: mapRun(r.runData.medianrun, skillId, _median(results)),
    },
    meanL: _mean(results),
    nsamples: results.length,
  };
}
