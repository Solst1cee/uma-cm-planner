import { describe, expect, it } from 'vitest';
import i18n from './labels';

describe('racetrack label shim', () => {
  it('returns full labels for known keys', () => {
    expect(i18n.t('racetrack.straight')).toBe('Straight');
    expect(i18n.t('racetrack.phase3')).toBe('Last spurt');
  });
  it('interpolates {{n}} for corner labels', () => {
    expect(i18n.t('racetrack.corner', { n: 3 })).toBe('Corner 3');
    expect(i18n.t('racetrack.short.corner', { n: 4 })).toBe('C4');
  });
  it('falls back to the key when unknown', () => {
    expect(i18n.t('racetrack.nope')).toBe('racetrack.nope');
  });
});
