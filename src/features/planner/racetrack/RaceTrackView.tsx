/**
 * M4 §0 — race-track visualization. Renders umalator's vendored SVG layers
 * (slope profile, corner/straight bands, race legs, distance ruler) for a
 * given course. Course geometry is the real engine CourseData, lazy-loaded so
 * the engine bundle stays out of the initial chunk.
 *
 * Driven by `courseId` (the race-setup chooser owns the selection). Slice A
 * scope: static course only — HP / velocity / skill-activation zones (which need
 * the engine's per-frame run trace) land in a later slice.
 */
import { useEffect, useState } from 'react';
import type { CourseData, RaceCompareRun } from '@/sim';
import { RaceTrackDimensions } from './vendor/types';
import { SlopeVisualization } from './vendor/layers/slope-visualization';
import { SlopeLabelBar } from './vendor/layers/slope-label-bar';
import { SectionTypesBar } from './vendor/layers/section-bar';
import { PhaseBar } from './vendor/layers/phase-bar';
import { SectionNumbersBar } from './vendor/layers/section-numbers';
import { XAxis } from './vendor/axes/x-axis';
import { RaceOverlay } from './overlay/RaceOverlay';
import './vendor/RaceTrack.css';
import './racetrack.css';

interface RaceTrackViewProps {
  courseId: string;
  deps?: { loadCourse: (courseId: string) => Promise<CourseData> };
  trace?: RaceCompareRun;
  traceDistance?: number;
  showHp?: boolean;
  skillName?: (id: string) => string;
}

const defaultLoadCourse = (courseId: string): Promise<CourseData> =>
  import('@/sim/courseData').then((m) => m.courseDataFor(courseId));

export function RaceTrackView({ courseId, deps, trace, traceDistance, showHp = true, skillName }: RaceTrackViewProps) {
  const loadCourse = deps?.loadCourse ?? defaultLoadCourse;
  const [course, setCourse] = useState<CourseData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setCourse(null);
    setError(null);
    if (!courseId) {
      setError('no course selected');
      return;
    }
    loadCourse(courseId)
      .then((c) => {
        if (!cancelled) setCourse(c);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [courseId, loadCourse]);

  if (error) return <p className="muted">Track unavailable: {error}</p>;
  if (!course) return <p className="muted small">Loading track…</p>;

  const overlayActive = !!trace;
  const shift = overlayActive ? RaceTrackDimensions.OverlayBandHeight : 0;
  const vbHeight = RaceTrackDimensions.ViewHeight + shift;
  return (
    <div className="rt-view">
      <svg
        version="1.1"
        xmlns="http://www.w3.org/2000/svg"
        viewBox={`0 0 ${RaceTrackDimensions.ViewWidth} ${vbHeight}`}
        preserveAspectRatio="xMidYMid meet"
        className="racetrackView"
        data-courseid={courseId}
      >
        <g transform={`translate(0, ${shift})`}>
          <SlopeVisualization course={course} />
          <SlopeLabelBar course={course} />
          <SectionTypesBar course={course} />
          <PhaseBar course={course} />
          <SectionNumbersBar />
          <XAxis courseDistance={course.distance} />
        </g>
        {trace && (
          <RaceOverlay
            run={trace}
            distance={traceDistance ?? course.distance}
            showHp={showHp}
            skillName={skillName ?? ((id) => id)}
          />
        )}
      </svg>
    </div>
  );
}
