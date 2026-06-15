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

/**
 * Memoizing cache for SINGLE-skill bashin deltas on a FIXED base build.
 * The key buckets stats (50-pt bins ≈ a single skill's noise floor) and ignores `mood`
 * and the build's OWNED-skill loadout beyond the tracked `skillId`. Safe for M4's pre-run
 * opportunistic reuse; NOT safe to reuse across builds with different owned-skill sets
 * (e.g. M2 basket sims) — a skill's marginal value depends on what's already learned, so
 * M2 must scope its own cache per basket.
 */
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
