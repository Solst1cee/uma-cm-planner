import { describe, expect, it } from 'vitest';
import type { CmPlan } from '@/core/types';
import { FIXTURE_PLAN } from '@/core/fixtures';
import {
  isPlanContentSaved,
  isSamePlanContent,
  isSamePlanVersionGroup,
  nextPlanNumberForContent,
} from '@/core/planIdentity';

function plan(overrides: Partial<CmPlan> = {}): CmPlan {
  return {
    ...FIXTURE_PLAN,
    id: overrides.id ?? crypto.randomUUID(),
    name: overrides.name ?? FIXTURE_PLAN.name,
    planNumber: overrides.planNumber ?? FIXTURE_PLAN.planNumber,
    cmRef: overrides.cmRef ?? FIXTURE_PLAN.cmRef,
    umaId: overrides.umaId ?? FIXTURE_PLAN.umaId,
    statProfile: overrides.statProfile ?? FIXTURE_PLAN.statProfile,
    sparkGoals: overrides.sparkGoals ?? FIXTURE_PLAN.sparkGoals,
    wishlist: overrides.wishlist ?? FIXTURE_PLAN.wishlist,
    strategy: overrides.strategy ?? FIXTURE_PLAN.strategy,
  };
}

describe('plan content identity', () => {
  it('treats name, notes, id, and plan number as metadata', () => {
    expect(
      isSamePlanContent(
        plan({ id: 'a', name: 'Plan 1', notes: 'first', planNumber: 1 }),
        plan({ id: 'b', name: 'Plan 9', notes: 'other', planNumber: 9 }),
      ),
    ).toBe(true);
  });

  it('detects meaningful content changes', () => {
    expect(isSamePlanContent(plan(), plan({ umaId: '106801' }))).toBe(false);
    expect(isSamePlanContent(plan(), plan({ cmRef: { kind: 'custom', courseId: '10906', surface: 'turf', distance: 2400, ground: 'good', weather: 'sunny', season: 'spring' } }))).toBe(false);
    expect(
      isSamePlanContent(
        plan(),
        plan({ statProfile: { ...FIXTURE_PLAN.statProfile, stats: { ...FIXTURE_PLAN.statProfile.stats, spd: 1200 } } }),
      ),
    ).toBe(false);
    expect(isSamePlanContent(plan(), plan({ wishlist: [{ skillId: '200331', priority: 1, source: 'targeted' }] }))).toBe(false);
  });

  it('fills the lowest missing plan number for the same track, distance, and uma', () => {
    const base = plan({ planNumber: 99 });
    const saved = [
      plan({ id: 'p1', planNumber: 1 }),
      plan({
        id: 'p3',
        planNumber: 3,
        statProfile: { ...FIXTURE_PLAN.statProfile, stats: { ...FIXTURE_PLAN.statProfile.stats, spd: 1200 } },
      }),
      plan({
        id: 'p5',
        planNumber: 5,
        wishlist: [{ skillId: '200331', priority: 1, source: 'targeted' }],
      }),
      plan({ id: 'other', planNumber: 2, umaId: '106801' }),
    ];

    expect(nextPlanNumberForContent(base, saved)).toBe(2);
    expect(nextPlanNumberForContent(base, [...saved, plan({ id: 'p2', planNumber: 2 })])).toBe(4);
  });

  it('starts at plan 1 when no matching content is saved', () => {
    expect(isPlanContentSaved(plan({ umaId: '106801' }), [plan({ planNumber: 1 })])).toBe(false);
    expect(nextPlanNumberForContent(plan({ umaId: '106801' }), [plan({ planNumber: 1 })])).toBe(1);
  });

  it('keeps exact-content saved status separate from version grouping', () => {
    const activeDraft = plan({
      id: 'active-plan',
      planNumber: 1,
      statProfile: { ...FIXTURE_PLAN.statProfile, stats: { ...FIXTURE_PLAN.statProfile.stats, spd: 1200 } },
    });
    const savedBeforeEdit = plan({ id: 'active-plan', planNumber: 1 });

    expect(isPlanContentSaved(activeDraft, [savedBeforeEdit])).toBe(false);
    expect(isSamePlanVersionGroup(activeDraft, savedBeforeEdit)).toBe(true);
    expect(nextPlanNumberForContent(activeDraft, [savedBeforeEdit])).toBe(2);
  });

  it('starts a separate plan-number order for a different uma on the same track and distance', () => {
    const kitasan = plan({ umaId: '106801' });
    const specialWeek = plan({ umaId: '100101', planNumber: 1 });

    expect(isSamePlanVersionGroup(kitasan, specialWeek)).toBe(false);
    expect(nextPlanNumberForContent(kitasan, [specialWeek])).toBe(1);
  });
});
