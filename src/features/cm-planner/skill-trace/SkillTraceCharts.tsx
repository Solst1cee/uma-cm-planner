import './skill-trace.css';
import type { RunChoice, SkillTraceRun } from '@/sim';
import {
  vtPoints, gapCurve, gapPoints, lDomain, zeroLineY, polyline, domainOf, activationTimes,
  distancePhaseBands, timePhaseBands, type Box, type Band,
} from './geometry';

const BOX: Box = { w: 280, h: 96 };
const PHASE_LABELS = ['Early', 'Mid', 'Late'] as const;

/** Low-opacity Early/Mid/Late background bands (colors match the §0 racetrack). */
function PhaseBands({ bands }: { bands: Band[] }) {
  return (
    <>
      {bands.map((b) => (
        <rect key={b.phase} className={`cmp-trace-phase is-phase-${b.phase}`} x={b.x} y={0} width={b.w} height={BOX.h}>
          <title>{PHASE_LABELS[b.phase]} race</title>
        </rect>
      ))}
    </>
  );
}

/** Compact axis number: integers bare, else trimmed to 1–2 dp. */
function num(n: number): string {
  if (Number.isInteger(n)) return `${n}`;
  return n.toFixed(Math.abs(n) < 1 ? 2 : 1).replace(/\.?0+$/, '');
}

export function VelocityTimeChart({ run }: { run: SkillTraceRun }) {
  const d = domainOf(run);
  const withPts = polyline(vtPoints(run.withSkill, BOX, d));
  const withoutPts = polyline(vtPoints(run.without, BOX, d));
  const zones = activationTimes(run).map(({ tStart, tEnd }) => ({
    x: (tStart / d.tMax) * BOX.w,
    w: Math.max(1, ((tEnd - tStart) / d.tMax) * BOX.w),
  }));
  return (
    <figure className="cmp-trace-chart">
      <figcaption>Velocity vs time</figcaption>
      <div className="cmp-trace-plot">
        <span className="cmp-axis-ytitle">m/s</span>
        <span className="cmp-axis-ymax">{num(d.vMax)}</span>
        <svg viewBox={`0 0 ${BOX.w} ${BOX.h}`} role="img" aria-label="Velocity over time, with and without the skill; race phases shaded" preserveAspectRatio="none">
          <PhaseBands bands={timePhaseBands(run, BOX, d)} />
          {zones.map((z, i) => <rect key={i} className="cmp-trace-zone" x={z.x} y={0} width={z.w} height={BOX.h} />)}
          <polyline className="cmp-trace-line is-without" points={withoutPts} fill="none" />
          <polyline className="cmp-trace-line is-with" points={withPts} fill="none" />
        </svg>
        <span className="cmp-axis-x"><span>0</span><span className="cmp-axis-xtitle">time (s)</span><span>{`${num(d.tMax)}s`}</span></span>
      </div>
    </figure>
  );
}

export function LengthDistanceChart({ run }: { run: SkillTraceRun }) {
  const d = domainOf(run);
  const curve = gapCurve(run);
  const ld = lDomain(curve);
  const pts = polyline(gapPoints(curve, BOX, d, ld));
  const zeroY = zeroLineY(BOX, ld);
  return (
    <figure className="cmp-trace-chart">
      <figcaption>Length gained vs distance</figcaption>
      <div className="cmp-trace-plot">
        <span className="cmp-axis-ytitle">バ身</span>
        <span className="cmp-axis-ymax">{`${num(ld.top)}L`}</span>
        {ld.bottom < 0 && <span className="cmp-axis-ymin">{`${num(ld.bottom)}L`}</span>}
        <svg viewBox={`0 0 ${BOX.w} ${BOX.h}`} role="img" aria-label="Length advantage over race distance; race phases shaded" preserveAspectRatio="none">
          <PhaseBands bands={distancePhaseBands(BOX)} />
          <line className="cmp-trace-baseline" x1={0} y1={zeroY} x2={BOX.w} y2={zeroY} />
          <polyline className="cmp-trace-line is-gain" points={pts} fill="none" />
        </svg>
        <span className="cmp-axis-x"><span>0</span><span className="cmp-axis-xtitle">distance (m)</span><span>{`${Math.round(d.distMax)}m`}</span></span>
      </div>
    </figure>
  );
}

export function ActivationRateBadge({
  status, rate, onCompute,
}: { status: 'idle' | 'running' | 'done'; rate: number | null; onCompute: () => void }) {
  if (status === 'done' && rate !== null) {
    const pct = `${Math.round(rate * 100)}%`;
    return (
      <div className="cmp-trace-rate is-done">
        <span className="cmp-trace-rate-label">Activation rate</span>
        <span className="cmp-trace-rate-bar"><span style={{ width: pct }} /></span>
        <strong>{pct}</strong>
      </div>
    );
  }
  return (
    <button type="button" className="cmp-trace-rate-btn" disabled={status === 'running'} onClick={onCompute}>
      {status === 'running' ? 'Measuring activation rate…' : 'Compute activation rate'}
    </button>
  );
}

const CHOICES: { label: string; value: RunChoice }[] = [
  { label: 'Worst', value: 'min' },
  { label: 'Typical', value: 'median' },
  { label: 'Best', value: 'max' },
];

export function RunChoiceToggle({ value, onChange }: { value: RunChoice; onChange: (c: RunChoice) => void }) {
  return (
    <div className="cmp-trace-choice" role="group" aria-label="Representative run">
      {CHOICES.map((c) => (
        <button
          key={c.value}
          type="button"
          className={`cmp-trace-choice-btn ${value === c.value ? 'is-active' : ''}`.trim()}
          aria-pressed={value === c.value}
          onClick={() => onChange(c.value)}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}
