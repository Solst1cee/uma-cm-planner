/**
 * M3 Meta Intel — browsable timeline. Three swimlanes (CM / Banners / Patches)
 * on a shared date axis with a "now" marker, tier badges, lane + confirmed-only
 * filters, and a detail panel. Read-only browsing (P2/P3): confirming an entry
 * is a hand-edit of timeline_overrides.json, surfaced in the detail panel.
 *
 * `now` is injectable for deterministic tests; it defaults to today.
 */
import { Fragment, useMemo, useRef, useState } from 'react';
import { effectiveDate } from '@/core/timeline';
import { useGameData } from '@/features/data/gameData';
import { LANES, type LaneKey, currentCm, filterTimeline, nowIndex, partitionByLane } from './timelineView';
import { TimelineEntryCard } from './TimelineEntryCard';
import { TimelineDetailPanel } from './TimelineDetailPanel';
import './meta-intel.css';

const ALL_LANE_KEYS: LaneKey[] = LANES.map((l) => l.key);

export function TimelinePage({ now }: { now?: string } = {}) {
  const { status, timeline } = useGameData();
  const entries = timeline ?? [];
  const nowISO = now ?? new Date().toISOString().slice(0, 10);

  const [enabledLanes, setEnabledLanes] = useState<Set<LaneKey>>(() => new Set(ALL_LANE_KEYS));
  const [confirmedOnly, setConfirmedOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const lanesRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(
    () => filterTimeline(entries, { lanes: enabledLanes, confirmedOnly }),
    [entries, enabledLanes, confirmedOnly],
  );
  const partitioned = useMemo(() => partitionByLane(filtered), [filtered]);
  const currentCmId = useMemo(
    () => currentCm(partitionByLane(entries).cm, nowISO)?.id ?? null,
    [entries, nowISO],
  );
  const selected = useMemo(
    () => entries.find((e) => e.id === selectedId) ?? null,
    [entries, selectedId],
  );

  const toggleLane = (key: LaneKey) =>
    setEnabledLanes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const jumpToNow = () => {
    const marker = lanesRef.current?.querySelector('[data-now]');
    (marker as HTMLElement | null)?.scrollIntoView?.({ block: 'nearest', inline: 'center' });
  };

  if (status === 'loading') {
    return (
      <div className="page">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="page tl-page">
      <section className="panel">
        <h2>Meta Intel — Timeline</h2>
        <p className="muted small">
          Champions Meetings, banners, and patches on one axis. Each entry shows its
          confidence tier — ✓ confirmed (official), ◆ datamined, ~ predicted. Predictions
          are estimates (P3), never guarantees; JP-ahead items are previews (P4).
        </p>

        <div className="timeline-controls" role="group" aria-label="Timeline filters">
          {LANES.map((l) => (
            <label key={l.key} className="tl-toggle">
              <input
                type="checkbox"
                checked={enabledLanes.has(l.key)}
                onChange={() => toggleLane(l.key)}
              />
              {l.label}
            </label>
          ))}
          <label className="tl-toggle">
            <input
              type="checkbox"
              checked={confirmedOnly}
              onChange={(e) => setConfirmedOnly(e.target.checked)}
            />
            Confirmed only
          </label>
          <button type="button" onClick={jumpToNow}>
            Jump to now
          </button>
        </div>
      </section>

      <div className="tl-body">
        <div className="timeline-lanes" ref={lanesRef}>
          {entries.length === 0 ? (
            <p className="muted">
              No timeline data yet — run <code>pnpm data:build</code> to bake it.
            </p>
          ) : (
            LANES.filter((l) => enabledLanes.has(l.key)).map((lane) => {
              const laneEntries = partitioned[lane.key];
              const marker = nowIndex(laneEntries, nowISO);
              return (
                <section key={lane.key} className="timeline-lane" aria-label={lane.label}>
                  <h3 className="lane-label">{lane.label}</h3>
                  <div className="lane-track">
                    {laneEntries.length === 0 && <span className="muted small">— none —</span>}
                    {laneEntries.map((entry, i) => (
                      <Fragment key={entry.id}>
                        {i === marker && (
                          <span className="now-marker" data-now aria-label="now">
                            now ▸
                          </span>
                        )}
                        <TimelineEntryCard
                          entry={entry}
                          selected={entry.id === selectedId}
                          past={effectiveDate(entry) < nowISO}
                          current={entry.id === currentCmId}
                          onSelect={() => setSelectedId(entry.id)}
                        />
                      </Fragment>
                    ))}
                    {marker === laneEntries.length && laneEntries.length > 0 && (
                      <span className="now-marker" data-now aria-label="now">
                        now ▸
                      </span>
                    )}
                  </div>
                </section>
              );
            })
          )}
        </div>
        <TimelineDetailPanel entry={selected} />
      </div>
    </div>
  );
}
