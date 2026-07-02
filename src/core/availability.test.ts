import { describe, it, expect } from 'vitest';
import { availabilityTier, visibleAtHorizon, type PlanningHorizon } from './availability';

describe('availabilityTier', () => {
  const today = '2026-07-02';
  const cutoff = '2026-08-26'; // e.g. CM17's date
  it('global records are now', () => {
    expect(availabilityTier({ server: 'global' }, cutoff, today)).toBe('now');
  });
  it('jp announced-elapsed (not predicted) is now (already on Global)', () => {
    expect(
      availabilityTier({ server: 'jp', releaseDate: '2026-06-01' }, cutoff, today),
    ).toBe('now');
    expect(
      availabilityTier(
        { server: 'jp', releaseDate: '2026-06-01', releaseDatePredicted: false },
        cutoff,
        today,
      ),
    ).toBe('now');
  });
  it('jp predicted-elapsed is upcoming, not now (a projection having elapsed is still a guess)', () => {
    expect(
      availabilityTier(
        { server: 'jp', releaseDate: '2026-06-01', releaseDatePredicted: true },
        cutoff,
        today,
      ),
    ).toBe('upcoming');
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
