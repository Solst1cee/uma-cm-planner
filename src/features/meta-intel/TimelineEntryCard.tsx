/**
 * One timeline entry as a selectable card: tier badge + title + headline date
 * + a type-specific one-line summary. The current CM also carries a `→ M4` tag
 * (it's the CM the Skill Planner targets). Presentational — all state lives in
 * TimelinePage.
 */
import type { TimelineEntry } from '@/core/types';
import { effectiveDate, timelineBadge } from '@/core/timeline';

function laneSummary(e: TimelineEntry): string {
  if (e.type === 'cm') {
    return e.cm?.trackSummary ?? (e.cm?.cmNumber !== undefined ? `CM${e.cm.cmNumber}` : 'Champions Meeting');
  }
  if (e.type === 'banner') {
    return e.banner?.kind === 'support' ? 'Support banner' : 'Character banner';
  }
  return e.patch?.version !== undefined ? `Patch ${e.patch.version}` : 'Patch';
}

export function TimelineEntryCard({
  entry,
  selected,
  past,
  current,
  onSelect,
}: {
  entry: TimelineEntry;
  selected: boolean;
  past: boolean;
  current: boolean;
  onSelect: () => void;
}) {
  const badge = timelineBadge(entry);
  const date = effectiveDate(entry) || 'TBD';
  const className =
    'tl-card' +
    (selected ? ' selected' : '') +
    (past ? ' past' : '') +
    (current ? ' current' : '');
  return (
    <button type="button" className={className} aria-pressed={selected} onClick={onSelect}>
      <span className={`tl-badge ${badge.label}`}>
        {badge.symbol} {badge.label}
      </span>
      <span className="tl-card-title">{entry.title}</span>
      <span className="tl-card-date muted small">{date}</span>
      <span className="tl-card-summary small">{laneSummary(entry)}</span>
      {current && entry.type === 'cm' && (
        <span className="tl-m4-tag" title="The CM the Skill Planner targets">
          → M4
        </span>
      )}
    </button>
  );
}
