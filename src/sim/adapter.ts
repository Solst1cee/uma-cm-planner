import type { IRunnerState } from '@/sim/vendor/umalator.bundle.mjs';
import type { SimBuild, Strategy } from './types';

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
  };
}
