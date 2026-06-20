import { describe, it, expect } from 'vitest';
import type { TimelineEntry } from '@/core/types';
import type { CourseCatalogEntry } from '@/sim/courseCatalog';
import { cmRaceOptions } from '@/core/cmRace';
import { cmRefToSelection, selectionToCmRef } from './cmRefSelection';

const entries: TimelineEntry[] = [
  { id: 'cm15', type: 'cm', title: 'Cancer Cup', dates: { finals: '2026-06-24' },
    cm: { cmNumber: 15, courseId: '10906', conditions: { ground: 'good', weather: 'cloudy', season: 'summer' } },
    tier: 'official', status: 'confirmed', source: { kind: 'official_news', url: '' }, server: 'global', dataVersion: 'x' },
];
const catalog: CourseCatalogEntry[] = [
  { courseId: '10906', raceTrackId: 10009, surface: 'turf', distance: 2200, distanceClass: 'medium', turn: 1, course: 2 } as CourseCatalogEntry,
];

describe('cmRefToSelection / selectionToCmRef', () => {
  it('derives a CM selection from the timeline + catalog', () => {
    const sel = cmRefToSelection({ kind: 'cm', cmId: 'CM15', cmNumber: 15 }, catalog, entries);
    expect(sel).toMatchObject({ courseId: '10906', distance: 2200, surface: 'turf', ground: 'good', weather: 'cloudy', season: 'summer', presetCmId: 'CM15' });
  });
  it('uses stored fields for a custom ref', () => {
    const sel = cmRefToSelection({ kind: 'custom', courseId: '10906', surface: 'turf', distance: 2200, ground: 'soft', weather: 'rainy', season: 'fall' }, catalog, entries);
    expect(sel).toMatchObject({ courseId: '10906', ground: 'soft', weather: 'rainy', presetCmId: undefined });
  });
  it('round-trips a matched CM selection back to kind:cm', () => {
    const opts = cmRaceOptions(entries);
    const sel = cmRefToSelection({ kind: 'cm', cmId: 'CM15', cmNumber: 15 }, catalog, entries);
    expect(selectionToCmRef(sel, opts)).toEqual({ kind: 'cm', cmId: 'CM15', cmNumber: 15 });
  });
  it('maps an edited (non-matching) selection to kind:custom', () => {
    const opts = cmRaceOptions(entries);
    const sel = cmRefToSelection({ kind: 'cm', cmId: 'CM15', cmNumber: 15 }, catalog, entries);
    const edited = { ...sel, weather: 'rainy' as const }; // diverges from CM15's cloudy
    expect(selectionToCmRef(edited, opts)).toMatchObject({ kind: 'custom', courseId: '10906', weather: 'rainy' });
  });
});
