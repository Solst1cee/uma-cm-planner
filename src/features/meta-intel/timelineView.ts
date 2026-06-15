/**
 * Pure view-model helpers for the M3 timeline UI. No React, no DOM — bucket,
 * filter, and locate "now" so the components stay presentational and these
 * stay unit-testable. Mechanics (effectiveDate, timelineBadge) come from
 * @/core/timeline; nothing game-rule lives here.
 */
import type { TimelineEntry } from '@/core/types';
import { addMonths, effectiveDate } from '@/core/timeline';

export type LaneKey = TimelineEntry['type']; // 'cm' | 'banner' | 'patch'

export const LANES: readonly { key: LaneKey; label: string }[] = [
  { key: 'cm', label: 'Champions Meetings' },
  { key: 'banner', label: 'Banners' },
  { key: 'patch', label: 'Patches' },
];

export interface TimelineFilter {
  lanes: ReadonlySet<LaneKey>;
  confirmedOnly: boolean;
}

/** Keep entries in enabled lanes, optionally only confirmed ones. Order preserved. */
export function filterTimeline(entries: TimelineEntry[], filter: TimelineFilter): TimelineEntry[] {
  return entries.filter(
    (e) => filter.lanes.has(e.type) && (!filter.confirmedOnly || e.status === 'confirmed'),
  );
}

function byDateAsc(a: TimelineEntry, b: TimelineEntry): number {
  const da = effectiveDate(a);
  const db = effectiveDate(b);
  return da < db ? -1 : da > db ? 1 : 0;
}

/** Bucket into the three lanes, each sorted ascending by effective date. */
export function partitionByLane(entries: TimelineEntry[]): Record<LaneKey, TimelineEntry[]> {
  const out: Record<LaneKey, TimelineEntry[]> = { cm: [], banner: [], patch: [] };
  for (const e of entries) out[e.type].push(e);
  for (const key of Object.keys(out) as LaneKey[]) out[key].sort(byDateAsc);
  return out;
}

/**
 * Index in a date-sorted lane where the "now" marker belongs: the first entry
 * whose effective date is >= nowISO (the next upcoming entry). Returns
 * entries.length when every entry is in the past. Undated entries
 * (effectiveDate '') sort before all dated ones, so they fall before the marker.
 */
export function nowIndex(sorted: TimelineEntry[], nowISO: string): number {
  const i = sorted.findIndex((e) => effectiveDate(e) >= nowISO);
  return i === -1 ? sorted.length : i;
}

/** The current/next CM: first CM on/after now, else the most recent past one. */
export function currentCm(cmEntries: TimelineEntry[], nowISO: string): TimelineEntry | null {
  if (cmEntries.length === 0) return null;
  const sorted = [...cmEntries].sort(byDateAsc);
  const upcoming = sorted.find((e) => effectiveDate(e) >= nowISO);
  return upcoming ?? sorted[sorted.length - 1] ?? null;
}

export type RangeKey = 'upcoming' | 'year' | 'all';

export const RANGES: readonly { key: RangeKey; label: string }[] = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'year', label: '±1 year' },
  { key: 'all', label: 'All' },
];

/**
 * Restrict entries to a date window around `nowISO`. Undated entries (effectiveDate
 * '') appear only under 'all'. Order is preserved (caller sorts per lane).
 */
export function windowTimeline(entries: TimelineEntry[], nowISO: string, range: RangeKey): TimelineEntry[] {
  if (range === 'all') return entries;
  if (range === 'upcoming') return entries.filter((e) => effectiveDate(e) >= nowISO);
  const lo = addMonths(nowISO, -6);
  const hi = addMonths(nowISO, 12);
  return entries.filter((e) => {
    const d = effectiveDate(e);
    return d !== '' && d >= lo && d <= hi;
  });
}
