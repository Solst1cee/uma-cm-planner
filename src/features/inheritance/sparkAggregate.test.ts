// src/features/inheritance/sparkAggregate.test.ts
import { describe, expect, it } from 'vitest';
import type { Parent } from '@/core/types';
import { aggregate } from './sparkAggregate';

const veteran: Parent = {
  id: 'v', umaId: '101501', source: 'mine',
  blueSpark: { stat: 'pow', stars: 3 },
  pinkSpark: { aptitude: 'medium', stars: 3 },
  whiteSparks: [{ skillId: '200361', stars: 2 }],
  grandparents: [
    { umaId: '100701', blueSpark: { stat: 'pow', stars: 3 }, pinkSpark: { aptitude: 'medium', stars: 2 }, whiteSparks: [{ skillId: '200361', stars: 1 }] },
    { umaId: '100601', blueSpark: { stat: 'pow', stars: 2 }, pinkSpark: { aptitude: 'long', stars: 1 }, whiteSparks: [{ skillId: '200999', stars: 1 }] },
  ],
};

describe('aggregate', () => {
  it('sums blue across veteran + 2 grandparents and keeps legacy', () => {
    const a = aggregate(veteran);
    expect(a.blueTotals).toEqual({ pow: 8 }); // 3 + 3 + 2
    expect(a.blueLegacy).toEqual({ stat: 'pow', stars: 3 });
    expect(a.maxBlueTotal).toBe(8);
  });

  it('sums pink per aptitude across the lineage', () => {
    const a = aggregate(veteran);
    expect(a.pinkTotals).toEqual({ medium: 5, long: 1 }); // medium 3+2, long 1
    expect(a.pinkLegacy).toEqual({ aptitude: 'medium', stars: 3 });
  });

  it('sums white sparks per skill with legacy = veteran-own only', () => {
    const a = aggregate(veteran);
    expect(a.whites.get('200361')).toEqual({ total: 3, legacy: 2 }); // 2(own) + 1(gp)
    expect(a.whites.get('200999')).toEqual({ total: 1, legacy: 0 }); // gp-only
  });

  it('handles a veteran with no grandparents', () => {
    const a = aggregate({ ...veteran, grandparents: undefined });
    expect(a.blueTotals).toEqual({ pow: 3 });
    expect(a.whites.get('200361')).toEqual({ total: 2, legacy: 2 });
  });

  describe('normalizeWhite (◎ → ○ family id)', () => {
    // '200362' is the ◎ variant of '200361' (○); everything else is standalone.
    const toCircle = (id: string) => (id === '200362' ? '200361' : id);

    it('keys a ◎-variant recorded spark under the ○ family id', () => {
      const vet: Parent = { ...veteran, whiteSparks: [{ skillId: '200362', stars: 2 }], grandparents: undefined };
      const a = aggregate(vet, toCircle);
      expect(a.whites.get('200362')).toBeUndefined();
      expect(a.whites.get('200361')).toEqual({ total: 2, legacy: 2 });
    });

    it('sums stars when ○ and ◎ co-occur across the lineage', () => {
      // veteran holds the ◎ (2★), gp1 holds the ○ (1★) → merged under ○: total 3, legacy 2.
      const vet: Parent = { ...veteran, whiteSparks: [{ skillId: '200362', stars: 2 }] };
      const a = aggregate(vet, toCircle);
      expect(a.whites.get('200361')).toEqual({ total: 3, legacy: 2 });
      expect(a.whites.get('200362')).toBeUndefined();
      expect(a.whites.get('200999')).toEqual({ total: 1, legacy: 0 }); // untouched standalone
    });

    it('leaves greens un-normalised', () => {
      const vet: Parent = { ...veteran, greenSpark: { skillId: '200362', stars: 1 }, grandparents: undefined };
      const a = aggregate(vet, toCircle);
      expect(a.greens.get('200362')).toEqual({ total: 1, legacy: 1 });
    });

    it('defaults to identity when no normaliser is passed', () => {
      const vet: Parent = { ...veteran, whiteSparks: [{ skillId: '200362', stars: 2 }], grandparents: undefined };
      const a = aggregate(vet);
      expect(a.whites.get('200362')).toEqual({ total: 2, legacy: 2 });
    });
  });
});
