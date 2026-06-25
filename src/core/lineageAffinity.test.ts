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
  it('folds the 2.0 win-bonus into each member score', () => {
    // trainee chara 10 (uma "1000"); parentA chara 20 (uma "2000") shares race 'X' with parentB.
    const A = parent('2000', ['X']);
    const B = parent('3000', ['X']);
    const res = planLineageAffinity(idx, '1000', A, B);
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
