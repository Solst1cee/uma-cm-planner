// src/features/inheritance/sparkAggregate.ts
/**
 * Roll a roster veteran + its two grandparents into the spark totals the parent
 * picker filters on. legacy = the veteran's OWN factor; total = summed across
 * the veteran + both grandparents (the combined factor stars the game shows).
 */
import type { Parent, ParentRef, Stat } from '@/core/types';

export interface SparkAgg {
  blueTotals: Partial<Record<Stat, number>>;
  blueLegacy: { stat: Stat; stars: number };
  maxBlueTotal: number;
  pinkTotals: Record<string, number>;
  pinkLegacy: { aptitude: string; stars: number };
  whites: Map<string, { total: number; legacy: number }>;
  /** Green (inherited-unique) sparks, keyed by the decoded unique skill id. */
  greens: Map<string, { total: number; legacy: number }>;
}

export function aggregate(veteran: Parent): SparkAgg {
  const members: Array<Parent | ParentRef> = [veteran, ...(veteran.grandparents ?? []).filter((g): g is ParentRef => !!g)];

  const blueTotals: Partial<Record<Stat, number>> = {};
  const pinkTotals: Record<string, number> = {};
  const whites = new Map<string, { total: number; legacy: number }>();
  const greens = new Map<string, { total: number; legacy: number }>();

  for (const m of members) {
    if (m.blueSpark) blueTotals[m.blueSpark.stat] = (blueTotals[m.blueSpark.stat] ?? 0) + m.blueSpark.stars;
    if (m.pinkSpark) pinkTotals[m.pinkSpark.aptitude] = (pinkTotals[m.pinkSpark.aptitude] ?? 0) + m.pinkSpark.stars;
    for (const w of m.whiteSparks ?? []) {
      const prev = whites.get(w.skillId) ?? { total: 0, legacy: 0 };
      whites.set(w.skillId, { total: prev.total + w.stars, legacy: prev.legacy });
    }
    if (m.greenSpark) {
      const prev = greens.get(m.greenSpark.skillId) ?? { total: 0, legacy: 0 };
      greens.set(m.greenSpark.skillId, { total: prev.total + m.greenSpark.stars, legacy: prev.legacy });
    }
  }
  // legacy = the veteran's own sparks only
  for (const w of veteran.whiteSparks ?? []) {
    const prev = whites.get(w.skillId) ?? { total: 0, legacy: 0 };
    whites.set(w.skillId, { total: prev.total, legacy: prev.legacy + w.stars });
  }
  if (veteran.greenSpark) {
    const prev = greens.get(veteran.greenSpark.skillId) ?? { total: 0, legacy: 0 };
    greens.set(veteran.greenSpark.skillId, { total: prev.total, legacy: prev.legacy + veteran.greenSpark.stars });
  }

  const maxBlueTotal = Math.max(0, ...Object.values(blueTotals));
  return {
    blueTotals,
    blueLegacy: { stat: veteran.blueSpark.stat, stars: veteran.blueSpark.stars },
    maxBlueTotal,
    pinkTotals,
    pinkLegacy: { aptitude: veteran.pinkSpark.aptitude, stars: veteran.pinkSpark.stars },
    whites,
    greens,
  };
}
