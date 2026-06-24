/** Stamina checker tab — derives whether the focused build finishes the current race
 *  without running out of HP, from the engine's HP trace via useSkillTrace.
 *
 *  useSkillTrace / runSkillTrace semantics:
 *    run.without = uma1's frames = the build-as-passed WITHOUT the anchor skill.
 *  We pass planToOverlayBuild(plan) (unique + wishlist skills) so recovery skills are
 *  included in the "without" trace (the full build's HP curve). The anchor MUST be absent
 *  from the overlay build's skill set — otherwise uma1 would already exclude it and
 *  `without` would silently drop a wishlist skill. We pick the first id from a candidate
 *  list that isn't in the overlay build's skills.
 */
import { useMemo } from 'react';
import { planToOverlayBuild } from '@/core/simBuild';
import type { CmPlan } from '@/core/types';
import type { TraceContext } from './useSkillTrace';
import { useSkillTrace, type UseSkillTraceDeps } from './useSkillTrace';
import { staminaVerdict } from './staminaCheck';

/** Stable anchor candidates (speed/positioning skills unlikely to appear in a recovery
 *  wishlist). All must be valid engine skill ids. We pick the first one absent from the
 *  overlay build's skill set to satisfy the anchor-absence invariant. */
const ANCHOR_CANDIDATES = [
  '10071', // Warning Shot! (speed)
  '10011', // Starting Dash (acceleration)
  '10021', // Corner Recovery (speed)
];

/** Return an anchor id that is guaranteed absent from the overlay build's skill set.
 *  The anchor-absence invariant: run.without == the full overlay build's HP trace. */
function anchorSkillId(plan: CmPlan): string {
  const overlaySkills = new Set(planToOverlayBuild(plan).skills);
  for (const id of ANCHOR_CANDIDATES) {
    if (!overlaySkills.has(id)) return id;
  }
  // Extremely unlikely: all candidates are in the wishlist. Fall back to uniqueSkillId
  // (the engine will add it to uma2 only, so without = overlay-minus-unique — still shows
  // recovery skills, just not the unique; acceptable last resort).
  if (plan.uniqueSkillId && !overlaySkills.has(plan.uniqueSkillId)) return plan.uniqueSkillId;
  // Last resort: use the first candidate anyway (anchor in the deck → without loses one
  // skill, but the trade-off is acceptable vs crashing).
  return ANCHOR_CANDIDATES[0]!;
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
      build: planToOverlayBuild(plan),
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
      plan.uniqueSkillId,
      JSON.stringify(plan.wishlist),
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
