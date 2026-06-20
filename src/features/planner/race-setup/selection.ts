/**
 * The resolved race selection (course + conditions) the planner page acts on,
 * plus pure mappers from a preset or a catalog course, and a readable
 * conditions-chip formatter.
 */
import type { CourseCatalogEntry } from '@/sim/courseCatalog';
import type { Ground, Season, Weather } from '@/core/raceConditions';
import { trackName } from './trackCatalog';

export type { Ground, Season, Weather } from '@/core/raceConditions';

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
  inOut?: 'inner' | 'outer' | 'outer-inner';
  /** Set when the selection came from a CM preset (else custom). */
  presetCmId?: string;
}

export const cap = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

function courseLayout(course: CourseCatalogEntry['course']): RaceSelection['inOut'] {
  if (course === 2) return 'inner';
  if (course === 3) return 'outer';
  if (course === 4) return 'outer-inner';
  return undefined;
}

export function courseLayoutLabel(inOut: RaceSelection['inOut']): string | undefined {
  if (inOut === 'outer-inner') return 'Outer-Inner';
  return inOut ? cap(inOut) : undefined;
}

export function formatDistanceWithLayout(sel: Pick<RaceSelection, 'distance' | 'inOut'>): string {
  const layout = courseLayoutLabel(sel.inOut);
  const distance = sel.distance.toLocaleString('en-US');
  return layout ? `${distance}m (${layout})` : `${distance}m`;
}

export function formatCourseLabel(sel: Pick<RaceSelection, 'racetrack' | 'distance' | 'inOut'>): string {
  return `${sel.racetrack} ${formatDistanceWithLayout(sel)}`;
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
    inOut: courseLayout(course.course),
    ground: conditions.ground,
    weather: conditions.weather,
    season: conditions.season,
  };
}

/** Readable condition chips, e.g. Hanshin / Turf / 2,200m (Inner) / Right-Handed / Good / Summer / Cloudy. */
export function describeSelection(sel: RaceSelection): string[] {
  const chips = [
    sel.racetrack,
    cap(sel.surface),
    formatDistanceWithLayout(sel),
    sel.direction === 'right' ? 'Right-Handed' : 'Left-Handed',
  ];
  chips.push(cap(sel.ground), cap(sel.season), cap(sel.weather));
  return chips;
}
