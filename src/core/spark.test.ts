/**
 * Tests for sparkChance (Module 4, plan §6 step 4).
 *
 * GOLDEN TESTS reproduce Ice's Affinity & Inspirations sheet (plan §12
 * validation target). Source artifact: spikes/web/ice-sheet.xlsx (retrieved
 * 2026-06-11), XML extraction at spikes/web/ice-sheet/. Golden cells come
 * from the 'Complete Distribution Table' tab — the sheet's precomputed
 * 1 − (1 − p_event)² career table (column AO = "≥1 proc per career", header
 * row 7) under the tab's affinity assumptions: parent affinity 95 (cell C6),
 * grandparent affinity 21 (cell F6). Test names cite tab + cell.
 *
 * Mechanics model citations: docs/mechanics-notes.md §1 (n=2 inspiration
 * events; exact formula = Ice sheet `non_zero_career`, Full Custom
 * Calculation CB18), §2 (base proc table), §3 (per-member affinity scaling,
 * worked example 0.03 × 1.95 = 0.0585), §4 (NO flat grandparent multiplier).
 */
import { describe, expect, it } from 'vitest';

import { parentCoversSkill, sparkChance } from '@/core/spark';
import { FIXTURE_SPARK_RATES } from '@/core/fixtures';
import type { Parent } from '@/core/types';

const rates = FIXTURE_SPARK_RATES;
const SKILL = '200012';

function makeParent(overrides: Partial<Parent> & Pick<Parent, 'id'>): Parent {
  return {
    umaId: '100201',
    blueSpark: { stat: 'spd', stars: 3 },
    pinkSpark: { aptitude: 'turf', stars: 3 },
    whiteSparks: [],
    source: 'mine',
    ...overrides,
  };
}

// --- goldens: white skill sparks ('Skill' block, rows 1058+) ----------------

describe('sparkChance — Ice sheet goldens (Complete Distribution Table)', () => {
  it('AO1065: white skill 1★ on a parent at affinity 95 → 11.357775% (pEvent 0.03×1.95=0.0585, mechanics-notes §3)', () => {
    const parent = makeParent({
      id: 'p1',
      whiteSparks: [{ skillId: SKILL, stars: 1 }],
      affinityHint: 95,
    });
    const result = sparkChance({ parents: [parent], skillId: SKILL, rates });
    expect(result.pct).toBeCloseTo(11.357775, 9);
    expect(result.approximate).toBe(false);
    expect(result.contributions).toHaveLength(1);
    expect(result.contributions[0]).toMatchObject({
      parentId: 'p1',
      grandparent: false,
      stars: 1,
      affinityUsed: 95,
    });
    expect(result.contributions[0]?.pct).toBeCloseTo(11.357775, 9);
  });

  it('AO1086: white skill 2★ on a parent at affinity 95 → 22.0311%', () => {
    const parent = makeParent({
      id: 'p1',
      whiteSparks: [{ skillId: SKILL, stars: 2 }],
      affinityHint: 95,
    });
    const result = sparkChance({ parents: [parent], skillId: SKILL, rates });
    expect(result.pct).toBeCloseTo(22.0311, 9);
  });

  it('AO1085: white skill 1★ on EACH of two parents at affinity 95 → 21.4255594705% (independent members combine, mechanics-notes §2 semantics)', () => {
    const parents = [
      makeParent({ id: 'p1', whiteSparks: [{ skillId: SKILL, stars: 1 }], affinityHint: 95 }),
      makeParent({ id: 'p2', whiteSparks: [{ skillId: SKILL, stars: 1 }], affinityHint: 95 }),
    ];
    const result = sparkChance({ parents, skillId: SKILL, rates });
    expect(result.pct).toBeCloseTo(21.42555947049376, 8);
    expect(result.contributions).toHaveLength(2);
  });

  it('AO1059: white skill 1★ on a grandparent at affinity 21 → 7.128231%, approximate (mechanics-notes §4: gp affinity is a degraded-mode input)', () => {
    const parent = makeParent({
      id: 'p1',
      affinityHint: 95,
      grandparents: [{ umaId: '100101', whiteSparks: [{ skillId: SKILL, stars: 1 }] }, undefined],
    });
    const result = sparkChance({
      parents: [parent],
      skillId: SKILL,
      rates,
      opts: { grandparentAffinity: 21 },
    });
    expect(result.pct).toBeCloseTo(7.128231, 9);
    expect(result.approximate).toBe(true);
    expect(result.contributions).toEqual([
      expect.objectContaining({ parentId: 'p1', grandparent: true, stars: 1, affinityUsed: 21 }),
    ]);
  });

  it('AO1070: white skill 1★ parent (aff 95) + 1★ grandparent (aff 21) → 17.6763975615%', () => {
    const parent = makeParent({
      id: 'p1',
      whiteSparks: [{ skillId: SKILL, stars: 1 }],
      affinityHint: 95,
      grandparents: [{ umaId: '100101', whiteSparks: [{ skillId: SKILL, stars: 1 }] }, undefined],
    });
    const result = sparkChance({
      parents: [parent],
      skillId: SKILL,
      rates,
      opts: { grandparentAffinity: 21 },
    });
    expect(result.pct).toBeCloseTo(17.676397561539758, 8);
    expect(result.contributions).toHaveLength(2);
    expect(result.approximate).toBe(true);
  });

  // --- goldens: green (inherited unique) sparks ('Green' block, rows 708+) --

  it('AO715: green 1★ on a parent at affinity 95 → 18.549375% (green base 5/10/15, mechanics-notes §2)', () => {
    const parent = makeParent({
      id: 'p1',
      greenSpark: { skillId: '900021', stars: 1 },
      affinityHint: 95,
    });
    const result = sparkChance({ parents: [parent], skillId: '900021', rates });
    expect(result.pct).toBeCloseTo(18.549375, 9);
    expect(result.approximate).toBe(false);
  });

  it('AO736: green 2★ on a parent at affinity 95 → 35.1975%', () => {
    const parent = makeParent({
      id: 'p1',
      greenSpark: { skillId: '900021', stars: 2 },
      affinityHint: 95,
    });
    const result = sparkChance({ parents: [parent], skillId: '900021', rates });
    expect(result.pct).toBeCloseTo(35.1975, 9);
  });
});

// --- model behavior ----------------------------------------------------------

describe('sparkChance — model behavior', () => {
  it('clamps pEvent at 100% (mechanics-notes §3): white 3★ at absurd affinity → exactly 100%', () => {
    const parent = makeParent({
      id: 'p1',
      whiteSparks: [{ skillId: SKILL, stars: 3 }],
      affinityHint: 100000,
    });
    const result = sparkChance({ parents: [parent], skillId: SKILL, rates });
    expect(result.pct).toBe(100);
  });

  it('returns 0 with empty contributions when nothing matches', () => {
    const parent = makeParent({
      id: 'p1',
      whiteSparks: [{ skillId: '999999', stars: 3 }],
      affinityHint: 95,
    });
    expect(sparkChance({ parents: [parent], skillId: SKILL, rates })).toEqual({
      pct: 0,
      approximate: false,
      contributions: [],
    });
  });

  it('missing affinityHint on a CONTRIBUTING parent → affinity 0 fallback, approximate (white 1★ base-only: 1−0.97² = 5.91%)', () => {
    const parent = makeParent({ id: 'p1', whiteSparks: [{ skillId: SKILL, stars: 1 }] });
    const result = sparkChance({ parents: [parent], skillId: SKILL, rates });
    expect(result.pct).toBeCloseTo(5.91, 10);
    expect(result.approximate).toBe(true);
    expect(result.contributions[0]?.affinityUsed).toBe(0);
  });

  it('missing affinityHint on a NON-contributing parent does not flag approximate', () => {
    const parents = [
      makeParent({ id: 'bystander' }), // no sparks, no hint
      makeParent({ id: 'p1', whiteSparks: [{ skillId: SKILL, stars: 1 }], affinityHint: 95 }),
    ];
    const result = sparkChance({ parents, skillId: SKILL, rates });
    expect(result.approximate).toBe(false);
    expect(result.contributions).toHaveLength(1);
  });

  it('grandparent affinity defaults to 0 (conservative floor, NEVER a flat ×0.5 — mechanics-notes §4) and flags approximate', () => {
    const parent = makeParent({
      id: 'p1',
      affinityHint: 95,
      grandparents: [{ umaId: '100101', whiteSparks: [{ skillId: SKILL, stars: 1 }] }, undefined],
    });
    const result = sparkChance({ parents: [parent], skillId: SKILL, rates });
    // base-only 1★: 1 − (1 − 0.03)² = 5.91% — no fabricated multiplier.
    expect(result.pct).toBeCloseTo(5.91, 10);
    expect(result.approximate).toBe(true);
    expect(result.contributions[0]?.affinityUsed).toBe(0);
  });

  it('green spark only matches its own (9xxxxx inherited-unique) skillId — mechanics-notes §8', () => {
    const parent = makeParent({
      id: 'p1',
      greenSpark: { skillId: '900021', stars: 3 },
      affinityHint: 95,
    });
    expect(sparkChance({ parents: [parent], skillId: '900022', rates }).contributions).toEqual([]);
    expect(
      sparkChance({ parents: [parent], skillId: '900021', rates }).contributions,
    ).toHaveLength(1);
  });
});

// --- parentCoversSkill --------------------------------------------------------

describe('parentCoversSkill', () => {
  it('true for parent white spark, green spark, and grandparent white spark', () => {
    expect(
      parentCoversSkill(
        makeParent({ id: 'p', whiteSparks: [{ skillId: SKILL, stars: 1 }] }),
        SKILL,
      ),
    ).toBe(true);
    expect(
      parentCoversSkill(makeParent({ id: 'p', greenSpark: { skillId: '900021', stars: 1 } }), '900021'),
    ).toBe(true);
    expect(
      parentCoversSkill(
        makeParent({
          id: 'p',
          grandparents: [undefined, { umaId: '100101', whiteSparks: [{ skillId: SKILL, stars: 2 }] }],
        }),
        SKILL,
      ),
    ).toBe(true);
  });

  it('false when no lineage member holds the spark', () => {
    expect(parentCoversSkill(makeParent({ id: 'p' }), SKILL)).toBe(false);
  });
});
