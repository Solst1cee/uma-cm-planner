/**
 * public/data/spark_rates.json — hand-encoded inheritance mechanics constants.
 * Every number cites docs/mechanics-notes.md (Phase 0 verified, 2026-06-12).
 * P3: provisional values stay flagged so the UI renders them as approximate.
 */
import type { SparkRates } from '@/core/types';

export function buildSparkRates(): SparkRates {
  return {
    // mechanics-notes §2 — base proc % per inspiration event by 1★/2★/3★.
    baseProcPctByStars: {
      blue: [70, 80, 90],
      pink: [1, 3, 5],
      green: [5, 10, 15],
      whiteSkill: [3, 6, 9],
      whiteRace: [1, 2, 3],
      whiteScenario: [3, 6, 9],
    },
    // mechanics-notes §1 — Classic April + Senior April.
    inspirationEvents: 2,
    // mechanics-notes §3 — per-member multiplicative scaling, no flat gp factor (§4).
    affinityScaling: 'per_member_multiplicative_pct',
    // mechanics-notes §5.
    pink: {
      careerStartStepThresholds: [1, 4, 7, 10],
      careerStartMaxSteps: 4,
      careerStartCap: 'A',
      sToSRequiresInRunProcAtA: true,
    },
    // mechanics-notes §6 — deterministic career-start stat points.
    blueCareerStartByStars: [5, 12, 21],
    // mechanics-notes §6 — PROVISIONAL (single-origin, disputed by GameWith).
    blueInRunRollRange: { 1: [1, 10], 2: [1, 16], 3: [1, 28] },
    blueInRunRollRangeProvisional: true,
    // mechanics-notes §7 — cumulative 10/20/30/35/40, cap 40.
    hintDiscountCumulativePct: [10, 20, 30, 35, 40],
    // mechanics-notes §7 — Fast Learner ×0.9.
    fastLearnerMultiplier: 0.9,
    // INTENTIONALLY a mechanics-verification version, NOT the upstream data
    // commit ('global-c1fa2107' on skills/cards/umas): these constants come from
    // community research (docs/mechanics-notes.md), not the borrowed dataset, so
    // they version on the date they were verified. Bump when mechanics change.
    dataVersion: 'global-2026-06',
  };
}
