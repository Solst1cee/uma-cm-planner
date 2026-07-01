// src/core/g1Saddle.test.ts
import { describe, expect, it } from 'vitest';
import { filterG1, isG1Saddle } from './g1Saddle';

const G1 = new Set(['10', '14', '18']);

describe('isG1Saddle', () => {
  it('is true only for ids in the G1 set', () => {
    expect(isG1Saddle('10', G1)).toBe(true);
    expect(isG1Saddle('11', G1)).toBe(false);
  });
});

describe('filterG1', () => {
  it('keeps only G1 saddle ids', () => {
    expect(filterG1(['6', '10', '11', '14', '26'], G1)).toEqual(['10', '14']);
  });
  it('returns [] for undefined wonRaces', () => {
    expect(filterG1(undefined, G1)).toEqual([]);
  });
  it('returns [] when the G1 set is empty (safe under-count, no fabrication)', () => {
    expect(filterG1(['10', '14'], new Set())).toEqual([]);
  });
});
