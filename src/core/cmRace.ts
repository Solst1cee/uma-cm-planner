/**
 * The CM race reference + the chooser option list (M4). A race is either a
 * reference to a timeline CM (derive track+conditions) or a self-contained
 * custom race. The timeline is the SSOT for CMs; see the 2026-06-20 spec.
 * Pure core: no feature/sim imports. The cmRef↔RaceSelection mappers live in
 * the race-setup feature (they touch RaceSelection + the course catalog).
 */
import type { CmId, CmRaceOption, CmRefV2, TimelineEntry } from './types';
import type { Ground, RaceConditions, Season, Weather } from './raceConditions';
import { defaultConditions } from './raceConditions';
import { effectiveDate } from './timeline';

/** Classify a legacy/flat or new-shape cmRef into the discriminated union. */
export function normalizeCmRef(raw: unknown): CmRefV2 {
  const r = (raw ?? {}) as Record<string, unknown>;
  if (r['kind'] === 'cm') {
    // Backfill cmId + require a finite cmNumber, like the legacy branch — a malformed cm ref
    // (NaN/≤0 cmNumber) must NOT be stored as `{ cmNumber: NaN }` (it would render "CM NaN" and
    // never match the timeline); fall through to the legacy/custom normalization instead.
    const cmNumber = Number(r['cmNumber']);
    if (Number.isFinite(cmNumber) && cmNumber > 0) {
      return { kind: 'cm', cmId: (r['cmId'] as CmId) ?? (`CM${cmNumber}` as CmId), cmNumber,
        courseId: String(r['courseId'] ?? ''), surface: r['surface'] === 'dirt' ? 'dirt' : 'turf', distance: Number(r['distance'] ?? 0) };
    }
  }
  if (r['kind'] === 'custom') {
    return { kind: 'custom', courseId: String(r['courseId']), surface: r['surface'] === 'dirt' ? 'dirt' : 'turf',
      distance: Number(r['distance']), ground: r['ground'] as Ground, weather: r['weather'] as Weather, season: r['season'] as Season };
  }
  // legacy flat: cmNumber>0 → cm reference (keep geometry, drop conditions); else custom.
  const cmNumber = Number(r['cmNumber'] ?? 0);
  if (cmNumber > 0) {
    return { kind: 'cm', cmId: (r['cmId'] as CmId) ?? (`CM${cmNumber}` as CmId), cmNumber,
      courseId: String(r['courseId'] ?? ''), surface: r['surface'] === 'dirt' ? 'dirt' : 'turf', distance: Number(r['distance'] ?? 0) };
  }
  return {
    kind: 'custom', courseId: String(r['courseId'] ?? ''), surface: r['surface'] === 'dirt' ? 'dirt' : 'turf',
    distance: Number(r['distance'] ?? 0),
    ground: (r['ground'] ?? r['condition'] ?? 'good') as Ground, // old name was `condition`
    weather: (r['weather'] ?? 'sunny') as Weather, season: (r['season'] ?? 'spring') as Season,
  };
}

/** Conditions for a timeline CM entry: curated if present, else month-derived defaults.
 *  The single derive-conditions-from-timeline rule (the cmRef↔selection mappers reuse it). */
export function conditionsFor(e: TimelineEntry): RaceConditions {
  return e.cm?.conditions ?? defaultConditions(e.dates.finals ?? e.dates.start);
}

/** Track-known CMs (entries with a courseId + cmNumber), recent-first by date. */
export function cmRaceOptions(entries: TimelineEntry[]): CmRaceOption[] {
  return entries
    .filter((e) => e.type === 'cm' && e.cm?.courseId && e.cm.cmNumber !== undefined)
    .sort((a, b) => (effectiveDate(a) < effectiveDate(b) ? 1 : effectiveDate(a) > effectiveDate(b) ? -1 : 0)) // recent-first
    .map((e) => ({ cmId: `CM${e.cm!.cmNumber}` as CmId, cmNumber: e.cm!.cmNumber!, name: e.title, courseId: e.cm!.courseId!, conditions: conditionsFor(e) }));
}
