import { describe, it, expect } from 'vitest';
import { cornerNumber, cornerLabel, cornerIndexAt } from './corners';

describe('cornerNumber', () => {
  it('labels a normal 1-lap track C1..C4 in order', () => {
    expect([0, 1, 2, 3].map((i) => cornerNumber(4, i))).toEqual([1, 2, 3, 4]);
  });

  it('labels a 1.5-lap wrap track (Hanshin 3200m, 6 corners) C3,C4,C1,C2,C3,C4', () => {
    expect([0, 1, 2, 3, 4, 5].map((i) => cornerNumber(6, i))).toEqual([3, 4, 1, 2, 3, 4]);
  });

  it('always ends on C4 (the last corner before the finish)', () => {
    for (const n of [2, 4, 6, 8]) expect(cornerNumber(n, n - 1)).toBe(4);
  });
});

describe('cornerLabel', () => {
  it('formats as C<n>', () => {
    expect(cornerLabel(6, 0)).toBe('C3');
    expect(cornerLabel(4, 3)).toBe('C4');
  });
});

describe('cornerIndexAt', () => {
  const corners = [
    { start: 100, length: 50 }, // [100, 150)
    { start: 300, length: 80 }, // [300, 380)
  ];
  it('returns the index of the corner segment containing the position', () => {
    expect(cornerIndexAt(corners, 120)).toBe(0);
    expect(cornerIndexAt(corners, 100)).toBe(0); // start inclusive
    expect(cornerIndexAt(corners, 379)).toBe(1);
  });
  it('returns -1 on a straight (no corner contains the position)', () => {
    expect(cornerIndexAt(corners, 200)).toBe(-1);
    expect(cornerIndexAt(corners, 150)).toBe(-1); // end exclusive
    expect(cornerIndexAt(corners, 0)).toBe(-1);
  });
  it('returns -1 for an empty corner list', () => {
    expect(cornerIndexAt([], 120)).toBe(-1);
  });
});
