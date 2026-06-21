import { describe, it, expect } from 'vitest';
import type { TimelineEntry } from './types';
import { normalizeCmRef, cmRaceOptions } from './cmRace';

const entries: TimelineEntry[] = [
  { id: 'cm15', type: 'cm', title: 'Cancer Cup', dates: { finals: '2026-06-24' },
    cm: { cmNumber: 15, courseId: '10906', conditions: { ground: 'good', weather: 'cloudy', season: 'summer' } },
    tier: 'official', status: 'confirmed', source: { kind: 'official_news', url: '' }, server: 'global', dataVersion: 'x' },
  { id: 'cm16', type: 'cm', title: 'Leo Cup', dates: { finals: '2026-07-30' },
    cm: { cmNumber: 16, courseId: '10501' /* no conditions → defaults */ },
    tier: 'prediction', status: 'unconfirmed', source: { kind: 'umaguide', url: '' }, server: 'global', dataVersion: 'x' },
  { id: 'cm17pred', type: 'cm', title: 'Virgo', dates: { finals: '2026-08-30' },
    cm: { cmNumber: 17 /* NO courseId → excluded from options */ },
    tier: 'prediction', status: 'unconfirmed', source: { kind: 'umaguide', url: '' }, server: 'global', dataVersion: 'x' },
];

describe('normalizeCmRef', () => {
  it('classifies a legacy CM ref (cmNumber>0) as kind:cm, keeping geometry, dropping conditions', () => {
    expect(normalizeCmRef({ cmId: 'CM15', cmNumber: 15, courseId: '10906', surface: 'turf', distance: 2200, condition: 'good', weather: 'cloudy', season: 'summer' }))
      .toEqual({ kind: 'cm', cmId: 'CM15', cmNumber: 15, courseId: '10906', surface: 'turf', distance: 2200 });
  });
  it('classifies a legacy custom ref (cmNumber 0) as kind:custom, mapping condition→ground', () => {
    expect(normalizeCmRef({ cmId: 'CM0', cmNumber: 0, courseId: '10906', surface: 'turf', distance: 2200, condition: 'soft', weather: 'rainy', season: 'fall' }))
      .toEqual({ kind: 'custom', courseId: '10906', surface: 'turf', distance: 2200, ground: 'soft', weather: 'rainy', season: 'fall' });
  });
  it('passes a new-shape cm ref through (preserving geometry fields)', () => {
    expect(normalizeCmRef({ kind: 'cm', cmId: 'CM15', cmNumber: 15, courseId: '10906', surface: 'turf', distance: 2200 }))
      .toEqual({ kind: 'cm', cmId: 'CM15', cmNumber: 15, courseId: '10906', surface: 'turf', distance: 2200 });
  });
  it('backfills a missing cmId on a new-shape cm ref from cmNumber', () => {
    expect(normalizeCmRef({ kind: 'cm', cmNumber: 15, courseId: '10906', surface: 'turf', distance: 2200 }))
      .toEqual({ kind: 'cm', cmId: 'CM15', cmNumber: 15, courseId: '10906', surface: 'turf', distance: 2200 });
  });
  it('falls back to custom (no NaN cmNumber) for a malformed cm ref missing a numeric cmNumber', () => {
    // hand-edited/corrupt import — must NOT produce { kind:'cm', cmNumber:NaN } (renders "CM NaN", never matches the timeline)
    const out = normalizeCmRef({ kind: 'cm', courseId: '10906', surface: 'turf', distance: 2200 });
    expect(out.kind).toBe('custom');
    expect(out).toMatchObject({ courseId: '10906', surface: 'turf', distance: 2200, ground: 'good', weather: 'sunny', season: 'spring' });
  });
});

describe('cmRaceOptions', () => {
  it('lists only courseId entries, recent-first, conditions curated-or-default', () => {
    const opts = cmRaceOptions(entries);
    expect(opts.map((o) => o.cmNumber)).toEqual([16, 15]); // recent-first by finals date; cm17 excluded (no courseId)
    expect(opts.find((o) => o.cmNumber === 15)?.conditions).toEqual({ ground: 'good', weather: 'cloudy', season: 'summer' });
    expect(opts.find((o) => o.cmNumber === 16)?.conditions.season).toBe('summer'); // default from 2026-07
  });
});
