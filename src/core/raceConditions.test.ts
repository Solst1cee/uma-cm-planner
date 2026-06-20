import { describe, it, expect } from 'vitest';
import { defaultConditions } from './raceConditions';

describe('defaultConditions', () => {
  it('derives season from the CM month and defaults ground/weather', () => {
    expect(defaultConditions('2026-07-15')).toEqual({ ground: 'good', weather: 'sunny', season: 'summer' });
    expect(defaultConditions('2026-01-15').season).toBe('winter');
    expect(defaultConditions('2026-04-15').season).toBe('spring');
    expect(defaultConditions('2026-10-15').season).toBe('fall');
  });
  it('falls back to spring when the date is missing/unparseable', () => {
    expect(defaultConditions(undefined)).toEqual({ ground: 'good', weather: 'sunny', season: 'spring' });
    expect(defaultConditions('').season).toBe('spring');
  });
});
