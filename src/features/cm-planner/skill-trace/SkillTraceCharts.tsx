import './skill-trace.css';
import type { RunChoice, SkillImpact, SkillTraceRun } from '@/sim';
import {
  vtPoints, polyline, domainOf, activationTimes, timePhaseBands,
  impactByPosition, frequencyByPosition, binColumns, niceDomain, zeroLineY,
  distancePhaseBands, phaseBoundaryDistances, PHASE_FRACTIONS,
  type Box, type Band, type LDomain,
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

/** Shared position-binned bar chart: X = course position (with phase-transition ticks),
 *  Y = a per-bin value (max バ身, or activation %). */
function PositionBarChart({
  title, yTitle, yMax, values, ld, distance,
}: { title: string; yTitle: string; yMax: string; values: number[]; ld: LDomain; distance: number }) {
  const cols = binColumns(values, BOX, ld);
  const zeroY = zeroLineY(BOX, ld);
  const ticks = [
    { left: 0, label: '0' },
    ...phaseBoundaryDistances(distance).map((dist, i) => ({ left: (PHASE_FRACTIONS[i] ?? 0) * 100, label: `${Math.round(dist)}m` })),
    { left: 100, label: `${Math.round(distance)}m` },
  ];
  return (
    <figure className="cmp-trace-chart">
      <figcaption>{title}</figcaption>
      <div className="cmp-trace-plot">
        <span className="cmp-axis-ytitle">{yTitle}</span>
        <span className="cmp-axis-ymax">{yMax}</span>
        <svg viewBox={`0 0 ${BOX.w} ${BOX.h}`} role="img" aria-label={title} preserveAspectRatio="none">
          <PhaseBands bands={distancePhaseBands(BOX)} />
          {cols.map((c, i) => <rect key={i} className={`cmp-trace-col ${c.neg ? 'is-neg' : ''}`.trim()} x={c.x} y={c.y} width={c.w} height={c.h} />)}
          <line className="cmp-trace-baseline" x1={0} y1={zeroY} x2={BOX.w} y2={zeroY} />
        </svg>
        <span className="cmp-axis-x cmp-axis-x-ticks">
          {ticks.map((t, i) => <span key={i} className="cmp-xtick" style={{ left: `${t.left}%` }}>{t.label}</span>)}
        </span>
      </div>
    </figure>
  );
}

/** umalator "Length Difference Impact": max バ身 gained when the skill activates at each position. */
export function LengthImpactChart({ impact }: { impact: SkillImpact }) {
  const values = impactByPosition(impact.samples, impact.distance);
  const ld = niceDomain(values);
  return (
    <PositionBarChart title="Length gained by activation position" yTitle="バ身" yMax={`${num(ld.top)}L`}
      values={values} ld={ld} distance={impact.distance} />
  );
}

/** % of runs in which the skill activates at each position (発動率 by position). */
export function ActivationFrequencyChart({ impact }: { impact: SkillImpact }) {
  const values = frequencyByPosition(impact.samples, impact.nsamples, impact.distance);
  return (
    <PositionBarChart title="Activation frequency by position" yTitle="%" yMax="100%"
      values={values} ld={{ top: 100, bottom: 0 }} distance={impact.distance} />
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
