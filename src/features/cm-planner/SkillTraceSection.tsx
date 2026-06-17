import './skill-trace/skill-trace.css';
import { useSkillTrace, type TraceContext } from './useSkillTrace';
import { VelocityTimeChart, LengthDistanceChart, ActivationRateBadge, RunChoiceToggle } from './skill-trace/SkillTraceCharts';

const RUN_LABEL: Record<string, string> = { min: 'worst', median: 'typical', mean: 'mean', max: 'best' };

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
      <div className="cmp-trace-charts">
        <VelocityTimeChart run={s.run} />
        <LengthDistanceChart run={s.run} />
      </div>
      <div className="cmp-trace-controls">
        <RunChoiceToggle value={s.runChoice} onChange={s.setRunChoice} />
        <ActivationRateBadge status={s.rateStatus} rate={s.rate} onCompute={s.computeRate} />
      </div>
      <p className="cmp-trace-note">
        Single {RUN_LABEL[s.runChoice]} run of {ctx.build.umaId ? 'your build' : 'the reference'} — an estimate (P3), not a guarantee.
      </p>
    </div>
  );
}
