// src/features/inheritance/sparkFilter.ts
/**
 * AND-clause spark filter over a SparkAgg. Every threshold is a `>=` (choosing
 * 2 means "2 or higher"); 0 = no constraint. legacy = veteran's own; total =
 * summed across the lineage. blue/pink/white are symmetric.
 */
import type { Stat } from '@/core/types';
import type { SparkAgg } from './sparkAggregate';

export type SparkFilter =
  | { id: string; kind: 'blue'; stat: Stat; legacyMin: number; totalMin: number }
  | { id: string; kind: 'pink'; aptitude: string; legacyMin: number; totalMin: number }
  | { id: string; kind: 'white'; skillId: string; legacyMin: number; totalMin: number }
  | { id: string; kind: 'anyBlue'; totalMin: number };

export function clauseMatches(agg: SparkAgg, f: SparkFilter): boolean {
  switch (f.kind) {
    case 'blue': {
      const total = agg.blueTotals[f.stat] ?? 0;
      const legacy = agg.blueLegacy.stat === f.stat ? agg.blueLegacy.stars : 0;
      return total >= f.totalMin && legacy >= f.legacyMin;
    }
    case 'pink': {
      const total = agg.pinkTotals[f.aptitude] ?? 0;
      const legacy = agg.pinkLegacy.aptitude === f.aptitude ? agg.pinkLegacy.stars : 0;
      return total >= f.totalMin && legacy >= f.legacyMin;
    }
    case 'white': {
      const w = agg.whites.get(f.skillId);
      return (w?.total ?? 0) >= f.totalMin && (w?.legacy ?? 0) >= f.legacyMin;
    }
    case 'anyBlue':
      return agg.maxBlueTotal >= f.totalMin;
  }
}

export function matchesFilters(agg: SparkAgg, filters: SparkFilter[]): boolean {
  return filters.every((f) => clauseMatches(agg, f));
}
