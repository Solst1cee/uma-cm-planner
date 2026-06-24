/** Stamina checker tab — derives whether the focused build finishes the current race
 *  without running out of HP, from the engine's HP trace via useSkillTrace.
 *
 *  The `without` run from runSkillTrace is the build simulated WITHOUT the anchor skill.
 *  Since planToSimBuild produces a vacuum build (skills: []), the anchor skill is always
 *  absent, making `without` == the true build's HP trace. Any valid skill id can be the
 *  anchor; we use the plan's uniqueSkillId if set, or a stable fallback.
 */
import { useMemo } from 'react';
import { planToSimBuild } from '@/core/simBuild';
import type { CmPlan } from '@/core/types';
import type { TraceContext } from './useSkillTrace';
import { useSkillTrace, type UseSkillTraceDeps } from './useSkillTrace';
import { staminaVerdict } from './staminaCheck';

/** Fallback anchor skill id (Warning Shot! — a common speed skill in every game version).
 *  Must be a valid engine skill id. The vacuum build (skills:[]) guarantees it's absent. */
const FALLBACK_ANCHOR = '10071';

function anchorSkillId(plan: CmPlan): string {
  // Prefer the plan's own unique skill (guaranteed absent from the vacuum build).
  if (plan.uniqueSkillId) return plan.uniqueSkillId;
  // Fall back to a stable well-known id.
  return FALLBACK_ANCHOR;
}

interface StaminaCheckerTabProps {
  plan: CmPlan;
  /** Injected deps for testing (mirrors useSkillTrace pattern). */
  deps?: UseSkillTraceDeps;
}

export function StaminaCheckerTab({ plan, deps }: StaminaCheckerTabProps) {
  const spd = plan.statProfile.stats.spd;

  const ctx = useMemo<TraceContext>(
    () => ({
      build: planToSimBuild(plan),
      race: { courseId: plan.cmRef.courseId },
      buildLabel: 'your build',
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      plan.cmRef.courseId,
      plan.umaId,
      plan.strategy,
      plan.statProfile.stats.spd,
      plan.statProfile.stats.sta,
      plan.statProfile.stats.pow,
      plan.statProfile.stats.gut,
      plan.statProfile.stats.wit,
      plan.statProfile.mood,
    ],
  );

  const anchor = anchorSkillId(plan);
  // enabled only when the build has a non-zero speed (engine throws on all-zero builds)
  const enabled = spd > 0;

  const { status, run } = useSkillTrace(anchor, ctx, enabled, deps);

  if (spd === 0) {
    return (
      <div className="cmp-stamina-tab">
        <p className="muted small">Set a speed stat to simulate stamina.</p>
      </div>
    );
  }

  if (status === 'idle') {
    return (
      <div className="cmp-stamina-tab">
        <p className="muted small">Waiting to simulate…</p>
      </div>
    );
  }

  if (status === 'running') {
    return (
      <div className="cmp-stamina-tab">
        <p className="muted small">Simulating…</p>
      </div>
    );
  }

  if (status === 'na' || run === null) {
    return (
      <div className="cmp-stamina-tab">
        <p className="muted small">No stamina trace available for this build.</p>
      </div>
    );
  }

  const verdict = staminaVerdict(run.without, plan.cmRef.distance);

  return (
    <div className="cmp-stamina-tab">
      <div className="cmp-stamina-verdict">
        <span
          className={`cmp-stamina-badge ${verdict.finishes ? 'cmp-stamina-badge--ok' : 'cmp-stamina-badge--fail'}`}
          aria-label={verdict.finishes ? 'Finishes' : 'Runs out'}
        >
          {verdict.finishes ? 'Finishes' : 'Runs out'}
        </span>
      </div>
      <dl className="cmp-stamina-details">
        <dt>Min HP</dt>
        <dd>{verdict.minHp.toFixed(0)}</dd>
        <dt>at</dt>
        <dd>{verdict.minHpPos.toFixed(0)} m</dd>
      </dl>
    </div>
  );
}
