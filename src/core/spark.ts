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
 * Module 1's computed affinity (plan §14.4) — until then ANY parent contribution
 * scaled by a positive `affinityHint` is flagged `approximate` (review finding:
 * "Affinity total used as per-member overestimates"): a confident un-flagged
 * percent must not rest on the total-as-member assumption (P3). An
 * `affinityHint === 0` parent contribution applies NO scaling — it is the honest
 * base-rate floor and stays non-approximate. (Other approximate triggers below:
 * a grandparent contributed, or a contributing parent had no affinityHint.)
 *
 * White-skill spark families map ONLY to white skills (mechanics-notes §8; the
 * extraction `white_spark_skills.json` carries white ids exclusively). Gold /
 * unique / inherited_unique skills are not white-spark targets, so pricing a
 * `whiteSparks` entry whose skill is non-white fabricates an inheritance percent
 * for an event that cannot occur. When a rarity lookup is supplied (review
 * finding: "Gold skills priced as white sparks"), such entries are SKIPPED;
 * green sparks keep their separate green-base path. Without a rarity lookup the
 * function falls back to pricing every recorded whiteSparks entry — the data
 * layer is then responsible for not recording non-white white-sparks.
 */
import type { Parent, SkillRarity, SparkRates } from '@/core/types';

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
  /**
   * True when THIS contribution rests on a documented approximation — a
   * grandparent (gp affinity is a degraded-mode floor, mechanics-notes §4), a
   * parent with no affinityHint entered, or a parent scaled by a positive
   * affinityHint (the total-as-member overestimate, see module docblock).
   */
  approximate: boolean;
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
 *   no affinityHint falls back to 0 (conservative) and flags `approximate`; a
 *   parent with a POSITIVE affinityHint also flags `approximate` because the
 *   total is fed in as a member score (overestimate). A parent with
 *   affinityHint === 0 applies no scaling — the honest base floor, NOT flagged.
 * - Grandparent-held sparks scale by `opts.grandparentAffinity ?? 0` — a
 *   conservative floor; any grandparent contribution flags `approximate`
 *   (mechanics-notes §4: no flat multiplier exists, so without the member's
 *   real score we under-promise rather than fabricate).
 *
 * Rarity safety (mechanics-notes §8): pass `opts.skillRarity` (a Map or a
 * lookup fn) so the function can SKIP a `whiteSparks` entry whose skill is
 * gold/unique/inherited_unique — those are not white-spark targets and pricing
 * them with the whiteSkill base table fabricates an impossible percent. The
 * green path is unaffected (it grants the 9xxxxx inherited-unique id directly).
 * Without the lookup every recorded whiteSparks entry is priced (fallback).
 *
 * Parents with no matching spark contribute nothing and do NOT affect the
 * `approximate` flag. Returns pct 0 with empty contributions when nothing
 * matches. Full float precision — round at the presentation layer.
 */
export function sparkChance(args: {
  parents: Parent[];
  skillId: string;
  rates: SparkRates;
  opts?: {
    grandparentAffinity?: number;
    /** Resolve a skillId → rarity to gate white-spark pricing (finding 2). */
    skillRarity?: ReadonlyMap<string, SkillRarity> | ((skillId: string) => SkillRarity | undefined);
  };
}): SparkChanceResult {
  const { parents, skillId, rates, opts } = args;
  const contributions: SparkContribution[] = [];
  let approximate = false;

  // A whiteSparks entry only prices when the target skill is white (or its
  // rarity is unknown — fallback). Gold/unique/inherited_unique are skipped.
  const rarityOf = (id: string): SkillRarity | undefined => {
    const lookup = opts?.skillRarity;
    if (!lookup) return undefined;
    return typeof lookup === 'function' ? lookup(id) : lookup.get(id);
  };
  const isWhiteSparkTarget = (id: string): boolean => {
    const rarity = rarityOf(id);
    return rarity === undefined || rarity === 'white';
  };

  for (const parent of parents) {
    // --- sparks held by the parent itself ---------------------------------
    const parentAffinity = parent.affinityHint ?? 0;
    // A positive affinity feeds the lineage TOTAL as a member score (module
    // docblock overestimate); a missing hint falls back to 0. Either way the
    // resulting number is approximate. affinityHint === 0 is the honest floor.
    const parentApprox = parent.affinityHint === undefined || parentAffinity > 0;
    const matching: Array<{ family: SparkFamily; stars: 1 | 2 | 3 }> = [];
    for (const spark of parent.whiteSparks) {
      if (spark.skillId !== skillId) continue;
      // mechanics-notes §8: white-spark factors map only to white skills.
      if (!isWhiteSparkTarget(spark.skillId)) continue;
      matching.push({ family: 'whiteSkill', stars: spark.stars });
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
        approximate: parentApprox,
      });
      if (parentApprox) approximate = true;
    }

    // --- sparks held by this parent's grandparents (ParentRef) ------------
    // ParentRef carries whiteSparks only — green career math for grandparents
    // is unverified anyway (mechanics-notes §1 note, §10 item 3).
    const gpAffinity = opts?.grandparentAffinity ?? 0;
    for (const gp of parent.grandparents ?? []) {
      for (const spark of gp?.whiteSparks ?? []) {
        if (spark.skillId !== skillId) continue;
        if (!isWhiteSparkTarget(spark.skillId)) continue;
        const pEvent = perEventChance(baseProcPct(rates, 'whiteSkill', spark.stars), gpAffinity);
        contributions.push({
          parentId: parent.id,
          grandparent: true,
          stars: spark.stars,
          affinityUsed: gpAffinity,
          pct: perCareerChance(pEvent, rates) * 100,
          approximate: true,
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
 * Combined whole-career spark % across ALL given parents for `skillId`, in a
 * single raw-float pass (review finding: "combinedSparkPct double-rounds").
 *
 * `sparkChance` already does 1 − Π(1 − pCareer_i) over every contribution from
 * every parent, so this is just that function rounded ONCE at the end — no
 * per-parent intermediate rounding. Prefer this for the "all parents together"
 * figure and the contingency sparkPct; `combinedSparkPct(sources)` in
 * coverage.ts stays the back-compat chip-combine variant (documented there).
 *
 * Returns `pct` (rounded to `opts.dp` decimals, default 1) and the `approximate`
 * flag from the same single-pass result. Same affinity/rarity opts as
 * `sparkChance`.
 */
export function combinedSparkChance(args: {
  parents: Parent[];
  skillId: string;
  rates: SparkRates;
  opts?: {
    grandparentAffinity?: number;
    skillRarity?: ReadonlyMap<string, SkillRarity> | ((skillId: string) => SkillRarity | undefined);
    /** Display precision in decimal places (default 1). */
    dp?: number;
  };
}): { pct: number; approximate: boolean } {
  const { parents, skillId, rates, opts } = args;
  const result = sparkChance({ parents, skillId, rates, opts });
  const dp = opts?.dp ?? 1;
  const factor = 10 ** dp;
  return { pct: Math.round(result.pct * factor) / factor, approximate: result.approximate };
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
