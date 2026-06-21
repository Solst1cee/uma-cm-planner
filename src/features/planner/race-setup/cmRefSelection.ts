/**
 * Bridge a CmRefV2 to the Race-setup view (RaceSelection) and back. Lives in the
 * feature layer because it touches RaceSelection + the course catalog; the pure
 * data logic (normalizeCmRef, cmRaceOptions) stays in @/core/cmRace.
 */
import type { CmId, CmRaceOption, CmRefV2, TimelineEntry } from '@/core/types';
import type { RaceConditions } from '@/core/raceConditions';
import { defaultConditions } from '@/core/raceConditions';
import { conditionsFor } from '@/core/cmRace';
import type { CourseCatalogEntry } from '@/sim/courseCatalog';
import { courseToSelection, type RaceSelection } from './selection';

/** Minimal selection when the catalog hasn't resolved a courseId yet (no flicker). */
function fallbackSelection(courseId: string, c: RaceConditions, surface: 'turf' | 'dirt' = 'turf', distance = 0): RaceSelection {
  return { courseId, racetrack: '', surface, distance, distanceClass: '', direction: 'right', inOut: undefined, ...c };
}

/** Derive the Race-setup view from a cmRef. */
export function cmRefToSelection(cmRef: CmRefV2, catalog: CourseCatalogEntry[], entries: TimelineEntry[]): RaceSelection {
  if (cmRef.kind === 'cm') {
    const entry = entries.find((e) => e.type === 'cm' && e.cm?.cmNumber === cmRef.cmNumber && e.cm.courseId);
    // Conditions are DERIVED from the timeline; geometry falls back to the ref's stored fields.
    const courseId = entry?.cm?.courseId ?? cmRef.courseId;
    const conditions = entry ? conditionsFor(entry) : defaultConditions(undefined);
    const course = catalog.find((c) => c.courseId === courseId);
    const sel = course ? courseToSelection(course, conditions) : fallbackSelection(courseId, conditions, cmRef.surface, cmRef.distance);
    return { ...sel, presetCmId: cmRef.cmId };
  }
  const course = catalog.find((c) => c.courseId === cmRef.courseId);
  const conditions: RaceConditions = { ground: cmRef.ground, weather: cmRef.weather, season: cmRef.season };
  const sel = course ? courseToSelection(course, conditions) : fallbackSelection(cmRef.courseId, conditions, cmRef.surface, cmRef.distance);
  return { ...sel, presetCmId: undefined };
}

/**
 * Build a `cm` cmRef for a track-known timeline CM entry, resolving geometry from
 * the catalog. Returns null when the entry has no courseId/cmNumber or the catalog
 * hasn't loaded the course yet — callers fall back to a default. Used to default the
 * planner (and the New button) to the current CM.
 */
export function cmRefForEntry(entry: TimelineEntry | null | undefined, catalog: CourseCatalogEntry[]): CmRefV2 | null {
  const cm = entry?.cm;
  if (!cm?.courseId || cm.cmNumber === undefined) return null;
  const course = catalog.find((c) => c.courseId === cm.courseId);
  if (!course) return null;
  return { kind: 'cm', cmId: `CM${cm.cmNumber}` as CmId, cmNumber: cm.cmNumber, courseId: cm.courseId, surface: course.surface, distance: course.distance };
}

/** Inverse: a selection that exactly matches a CM option → cm ref; else custom. */
export function selectionToCmRef(sel: RaceSelection, options: CmRaceOption[]): CmRefV2 {
  const match = options.find((o) =>
    o.courseId === sel.courseId && o.conditions.ground === sel.ground && o.conditions.weather === sel.weather && o.conditions.season === sel.season);
  if (match) return { kind: 'cm', cmId: match.cmId, cmNumber: match.cmNumber, courseId: sel.courseId, surface: sel.surface, distance: sel.distance };
  return { kind: 'custom', courseId: sel.courseId, surface: sel.surface, distance: sel.distance, ground: sel.ground, weather: sel.weather, season: sel.season };
}
