import type { TimelineEntry, CmScheduleRow, CmId } from './types';

/** The date a timeline entry sorts/schedules on: finals → start → end. */
export function effectiveDate(e: TimelineEntry): string {
  return e.dates.finals ?? e.dates.start ?? e.dates.end ?? '';
}

function patchEntry(base: TimelineEntry, patch: Partial<TimelineEntry>): TimelineEntry {
  return {
    ...base,
    ...patch,
    dates: { ...base.dates, ...patch.dates },
    cm: patch.cm ? { ...base.cm, ...patch.cm } : base.cm,
    banner: patch.banner ? { ...base.banner, ...patch.banner } : base.banner,
    patch: patch.patch ? { ...base.patch, ...patch.patch } : base.patch,
    source: patch.source ? { ...base.source, ...patch.source } : base.source,
  };
}

/** P5 merge: known id patches; unknown id inserts (must be a full entry). */
export function mergeTimeline(base: TimelineEntry[], overrides: Array<Partial<TimelineEntry> & { id: string }>): TimelineEntry[] {
  const byId = new Map(base.map((e) => [e.id, e]));
  for (const ov of overrides) {
    const existing = byId.get(ov.id);
    if (existing) byId.set(ov.id, patchEntry(existing, ov));
    else byId.set(ov.id, ov as TimelineEntry);
  }
  return sortTimeline([...byId.values()]);
}

export function sortTimeline(entries: TimelineEntry[]): TimelineEntry[] {
  return [...entries].sort((a, b) => (effectiveDate(a) < effectiveDate(b) ? -1 : effectiveDate(a) > effectiveDate(b) ? 1 : 0));
}

/** M3→M4: cm entries with a cmNumber → CmScheduleRow (shared-data-model §6). */
export function projectCmSchedule(entries: TimelineEntry[]): CmScheduleRow[] {
  const rows: CmScheduleRow[] = [];
  for (const e of entries) {
    if (e.type !== 'cm' || e.cm?.cmNumber === undefined || !e.cm.courseId) continue;
    rows.push({
      date: effectiveDate(e),
      cmId: `CM${e.cm.cmNumber}` as CmId,
      cmNumber: e.cm.cmNumber,
      name: e.title,
      courseId: e.cm.courseId,
    });
  }
  return rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/**
 * Predict a Global date from a JP date: Global runs JP content on a compressed schedule, so the
 * gap from the anchor shrinks by `paceMultiplier` (~1.3–1.6×; M3 spec §1.4). PREDICTION ONLY (P3).
 */
export function predictGlobalDate(jpISO: string, paceMultiplier: number, anchorJpISO: string, anchorGlobalISO: string): string {
  const DAY = 86_400_000;
  const jpGapDays = (Date.parse(jpISO) - Date.parse(anchorJpISO)) / DAY;
  const globalMs = Date.parse(anchorGlobalISO) + (jpGapDays / paceMultiplier) * DAY;
  return new Date(globalMs).toISOString().slice(0, 10);
}

export function timelineBadge(e: TimelineEntry): { symbol: '✓' | '◆' | '~'; label: string } {
  if (e.status === 'confirmed') return { symbol: '✓', label: 'confirmed' };
  if (e.tier === 'datamined') return { symbol: '◆', label: 'datamined' };
  return { symbol: '~', label: 'predicted' };
}
