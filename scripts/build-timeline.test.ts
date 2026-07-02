import { describe, expect, it } from 'vitest';
import type { CmPreset, CmTrack, TimelineEntry } from '@/core/types';
import { buildTimeline } from './build-timeline';

const PRESETS: CmPreset[] = [
  { name: 'Cancer Cup', date: '2026-06-30', server: 'global', dataVersion: 'test', courseId: '10906', surface: 'turf', distance: 2200 },
];
const TRACKS: CmTrack[] = [
  { index: 15, cupName: 'Cancer Cup', racetrack: 'Hanshin', distance: 2200, distanceClass: 'medium', surface: 'turf' },
  { index: 16, cupName: 'Leo Cup', racetrack: 'Nakayama', distance: 1200, distanceClass: 'sprint', surface: 'turf' },
  { index: 17, cupName: 'Virgo Cup', racetrack: 'Oi', distance: 2000, distanceClass: 'medium', surface: 'dirt' },
];
// Override stamps the anchor CM15 with its cmNumber (mirrors timeline_overrides.json).
const OVERRIDES = [
  { id: 'cm-cancer-cup-2026-06-30', cm: { cmNumber: 15, courseId: '10906', trackSummary: 'Hanshin turf 2200m' } },
];

describe('buildTimeline synthesis', () => {
  it('appends predicted CMs from cm_tracks after the anchor', () => {
    const { entries } = buildTimeline({ presets: PRESETS, overrides: OVERRIDES, tracks: TRACKS, dataVersion: 'test', horizon: 2 });
    const predicted = entries.filter((e) => e.tier === 'prediction');
    expect(predicted.map((e) => e.cm?.cmNumber)).toEqual([16, 17]);
    expect(predicted.every((e) => e.cm?.courseId === undefined)).toBe(true);
  });

  it('produces no predictions without tracks', () => {
    const { entries } = buildTimeline({ presets: PRESETS, overrides: OVERRIDES, dataVersion: 'test' });
    expect(entries.some((e) => e.tier === 'prediction')).toBe(false);
  });

  it('keeps entries sorted by effective date', () => {
    const { entries } = buildTimeline({ presets: PRESETS, overrides: OVERRIDES, tracks: TRACKS, dataVersion: 'test', horizon: 2 });
    const dates = entries.map((e) => e.dates.finals ?? '');
    expect([...dates]).toEqual([...dates].sort());
  });

  it('merges extraEntries in, sorted alongside cm/predicted entries (rebalance patch lane)', () => {
    const patch: TimelineEntry = {
      id: 'patch-200011-v2',
      type: 'patch',
      title: 'Skill rebalance: Right-Handed Demon v2',
      dates: { start: '2026-06-15' },
      tier: 'official',
      status: 'confirmed',
      source: { kind: 'manual', url: 'https://example.com' },
      server: 'global',
      dataVersion: 'test',
    };
    const { entries } = buildTimeline({
      presets: PRESETS,
      overrides: OVERRIDES,
      tracks: TRACKS,
      dataVersion: 'test',
      horizon: 2,
      extraEntries: [patch],
    });
    expect(entries.find((e) => e.id === 'patch-200011-v2')).toEqual(patch);
    const dates = entries.map((e) => e.dates.finals ?? e.dates.start ?? '');
    expect([...dates]).toEqual([...dates].sort());
  });

  it('produces no extra entries when extraEntries is omitted', () => {
    const { entries } = buildTimeline({ presets: PRESETS, overrides: OVERRIDES, tracks: TRACKS, dataVersion: 'test', horizon: 2 });
    expect(entries.some((e) => e.type === 'patch')).toBe(false);
  });
});
