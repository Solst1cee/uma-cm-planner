import { describe, it, expect } from 'vitest';
import { isReleasedBy, availabilityTier, visibleAtHorizon, type PlanningHorizon } from './availability';

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

describe('availabilityTier', () => {
  const today = '2026-07-02';
  const cutoff = '2026-08-26'; // e.g. CM17's date
  it('global records are now', () => {
    expect(availabilityTier({ server: 'global' }, cutoff, today)).toBe('now');
  });
  it('jp released by today is also now (already on Global)', () => {
    expect(availabilityTier({ server: 'jp', releaseDate: '2026-06-01' }, cutoff, today)).toBe('now');
  });
  it('jp releasing between today and the cutoff is upcoming', () => {
    expect(availabilityTier({ server: 'jp', releaseDate: '2026-08-01' }, cutoff, today)).toBe('upcoming');
  });
  it('jp releasing after the cutoff is future', () => {
    expect(availabilityTier({ server: 'jp', releaseDate: '2027-01-01' }, cutoff, today)).toBe('future');
  });
  it('undated jp is future', () => {
    expect(availabilityTier({ server: 'jp' }, cutoff, today)).toBe('future');
  });
});

describe('visibleAtHorizon', () => {
  const current: PlanningHorizon = { kind: 'current' };
  const cm: PlanningHorizon = { kind: 'cm', cmNumber: 17 };
  const allJp: PlanningHorizon = { kind: 'allJp' };
  it('current reveals only now', () => {
    expect(visibleAtHorizon('now', current)).toBe(true);
    expect(visibleAtHorizon('upcoming', current)).toBe(false);
    expect(visibleAtHorizon('future', current)).toBe(false);
  });
  it('cm reveals now + upcoming', () => {
    expect(visibleAtHorizon('now', cm)).toBe(true);
    expect(visibleAtHorizon('upcoming', cm)).toBe(true);
    expect(visibleAtHorizon('future', cm)).toBe(false);
  });
  it('allJp reveals everything', () => {
    expect(visibleAtHorizon('future', allJp)).toBe(true);
  });
});
