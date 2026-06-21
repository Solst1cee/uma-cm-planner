import { describe, it, expect } from 'vitest';
import { nullsLast } from './compare';

describe('nullsLast', () => {
  const id = (n: number | null) => n;

  it('sorts non-null descending by default, nulls last', () => {
    expect([3, null, 1, null, 2].sort(nullsLast(id))).toEqual([3, 2, 1, null, null]);
  });

  it('sorts ascending when dir=asc, still nulls last', () => {
    expect([3, null, 1, 2].sort(nullsLast(id, 'asc'))).toEqual([1, 2, 3, null]);
  });

  it('keeps null-vs-null stable (returns 0, never NaN)', () => {
    const cmp = nullsLast<number | null>(id);
    expect(cmp(null, null)).toBe(0);
    expect(cmp(null, 5)).toBe(1);
    expect(cmp(5, null)).toBe(-1);
  });

  it('treats undefined like null', () => {
    expect([2, undefined, 1].sort(nullsLast<number | undefined>((x) => x))).toEqual([2, 1, undefined]);
  });
});
