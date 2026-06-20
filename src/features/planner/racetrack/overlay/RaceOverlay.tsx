import './race-overlay.css';
import type { RaceCompareRun, RaceActivation } from '@/sim';
import {
  polyline, posPoints, activationZonesByPos, velocityHpDomain, gapMagnitude, gapPoints, type Box,
} from '@/features/cm-planner/skill-trace/geometry';
import { RaceTrackDimensions as D } from '../vendor/types';

export const OVERLAY_VELO_BOX: Box = { w: D.RenderWidth, h: D.OverlayVeloHeight };
export const OVERLAY_GAP_BOX: Box = { w: D.RenderWidth, h: D.OverlayGapHeight };

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

const LANE_H = 12; // short skill-marker lane height

/** Skill activations in a short horizontal lane: a tick (or a shaded bar for duration skills) at
 *  the fire position + the skill name as horizontal text. Each uma gets its own lane (no overlap
 *  between runners); `laneY` stacks them (red above blue). */
function MarkerLayer({ acts, distance, box, laneY, cls, skillName }: {
  acts: RaceActivation[]; distance: number; box: Box; laneY: number; cls: string; skillName: (id: string) => string;
}) {
  const zones = activationZonesByPos(acts, box, distance);
  return (
    <g className={`ro-marks ${cls}`} transform={`translate(0, ${laneY})`}>
      {acts.map((a, i) => {
        const z = zones[i]!;
        const duration = a.end - a.start > 1;
        return (
          <g key={i} transform={`translate(${z.x}, 0)`}>
            {duration ? (
              <rect className={`ro-zone ${cls}`} x={0} y={0} width={z.w} height={LANE_H} />
            ) : (
              <line className={`ro-marker ${cls}`} x1={0} x2={0} y1={0} y2={LANE_H} />
            )}
            <text className="ro-mark-label" x={2.5} y={LANE_H - 3}>{skillName(a.skillId)}</text>
          </g>
        );
      })}
    </g>
  );
}

/** SVG overlay for the race-compare view: two velocity lines + two HP lines (toggle) + a speed
 *  y-axis + per-uma skill markers with labels + バ身-gap sub-band, on the track's distance→x scale. */
export function RaceOverlay({ run, distance, showHp, skillName }: {
  run: RaceCompareRun; distance: number; showHp: boolean; skillName: (id: string) => string;
}) {
  const velo = OVERLAY_VELO_BOX, gapBox = OVERLAY_GAP_BOX;
  const { vMax, hpMax } = velocityHpDomain(run.uma1Frames, run.uma2Frames);
  const v1 = polyline(posPoints(run.uma1Frames, velo, distance, (f) => f.v, vMax));
  const v2 = polyline(posPoints(run.uma2Frames, velo, distance, (f) => f.v, vMax));
  const h1 = polyline(posPoints(run.uma1Frames, velo, distance, (f) => f.hp, hpMax));
  const h2 = polyline(posPoints(run.uma2Frames, velo, distance, (f) => f.hp, hpMax));
  const mag = gapMagnitude(run.gap);
  const gapLine = polyline(gapPoints(run.gap, gapBox, distance, mag));
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
      {/* skill markers in two short lanes near the bottom — red (uma2) above blue (uma1) */}
      <MarkerLayer acts={run.uma2Acts} distance={distance} box={velo} laneY={velo.h - 2 * LANE_H - 2} cls="is-uma2" skillName={skillName} />
      <MarkerLayer acts={run.uma1Acts} distance={distance} box={velo} laneY={velo.h - LANE_H} cls="is-uma1" skillName={skillName} />
      {/* gap sub-band */}
      <g transform={`translate(0, ${D.OverlayVeloHeight + 6})`}>
        <line className="ro-gap-zero" x1={0} y1={gapBox.h / 2} x2={gapBox.w} y2={gapBox.h / 2} />
        <polyline className="ro-gap" points={gapLine} fill="none" />
      </g>
    </g>
  );
}
