import { describe, it, expect } from 'vitest';
import { resolveUma2 } from './resolveUma2';
import { planToOverlayBuild } from '@/core/simBuild';
import { makeDefaultPlan } from '@/app/ActivePlanContext';

describe('resolveUma2', () => {
  const active = { ...makeDefaultPlan(), id: 'A' };
  const other = { ...makeDefaultPlan(), id: 'B', uniqueSkillId: 'U2' };

  it('savedPlan → that plan as an overlay build', () => {
    expect(resolveUma2({ kind: 'savedPlan', planId: 'B' }, active, [active, other]))
      .toEqual(planToOverlayBuild(other));
  });
  it('savedPlan with unknown id → null', () => {
    expect(resolveUma2({ kind: 'savedPlan', planId: 'X' }, active, [active])).toBeNull();
  });
  it('unimplemented sources → null (follow-up)', () => {
    expect(resolveUma2({ kind: 'minusWishlist' }, active, [])).toBeNull();
    expect(resolveUma2({ kind: 'reference' }, active, [])).toBeNull();
  });
});
