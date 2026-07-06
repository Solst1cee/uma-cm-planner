/** M1.4b — pure helpers for the Parent-2 rental DRAFT (a forced-tier spark
 *  search-spec). See docs/superpowers/specs/2026-07-06-m1-4b-rental-builder-design.md. */
import type { ForcedTier, Parent, RentalDraft, Stat } from '@/core/types';
import type { SparkFilter } from '@/core/sparkFilter';

/** Forced inheritance-affinity tier → representative affinity score (P3 estimate,
 *  aligned to the △0–50 / ○51–150 / ◎151+ bands, mechanics-notes §3). */
export function forcedTierScore(t: ForcedTier): number {
  return t === 'double' ? 175 : t === 'single' ? 100 : 25;
}

/** Seed draft filters from M1.8 Target spark. Blue carries a structured stat key;
 *  the uncovered wishlist skills are pre-split by the caller into `green`
 *  (inherited-unique / unique → the UNIQUE card) and `white` (whites/golds → the
 *  SKILL card) — routing them by kind so a unique never seeds as a white filter.
 *  Pink stays manual (PinkSparkRow is label-only). */
export function seedFromTargetSpark(
  seed: {
    blue: Array<{ stat: Stat; stars: number }>;
    white: Array<{ id: string }>;
    green?: Array<{ id: string }>;
  },
): SparkFilter[] {
  const out: SparkFilter[] = [];
  for (const b of seed.blue) out.push({ id: `seed-blue-${b.stat}`, kind: 'blue', stat: b.stat, legacyMin: 0, totalMin: b.stars });
  for (const g of seed.green ?? []) out.push({ id: `seed-green-${g.id}`, kind: 'green', skillId: g.id, legacyMin: 0, totalMin: 1 });
  for (const w of seed.white) out.push({ id: `seed-white-${w.id}`, kind: 'white', skillId: w.id, legacyMin: 0, totalMin: 1 });
  return out;
}

const STARS = (n: number): 1 | 2 | 3 => (n >= 3 ? 3 : n >= 2 ? 2 : 1);

/** Synthesize a Parent from a draft so it rides the existing coverage/affinity
 *  path. Parent holds ONE green + N whites, so multi-green drafts keep the first
 *  green (documented limitation). affinityHint = the forced score → spark.ts
 *  prices the draft's inherit-% at the chosen tier with no memberAffinity hook. */
export function draftToSyntheticParent(draft: RentalDraft): Parent {
  const white = draft.filters.filter((f): f is Extract<SparkFilter, { kind: 'white' }> => f.kind === 'white');
  const green = draft.filters.find((f): f is Extract<SparkFilter, { kind: 'green' }> => f.kind === 'green');
  const blue = draft.filters.find((f): f is Extract<SparkFilter, { kind: 'blue' }> => f.kind === 'blue');
  const pink = draft.filters.find((f): f is Extract<SparkFilter, { kind: 'pink' }> => f.kind === 'pink');
  const p: Parent = {
    id: '__rental_draft__',
    umaId: '',
    blueSpark: blue ? { stat: blue.stat, stars: STARS(blue.totalMin) } : { stat: 'spd', stars: 1 },
    pinkSpark: pink ? { aptitude: pink.aptitude, stars: STARS(pink.totalMin) } : { aptitude: 'turf', stars: 1 },
    whiteSparks: white.map((w) => ({ skillId: w.skillId, stars: STARS(w.totalMin) })),
    affinityHint: forcedTierScore(draft.forcedTier),
    source: 'friend_rental',
  };
  if (green) p.greenSpark = { skillId: green.skillId, stars: STARS(green.totalMin) };
  return p;
}
