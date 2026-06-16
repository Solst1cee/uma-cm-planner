import { describe, expect, it } from 'vitest';
import type { CourseCatalogEntry } from '@/sim/courseCatalog';
import { TRACKS, trackName, surfacesForTrack, coursesForTrackSurface } from './trackCatalog';

const CATALOG: CourseCatalogEntry[] = [
  { courseId: '10906', raceTrackId: 10009, surface: 'turf', distance: 2200, distanceClass: 'medium', turn: 1 },
  { courseId: '10901', raceTrackId: 10009, surface: 'turf', distance: 1200, distanceClass: 'sprint', turn: 1 },
  { courseId: '10910', raceTrackId: 10009, surface: 'dirt', distance: 1200, distanceClass: 'sprint', turn: 1 },
  { courseId: '11101', raceTrackId: 10101, surface: 'dirt', distance: 1200, distanceClass: 'sprint', turn: 1 },
];

describe('TRACKS', () => {
  it('lists the 11 tracks in in-game order, ending with Ooi', () => {
    expect(TRACKS).toHaveLength(11);
    expect(TRACKS[0]!.name).toBe('Sapporo');
    expect(TRACKS.at(-1)!.name).toBe('Ooi');
  });
});

describe('trackName', () => {
  it('maps a raceTrackId to its track name', () => {
    expect(trackName(10009)).toBe('Hanshin');
    expect(trackName(10005)).toBe('Nakayama');
    expect(trackName(10101)).toBe('Ooi');
  });
});

describe('surfacesForTrack', () => {
  it('returns turf then dirt when a track has both', () => {
    expect(surfacesForTrack(CATALOG, 10009)).toEqual(['turf', 'dirt']);
  });
  it('returns only dirt for a dirt-only track (Ooi)', () => {
    expect(surfacesForTrack(CATALOG, 10101)).toEqual(['dirt']);
  });
});

describe('coursesForTrackSurface', () => {
  it('filters by track + surface, sorted ascending by distance', () => {
    const r = coursesForTrackSurface(CATALOG, 10009, 'turf');
    expect(r.map((c) => c.distance)).toEqual([1200, 2200]);
    expect(r.every((c) => c.surface === 'turf')).toBe(true);
  });
});
