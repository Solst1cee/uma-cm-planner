/**
 * The resolved race selection (course + conditions) the planner page acts on,
 * plus pure mappers from a preset or a catalog course, and a readable
 * conditions-chip formatter.
 */
import type { CourseCatalogEntry } from '@/sim/courseCatalog';
import type { Ground, RacePreset, Season, Weather } from './presets';
import { trackName } from './trackCatalog';

export interface RaceConditions {
  ground: Ground;
  weather: Weather;
  season: Season;
}

export interface RaceSelection extends RaceConditions {
  courseId: string;
  racetrack: string;
  surface: 'turf' | 'dirt';
  distance: number;
  distanceClass: string;
  direction: 'right' | 'left';
  inOut?: 'inner' | 'outer';
  /** Set when the selection came from a CM preset (else custom). */
  presetCmId?: string;
}

const cap = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export function presetToSelection(p: RacePreset): RaceSelection {
  return {
    courseId: p.courseId,
    racetrack: p.racetrack,
    surface: p.surface,
    distance: p.distance,
    distanceClass: p.distanceClass,
    direction: p.direction,
    inOut: p.inOut,
    ground: p.ground,
    weather: p.weather,
    season: p.season,
    presetCmId: p.cmId,
  };
}

export function courseToSelection(
  course: CourseCatalogEntry,
  conditions: RaceConditions,
): RaceSelection {
  return {
    courseId: course.courseId,
    racetrack: trackName(course.raceTrackId),
    surface: course.surface,
    distance: course.distance,
    distanceClass: course.distanceClass,
    direction: course.turn === 2 ? 'left' : 'right',
    ground: conditions.ground,
    weather: conditions.weather,
    season: conditions.season,
  };
}

/** Readable condition chips, e.g. Hanshin · Turf · 2,200m (Medium) · Right-Handed · Inner · Ground good · Summer · Cloudy. */
export function describeSelection(sel: RaceSelection): string[] {
  const chips = [
    sel.racetrack,
    cap(sel.surface),
    `${sel.distance.toLocaleString('en-US')}m (${cap(sel.distanceClass)})`,
    sel.direction === 'right' ? 'Right-Handed' : 'Left-Handed',
  ];
  if (sel.inOut) chips.push(cap(sel.inOut));
  chips.push(`Ground ${sel.ground}`, cap(sel.season), cap(sel.weather));
  return chips;
}
