/**
 * Module 4 core — spark inheritance probability (plan §6 build step 4).
 *
 * Pure functions only. Mechanics model (docs/mechanics-notes.md §1–§4, all
 * CONFIRMED 2026-06-12):
 *
 * - Per matching spark, per lineage member, per inspiration event:
 *     pEvent = min(1, base[stars]/100 × (1 + affinity/100))
 *   (base table §2; affinity scaling §3, clamped at 100%).
 * - Two probabilistic inspiration events per career (Classic + Senior April,
 *   §1): pCareer = 1 − (1 − pEvent)^rates.inspirationEvents — the exact
 *   `non_zero_career` formula from Ice's sheet (Full Custom Calculation CB18).
 * - Independent members combine as 1 − Π(1 − pCareer_i).
 * - There is NO flat ×0.5 grandparent multiplier (§4) — grandparents use the
 *   same base table; their lower effective rate is emergent from structurally
 *   smaller individual affinity scores. We model that with a separate
 *   (conservative-floor) grandparent affinity input, never a fudge factor.
 *
 * Affinity caveat (P3 honest numbers): the true model uses each lineage
 * member's INDIVIDUAL affinity score (mechanics-notes §3). `Parent.affinityHint`
 * is the user-entered TOTAL displayed vs the target (= sum of all 6 member
 * scores), so using it for a single member OVERESTIMATES that member's chance;
 * the min(1, …) clamp mitigates the worst of it. Per-member scores land with
 * Module 1's computed affinity (plan §14.4) — until then results that lean on
 * fallbacks are flagged `approximate`.
 */
import type { Parent, SparkRates } from '@/core/types';

export interface SparkContribution {
  /** The Parent (lineage branch) this contribution belongs to. */
  parentId: string;
  /** True when the spark is held by a grandparent (ParentRef), not the parent. */
  grandparent: boolean;
  stars: number;
  /** Affinity score fed into the scaling formula for this member. */
  affinityUsed: number;
  /** This member's own whole-career proc chance %, before combining members. */
  pct: number;
}

export interface SparkChanceResult {
  /** Whole-career chance % that AT LEAST ONE matching spark procs. */
  pct: number;
  /**
   * True when the number rests on a documented approximation: a grandparent
   * contributed (grandparent affinity is a conservative floor, mechanics-notes
   * §4 degraded mode) or a contributing parent had no affinityHint entered.
   */
  approximate: boolean;
  contributions: SparkContribution[];
}

/** Spark families this function prices (skill-granting sparks only). */
type SparkFamily = 'green' | 'whiteSkill';

/** Base % per inspiration event (mechanics-notes §2 table) for a star count. */
function baseProcPct(rates: SparkRates, family: SparkFamily, stars: 1 | 2 | 3): number {
  return rates.baseProcPctByStars[family][stars - 1] ?? 0;
}

/** pEvent = min(1, base/100 × (1 + affinity/100)) — mechanics-notes §3. */
function perEventChance(basePct: number, affinity: number): number {
  return Math.min(1, (basePct / 100) * (1 + affinity / 100));
}

/** pCareer = 1 − (1 − pEvent)^n, n = 2 inspiration events (mechanics-notes §1). */
function perCareerChance(pEvent: number, rates: SparkRates): number {
  return 1 - (1 - pEvent) ** rates.inspirationEvents;
}

/**
 * Whole-career chance that the child gains `skillId` from the given parents'
 * sparks (white skill sparks + green inherited-unique sparks, incl. the
 * grandparents recorded on each parent).
 *
 * Affinity inputs:
 * - Parent-held sparks scale by `Parent.affinityHint ?? 0` (see module
 *   docblock for the total-vs-per-member caveat). A contributing parent with
 *   no affinityHint falls back to 0 (conservative) and flags `approximate`.
 * - Grandparent-held sparks scale by `opts.grandparentAffinity ?? 0` — a
 *   conservative floor; any grandparent contribution flags `approximate`
 *   (mechanics-notes §4: no flat multiplier exists, so without the member's
 *   real score we under-promise rather than fabricate).
 *
 * Parents with no matching spark contribute nothing and do NOT affect the
 * `approximate` flag. Returns pct 0 with empty contributions when nothing
 * matches. Full float precision — round at the presentation layer.
 */
export function sparkChance(args: {
  parents: Parent[];
  skillId: string;
  rates: SparkRates;
  opts?: { grandparentAffinity?: number };
}): SparkChanceResult {
  const { parents, skillId, rates, opts } = args;
  const contributions: SparkContribution[] = [];
  let approximate = false;

  for (const parent of parents) {
    // --- sparks held by the parent itself ---------------------------------
    const parentAffinity = parent.affinityHint ?? 0;
    const matching: Array<{ family: SparkFamily; stars: 1 | 2 | 3 }> = [];
    for (const spark of parent.whiteSparks) {
      if (spark.skillId === skillId) matching.push({ family: 'whiteSkill', stars: spark.stars });
    }
    // Green spark grants the 9xxxxx inherited-unique id (mechanics-notes §8);
    // Parent.greenSpark.skillId is already that id, so a plain match works.
    if (parent.greenSpark?.skillId === skillId) {
      matching.push({ family: 'green', stars: parent.greenSpark.stars });
    }
    for (const spark of matching) {
      const pEvent = perEventChance(baseProcPct(rates, spark.family, spark.stars), parentAffinity);
      contributions.push({
        parentId: parent.id,
        grandparent: false,
        stars: spark.stars,
        affinityUsed: parentAffinity,
        pct: perCareerChance(pEvent, rates) * 100,
      });
      if (parent.affinityHint === undefined) approximate = true;
    }

    // --- sparks held by this parent's grandparents (ParentRef) ------------
    // ParentRef carries whiteSparks only — green career math for grandparents
    // is unverified anyway (mechanics-notes §1 note, §10 item 3).
    const gpAffinity = opts?.grandparentAffinity ?? 0;
    for (const gp of parent.grandparents ?? []) {
      for (const spark of gp?.whiteSparks ?? []) {
        if (spark.skillId !== skillId) continue;
        const pEvent = perEventChance(baseProcPct(rates, 'whiteSkill', spark.stars), gpAffinity);
        contributions.push({
          parentId: parent.id,
          grandparent: true,
          stars: spark.stars,
          affinityUsed: gpAffinity,
          pct: perCareerChance(pEvent, rates) * 100,
        });
        approximate = true;
      }
    }
  }

  // Independent members: P(≥1 proc) = 1 − Π(1 − pCareer_i).
  const missAll = contributions.reduce((acc, c) => acc * (1 - c.pct / 100), 1);
  return { pct: (1 - missAll) * 100, approximate, contributions };
}

/**
 * True when the parent's lineage branch holds ANY spark granting `skillId`
 * (parent white/green spark or grandparent white spark) — i.e. sparkChance
 * would return contributions. Probability-free helper for coverage checks
 * that don't need rates (deck suggester's `uncovered`).
 */
export function parentCoversSkill(parent: Parent, skillId: string): boolean {
  if (parent.whiteSparks.some((s) => s.skillId === skillId)) return true;
  if (parent.greenSpark?.skillId === skillId) return true;
  for (const gp of parent.grandparents ?? []) {
    if (gp?.whiteSparks?.some((s) => s.skillId === skillId)) return true;
  }
  return false;
}
