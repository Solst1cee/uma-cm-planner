/** Sort helpers. Pure core. */

export type SortDir = 'asc' | 'desc';

/**
 * Comparator over a numeric key where null/undefined always sorts LAST (regardless of `dir`),
 * and null-vs-null returns 0 (stable, never NaN). Used for chart rankings where a missing value
 * (n/a row, no SP cost) should sink to the bottom instead of comparing as -Infinity.
 */
export function nullsLast<T>(
  key: (x: T) => number | null | undefined,
  dir: SortDir = 'desc',
): (a: T, b: T) => number {
  return (a, b) => {
    const av = key(a);
    const bv = key(b);
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    return dir === 'desc' ? bv - av : av - bv;
  };
}
