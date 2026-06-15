/**
 * Detail for the selected timeline entry: tier/lane/server badges, the date +
 * type-specific fields, the source permalink, what it feeds M4, and — for
 * anything not yet confirmed — how to hand-confirm it (P5; a static app can't
 * write timeline_overrides.json itself).
 */
import type { TimelineEntry } from '@/core/types';
import { timelineBadge } from '@/core/timeline';

const LANE_NAME: Record<TimelineEntry['type'], string> = {
  cm: 'Champions Meeting',
  banner: 'Banner',
  patch: 'Patch',
};

export function TimelineDetailPanel({ entry }: { entry: TimelineEntry | null }) {
  if (entry === null) {
    return (
      <aside className="panel tl-detail" aria-label="Entry detail">
        <p className="muted">Select an entry to see its dates, source, and what it feeds.</p>
      </aside>
    );
  }

  const badge = timelineBadge(entry);
  const isCm = entry.type === 'cm';
  return (
    <aside className="panel tl-detail" aria-label="Entry detail">
      <h3>{entry.title}</h3>
      <p className="tl-detail-meta">
        <span className="badge">{LANE_NAME[entry.type]}</span>
        <span className={`tl-badge ${badge.label}`}>
          {badge.symbol} {badge.label}
        </span>
        <span className="badge">{entry.server.toUpperCase()}</span>
      </p>

      <dl className="tl-detail-fields">
        {entry.dates.start !== undefined && (
          <>
            <dt>Signup</dt>
            <dd>{entry.dates.start}</dd>
          </>
        )}
        {entry.dates.finals !== undefined && (
          <>
            <dt>Finals</dt>
            <dd>{entry.dates.finals}</dd>
          </>
        )}
        {entry.dates.end !== undefined && (
          <>
            <dt>Ends</dt>
            <dd>{entry.dates.end}</dd>
          </>
        )}

        {isCm && entry.cm?.cmNumber !== undefined && (
          <>
            <dt>CM #</dt>
            <dd>{entry.cm.cmNumber}</dd>
          </>
        )}
        {isCm && entry.cm?.courseId !== undefined && (
          <>
            <dt>Course</dt>
            <dd>{entry.cm.courseId}</dd>
          </>
        )}
        {isCm && entry.cm?.trackSummary !== undefined && (
          <>
            <dt>Track</dt>
            <dd>{entry.cm.trackSummary}</dd>
          </>
        )}

        {entry.type === 'banner' && entry.banner?.kind !== undefined && (
          <>
            <dt>Banner</dt>
            <dd>{entry.banner.kind === 'support' ? 'Support card' : 'Character'}</dd>
          </>
        )}
        {entry.type === 'patch' && entry.patch?.version !== undefined && (
          <>
            <dt>Version</dt>
            <dd>{entry.patch.version}</dd>
          </>
        )}
        {entry.type === 'patch' && entry.patch?.summary !== undefined && (
          <>
            <dt>Summary</dt>
            <dd>{entry.patch.summary}</dd>
          </>
        )}
      </dl>

      {entry.source.url !== '' ? (
        <p className="tl-detail-source small">
          Source:{' '}
          <a href={entry.source.url} target="_blank" rel="noreferrer">
            {entry.source.kind} ↗
          </a>
        </p>
      ) : (
        <p className="tl-detail-source muted small">Source: {entry.source.kind} (no link yet)</p>
      )}

      {isCm && entry.cm?.cmNumber !== undefined && entry.cm.courseId !== undefined && (
        <p className="tl-feeds small">
          → Feeds Skill Planner §0 as CM{entry.cm.cmNumber} (course {entry.cm.courseId}).
        </p>
      )}

      {entry.status !== 'confirmed' && (
        <p className="tl-unconfirmed small">
          Not yet confirmed ({badge.label}). To confirm, hand-edit{' '}
          <code>data-overrides/timeline_overrides.json</code>: set{' '}
          <code>status: "confirmed"</code>, stamp an official <code>/news/&lt;id&gt;/</code> link,
          then run <code>pnpm data:build</code>.
        </p>
      )}
    </aside>
  );
}
