import { describe, expect, it } from 'vitest';
import { computeWinBonus, sharedG1 } from './winBonus';

describe('sharedG1 (2.0: +3 per shared G1 race)', () => {
  it('is 0 for disjoint or missing sets', () => {
    expect(sharedG1(['1001'], ['1002'])).toBe(0);
    expect(sharedG1(undefined, ['1001'])).toBe(0);
    expect(sharedG1(['1001'], [])).toBe(0);
  });
  it('grants +3 per shared id (deduped)', () => {
    expect(sharedG1(['1001'], ['1001'])).toBe(3);
    expect(sharedG1(['1001', '1002', '1003'], ['1002', '1003'])).toBe(6);
    expect(sharedG1(['1001', '1001'], ['1001'])).toBe(3); // dedupe
  });
});

describe('computeWinBonus (full 6-member assembly)', () => {
  it('routes shared G1 wins to each member per mechanics-notes §3', () => {
    // P1 shares race 'A' with P2, 'B' with its gA1; P2 shares 'C' with its gB2.
    const wb = computeWinBonus({
      parentA: { wonRaces: ['A', 'B'] },
      parentB: { wonRaces: ['A', 'C'] },
      gA1: { wonRaces: ['B'] },
      gA2: { wonRaces: [] },
      gB1: { wonRaces: [] },
      gB2: { wonRaces: ['C'] },
    });
    // sg(P1,P2)=3 (A); sg(P1,gA1)=3 (B); sg(P2,gB2)=3 (C); others 0
    expect(wb).toEqual({
      parentA: 6, // sg(P1,P2)=3 + sg(P1,gA1)=3 + sg(P1,gA2)=0
      parentB: 6, // sg(P2,P1)=3 + sg(P2,gB1)=0 + sg(P2,gB2)=3
      gA1: 3,
      gA2: 0,
      gB1: 0,
      gB2: 3,
    });
  });
  it('is all-zero when no wonRaces are present', () => {
    expect(computeWinBonus({ parentA: {}, parentB: {} })).toEqual({
      parentA: 0, parentB: 0, gA1: 0, gA2: 0, gB1: 0, gB2: 0,
    });
  });
});
