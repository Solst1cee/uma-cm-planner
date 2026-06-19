import './skill-trace.css';
import type { RunChoice, SkillImpact, SkillTraceRun } from '@/sim';
import {
  vtPoints, polyline, domainOf, activationTimes, timePhaseBands,
  impactByPosition, frequencyByPosition, binColumns, lAxisDomain, zeroLineY,
  distancePhaseBands, gridLinesX, gridLinesY,
  type Box, type Band, type LDomain,
} from './geometry';

const BOX: Box = { w: 280, h: 96 };
const PHASE_LABELS = ['Early', 'Mid', 'Late', 'Spurt'] as const;
const X_STEP = 500; // metres between x gridlines

function PhaseBands({ bands }: { bands: Band[] }) {
  return (
    <>
      {bands.map((b) => (
        <rect key={b.phase} className={`cmp-trace-phase is-phase-${b.phase}`} x={b.x} y={0} width={b.w} height={BOX.h} />
      ))}
    </>
  );
}

function PhaseLabels({ bands }: { bands: Band[] }) {
  return (
    <>
      {bands.map((b) => (
        <span key={b.phase} className="cmp-phase-label" style={{ left: `${((b.x + b.w / 2) / BOX.w) * 100}%` }}>
          {PHASE_LABELS[b.phase]}
        </span>
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
  const bands = timePhaseBands(run, BOX, d);
  const zones = activationTimes(run).map(({ tStart, tEnd }) => ({
    x: (tStart / d.tMax) * BOX.w,
    w: Math.max(1, ((tEnd - tStart) / d.tMax) * BOX.w),
  }));
  return (
    <figure className="cmp-trace-chart">
      <figcaption>Velocity vs time <small>(m/s)</small></figcaption>
      <div className="cmp-trace-plot">
        <div className="cmp-trace-graph">
          <svg viewBox={`0 0 ${BOX.w} ${BOX.h}`} role="img" aria-label="Velocity over time, with and without the skill; race phases shaded" preserveAspectRatio="none">
            <PhaseBands bands={bands} />
            {zones.map((z, i) => <rect key={i} className="cmp-trace-zone" x={z.x} y={0} width={z.w} height={BOX.h} />)}
            <polyline className="cmp-trace-line is-without" points={withoutPts} fill="none" />
            <polyline className="cmp-trace-line is-with" points={withPts} fill="none" />
          </svg>
          <PhaseLabels bands={bands} />
          <span className="cmp-ylabel" style={{ top: '6px' }}>{num(d.vMax)}</span>
          <span className="cmp-xlabel" style={{ left: '0', transform: 'none' }}>0</span>
          <span className="cmp-xlabel" style={{ left: '100%', transform: 'translateX(-100%)' }}>{`${num(d.tMax)}s`}</span>
        </div>
      </div>
    </figure>
  );
}

/** Shared position-binned bar chart: X = course position (500 m gridlines + labels),
 *  Y = a per-bin value with `yStep` gridlines + labels; 4 phase bands + labels behind. */
function PositionBarChart({ title, values, ld, distance, yStep, yUnit }: {
  title: string; values: number[]; ld: LDomain; distance: number; yStep: number; yUnit: string;
}) {
  const cols = binColumns(values, BOX, ld);
  const zeroY = zeroLineY(BOX, ld);
  const xGrid = gridLinesX(distance, X_STEP, BOX);
  const yGrid = gridLinesY(ld, yStep, BOX);
  const bands = distancePhaseBands(BOX);
  return (
    <figure className="cmp-trace-chart">
      <figcaption>{title}</figcaption>
      <div className="cmp-trace-plot">
        <div className="cmp-trace-graph">
          <svg viewBox={`0 0 ${BOX.w} ${BOX.h}`} role="img" aria-label={title} preserveAspectRatio="none">
            <PhaseBands bands={bands} />
            {yGrid.map((g) => <line key={`y${g.value}`} className="cmp-trace-grid" x1={0} y1={g.y} x2={BOX.w} y2={g.y} />)}
            {xGrid.map((g) => <line key={`x${g.value}`} className="cmp-trace-grid" x1={g.x} y1={0} x2={g.x} y2={BOX.h} />)}
            {cols.map((c, i) => <rect key={i} className={`cmp-trace-col ${c.neg ? 'is-neg' : ''}`.trim()} x={c.x} y={c.y} width={c.w} height={c.h} />)}
            <line className="cmp-trace-baseline" x1={0} y1={zeroY} x2={BOX.w} y2={zeroY} />
          </svg>
          <PhaseLabels bands={bands} />
          {yGrid.map((g) => (
            <span key={`yl${g.value}`} className="cmp-ylabel" style={{ top: `${Math.max(5, Math.min(91, g.y))}px` }}>
              {`${num(g.value)}${yUnit}`}
            </span>
          ))}
          {xGrid.map((g) => (
            <span key={`xl${g.value}`} className="cmp-xlabel"
              style={{ left: `${(g.x / BOX.w) * 100}%`, transform: g.value === 0 ? 'none' : 'translateX(-50%)' }}>
              {g.value === 0 ? '0' : `${g.value}m`}
            </span>
          ))}
        </div>
      </div>
    </figure>
  );
}

/** umalator "Length Difference Impact": max L gained when the skill activates at each position. */
export function LengthImpactChart({ impact }: { impact: SkillImpact }) {
  const values = impactByPosition(impact.samples, impact.distance);
  const ld = lAxisDomain(values);
  return (
    <PositionBarChart title="L gained by activation position" values={values} ld={ld} distance={impact.distance} yStep={1} yUnit="L" />
  );
}

/** % of runs in which the skill activates at each position (発動率 by position). */
export function ActivationFrequencyChart({ impact }: { impact: SkillImpact }) {
  const values = frequencyByPosition(impact.samples, impact.nsamples, impact.distance);
  return (
    <PositionBarChart title="Activation frequency by position" values={values} ld={{ top: 100, bottom: 0 }} distance={impact.distance} yStep={25} yUnit="%" />
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
