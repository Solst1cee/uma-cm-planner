import './skill-trace.css';
import type { RunChoice, SkillImpact, SkillTraceRun } from '@/sim';
import {
  polyline, activationTimes, velocityWindow, vtWindowPoints, timePhaseBandsWindowed, tToX,
  impactByPosition, frequencyByPosition, binColumns, lAxisDomain, zeroLineY,
  distancePhaseBands, gridLinesX, gridLinesY,
  type Box, type Band, type LDomain,
} from './geometry';

const BOX: Box = { w: 280, h: 96 };
/** Activation-frequency chart only — half height (user pref); its own box keeps the others full size. */
const FREQ_BOX: Box = { w: 280, h: 48 };
const PHASE_LABELS = ['Early', 'Mid', 'Late', 'Spurt'] as const;
const X_STEP = 500; // metres between x gridlines

function PhaseBands({ bands, box }: { bands: Band[]; box: Box }) {
  return (
    <>
      {bands.map((b) => (
        <rect key={b.phase} className={`cmp-trace-phase is-phase-${b.phase}`} x={b.x} y={0} width={b.w} height={box.h} />
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

/** Velocity vs time (utools / VFalator-style) — zoomed to the skill activation (±window padding),
 *  y-axis floored (not 0-based) so the with/without gap reads, and the with-skill line trimmed to
 *  where it re-converges with the no-skill baseline. Race phases shaded behind. */
export function VelocityTimeChart({ run, runChoice, onRunChoice }: {
  run: SkillTraceRun; runChoice?: RunChoice; onRunChoice?: (c: RunChoice) => void;
}) {
  const w = velocityWindow(run);
  const bands = timePhaseBandsWindowed(run, BOX, w);
  const baseline = polyline(vtWindowPoints(run.without, BOX, w)); // no-skill line spans the whole window
  const withClip = w.tStart !== null ? { start: w.tStart, end: w.convergenceT } : undefined;
  const withPts = polyline(vtWindowPoints(run.withSkill, BOX, w, withClip)); // trimmed to the divergence
  // Only the activations the zoomed window actually spans — a later proc (multi-fire) outside the
  // window would otherwise draw an off-canvas sliver + a label leaking past the right margin.
  const zones = (w.tStart !== null ? activationTimes(run) : [])
    .map(({ tStart, tEnd }, i) => ({ tStart, tEnd, pos: run.activation[i]?.start ?? 0 }))
    .filter((z) => z.tEnd >= w.winStart && z.tStart <= w.winEnd)
    .map((z) => {
      const x0 = Math.max(w.winStart, z.tStart), x1 = Math.min(w.winEnd, z.tEnd);
      return {
        x: tToX(x0, w, BOX),
        w: Math.max(1, tToX(x1, w, BOX) - tToX(x0, w, BOX)),
        dur: z.tEnd - z.tStart,   // activation length (s)
        pos: z.pos,               // where it fires (course metres)
      };
    });
  return (
    <figure className="cmp-trace-chart">
      <figcaption className="cmp-trace-caphead">
        <span>Velocity vs time <small>(m/s)</small></span>
        {runChoice !== undefined && onRunChoice !== undefined && (
          <RunChoiceToggle value={runChoice} onChange={onRunChoice} />
        )}
      </figcaption>
      <div className="cmp-trace-plot">
        <div className="cmp-trace-graph">
          <svg viewBox={`0 0 ${BOX.w} ${BOX.h}`} role="img" aria-label="Velocity over time around the skill activation, with and without the skill; race phases shaded" preserveAspectRatio="none">
            <PhaseBands bands={bands} box={BOX} />
            {zones.map((z, i) => <rect key={i} className="cmp-trace-zone" x={z.x} y={0} width={z.w} height={BOX.h} />)}
            <polyline className="cmp-trace-line is-without" points={baseline} fill="none" />
            <polyline className="cmp-trace-line is-with" points={withPts} fill="none" />
          </svg>
          <PhaseLabels bands={bands} />
          {zones.map((z, i) => (
            <span key={`zl${i}`} className="cmp-zone-label" style={{ left: `${((z.x + z.w / 2) / BOX.w) * 100}%` }}>
              {num(z.dur)}s · ~{Math.round(z.pos)}m
            </span>
          ))}
          <span className="cmp-ylabel" style={{ top: '6px' }}>{num(w.vMax)}</span>
          <span className="cmp-ylabel" style={{ top: `${BOX.h - 6}px` }}>{num(w.vMin)}</span>
          <span className="cmp-xlabel" style={{ left: '0', transform: 'none' }}>{`${num(w.winStart)}s`}</span>
          <span className="cmp-xlabel" style={{ left: '100%', transform: 'translateX(-100%)' }}>{`${num(w.winEnd)}s`}</span>
        </div>
      </div>
    </figure>
  );
}

/** Shared position-binned bar chart: X = course position (500 m gridlines + labels),
 *  Y = a per-bin value with `yStep` gridlines + labels; 4 phase bands + labels behind. */
function PositionBarChart({ title, values, ld, distance, yStep, yUnit, box = BOX }: {
  title: string; values: number[]; ld: LDomain; distance: number; yStep: number; yUnit: string; box?: Box;
}) {
  const cols = binColumns(values, box, ld);
  const zeroY = zeroLineY(box, ld);
  const xGrid = gridLinesX(distance, X_STEP, box); // 500 m: lines + labels
  // 250 m: fainter half-step lines, no labels (skip those already drawn as a 500 m major line).
  const xMinor = gridLinesX(distance, X_STEP / 2, box).filter((g) => g.value % X_STEP !== 0);
  const yGrid = gridLinesY(ld, yStep, box);
  const bands = distancePhaseBands(box);
  const graphCls = box.h < BOX.h ? 'cmp-trace-graph cmp-trace-graph--short' : 'cmp-trace-graph';
  return (
    <figure className="cmp-trace-chart">
      <figcaption>{title}</figcaption>
      <div className="cmp-trace-plot">
        <div className={graphCls}>
          <svg viewBox={`0 0 ${box.w} ${box.h}`} role="img" aria-label={title} preserveAspectRatio="none">
            <PhaseBands bands={bands} box={box} />
            {yGrid.map((g) => <line key={`y${g.value}`} className="cmp-trace-grid" x1={0} y1={g.y} x2={box.w} y2={g.y} />)}
            {xMinor.map((g) => <line key={`xm${g.value}`} className="cmp-trace-grid is-minor" x1={g.x} y1={0} x2={g.x} y2={box.h} />)}
            {xGrid.map((g) => <line key={`x${g.value}`} className="cmp-trace-grid" x1={g.x} y1={0} x2={g.x} y2={box.h} />)}
            {cols.map((c, i) => <rect key={i} className={`cmp-trace-col ${c.neg ? 'is-neg' : ''}`.trim()} x={c.x} y={c.y} width={c.w} height={c.h} />)}
            <line className="cmp-trace-baseline" x1={0} y1={zeroY} x2={box.w} y2={zeroY} />
          </svg>
          <PhaseLabels bands={bands} />
          {yGrid.map((g) => (
            <span key={`yl${g.value}`} className="cmp-ylabel" style={{ top: `${Math.max(4, Math.min(box.h - 4, g.y))}px` }}>
              {`${num(g.value)}${yUnit}`}
            </span>
          ))}
          {xGrid.map((g) => (
            <span key={`xl${g.value}`} className="cmp-xlabel"
              style={{ left: `${(g.x / box.w) * 100}%`, transform: g.value === 0 ? 'none' : 'translateX(-50%)' }}>
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
    <PositionBarChart title="Activation frequency by position" values={values} ld={{ top: 100, bottom: 0 }} distance={impact.distance} yStep={50} yUnit="%" box={FREQ_BOX} />
  );
}

const CHOICES: { label: string; value: RunChoice }[] = [
  { label: 'Worst', value: 'min' },
  { label: 'Typical', value: 'median' },
  { label: 'Best', value: 'max' },
];

export function RunChoiceToggle({ value, onChange }: { value: RunChoice; onChange: (c: RunChoice) => void }) {
  return (
    <div className="cmp-control-group cmp-trace-choice" role="group" aria-label="Representative run">
      {CHOICES.map((c) => (
        <button
          key={c.value}
          type="button"
          aria-pressed={value === c.value}
          onClick={() => onChange(c.value)}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}
