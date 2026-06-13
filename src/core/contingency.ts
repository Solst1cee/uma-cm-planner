/**
 * Module 4 core — static spark contingency view (plan §6, links M4→M2).
 *
 * For every coverage row that has at least one 'spark' source, compute the
 * two SP branches: "if the spark procs → buy at the proc-granted hint
 * discount; else → buy at the card-derived hint level (or full price)".
 * v1 is a static display; Module 2 will auto-recompute (plan §6).
 *
 * Honest-numbers notes (P3):
 * - A white skill-spark proc grants the skill at hint Lv1–5, distribution
 *   UNVERIFIED (mechanics-notes §6; verification queue §10 item 4). We assume
 *   Lv1 — the worst case — and surface that assumption verbatim in the UI
 *   via spIfProcAssumption.
 * - deltaSp = spIfMiss − spIfProc (the SP to budget for the miss branch). In-game
 *   hint levels only ACCUMULATE: a spark proc grants the skill at Lv1+, and any
 *   card hint takes the user gets stack on top — so a proc can never leave the
 *   skill MORE expensive than a miss. We therefore price spIfProc at the
 *   conservative floor effectiveHintLevel = max(PROC_HINT_LEVEL, missHintLevel),
 *   guaranteeing spIfProc <= spIfMiss (deltaSp >= 0). The verbatim Lv1
 *   assumption string is still shown for the spark's own grant, but the SP uses
 *   the floor (review finding: "Contingency proc branch can cost more than miss").
 * - inherited_unique targets (green sparks, all baseSpCost 200 in shipped data)
 *   are obtainable ONLY via inheritance — there is no SP purchase path
 *   (mechanics-notes §8). For such a row the MISS branch is "not obtainable":
 *   spIfMiss and deltaSp are set to Infinity (the frozen type has number fields
 *   only; the UI renders Infinity as not-obtainable). spIfProc stays a real
 *   number — the proc is the only way in (review finding: "Contingency miss
 *   branch prices an inherited-unique skill that cannot be bought").
 * - Gold targets with a white prereq price BOTH branches with bundledSpCost
 *   (components summed before one ceil — mechanics-notes §7). The prereq's
 *   own hint level is taken from the prereq's coverage row when it is also a
 *   target (same in both branches: the spark affects only the target skill);
 *   otherwise 0. A prereq missing from the dataset degrades to pricing the
 *   gold alone rather than fabricating a bundle.
 */
import {
  bundledSpCost,
  combinedSparkPct,
  effectiveSpCost,
  expectedHintLevel,
  type HintLevel,
} from '@/core/coverage';
import type {
  CoverageRow,
  SkillRecord,
  SparkContingency,
  SparkRates,
  SupportCardRecord,
} from '@/core/types';

/** Shown verbatim in the UI next to spIfProc (P3). */
export const SPARK_PROC_ASSUMPTION =
  'spark grants the skill hint at Lv1–5; Lv1 (worst case) assumed — distribution unverified (mechanics-notes §6, §10)';

/** The hint level we assume a spark proc grants (worst case of Lv1–5). */
const PROC_HINT_LEVEL: HintLevel = 1;

/**
 * Best card-derived hint level across a row's sources — what the user gets
 * if the spark misses. Needs the card records for the Hint Levels passive
 * (effect 17, mechanics-notes §9); without them expectedHintLevel degrades
 * to its base-1 hint default. 0 when no hint source exists.
 */
function bestCardHintLevel(
  row: CoverageRow,
  cardById: ReadonlyMap<string, SupportCardRecord>,
): HintLevel {
  let best: HintLevel = 0;
  for (const source of row.sources) {
    const card = source.cardId !== undefined ? cardById.get(source.cardId) : undefined;
    const cardSkill = card?.skills.find(
      (cs) => cs.skillId === row.skillId && cs.sourceType === 'hint_pool',
    );
    const level = expectedHintLevel(source, card, cardSkill);
    if (level > best) best = level;
  }
  return best;
}

/**
 * One SparkContingency per row with ≥1 'spark' source. Rows whose skillId is
 * missing from `skills` are skipped — no baseSpCost means no honest SP number
 * (P3: skip rather than fabricate). `cards` is optional but recommended: it
 * feeds the effect-17 hint passive into the miss branch.
 */
export function computeContingencies(args: {
  rows: CoverageRow[];
  skills: SkillRecord[];
  rates: SparkRates;
  cards?: SupportCardRecord[];
}): SparkContingency[] {
  const { rows, skills, rates, cards } = args;
  const skillById = new Map(skills.map((s) => [s.skillId, s]));
  const cardById = new Map((cards ?? []).map((c) => [c.cardId, c]));
  const rowBySkillId = new Map(rows.map((r) => [r.skillId, r]));

  const out: SparkContingency[] = [];
  for (const row of rows) {
    const sparkSources = row.sources.filter((s) => s.kind === 'spark');
    if (sparkSources.length === 0) continue;
    const skill = skillById.get(row.skillId);
    if (!skill) continue; // unknown skill: cannot price either branch

    const missLevel = bestCardHintLevel(row, cardById);
    // Hint levels only accumulate in-game: the proc grants Lv1, then any card
    // hint takes stack on top. Price the proc at the conservative floor so it
    // can never cost MORE than the miss (deltaSp >= 0). The displayed
    // assumption string still names the Lv1 spark grant; only the SP uses this.
    const procLevel = Math.max(PROC_HINT_LEVEL, missLevel) as HintLevel;
    const prereq =
      skill.prereqSkillId !== undefined ? skillById.get(skill.prereqSkillId) : undefined;

    let spIfProc: number;
    let spIfMiss: number;
    if (prereq) {
      // Gold + white prereq bought together (mechanics-notes §7 bundling).
      const prereqRow = rowBySkillId.get(prereq.skillId);
      const prereqLevel = prereqRow ? bestCardHintLevel(prereqRow, cardById) : 0;
      spIfProc = bundledSpCost(skill, prereq, procLevel, prereqLevel, rates);
      spIfMiss = bundledSpCost(skill, prereq, missLevel, prereqLevel, rates);
    } else {
      spIfProc = effectiveSpCost(skill, procLevel, rates);
      spIfMiss = effectiveSpCost(skill, missLevel, rates);
    }

    // inherited_unique skills (green sparks) cannot be bought — inheritance is
    // the only path (mechanics-notes §8). The miss branch is not obtainable:
    // render it as Infinity (the frozen type is number-only; UI shows ∞ / "not
    // obtainable"). spIfProc stays the real number — the proc is the only way in.
    if (skill.rarity === 'inherited_unique') {
      spIfMiss = Infinity;
    }

    out.push({
      skillId: row.skillId,
      sparkPct: combinedSparkPct(row.sources),
      approximate: sparkSources.some((s) => s.approximate === true),
      spIfProc,
      spIfProcAssumption: SPARK_PROC_ASSUMPTION,
      spIfMiss,
      // Type docblock contract: deltaSp = spIfMiss − spIfProc. Infinity when the
      // miss branch is not obtainable (inherited_unique).
      deltaSp: spIfMiss - spIfProc,
    });
  }
  return out;
}
