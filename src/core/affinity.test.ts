import { describe, it, expect } from 'vitest';
import { buildAffinityIndex, aff2, aff3, affinityTier, charaIdOf, computeLineageAffinity } from './affinity';
import type { AffinityGroup } from './types';

const GROUPS: AffinityGroup[] = [
  { relationType: 100, point: 2, members: [1, 2, 3] },
  { relationType: 101, point: 2, members: [1, 2] },
  { relationType: 102, point: 2, members: [3, 4] },
];

describe('aff2 / aff3', () => {
  const idx = buildAffinityIndex(GROUPS);
  it('aff2 sums points over shared types and is symmetric', () => {
    expect(aff2(idx, 1, 2)).toBe(4);
    expect(aff2(idx, 2, 1)).toBe(4);
    expect(aff2(idx, 1, 3)).toBe(2);
    expect(aff2(idx, 1, 4)).toBe(0);
  });
  it('aff3 needs all three in one type, order-independent', () => {
    expect(aff3(idx, 1, 2, 3)).toBe(2);
    expect(aff3(idx, 3, 2, 1)).toBe(2);
    expect(aff3(idx, 1, 2, 4)).toBe(0);
  });
});

describe('affinityTier', () => {
  it('△ 0–50 / ○ 51–150 / ◎ 151+', () => {
    expect(affinityTier(0)).toBe('△');
    expect(affinityTier(50)).toBe('△');
    expect(affinityTier(51)).toBe('○');
    expect(affinityTier(150)).toBe('○');
    expect(affinityTier(151)).toBe('◎');
  });
});

describe('charaIdOf', () => {
  it('maps umaId → 4-digit charaId', () => {
    expect(charaIdOf('100201')).toBe(1002);
    expect(charaIdOf('100101')).toBe(1001);
  });
});

describe('computeLineageAffinity', () => {
  const idx = buildAffinityIndex(GROUPS);
  it('computes member scores from the formula; grandparents optional', () => {
    const r = computeLineageAffinity(idx, { trainee: 1, parentA: 2, parentB: 3 });
    expect(r.aff2.tA).toBe(4);
    expect(r.aff2.tB).toBe(2);
    expect(r.aff2.aB).toBe(2);
    expect(r.memberScores.parentA).toBe(6);
    expect(r.memberScores.parentB).toBe(4);
    expect(r.tiers.parentA).toBe('△');
    expect(r.staticOnly).toBe(true);
    expect(r.displayTotal).toBe(r.memberScores.parentA + r.memberScores.parentB);
  });
  it('includes grandparent aff3 terms when provided', () => {
    const r = computeLineageAffinity(idx, { trainee: 1, parentA: 2, parentB: 3, gA1: 3 });
    expect(r.aff3.tA_gA1).toBe(2);
    expect(r.memberScores.gA1).toBe(2);
    expect(r.memberScores.parentA).toBe(8);
  });
});
