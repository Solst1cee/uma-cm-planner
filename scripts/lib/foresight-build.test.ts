import { describe, it, expect } from 'vitest';
import { buildForesightCalibration, projectReleaseDate, type ConfirmedCm } from './foresight-build';
import type { JpCmDate } from '@/core/types';

const JP: JpCmDate[] = [
  { cmNumber: 10, cupName: 'Aquarius Cup', jpDate: '2022-02-18' },
  { cmNumber: 11, cupName: 'Pisces Cup', jpDate: '2022-03-22' },
  { cmNumber: 12, cupName: 'Aries Cup', jpDate: '2022-04-22' },
  { cmNumber: 13, cupName: 'Taurus Cup', jpDate: '2022-05-24' },
  { cmNumber: 14, cupName: 'Gemini Cup', jpDate: '2022-06-14' },
  { cmNumber: 15, cupName: 'Cancer Cup', jpDate: '2022-07-14' },
];
const CONFIRMED: ConfirmedCm[] = [
  { cmNumber: 10, global: '2026-03-06' }, { cmNumber: 11, global: '2026-03-30' },
  { cmNumber: 12, global: '2026-04-23' }, { cmNumber: 13, global: '2026-05-14' },
  { cmNumber: 14, global: '2026-06-04' }, { cmNumber: 15, global: '2026-06-24' },
];

describe('buildForesightCalibration', () => {
  it('joins jp-schedule to confirmed Global CMs by cmNumber → GameTora pace', () => {
    const cal = buildForesightCalibration(JP, CONFIRMED)!;
    expect(cal.pace).toBeCloseTo(1.327, 2);
    expect(cal.anchorGlobal).toBe('2026-06-24');
  });
  it('returns null when fewer than 2 CMs join', () => {
    expect(buildForesightCalibration(JP, [{ cmNumber: 10, global: '2026-03-06' }])).toBeNull();
  });
});

describe('projectReleaseDate', () => {
  const cal = buildForesightCalibration(JP, CONFIRMED);
  it('announced Global date wins (not predicted)', () => {
    expect(projectReleaseDate('2022-08-13', '2026-05-01', cal)).toEqual({ releaseDate: '2026-05-01', predicted: false });
  });
  it('projects from the JP date when unannounced (predicted)', () => {
    expect(projectReleaseDate('2022-08-13', undefined, cal)).toEqual({ releaseDate: '2026-07-16', predicted: true });
  });
  it('yields no date when uncalibratable or no JP date', () => {
    expect(projectReleaseDate('2022-08-13', undefined, null)).toEqual({ predicted: false });
    expect(projectReleaseDate(undefined, undefined, cal)).toEqual({ predicted: false });
  });
});
