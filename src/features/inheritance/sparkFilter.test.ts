// src/features/inheritance/sparkFilter.test.ts
import { describe, expect, it } from 'vitest';
import type { Parent } from '@/core/types';
import { aggregate, type SparkAgg } from './sparkAggregate';
import { clauseMatches, matchesFilters, type SparkFilter } from './sparkFilter';

// veteran: pow legacy 3 / total 8; medium legacy 3 / total 6; whites groundwork(total3,legacy2), corner(total1,legacy0)
const agg: SparkAgg = {
  blueTotals: { pow: 8, spd: 2 }, blueLegacy: { stat: 'pow', stars: 3 }, maxBlueTotal: 8,
  pinkTotals: { medium: 6 }, pinkLegacy: { aptitude: 'medium', stars: 3 },
  whites: new Map([['groundwork', { total: 3, legacy: 2 }], ['corner', { total: 1, legacy: 0 }]]),
  greens: new Map([['100151', { total: 4, legacy: 2 }]]),
};
const f = (x: Partial<SparkFilter> & Pick<SparkFilter, 'kind'>): SparkFilter => ({ id: 'x', legacyMin: 0, totalMin: 0, ...(x as object) } as SparkFilter);

describe('clauseMatches', () => {
  it('blue: legacy + total both >=', () => {
    expect(clauseMatches(agg, f({ kind: 'blue', stat: 'pow', legacyMin: 3, totalMin: 8 } as SparkFilter))).toBe(true);
    expect(clauseMatches(agg, f({ kind: 'blue', stat: 'pow', legacyMin: 3, totalMin: 9 } as SparkFilter))).toBe(false); // total only 8
    expect(clauseMatches(agg, f({ kind: 'blue', stat: 'spd', legacyMin: 1, totalMin: 1 } as SparkFilter))).toBe(false); // spd not legacy
  });
  it('pink: legacy + total', () => {
    expect(clauseMatches(agg, f({ kind: 'pink', aptitude: 'medium', legacyMin: 3, totalMin: 6 } as SparkFilter))).toBe(true);
    expect(clauseMatches(agg, f({ kind: 'pink', aptitude: 'long', legacyMin: 0, totalMin: 1 } as SparkFilter))).toBe(false);
  });
  it('white: legacy + total', () => {
    expect(clauseMatches(agg, f({ kind: 'white', skillId: 'groundwork', legacyMin: 2, totalMin: 3 } as SparkFilter))).toBe(true);
    expect(clauseMatches(agg, f({ kind: 'white', skillId: 'corner', legacyMin: 0, totalMin: 1 } as SparkFilter))).toBe(true);
    expect(clauseMatches(agg, f({ kind: 'white', skillId: 'corner', legacyMin: 1, totalMin: 1 } as SparkFilter))).toBe(false); // legacy 0
    expect(clauseMatches(agg, f({ kind: 'white', skillId: 'absent', legacyMin: 0, totalMin: 1 } as SparkFilter))).toBe(false);
  });
  it('green: legacy + total (unique skill id)', () => {
    // greens has 100151 → total 4, legacy 2.
    expect(clauseMatches(agg, f({ kind: 'green', skillId: '100151', legacyMin: 2, totalMin: 4 } as SparkFilter))).toBe(true);
    expect(clauseMatches(agg, f({ kind: 'green', skillId: '100151', legacyMin: 3, totalMin: 4 } as SparkFilter))).toBe(false); // legacy only 2
    expect(clauseMatches(agg, f({ kind: 'green', skillId: '999999', legacyMin: 0, totalMin: 1 } as SparkFilter))).toBe(false); // absent
  });
  it('anyBlue: max stat total >=', () => {
    expect(clauseMatches(agg, { id: 'x', kind: 'anyBlue', totalMin: 8 })).toBe(true);
    expect(clauseMatches(agg, { id: 'x', kind: 'anyBlue', totalMin: 9 })).toBe(false);
  });
});

describe('matchesFilters', () => {
  it('empty filters pass all', () => { expect(matchesFilters(agg, [])).toBe(true); });
  it('example 1: pow legacy3 total8', () => {
    expect(matchesFilters(agg, [{ id: '1', kind: 'blue', stat: 'pow', legacyMin: 3, totalMin: 8 }])).toBe(true);
  });
  it('example 2: groundwork + corner + anyBlue>=8', () => {
    expect(matchesFilters(agg, [
      { id: '1', kind: 'white', skillId: 'groundwork', legacyMin: 0, totalMin: 1 },
      { id: '2', kind: 'white', skillId: 'corner', legacyMin: 0, totalMin: 1 },
      { id: '3', kind: 'anyBlue', totalMin: 8 },
    ])).toBe(true);
  });
  it('example 3: medium legacy3 total6 + anyBlue>=8', () => {
    expect(matchesFilters(agg, [
      { id: '1', kind: 'pink', aptitude: 'medium', legacyMin: 3, totalMin: 6 },
      { id: '2', kind: 'anyBlue', totalMin: 8 },
    ])).toBe(true);
  });

  it('a ◎-variant recorded spark matches an ○-id white clause when the agg is family-normalised', () => {
    // '200362' (◎) normalises to '200361' (○) — same map the picker gets when
    // the container passes `id => toSingleCircle(id, skillById)` to aggregate().
    const vet: Parent = {
      id: 'v', umaId: '101501', source: 'mine',
      blueSpark: { stat: 'pow', stars: 3 }, pinkSpark: { aptitude: 'medium', stars: 3 },
      whiteSparks: [{ skillId: '200362', stars: 2 }],
    };
    const normAgg = aggregate(vet, (id) => (id === '200362' ? '200361' : id));
    expect(clauseMatches(normAgg, { id: '1', kind: 'white', skillId: '200361', legacyMin: 2, totalMin: 2 })).toBe(true);
    expect(clauseMatches(normAgg, { id: '2', kind: 'white', skillId: '200362', legacyMin: 0, totalMin: 1 })).toBe(false); // raw ◎ id no longer keyed
  });
});
