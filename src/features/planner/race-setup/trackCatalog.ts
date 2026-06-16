/**
 * Pure helpers over the engine course catalog for the custom-track picker.
 * The catalog itself comes from `@/sim/courseCatalog` (lazy, runtime) — these
 * functions just group/filter it for the Track → Surface → Distance cascade.
 */
import type { CourseCatalogEntry } from '@/sim/courseCatalog';

export interface TrackDef {
  raceTrackId: number;
  name: string;
}

/** The 11 racetracks, in umamusume in-game order (Ooi is the NAR/dirt track). */
export const TRACKS: TrackDef[] = [
  { raceTrackId: 10001, name: 'Sapporo' },
  { raceTrackId: 10002, name: 'Hakodate' },
  { raceTrackId: 10003, name: 'Niigata' },
  { raceTrackId: 10004, name: 'Fukushima' },
  { raceTrackId: 10005, name: 'Nakayama' },
  { raceTrackId: 10006, name: 'Tokyo' },
  { raceTrackId: 10007, name: 'Chukyo' },
  { raceTrackId: 10008, name: 'Kyoto' },
  { raceTrackId: 10009, name: 'Hanshin' },
  { raceTrackId: 10010, name: 'Kokura' },
  { raceTrackId: 10101, name: 'Ooi' },
];

export function trackName(raceTrackId: number): string {
  return TRACKS.find((t) => t.raceTrackId === raceTrackId)?.name ?? `Track ${raceTrackId}`;
}

/** Surfaces a track offers, turf before dirt. */
export function surfacesForTrack(
  catalog: CourseCatalogEntry[],
  raceTrackId: number,
): Array<'turf' | 'dirt'> {
  const present = new Set<'turf' | 'dirt'>();
  for (const c of catalog) if (c.raceTrackId === raceTrackId) present.add(c.surface);
  return (['turf', 'dirt'] as const).filter((s) => present.has(s));
}

/** Courses for a track + surface, sorted ascending by distance. */
export function coursesForTrackSurface(
  catalog: CourseCatalogEntry[],
  raceTrackId: number,
  surface: 'turf' | 'dirt',
): CourseCatalogEntry[] {
  return catalog
    .filter((c) => c.raceTrackId === raceTrackId && c.surface === surface)
    .sort((a, b) => a.distance - b.distance);
}
