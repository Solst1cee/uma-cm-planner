import './skill-trace.css';
import type { RunChoice, SkillTraceRun } from '@/sim';
import { vtPoints, gapCurve, gapPoints, maxAbsL, polyline, domainOf, activationTimes, type Box } from './geometry';

const BOX: Box = { w: 280, h: 96 };

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
      <figcaption>Velocity vs time <small>(m/s)</small></figcaption>
      <svg viewBox={`0 0 ${BOX.w} ${BOX.h}`} role="img" aria-label="Velocity over time, with and without the skill" preserveAspectRatio="none">
        {zones.map((z, i) => <rect key={i} className="cmp-trace-zone" x={z.x} y={0} width={z.w} height={BOX.h} />)}
        <polyline className="cmp-trace-line is-without" points={withoutPts} fill="none" />
        <polyline className="cmp-trace-line is-with" points={withPts} fill="none" />
      </svg>
    </figure>
  );
}

export function LengthDistanceChart({ run }: { run: SkillTraceRun }) {
  const d = domainOf(run);
  const curve = gapCurve(run);
  const pts = polyline(gapPoints(curve, BOX, d, maxAbsL(curve)));
  return (
    <figure className="cmp-trace-chart">
      <figcaption>Length gained vs distance <small>(バ身)</small></figcaption>
      <svg viewBox={`0 0 ${BOX.w} ${BOX.h}`} role="img" aria-label="Length advantage over race distance" preserveAspectRatio="none">
        <line className="cmp-trace-baseline" x1={0} y1={BOX.h / 2} x2={BOX.w} y2={BOX.h / 2} />
        <polyline className="cmp-trace-line is-gain" points={pts} fill="none" />
      </svg>
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
