/**
 * Tests for the static spark contingency view (Module 4, plan §6 step 5,
 * M4→M2 link). SP math citations: docs/mechanics-notes.md §7 (cumulative
 * 10/20/30/35/40% hint discount, ceil after summing bundled components);
 * spark-proc hint level assumption: §6 + verification queue §10 item 4.
 */
import { describe, expect, it } from 'vitest';

import { SPARK_PROC_ASSUMPTION, computeContingencies } from '@/core/contingency';
import { buildCoverageMatrix, bundledSpCost, effectiveSpCost } from '@/core/coverage';
import {
  FIXTURE_CARDS,
  FIXTURE_PLAN,
  FIXTURE_SKILLS,
  FIXTURE_SPARK_RATES,
} from '@/core/fixtures';
import type { CoverageRow, CoverageSource, Parent, SkillRecord } from '@/core/types';

const rates = FIXTURE_SPARK_RATES;

function getSkill(skillId: string): SkillRecord {
  const skill = FIXTURE_SKILLS.find((s) => s.skillId === skillId);
  if (!skill) throw new Error(`fixture skill ${skillId} missing`);
  return skill;
}

function sparkSource(overrides: Partial<CoverageSource> = {}): CoverageSource {
  return { kind: 'spark', parentId: 'p1', sparkPct: 11.4, approximate: false, ...overrides };
}

function row(skillId: string, sources: CoverageSource[], priority: 1 | 2 | 3 = 1): CoverageRow {
  return { skillId, priority, sources, bestTier: sources[0]?.kind ?? 'uncovered' };
}

describe('computeContingencies', () => {
  it('white skill, no card hints: proc → Lv1 discount (mechanics-notes §7: 10%), miss → full price', () => {
    // 200012 base 90: proc = ceil(90×0.9) = 81; miss = 90; delta = +9.
    const rows = [row('200012', [sparkSource()])];
    const result = computeContingencies({ rows, skills: FIXTURE_SKILLS, rates });
    expect(result).toEqual([
      {
        skillId: '200012',
        sparkPct: 11.4,
        approximate: false,
        spIfProc: 81,
        spIfProcAssumption: SPARK_PROC_ASSUMPTION,
        spIfMiss: 90,
        deltaSp: 9,
      },
    ]);
  });

  it('uses the worst-case Lv1 proc assumption verbatim (P3 — surfaced in the UI)', () => {
    expect(SPARK_PROC_ASSUMPTION).toBe(
      'spark grants the skill hint at Lv1–5; Lv1 (worst case) assumed — distribution unverified (mechanics-notes §6, §10)',
    );
    const rows = [row('200012', [sparkSource()])];
    const result = computeContingencies({ rows, skills: FIXTURE_SKILLS, rates });
    // spIfProc must equal effectiveSpCost at exactly hint Lv1.
    expect(result[0]?.spIfProc).toBe(effectiveSpCost(getSkill('200012'), 1, rates));
  });

  it('NEGATIVE deltaSp is honest: a strong hint card can out-discount the assumed Lv1 proc', () => {
    // Kitasan hint on 200012 at LB4: base 1 + effect-17 passive 2 = Lv3 → 30%
    // off: miss = ceil(90×0.7) = 63 < proc 81 → delta = −18.
    const hint: CoverageSource = { kind: 'hint_strong', cardId: '30028', limitBreak: 4 };
    const rows = [row('200012', [hint, sparkSource()])];
    const result = computeContingencies({
      rows,
      skills: FIXTURE_SKILLS,
      rates,
      cards: FIXTURE_CARDS,
    });
    expect(result[0]?.spIfMiss).toBe(63);
    expect(result[0]?.spIfProc).toBe(81);
    expect(result[0]?.deltaSp).toBe(-18);
  });

  it('gold with prereq: BOTH branches use bundledSpCost (mechanics-notes §7 — sum before one ceil)', () => {
    // 200014 (gold 110, prereq 200012 white 90), no card hints anywhere:
    // proc = ceil(110×0.9 + 90) = 189; miss = ceil(110 + 90) = 200.
    const rows = [row('200014', [sparkSource()])];
    const result = computeContingencies({ rows, skills: FIXTURE_SKILLS, rates });
    const gold = getSkill('200014');
    const white = getSkill('200012');
    expect(result[0]?.spIfProc).toBe(bundledSpCost(gold, white, 1, 0, rates));
    expect(result[0]?.spIfProc).toBe(189);
    expect(result[0]?.spIfMiss).toBe(bundledSpCost(gold, white, 0, 0, rates));
    expect(result[0]?.spIfMiss).toBe(200);
    expect(result[0]?.deltaSp).toBe(11);
  });

  it("gold with prereq: the prereq's hint level comes from the prereq's own coverage row, same in both branches", () => {
    // Prereq 200012 row has Kitasan hint Lv3 (30% off → 63 component):
    // proc = ceil(110×0.9 + 63) = 162; miss = ceil(110 + 63) = 173.
    const hint: CoverageSource = { kind: 'hint_strong', cardId: '30028', limitBreak: 4 };
    const rows = [row('200014', [sparkSource()]), row('200012', [hint], 2)];
    const result = computeContingencies({
      rows,
      skills: FIXTURE_SKILLS,
      rates,
      cards: FIXTURE_CARDS,
    });
    // Only the spark-covered row yields a contingency.
    expect(result).toHaveLength(1);
    expect(result[0]?.skillId).toBe('200014');
    expect(result[0]?.spIfProc).toBe(162);
    expect(result[0]?.spIfMiss).toBe(173);
    expect(result[0]?.deltaSp).toBe(11);
  });

  it('gold whose prereq is missing from the dataset degrades to pricing the gold alone', () => {
    const orphanGold: SkillRecord = {
      skillId: '999001',
      nameEn: 'Orphan Gold',
      nameJp: '',
      baseSpCost: 120,
      rarity: 'gold',
      prereqSkillId: '999000', // not in the dataset
      conditions: '',
      server: 'global',
      dataVersion: 'test',
    };
    const rows = [row('999001', [sparkSource()])];
    const result = computeContingencies({ rows, skills: [orphanGold], rates });
    expect(result[0]?.spIfProc).toBe(108); // ceil(120×0.9)
    expect(result[0]?.spIfMiss).toBe(120);
    expect(result[0]?.deltaSp).toBe(12);
  });

  it('combines multiple spark sources into one sparkPct and ORs approximate', () => {
    const rows = [
      row('200012', [
        sparkSource({ parentId: 'a', sparkPct: 11.4 }),
        sparkSource({ parentId: 'b', sparkPct: 22, approximate: true }),
      ]),
    ];
    const result = computeContingencies({ rows, skills: FIXTURE_SKILLS, rates });
    expect(result[0]?.sparkPct).toBe(30.9); // 1 − (1−0.114)(1−0.22)
    expect(result[0]?.approximate).toBe(true);
  });

  it('skips rows without spark sources and rows whose skillId is not in the dataset', () => {
    const hint: CoverageSource = { kind: 'hint_strong', cardId: '30028', limitBreak: 4 };
    const rows = [
      row('200012', [hint]), // no spark source
      row('123456', [sparkSource()]), // unknown skill: no honest SP number
    ];
    expect(computeContingencies({ rows, skills: FIXTURE_SKILLS, rates })).toEqual([]);
  });

  it('end-to-end: rows from buildCoverageMatrix(parents) feed straight in', () => {
    const parent: Parent = {
      id: 'parent-a',
      umaId: '100201',
      blueSpark: { stat: 'spd', stars: 3 },
      pinkSpark: { aptitude: 'turf', stars: 3 },
      whiteSparks: [{ skillId: '200012', stars: 1 }],
      affinityHint: 95,
      source: 'mine',
    };
    const rows = buildCoverageMatrix({
      plan: { ...FIXTURE_PLAN, targetSkills: [{ skillId: '200012', priority: 1 }] },
      inventory: [{ cardId: '30028', limitBreak: 4 }],
      cards: FIXTURE_CARDS,
      skills: FIXTURE_SKILLS,
      parents: [parent],
      rates,
    });
    const result = computeContingencies({
      rows,
      skills: FIXTURE_SKILLS,
      rates,
      cards: FIXTURE_CARDS,
    });
    expect(result).toEqual([
      {
        skillId: '200012',
        sparkPct: 11.4, // Ice AO1065, 1dp
        approximate: false,
        spIfProc: 81,
        spIfProcAssumption: SPARK_PROC_ASSUMPTION,
        spIfMiss: 63, // Kitasan hint Lv3
        deltaSp: -18,
      },
    ]);
  });
});
