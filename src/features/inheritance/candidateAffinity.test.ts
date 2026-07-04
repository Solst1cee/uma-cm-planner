// src/features/inheritance/candidateAffinity.test.ts
import { describe, expect, it } from 'vitest';
import { buildAffinityIndex } from '@/core/affinity';
import type { Parent } from '@/core/types';
import { candidateAffinity } from './candidateAffinity';

// charaIds: trainee 1000, candidate 1007, gp 1006, other 1008
// group with point 5 shared by trainee+candidate → aff2(T,A) = 5
const idx = buildAffinityIndex([
  { relationType: 101, point: 5, members: [1000, 1007] },
  { relationType: 102, point: 3, members: [1007, 1008] }, // candidate+other → cross term 3
]);
const mk = (umaId: string, over: Partial<Parent> = {}): Parent => ({
  id: umaId, umaId, source: 'mine', blueSpark: { stat: 'spd', stars: 1 }, pinkSpark: { aptitude: 'turf', stars: 1 }, whiteSparks: [], ...over,
});

describe('candidateAffinity', () => {
  it('sums trainee↔candidate aff2 (no other slot)', () => {
    // umaId 100700 → charaId 1007 (candidate); trainee 100000 → 1000
    expect(candidateAffinity({ idx, traineeUmaId: '100000', candidate: mk('100700') })).toBe(5);
  });

  it('adds the cross term when the other slot is set', () => {
    // other umaId 100800 → 1008; aff2(1007,1008) = 3 → 5 + 3
    expect(candidateAffinity({ idx, traineeUmaId: '100000', candidate: mk('100700'), other: mk('100800') })).toBe(8);
  });

  it('adds the G1 win bonus from shared G1 wins (raw ids filtered via g1Set)', () => {
    // candidate + other both won G1 race "7001" → +3 to parentA
    const cand = mk('100700', { wonRaces: ['7001'] });
    const other = mk('100800', { wonRaces: ['7001'] });
    const g1Set = new Set(['7001']);
    expect(candidateAffinity({ idx, traineeUmaId: '100000', candidate: cand, other, g1Set })).toBe(8 + 3);
  });

  it('a shared non-G1 win contributes 0 (wonRaces arrive raw, all grades)', () => {
    // "8002" is shared but NOT in the G1 set (e.g. a G2) → no bonus.
    const cand = mk('100700', { wonRaces: ['8002', '7001'] });
    const other = mk('100800', { wonRaces: ['8002'] });
    expect(candidateAffinity({ idx, traineeUmaId: '100000', candidate: cand, other, g1Set: new Set(['7001']) })).toBe(8);
  });

  it('defaults to an empty G1 set → 0 win bonus even for shared wins', () => {
    const cand = mk('100700', { wonRaces: ['7001'] });
    const other = mk('100800', { wonRaces: ['7001'] });
    expect(candidateAffinity({ idx, traineeUmaId: '100000', candidate: cand, other })).toBe(8);
  });

  it('filters grandparent wonRaces too', () => {
    // candidate shares G1 "7001" with its gp and non-G1 "8002" with the other's gp
    // → only the gp-side G1 term (+3) lands on parentA.
    const cand = mk('100700', {
      wonRaces: ['7001', '8002'],
      grandparents: [{ umaId: '100600', blueSpark: { stat: 'spd', stars: 1 }, pinkSpark: { aptitude: 'turf', stars: 1 }, whiteSparks: [], wonRaces: ['7001'] }],
    });
    const other = mk('100800', {
      grandparents: [{ umaId: '100900', blueSpark: { stat: 'spd', stars: 1 }, pinkSpark: { aptitude: 'turf', stars: 1 }, whiteSparks: [], wonRaces: ['8002'] }],
    });
    expect(candidateAffinity({ idx, traineeUmaId: '100000', candidate: cand, other, g1Set: new Set(['7001']) })).toBe(8 + 3);
  });

  it('returns 0 for unknown charas without crashing', () => {
    expect(candidateAffinity({ idx, traineeUmaId: '999900', candidate: mk('888800') })).toBe(0);
  });
});
