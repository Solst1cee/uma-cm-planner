import { coursesService } from '@/sim/vendor/umalator.bundle.mjs';
import type { IRunnerState, CourseData, RaceDef, SkillComparisonResult, PlannerCompareResult } from '@/sim/vendor/umalator.bundle.mjs';
import type { SimBuild, Strategy, SimRaceParams, BashinStats } from './types';

export const STRATEGY_LABEL: Record<Strategy, IRunnerState['strategy']> = {
  front: 'Front Runner',
  pace: 'Pace Chaser',
  late: 'Late Surger',
  end: 'End Closer',
};

/** Map OUR build to the engine's IRunnerState. Note: our 'wit' -> engine 'wisdom'. */
export function toRunnerState(build: SimBuild): IRunnerState {
  return {
    outfitId: build.umaId,
    speed: build.stats.spd,
    stamina: build.stats.sta,
    power: build.stats.pow,
    guts: build.stats.gut,
    wisdom: build.stats.wit,
    strategy: STRATEGY_LABEL[build.strategy],
    distanceAptitude: build.aptitudes.distance,
    surfaceAptitude: build.aptitudes.surface,
    strategyAptitude: build.aptitudes.strategy,
    mood: build.mood ?? 2,
    skills: [...build.skills],
    ...(build.skillLevels ? { skillLevels: { ...build.skillLevels } } : {}),
  };
}

export function toRaceDef(race: SimRaceParams): RaceDef {
  return {
    ground: race.ground ?? 1,
    weather: race.weather ?? 1,
    season: race.season ?? 3,
    time: race.time ?? 2,
    grade: race.grade ?? 100,
  };
}

/** Resolve our string courseId to the engine's CourseData. Throws if unknown. */
export function resolveCourse(courseId: string): CourseData {
  const numeric = Number(courseId);
  const course = coursesService.getSimCourse(numeric);
  if (!course || typeof course.distance !== 'number') {
    throw new Error(`Unknown course: ${courseId}`);
  }
  return course;
}

/** Project an engine skill/planner result onto our honest BashinStats. The engine sets
 *  `skillActivations` to `{ [trackedSkillId]: … }` when the skill procced at least once,
 *  or `{}` when it never did — so a non-empty map means "activated". */
export function bashinStatsFrom(r: SkillComparisonResult | PlannerCompareResult): BashinStats {
  return {
    mean: r.mean,
    median: r.median,
    min: r.min,
    max: r.max,
    nsamples: r.results.length,
    results: r.results,
    activated: Object.keys(r.skillActivations ?? {}).length > 0,
  };
}
