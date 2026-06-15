import { runSkillComparison, skillsService, runComparison, runPlannerComparison } from '@/sim/vendor/umalator.bundle.mjs';
import { toRunnerState, toRaceDef, resolveCourse, bashinStatsFrom } from './adapter';
import type { SimBuild, SimRaceParams, BashinStats, VacuumResult } from './types';

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
