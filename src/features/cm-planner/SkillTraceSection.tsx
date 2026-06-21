import './skill-trace/skill-trace.css';
import { useEffect, useRef, useState } from 'react';
import { useSkillTrace, type TraceContext, IMPACT_SAMPLES } from './useSkillTrace';
import { VelocityTimeChart, LengthImpactChart, ActivationFrequencyChart } from './skill-trace/SkillTraceCharts';
import { peakImpactPosition, activationCounts } from './skill-trace/geometry';

export function SkillTraceSection({ skillId, ctx, enabled }: { skillId: string; ctx: TraceContext; enabled: boolean }) {
  const s = useSkillTrace(skillId, ctx, enabled);
  const [helpOpen, setHelpOpen] = useState(false);
  const helpRef = useRef<HTMLDivElement>(null);

  // Close the help popup on any click outside it (the button + popup live inside helpRef).
  useEffect(() => {
    if (!helpOpen) return;
    const onDown = (e: MouseEvent) => {
      if (helpRef.current && !helpRef.current.contains(e.target as Node)) setHelpOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [helpOpen]);

  if (s.status === 'na') {
    return <p className="muted small cmp-trace-note">No simulated trace for this skill on this build/course.</p>;
  }
  if (s.status === 'running' || s.run === null) {
    return <p className="muted small">Simulating trace…</p>;
  }
  const peak = s.impact && s.impact.nsamples > 0 ? peakImpactPosition(s.impact.samples) : null;
  const counts = s.impact && s.impact.nsamples > 0 ? activationCounts(s.impact.samples, s.impact.nsamples) : [];
  const build = ctx.buildLabel ?? 'this build';
  return (
    <section className="cmp-alt cmp-trace">
      <div className="cmp-trace-head">
        <h4>Simulated performance</h4>
        <div className="cmp-trace-help" ref={helpRef}>
          <button
            type="button"
            className="cmp-trace-help-btn"
            aria-label="How these graphs work"
            aria-expanded={helpOpen}
            onClick={() => setHelpOpen((o) => !o)}
          >
            ?
          </button>
          {helpOpen && (
            <div className="cmp-trace-help-pop" role="dialog" aria-label="How these graphs work">
              <p className="cmp-help-title">How these graphs work</p>
              <p>
                Every figure is a Monte-Carlo race simulation of {build} run <b>with vs without</b> this one
                skill on the same RNG, so the skill is the only difference. All are estimates, not guarantees.
              </p>
              <ul>
                <li><b>Velocity vs time</b> — one race, zoomed to the activation: speed with the skill (solid) vs without (dashed). <b>Worst / Typical / Best</b> pick the run where the skill gained the least / median / most バ身.</li>
                <li><b>L gained by activation position</b> — over {IMPACT_SAMPLES} runs, the most バ身 the skill bought when it fired at each track position. Taller = firing there pays off more.</li>
                <li><b>Activation frequency by position</b> — over the same runs, how often (%) the skill fired at each position.</li>
              </ul>
              <p>
                <b>Average gain</b> = mean バ身 across all runs (including ones where it never fired).
                <b> Biggest gain</b> = the single best run. <b>×1 / ×2</b> = share of runs where the skill
                fired that many times (its cooldown can let it re-proc on a later corner).
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Summary — the numbers. Everything below is graphs only. */}
      <div className="cmp-trace-summary">
        {s.meanL != null && (
          <p className="cmp-trace-headline"><strong>{s.meanL >= 0 ? '+' : ''}{s.meanL.toFixed(2)} L</strong> average gain</p>
        )}
        {peak && (
          <p className="cmp-trace-headline"><strong>+{peak.L.toFixed(2)} L</strong> biggest gain — fires at {peak.pos}m</p>
        )}
        {counts.map(({ count, pct }) => (
          <p key={count} className="cmp-trace-headline"><strong>{Math.round(pct)}%</strong> of runs fire <strong>×{count}</strong></p>
        ))}
      </div>

      {/* Auto: the single representative run's speed curve; run picker sits in the chart title. */}
      <VelocityTimeChart run={s.run} runChoice={s.runChoice} onRunChoice={s.setRunChoice} />
      {s.run.activation.length === 0 ? (
        <p className="cmp-trace-note">Skill didn’t fire in this run — try <b>Best</b>, or it rarely procs on this build/course.</p>
      ) : null}

      {/* Auto (paints after velocity): position-resolved impact + frequency, each on its own line. */}
      {s.impactStatus === 'done' && s.impact !== null ? (
        <div className="cmp-trace-charts">
          <LengthImpactChart impact={s.impact} />
          <ActivationFrequencyChart impact={s.impact} />
        </div>
      ) : s.impactStatus === 'running' ? (
        <p className="muted small">Simulating activation impact ({IMPACT_SAMPLES} runs)…</p>
      ) : null}
    </section>
  );
}
