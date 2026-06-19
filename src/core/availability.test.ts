import { describe, it, expect } from 'vitest';
import { isReleasedBy } from './availability';

describe('isReleasedBy', () => {
  it('treats an undated global record as always released', () => {
    expect(isReleasedBy({ server: 'global' }, '2020-01-01')).toBe(true);
  });
  it('treats an undated jp record as never released', () => {
    expect(isReleasedBy({ server: 'jp' }, '2999-01-01')).toBe(false);
  });
  it('gates a dated record by asOf >= releaseDate', () => {
    const rec = { server: 'jp' as const, releaseDate: '2026-07-30' };
    expect(isReleasedBy(rec, '2026-07-29')).toBe(false);
    expect(isReleasedBy(rec, '2026-07-30')).toBe(true); // inclusive: available on release day
    expect(isReleasedBy(rec, '2026-08-01')).toBe(true);
  });
  it('a dated global record is also gated by its date', () => {
    expect(isReleasedBy({ server: 'global', releaseDate: '2026-07-30' }, '2026-07-01')).toBe(false);
  });
});
