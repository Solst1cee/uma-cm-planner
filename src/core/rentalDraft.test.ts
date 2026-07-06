import { describe, expect, it } from 'vitest';
import { forcedTierScore, seedFromTargetSpark, draftToSyntheticParent } from './rentalDraft';

describe('forcedTierScore', () => {
  it('maps tiers to representative affinity scores', () => {
    expect(forcedTierScore('triangle')).toBe(25);
    expect(forcedTierScore('single')).toBe(100);
    expect(forcedTierScore('double')).toBe(175);
  });
});

describe('seedFromTargetSpark', () => {
  it('seeds blue (totalMin=stars) and white (totalMin=1) clauses; pink stays manual', () => {
    const out = seedFromTargetSpark({ blue: [{ stat: 'pow', stars: 6 }], white: [{ id: '200201' }] });
    expect(out).toEqual([
      { id: 'seed-blue-pow', kind: 'blue', stat: 'pow', legacyMin: 0, totalMin: 6 },
      { id: 'seed-white-200201', kind: 'white', skillId: '200201', legacyMin: 0, totalMin: 1 },
    ]);
  });

  it('seeds green (unique) ids as GREEN clauses, not white', () => {
    const out = seedFromTargetSpark({ blue: [], white: [{ id: '200201' }], green: [{ id: '100011' }] });
    expect(out).toContainEqual({ id: 'seed-green-100011', kind: 'green', skillId: '100011', legacyMin: 0, totalMin: 1 });
    expect(out).toContainEqual({ id: 'seed-white-200201', kind: 'white', skillId: '200201', legacyMin: 0, totalMin: 1 });
    // the unique id must NOT also appear as a white clause
    expect(out.some((f) => f.kind === 'white' && f.skillId === '100011')).toBe(false);
  });
});

describe('draftToSyntheticParent', () => {
  it('carries white clauses + first green as sparks and sets affinityHint to the forced score', () => {
    const p = draftToSyntheticParent({ forcedTier: 'double', filters: [
      { id: 'w1', kind: 'white', skillId: '200201', legacyMin: 0, totalMin: 2 },
      { id: 'w2', kind: 'white', skillId: '200301', legacyMin: 0, totalMin: 1 },
      { id: 'g1', kind: 'green', skillId: '100011', legacyMin: 1, totalMin: 1 },
    ] });
    expect(p.affinityHint).toBe(175);
    expect(p.source).toBe('friend_rental');
    expect(p.whiteSparks.map((w) => w.skillId)).toEqual(['200201', '200301']);
    expect(p.greenSpark?.skillId).toBe('100011');
    expect(p.id).toBe('__rental_draft__');
  });
});
