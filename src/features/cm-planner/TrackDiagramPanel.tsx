/**
 * M4 §0 — the always-on race-track diagram. Renders the course geometry
 * (straights/corners) for the plan's CM course and overlays an activation band
 * for every wishlist skill plus the unique. Selecting a band (or a skill row in
 * the chart) highlights it across panels via the SelectedSkill context.
 *
 * Geometry is resolved lazily (default `deps.resolveGeometry` dynamic-imports
 * `@/sim/courseGeometry`) so the ~5 MB engine bundle stays out of the initial
 * chunk; tests inject a synchronous resolver.
 *
 * P3 honesty: band START is parsed from the skill's condition DSL but band WIDTH
 * is an approximate fixed default until per-skill duration data is sourced — the
 * caveat is shown in the UI.
 */
import { useEffect, useMemo, useState } from 'react';
import type { CmPlan } from '@/core/types';
import { activationBands, trackSegments, type CourseGeometry } from '@/core/track';
import { useGameData } from '@/features/data/gameData';
import { useSelectedSkill } from './useSelectedSkill';

interface TrackDiagramPanelProps {
  plan: CmPlan;
  deps?: {
    resolveGeometry: (courseId: string) => CourseGeometry | Promise<CourseGeometry>;
  };
}

const defaultResolveGeometry = (courseId: string): Promise<CourseGeometry> =>
  import('@/sim/courseGeometry').then((m) => m.courseGeometryFor(courseId));

export function TrackDiagramPanel({ plan, deps }: TrackDiagramPanelProps) {
  const resolveGeometry = deps?.resolveGeometry ?? defaultResolveGeometry;
  const { skillById } = useGameData();
  const { selectedSkillId, setSelectedSkillId } = useSelectedSkill();
  const { cmRef, wishlist, uniqueSkillId } = plan;
  const courseId = cmRef.courseId;

  const [geom, setGeom] = useState<CourseGeometry | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setGeom(null);
    setError(null);
    if (!courseId) {
      setError('no course selected');
      return;
    }
    Promise.resolve()
      .then(() => resolveGeometry(courseId))
      .then((g) => {
        if (!cancelled) setGeom(g);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [courseId, resolveGeometry]);

  const segments = useMemo(() => (geom ? trackSegments(geom) : []), [geom]);
  const bands = useMemo(
    () =>
      geom
        ? activationBands(
            wishlist.map((w) => w.skillId),
            uniqueSkillId || undefined,
            geom,
            skillById,
          )
        : [],
    [geom, wishlist, uniqueSkillId, skillById],
  );

  return (
    <section className="panel cmp-race" aria-labelledby="race-h">
      <h2 id="race-h">Race</h2>
      <p className="muted small">
        CM{cmRef.cmNumber} · {cmRef.surface} · {cmRef.distance}m
        {geom ? ` · ${geom.turn === 1 ? 'right-handed' : 'left-handed'}` : ''}
      </p>

      {error && <p className="muted">Track unavailable: {error}</p>}

      {geom && (
        <>
          <div className="track" aria-label={`Activation map for the ${cmRef.distance}m course`}>
            {segments.map((s) => (
              <div
                key={`${s.kind}-${s.startPct}`}
                className={`tseg ${s.kind === 'corner' ? 'tcorner' : 'tstraight'}`}
                style={{ width: `${s.widthPct}%` }}
              />
            ))}
            {bands.map((b) => {
              const isSelected = b.skillId === selectedSkillId;
              return (
                <button
                  type="button"
                  key={b.skillId}
                  className={`act${isSelected ? ' hot' : ''}`}
                  style={{ left: `${b.startPct}%`, width: `${b.widthPct}%` }}
                  aria-pressed={isSelected}
                  aria-label={`${b.label}${b.isUnique ? ' (unique)' : ''} activation zone`}
                  onClick={() => setSelectedSkillId(isSelected ? null : b.skillId)}
                >
                  <b>{b.label}</b>
                </button>
              );
            })}
            <div className="fin" aria-hidden="true" />
          </div>
          <div className="axis">
            <span>start 0m</span>
            <span>{Math.round(cmRef.distance / 2)}m</span>
            <span>finish {cmRef.distance}m</span>
          </div>
          <div className="tracklegend">
            <span className="k">
              <i className="leg-straight" /> straight
            </span>
            <span className="k">
              <i className="leg-corner" /> corner
            </span>
            <span className="k">
              <i className="leg-sel" /> selected
            </span>
            <span className="k">
              <i className="leg-other" /> wishlist / unique
            </span>
            <span className="k">
              <i className="leg-fin" /> finish
            </span>
          </div>
          <p className="muted small">
            Activation zones are approximate — band widths use a default duration until per-skill
            duration data lands.
          </p>
        </>
      )}
    </section>
  );
}
