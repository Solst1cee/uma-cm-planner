import { describe, expect, it } from 'vitest';
import { buildAffinityIndex } from './affinity';
import { planLineageAffinity } from './lineageAffinity';
import type { Parent } from './types';

// Two relation groups so aff2/aff3 are non-zero; charaId = floor(umaId/100).
const idx = buildAffinityIndex([
  { relationType: 1, point: 10, members: [10, 20, 30] }, // charas 10,20,30 share type 1
  { relationType: 2, point: 5, members: [10, 20] },      // charas 10,20 share type 2
]);

function parent(umaId: string, wonRaces: string[], gpUmaId?: string, gpWon: string[] = []): Parent {
  return {
    id: `p-${umaId}`,
    umaId,
    blueSpark: { stat: 'spd', stars: 1 },
    pinkSpark: { aptitude: 'turf', stars: 1 },
    whiteSparks: [],
    wonRaces,
    grandparents: gpUmaId ? [{ umaId: gpUmaId, wonRaces: gpWon }, undefined] : undefined,
    source: 'mine',
  };
}

describe('planLineageAffinity', () => {
  it('folds the 2.0 win-bonus into each member score when g1Set provided', () => {
    // trainee chara 10 (uma "1000"); parentA chara 20 (uma "2000") shares race 'X' with parentB.
    const A = parent('2000', ['X']);
    const B = parent('3000', ['X']);
    const g1 = new Set(['X']);
    const res = planLineageAffinity(idx, '1000', A, B, g1);
    // aff2(10,20) over shared types: type1(10)+type2(5)=15; aff2(20,30)=type1=10.
    // parentA score = aff2(T,A)=15 + aff2(A,B)=10 + 0 gp + winBonus.parentA(=sg(A,B)=3) = 28
    expect(res.memberScores.parentA).toBe(28);
  });
  it('win-bonus is 0 when wonRaces are absent', () => {
    const A = parent('2000', []);
    const B = parent('3000', []);
    const res = planLineageAffinity(idx, '1000', A, B);
    // parentA = aff2(T,A)15 + aff2(A,B)10 + 0 = 25
    expect(res.memberScores.parentA).toBe(25);
  });
});

// Minimal empty index → aff terms are 0, so memberScores isolate the win bonus.
const emptyIdx = buildAffinityIndex([]);

const makeParent = (id: string, umaId: string, wonRaces: string[]): Parent => ({
  id, umaId, blueSpark: { stat: 'spd', stars: 1 }, pinkSpark: { aptitude: 'turf', stars: 1 },
  whiteSparks: [], wonRaces, source: 'mine',
});

describe('planLineageAffinity G1 filter', () => {
  it('counts a shared G1 win (id in the set) as +3 on both member scores', () => {
    const a = makeParent('a', '100101', ['10', '11']); // 11 not G1
    const b = makeParent('b', '100201', ['10', '99']);
    const g1 = new Set(['10']);
    const res = planLineageAffinity(emptyIdx, '100301', a, b, g1);
    expect(res.memberScores.parentA).toBe(3);
    expect(res.memberScores.parentB).toBe(3);
  });

  it('does NOT count a shared non-G1 win (over-count fix)', () => {
    const a = makeParent('a', '100101', ['11']); // shared, but 11 ∉ G1
    const b = makeParent('b', '100201', ['11']);
    const g1 = new Set(['10']);
    const res = planLineageAffinity(emptyIdx, '100301', a, b, g1);
    expect(res.memberScores.parentA).toBe(0);
    expect(res.memberScores.parentB).toBe(0);
  });

  it('with no g1Set, contributes no win bonus', () => {
    const a = makeParent('a', '100101', ['10']);
    const b = makeParent('b', '100201', ['10']);
    const res = planLineageAffinity(emptyIdx, '100301', a, b);
    expect(res.memberScores.parentA).toBe(0);
  });
});
