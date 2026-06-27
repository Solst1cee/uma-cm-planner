import { describe, expect, it } from 'vitest';
import type { CmPlan, Parent } from '@/core/types';
import { aptKeyToPinkKey, candidateScore, topCandidates } from './candidateScore';

const parent = (over: Partial<Parent>): Parent => ({
  id: 'p', umaId: '1', blueSpark: { stat: 'spd', stars: 3 }, pinkSpark: { aptitude: 'long', stars: 2 },
  whiteSparks: [], source: 'mine', ...over,
});
const goals: CmPlan['sparkGoals'] = {
  blue: { spd: 2, sta: 3 },
  pink: [{ aptKey: { kind: 'distance', key: 'long' }, target: 'A' }],
};

describe('candidateScore', () => {
  it('sums min(parentBlueStars, goalStars) over blue goals', () => {
    // spd: min(3,2)=2 ; sta: parent has no sta blue → 0 ; pink long match → +2
    expect(candidateScore(parent({}), goals)).toBe(4);
  });

  it('adds the parent pink stars when the apt matches a pink goal', () => {
    const p = parent({ pinkSpark: { aptitude: 'sprint', stars: 3 } }); // no goal match
    expect(candidateScore(p, goals)).toBe(2); // only the spd blue contributes
  });

  it('bridges AptKey distance "short" to pink "sprint"', () => {
    expect(aptKeyToPinkKey({ kind: 'distance', key: 'short' })).toBe('sprint');
    expect(aptKeyToPinkKey({ kind: 'surface', key: 'turf' })).toBe('turf');
    expect(aptKeyToPinkKey({ kind: 'strategy', key: 'pace' })).toBe('pace');
  });

  it('topCandidates returns the n highest, sorted desc with a stable tie-break', () => {
    const a = parent({ id: 'a', blueSpark: { stat: 'spd', stars: 1 } }); // 1 + 2 = 3
    const b = parent({ id: 'b' }); // 2 + 2 = 4
    const top = topCandidates([a, b], goals, 1);
    expect(top.map((t) => t.parent.id)).toEqual(['b']);
  });
});
