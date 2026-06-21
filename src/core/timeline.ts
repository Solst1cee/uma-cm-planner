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

/** The current/next CM: first CM on/after now, else the most recent past one. */
export function currentCm(cmEntries: TimelineEntry[], nowISO: string): TimelineEntry | null {
  if (cmEntries.length === 0) return null;
  const sorted = sortTimeline(cmEntries);
  // A CM stays "current" until its END date — it's still running through then —
  // so the badge/default don't jump to the next CM between finals and end.
  const until = (e: TimelineEntry): string => e.dates.end ?? e.dates.finals ?? e.dates.start ?? '';
  const active = sorted.find((e) => until(e) >= nowISO);
  return active ?? sorted[sorted.length - 1] ?? null;
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

/** JP→Global content acceleration (SoulEC "Time Factor" ≈ 142.2%, 2026-06-15). PREDICTION input only (P3). */
export const JP_GLOBAL_PACE = 1.422;
export const JP_LAUNCH = '2021-02-24';
export const GLOBAL_LAUNCH = '2025-06-26';

/** Predict a Global date from a JP date using the baked pace + launch anchors (tier 'prediction'). */
export function predictGlobalDateDefault(jpISO: string): string {
  return predictGlobalDate(jpISO, JP_GLOBAL_PACE, JP_LAUNCH, GLOBAL_LAUNCH);
}

/**
 * Add `months` calendar months to an ISO date (UTC), clamping to the last day
 * of the target month so day-of-month never overflows (2026-01-31 +1mo →
 * 2026-02-28, not 2026-03-03). Shared by CM-schedule synthesis + timeline windowing.
 */
export function addMonths(iso: string, months: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + months);
  if (d.getUTCDate() !== day) d.setUTCDate(0); // overflowed → snap to last day of intended month
  return d.toISOString().slice(0, 10);
}
