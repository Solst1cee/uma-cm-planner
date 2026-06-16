/**
 * Active-plan persistence: the debounced save must be flushable (export/import
 * snapshot Dexie directly — review 2026-06-12: stale export within the 400ms
 * window) and must flush on pagehide (tab close / mobile background-kill).
 * Also covers makeDefaultPlan's P4 preference for Global presets.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import type { CmPreset } from '@/core/types';
import {
  ActivePlanProvider,
  makeDefaultPlan,
  useActivePlan,
} from '@/app/ActivePlanContext';
import { savePlan } from '@/db';

vi.mock('@/features/data/gameData', async () => {
  const { fixtureGameData } = await import('@/features/testing/fixtureGameData');
  // Stable identity, like the real (memoized) GameDataProvider — the
  // provider's load effect is keyed on cmPresets.
  const data = fixtureGameData();
  return { useGameData: () => data };
});

vi.mock('@/db', () => ({
  getPlan: vi.fn(async () => undefined),
  getSetting: vi.fn(async () => undefined),
  listPlans: vi.fn(async () => []),
  savePlan: vi.fn(async () => undefined),
  setSetting: vi.fn(async () => undefined),
}));

afterEach(cleanup);

let ctx: ReturnType<typeof useActivePlan>;
function Grab() {
  ctx = useActivePlan();
  return null;
}

async function renderProvider() {
  render(
    <ActivePlanProvider>
      <Grab />
    </ActivePlanProvider>,
  );
  await waitFor(() => expect(ctx.plan).not.toBeNull());
  vi.mocked(savePlan).mockClear(); // drop the default-plan creation save
}

describe('ActivePlanProvider flushPendingSave', () => {
  it('persists an edit still inside the debounce window, exactly once', async () => {
    await renderProvider();

    act(() => ctx.setPlan({ ...ctx.plan!, name: 'EDIT-MID-DEBOUNCE' }));
    expect(savePlan).not.toHaveBeenCalled(); // debounced, not yet written

    await ctx.flushPendingSave();
    expect(savePlan).toHaveBeenCalledTimes(1);
    expect(vi.mocked(savePlan).mock.calls[0]?.[0]?.name).toBe('EDIT-MID-DEBOUNCE');

    // Flush cleared the timer — the debounce must not fire a second write.
    await new Promise((resolve) => setTimeout(resolve, 450));
    expect(savePlan).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when nothing is pending', async () => {
    await renderProvider();
    await ctx.flushPendingSave();
    expect(savePlan).not.toHaveBeenCalled();
  });

  it('flushes the pending edit on pagehide (tab close)', async () => {
    await renderProvider();

    act(() => ctx.setPlan({ ...ctx.plan!, name: 'EDIT-BEFORE-CLOSE' }));
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });

    expect(savePlan).toHaveBeenCalledTimes(1);
    expect(vi.mocked(savePlan).mock.calls[0]?.[0]?.name).toBe('EDIT-BEFORE-CLOSE');
  });
});

describe('makeDefaultPlan preset preference (P4)', () => {
  const preset = (over: Partial<CmPreset>): CmPreset => ({
    name: 'X',
    date: '2026-01-22',
    server: 'global',
    dataVersion: 'fixture',
    courseId: '10506',
    surface: 'turf',
    distance: 2500,
    ...over,
  });

  it('prefers the latest Global preset over later JP history', () => {
    const plan = makeDefaultPlan([
      preset({ name: 'JP Newest', date: '2026-05-22', server: 'jp' }),
      preset({ name: 'Global Latest', date: '2026-04-22', courseId: '10811' }),
      preset({ name: 'Global Older', date: '2025-12-22' }),
    ]);
    expect(plan.name).toBe('Global Latest');
    expect(plan.cmRef.courseId).toBe('10811');
  });

  it('falls back to the latest preset overall when none are Global', () => {
    const plan = makeDefaultPlan([
      preset({ name: 'JP Old', date: '2025-01-01', server: 'jp' }),
      preset({ name: 'JP New', date: '2026-02-02', server: 'jp' }),
    ]);
    expect(plan.name).toBe('JP New');
  });

  it('still produces a usable plan with no presets at all', () => {
    const plan = makeDefaultPlan([]);
    expect(plan.name).toBe('New CM Plan');
    expect(plan.statProfile.mood).toBe(2);
    expect(plan.wishlist).toEqual([]);
  });
});
