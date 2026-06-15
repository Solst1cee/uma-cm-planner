import type { SimBuild, SimRaceParams, BashinStats } from './types';

/** Bucket stats to 50-pt bins so near-identical builds share a key (shared-data-model §7). */
function bucketStats(build: SimBuild): string {
  const order: Array<keyof SimBuild['stats']> = ['spd', 'sta', 'pow', 'gut', 'wit'];
  return order.map((k) => Math.round(build.stats[k] / 50)).join('.');
}
function aptHash(build: SimBuild): string {
  return `${build.aptitudes.distance}${build.aptitudes.surface}${build.aptitudes.strategy}`;
}

/** Shared L-cache key: (courseId, strategy, bucketedStats, aptitudes, skillId, dataVersion). */
export function simCacheKey(build: SimBuild, race: SimRaceParams, skillId: string, dataVersion: string): string {
  return [race.courseId, build.strategy, bucketStats(build), aptHash(build), skillId, dataVersion].join('|');
}

export function makeDeltaCache(dataVersion: string) {
  const store = new Map<string, BashinStats>();
  return {
    get(build: SimBuild, race: SimRaceParams, skillId: string, compute: () => BashinStats): BashinStats {
      const key = simCacheKey(build, race, skillId, dataVersion);
      const hit = store.get(key);
      if (hit) return hit;
      const value = compute();
      store.set(key, value);
      return value;
    },
    size: () => store.size,
    clear: () => store.clear(),
  };
}
