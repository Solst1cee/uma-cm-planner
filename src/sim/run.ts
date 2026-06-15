import { runSkillComparison, skillsService } from '@/sim/vendor/umalator.bundle.mjs';
import { toRunnerState, toRaceDef, resolveCourse, bashinStatsFrom } from './adapter';
import type { SimBuild, SimRaceParams, BashinStats } from './types';

const EMPTY: BashinStats = { mean: 0, median: 0, min: 0, max: 0, nsamples: 0, results: [] };

/** With-vs-without bashin delta for adding `skillId` to `build` on `race`'s course. */
export function evalSkillDelta(
  build: SimBuild, race: SimRaceParams, skillId: string, nsamples: number, seed = 0,
): BashinStats {
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
