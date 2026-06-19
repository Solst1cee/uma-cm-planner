import './skill-trace/skill-trace.css';
import type { RunChoice } from '@/sim';
import { useSkillTrace, type TraceContext, IMPACT_SAMPLES } from './useSkillTrace';
import { VelocityTimeChart, LengthImpactChart, ActivationFrequencyChart, RunChoiceToggle } from './skill-trace/SkillTraceCharts';

const RUN_LABEL: Record<RunChoice, string> = { min: 'worst', median: 'typical', mean: 'mean', max: 'best' };

export function SkillTraceSection({ skillId, ctx, enabled }: { skillId: string; ctx: TraceContext; enabled: boolean }) {
  const s = useSkillTrace(skillId, ctx, enabled);

  if (s.status === 'na') {
    return <p className="muted small cmp-trace-note">No simulated trace for this skill on this build/course.</p>;
  }
  if (s.status === 'running' || s.run === null) {
    return <p className="muted small">Simulating trace…</p>;
  }
  return (
    <div className="cmp-trace">
      {/* Auto: the single representative run's speed curve (full width). */}
      <VelocityTimeChart run={s.run} />
      <div className="cmp-trace-controls">
        <RunChoiceToggle value={s.runChoice} onChange={s.setRunChoice} />
      </div>
      <p className="cmp-trace-note">
        Velocity is a single {RUN_LABEL[s.runChoice]} run of {ctx.buildLabel ?? 'this build'} — an estimate (P3), not a guarantee.
      </p>

      {/* Button-gated: position-resolved impact + frequency, from {IMPACT_SAMPLES} samples. */}
      {s.impactStatus !== 'done' || s.impact === null ? (
        <button
          type="button"
          className="cmp-trace-rate-btn"
          disabled={s.impactStatus === 'running'}
          onClick={s.computeImpact}
        >
          {s.impactStatus === 'running' ? `Simulating ${IMPACT_SAMPLES} runs…` : 'Compute activation impact'}
        </button>
      ) : (
        <>
          <div className="cmp-trace-charts">
            <LengthImpactChart impact={s.impact} />
            <ActivationFrequencyChart impact={s.impact} />
          </div>
          {s.rate !== null && (
            <div className="cmp-trace-rate is-done">
              <span className="cmp-trace-rate-label">Activates in</span>
              <span className="cmp-trace-rate-bar"><span style={{ width: `${Math.round(s.rate * 100)}%` }} /></span>
              <strong>{Math.round(s.rate * 100)}%</strong>
              <small className="cmp-trace-note">of {s.impact.nsamples} runs · max バ身 = best gain per zone</small>
            </div>
          )}
        </>
      )}
    </div>
  );
}
