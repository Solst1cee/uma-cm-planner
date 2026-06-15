import { describe, expect, it } from 'vitest';
import type { CmTrack, TimelineEntry } from '@/core/types';
import { synthesizeUpcomingCms } from './cmSynthesis';

const TRACKS: CmTrack[] = [
  { index: 15, cupName: 'Cancer Cup', racetrack: 'Hanshin', distance: 2200, distanceClass: 'medium', surface: 'turf' },
  { index: 16, cupName: 'Leo Cup', racetrack: 'Nakayama', distance: 1200, distanceClass: 'sprint', surface: 'turf' },
  { index: 17, cupName: 'Virgo Cup', racetrack: 'Oi', distance: 2000, distanceClass: 'medium', surface: 'dirt' },
  { index: 18, cupName: 'Libra Cup', racetrack: 'Hanshin', distance: 1600, distanceClass: 'mile', surface: 'turf' },
  { index: 19, cupName: 'Scorpio Cup', racetrack: 'Kyoto', distance: 2200, distanceClass: 'medium', surface: 'turf' },
];

function cm(num: number, finals: string): TimelineEntry {
  return {
    id: `cm${num}`, type: 'cm', title: `CM${num}`,
    dates: { finals }, cm: { cmNumber: num, courseId: '10906' },
    tier: 'official', status: 'confirmed',
    source: { kind: 'official_news', url: '' }, server: 'global', dataVersion: 'test',
  };
}

describe('synthesizeUpcomingCms', () => {
  const anchor = [cm(15, '2026-06-30')];

  it('predicts horizon CMs at monthly cadence from the anchor', () => {
    const out = synthesizeUpcomingCms(anchor, TRACKS, { dataVersion: 'test', horizon: 3 });
    expect(out.map((e) => e.cm?.cmNumber)).toEqual([16, 17, 18]);
    expect(out.map((e) => e.dates.finals)).toEqual(['2026-07-30', '2026-08-30', '2026-09-30']);
    expect(out.map((e) => e.title)).toEqual(['Leo Cup', 'Virgo Cup', 'Libra Cup']);
  });

  it('marks predictions as prediction/unconfirmed with no courseId', () => {
    const out = synthesizeUpcomingCms(anchor, TRACKS, { dataVersion: 'test', horizon: 1 });
    const e = out[0]!;
    expect(e.tier).toBe('prediction');
    expect(e.status).toBe('unconfirmed');
    expect(e.cm?.courseId).toBeUndefined();
    expect(e.server).toBe('global');
    expect(e.source.kind).toBe('umaguide');
    expect(e.cm?.trackSummary).toBe('Nakayama turf 1200m (sprint)');
  });

  it('skips CM numbers already present (overrides win)', () => {
    const withCm16 = [cm(15, '2026-06-30'), cm(16, '2026-07-25')];
    const out = synthesizeUpcomingCms(withCm16, TRACKS, { dataVersion: 'test', horizon: 3 });
    expect(out.map((e) => e.cm?.cmNumber)).toEqual([17, 18]);
  });

  it('skips gaps in the track list', () => {
    const sparse = TRACKS.filter((t) => t.index !== 17);
    const out = synthesizeUpcomingCms(anchor, sparse, { dataVersion: 'test', horizon: 3 });
    expect(out.map((e) => e.cm?.cmNumber)).toEqual([16, 18]);
  });

  it('caps at the horizon', () => {
    const out = synthesizeUpcomingCms(anchor, TRACKS, { dataVersion: 'test', horizon: 2 });
    expect(out.map((e) => e.cm?.cmNumber)).toEqual([16, 17]);
  });

  it('anchors on the highest-numbered CM that has a finals date', () => {
    const out = synthesizeUpcomingCms([cm(14, '2026-05-30'), cm(15, '2026-06-30')], TRACKS, {
      dataVersion: 'test', horizon: 1,
    });
    expect(out.map((e) => e.cm?.cmNumber)).toEqual([16]);
  });

  it('returns [] when nothing has a cmNumber + finals to anchor on', () => {
    const noAnchor: TimelineEntry[] = [{
      id: 'x', type: 'cm', title: 'x', dates: { finals: '2026-06-30' },
      cm: { courseId: '1' }, tier: 'official', status: 'confirmed',
      source: { kind: 'manual', url: '' }, server: 'global', dataVersion: 'test',
    }];
    expect(synthesizeUpcomingCms(noAnchor, TRACKS, { dataVersion: 'test' })).toEqual([]);
  });
});
