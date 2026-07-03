import { describe, expect, it } from 'vitest';
import type { CmTrack, JpCmDate, TimelineEntry } from '@/core/types';
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

  it('slides the window forward — confirming CM16 predicts the next 3 (17,18,19)', () => {
    const out = synthesizeUpcomingCms([cm(15, '2026-06-30'), cm(16, '2026-07-25')], TRACKS, {
      dataVersion: 'test', horizon: 3,
    });
    expect(out.map((e) => e.cm?.cmNumber)).toEqual([17, 18, 19]);
    // Dates measured from the latest confirmed (CM16 finals 2026-07-25), not CM15.
    expect(out[0]!.dates.finals).toBe('2026-08-25');
  });

  it('skips numbers already on the timeline, even undated ones (overrides win)', () => {
    const cm17NoDate: TimelineEntry = {
      id: 'cm17', type: 'cm', title: 'CM17 TBD', dates: {},
      cm: { cmNumber: 17 }, tier: 'official', status: 'confirmed',
      source: { kind: 'manual', url: '' }, server: 'global', dataVersion: 'test',
    };
    const out = synthesizeUpcomingCms([cm(15, '2026-06-30'), cm17NoDate], TRACKS, {
      dataVersion: 'test', horizon: 3,
    });
    // anchor = CM15 (highest WITH finals); CM17 is present-but-undated → skipped.
    expect(out.map((e) => e.cm?.cmNumber)).toEqual([16, 18]);
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

describe('synthesizeUpcomingCms — foresight pace projection', () => {
  const merged: TimelineEntry[] = [
    { id: 'cm15', type: 'cm', title: 'Cancer Cup', dates: { finals: '2026-06-24' },
      cm: { cmNumber: 15 }, tier: 'official', status: 'confirmed',
      source: { kind: 'official_news', url: '' }, server: 'global', dataVersion: 'x' },
    // a prior confirmed CM so there are >= 2 shared CMs to calibrate
    { id: 'cm14', type: 'cm', title: 'Gemini Cup', dates: { finals: '2026-06-04' },
      cm: { cmNumber: 14 }, tier: 'official', status: 'confirmed',
      source: { kind: 'official_news', url: '' }, server: 'global', dataVersion: 'x' },
  ];
  const tracks: CmTrack[] = [
    { index: 16, cupName: 'Leo Cup', racetrack: 'Hanshin', distance: 2200, distanceClass: 'medium', surface: 'turf' },
  ];
  const jpCms: JpCmDate[] = [
    { cmNumber: 14, cupName: 'Gemini Cup', jpDate: '2022-06-14' },
    { cmNumber: 15, cupName: 'Cancer Cup', jpDate: '2022-07-14' },
    { cmNumber: 16, cupName: 'Leo Cup', jpDate: '2022-08-13' },
  ];

  it('dates a predicted CM by pace projection when jpCms is supplied', () => {
    const out = synthesizeUpcomingCms(merged, tracks, { dataVersion: 'x', horizon: 1, jpCms });
    expect(out).toHaveLength(1);
    expect(out[0]!.cm?.cmNumber).toBe(16);
    // CM14->15 pace = 30d/20d = 1.5; CM16 JP +30d / 1.5 = 20d after 2026-06-24 = 2026-07-14
    expect(out[0]!.dates.finals).toBe('2026-07-14');
    expect(out[0]!.tier).toBe('prediction');
  });

  it('falls back to +1-month cadence when jpCms is absent (no regression)', () => {
    const out = synthesizeUpcomingCms(merged, tracks, { dataVersion: 'x', horizon: 1 });
    expect(out[0]!.dates.finals).toBe('2026-07-24'); // addMonths(2026-06-24, 1)
  });

  // The real-data trap this pins: a hand-authored *prediction* entry (CM16 in
  // timeline_overrides) carries a finals date but status 'unconfirmed'. It must
  // not enter the calibration window or anchor the predictions — otherwise the
  // timeline's clock diverges from build-all's confirmed-only foresight clock.
  describe('unconfirmed entries stay out of the calibration (one clock)', () => {
    const cm16Predicted: TimelineEntry = {
      id: 'cm16-stale', type: 'cm', title: 'Leo Cup', dates: { finals: '2026-07-30' },
      cm: { cmNumber: 16 }, tier: 'prediction', status: 'unconfirmed',
      source: { kind: 'umaguide', url: '' }, server: 'global', dataVersion: 'x',
    };
    const withStale = [...merged, cm16Predicted];
    const jp17 = [...jpCms, { cmNumber: 17, cupName: 'Virgo Cup', jpDate: '2022-09-14' }];
    const track17: CmTrack[] = [
      { index: 17, cupName: 'Virgo Cup', racetrack: 'Oi', distance: 2000, distanceClass: 'medium', surface: 'dirt' },
    ];

    it('pace-projects from confirmed CMs only', () => {
      const out = synthesizeUpcomingCms(withStale, track17, { dataVersion: 'x', horizon: 3, jpCms: jp17 });
      expect(out.map((e) => e.cm?.cmNumber)).toEqual([17]);
      // confirmed window CM14→15: pace 30/20 = 1.5, anchor 2022-07-14→2026-06-24;
      // CM17 JP +62d / 1.5 ≈ +41d = 2026-08-04 (NOT projected off the stale CM16).
      expect(out[0]!.dates.finals).toBe('2026-08-04');
    });

    it('anchors the fallback cadence on the latest CONFIRMED finals', () => {
      const out = synthesizeUpcomingCms(withStale, track17, { dataVersion: 'x', horizon: 3 });
      expect(out.map((e) => e.cm?.cmNumber)).toEqual([17]);
      // addMonths from confirmed CM15 (2026-06-24) + 2 steps — not from stale CM16.
      expect(out[0]!.dates.finals).toBe('2026-08-24');
    });
  });
});
