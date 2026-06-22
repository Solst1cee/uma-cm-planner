import './race-overlay.css';
import type { RaceCompareRun, RaceActivation } from '@/sim';
import {
  polyline, posPoints, velocityHpDomain, gapMagnitude, gapPoints, type Box,
} from '@/features/cm-planner/skill-trace/geometry';
import { RaceTrackDimensions as D } from '../vendor/types';
import { cornerIndexAt, cornerLabel } from '@/core/corners';

/** A course corner segment (position metres). */
export type Corner = { readonly start: number; readonly length: number };

export const OVERLAY_VELO_BOX: Box = { w: D.RenderWidth, h: D.OverlayVeloHeight };
export const OVERLAY_GAP_BOX: Box = { w: D.RenderWidth, h: D.OverlayGapHeight };

// Skill-marker layout (ported from umalator-global's rung-stacking, racetrack/skills): each
// activation is placed on the first "rung" (lane) whose horizontal extent — the bar OR the label
// width — doesn't overlap an existing marker, so nothing collides. Rungs stack upward.
const BAR_H = 9;        // marker / duration-bar height
const RUNG_STEP = 11;   // vertical distance between rungs
const CHAR_W = 3.4;     // approx label glyph width (viewBox units) for label-aware packing

interface Placed { a: RaceActivation; rung: number; x: number; w: number; duration: boolean; name: string; }

/** Greedy rung assignment for one uma's activations; the occupied interval is max(bar, label).
 *  `label(a)` is the full marker text (skill name + optional corner) — used for both packing and
 *  rendering so the corner suffix reserves horizontal space. Exported for unit testing. */
export function placeRungs(acts: RaceActivation[], distance: number, boxW: number, label: (a: RaceActivation) => string): { placed: Placed[]; rungs: number } {
  if (distance <= 0) return { placed: [], rungs: 0 };
  const metersPerUnit = distance / boxW;
  const lanes: { s: number; e: number }[][] = [];
  const placed = [...acts]
    .sort((a, b) => a.start - b.start)
    .map((a) => {
      const duration = a.end - a.start > 1;
      const name = label(a);
      const labelMeters = (name.length * CHAR_W + (duration ? 4 : 7)) * metersPerUnit;
      const s = a.start;
      const e = a.start + Math.max(duration ? a.end - a.start : 0, labelMeters);
      let r = 0;
      for (; r < lanes.length; r++) {
        if (!lanes[r]!.some((b) => !(e <= b.s || s >= b.e))) break;
      }
      if (r === lanes.length) lanes.push([]);
      lanes[r]!.push({ s, e });
      return { a, rung: r, x: (a.start / distance) * boxW, w: ((a.end - a.start) / distance) * boxW, duration, name };
    });
  return { placed, rungs: lanes.length };
}

/** Render one uma's placed markers stacking up from `baseY`: duration → labelled colored bar,
 *  instant → dot + label (umalator's duration/immediate marker split). */
function MarkerLayer({ placed, baseY, cls }: { placed: Placed[]; baseY: number; cls: string }) {
  return (
    <g className={`ro-marks ${cls}`}>
      {placed.map((p, i) => {
        const y = baseY - BAR_H - p.rung * RUNG_STEP;
        return (
          <g key={i} transform={`translate(${p.x}, ${y})`}>
            {p.duration ? (
              <>
                <rect className={`ro-zone ${cls}`} x={0} y={0} width={Math.max(2, p.w)} height={BAR_H} rx={2} />
                <text className="ro-mark-label ro-on-bar" x={3} y={BAR_H / 2} dominantBaseline="central">{p.name}</text>
              </>
            ) : (
              <>
                <circle className={`ro-marker ${cls}`} cx={1} cy={BAR_H / 2} r={2.4} />
                <text className="ro-mark-label" x={5} y={BAR_H / 2} dominantBaseline="central">{p.name}</text>
              </>
            )}
          </g>
        );
      })}
    </g>
  );
}

/** Round speed ticks (m/s) from 0 up to vMax for the velocity y-axis. */
function speedTicks(vMax: number): number[] {
  const step = vMax > 24 ? 10 : vMax > 12 ? 5 : 2;
  const out: number[] = [];
  for (let s = 0; s <= vMax + 1e-6; s += step) out.push(Math.round(s));
  return out;
}

/** Velocity (m/s) y-axis: left-margin labels only (no horizontal gridlines). */
function VelocityAxis({ box, vMax }: { box: Box; vMax: number }) {
  return (
    <g className="ro-yaxis" aria-hidden>
      {speedTicks(vMax).map((s) => (
        <text key={s} className="ro-yaxis-label" x={-2} y={box.h - (s / vMax) * box.h + 2.4} textAnchor="end">{s}</text>
      ))}
      <text className="ro-yaxis-unit" x={-2} y={7} textAnchor="end">m/s</text>
    </g>
  );
}

/** SVG overlay for the race-compare view: two velocity lines + two HP lines (toggle) + a speed
 *  y-axis + rung-stacked skill markers (red uma2 above blue uma1) + バ身-gap sub-band. When
 *  `corners` is supplied, a marker that fired inside a corner is suffixed with its physical
 *  corner (e.g. "Professor of Curvature C3"), wrap-around aware (Hanshin 3200m → C3,C4,C1,C2,C3,C4). */
export function RaceOverlay({ run, distance, showHp, skillName, corners }: {
  run: RaceCompareRun; distance: number; showHp: boolean; skillName: (id: string) => string;
  corners?: ReadonlyArray<Corner>;
}) {
  const velo = OVERLAY_VELO_BOX, gapBox = OVERLAY_GAP_BOX;
  const { vMax, hpMax } = velocityHpDomain(run.uma1Frames, run.uma2Frames);
  const v1 = polyline(posPoints(run.uma1Frames, velo, distance, (f) => f.v, vMax));
  const v2 = polyline(posPoints(run.uma2Frames, velo, distance, (f) => f.v, vMax));
  const h1 = polyline(posPoints(run.uma1Frames, velo, distance, (f) => f.hp, hpMax));
  const h2 = polyline(posPoints(run.uma2Frames, velo, distance, (f) => f.hp, hpMax));
  const mag = gapMagnitude(run.gap);
  const gapLine = polyline(gapPoints(run.gap, gapBox, distance, mag));

  // Marker text = skill name, plus the physical corner it fired in (if any).
  const label = (a: RaceActivation): string => {
    const name = skillName(a.skillId);
    if (!corners || corners.length === 0) return name;
    const ci = cornerIndexAt(corners, a.start);
    return ci >= 0 ? `${name} ${cornerLabel(corners.length, ci)}` : name;
  };

  // uma1 markers stack up from the bottom; uma2 markers stack up above uma1's stack (red over blue).
  const m1 = placeRungs(run.uma1Acts, distance, velo.w, label);
  const m2 = placeRungs(run.uma2Acts, distance, velo.w, label);
  const uma1BaseY = velo.h;
  const uma2BaseY = velo.h - m1.rungs * RUNG_STEP - 3;

  return (
    <g className="race-overlay" transform={`translate(${D.marginLeft}, ${D.OverlayBandY})`}>{/* overlay aligns to the XAxis scale because xOffset === marginLeft */}
      <VelocityAxis box={velo} vMax={vMax} />
      {/* velocity + HP */}
      <g>
        {showHp && <polyline className="ro-hp is-uma1" points={h1} fill="none" />}
        {showHp && <polyline className="ro-hp is-uma2" points={h2} fill="none" />}
        <polyline className="ro-velo is-uma2" points={v2} fill="none" />
        <polyline className="ro-velo is-uma1" points={v1} fill="none" />
      </g>
      {/* skill markers — rung-stacked so nothing overlaps; red (uma2) above blue (uma1) */}
      <MarkerLayer placed={m1.placed} baseY={uma1BaseY} cls="is-uma1" />
      <MarkerLayer placed={m2.placed} baseY={uma2BaseY} cls="is-uma2" />
      {/* gap sub-band */}
      <g transform={`translate(0, ${D.OverlayVeloHeight + 6})`}>
        <line className="ro-gap-zero" x1={0} y1={gapBox.h / 2} x2={gapBox.w} y2={gapBox.h / 2} />
        <polyline className="ro-gap" points={gapLine} fill="none" />
      </g>
    </g>
  );
}
