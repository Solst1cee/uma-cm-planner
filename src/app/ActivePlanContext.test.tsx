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
import { deletePlan, getPlan, listPlans, savePlan, setSetting } from '@/db';

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
  deletePlan: vi.fn(async () => undefined),
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
  vi.mocked(setSetting).mockClear();
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

  it('persists the current plan when nothing is pending', async () => {
    await renderProvider();
    await ctx.flushPendingSave();
    expect(savePlan).toHaveBeenCalledTimes(1);
    expect(vi.mocked(savePlan).mock.calls[0]?.[0]?.id).toBe(ctx.plan?.id);
  });

  it('does not flush the pending edit on pagehide when auto-save is off', async () => {
    await renderProvider();

    act(() => ctx.setPlan({ ...ctx.plan!, name: 'EDIT-BEFORE-CLOSE' }));
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });

    expect(savePlan).not.toHaveBeenCalled();
  });

  it('flushes the pending edit on pagehide when auto-save is on', async () => {
    await renderProvider();

    act(() => ctx.setAutoSave(true));
    act(() => ctx.setPlan({ ...ctx.plan!, name: 'EDIT-BEFORE-CLOSE' }));
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });

    expect(savePlan).toHaveBeenCalledTimes(1);
    expect(vi.mocked(savePlan).mock.calls[0]?.[0]?.name).toBe('EDIT-BEFORE-CLOSE');
  });

  it('does not silently save an unsaved edit before selecting a saved plan when auto-save is off', async () => {
    await renderProvider();
    const savedPlan = { ...ctx.plan!, id: 'saved-plan', name: 'Saved Plan' };
    vi.mocked(getPlan).mockResolvedValueOnce(savedPlan);

    act(() => ctx.setPlan({ ...ctx.plan!, name: 'EDIT-BEFORE-SWITCH' }));
    await act(async () => {
      await ctx.selectPlan('saved-plan');
    });

    expect(savePlan).not.toHaveBeenCalled();
    expect(setSetting).toHaveBeenCalledWith('activePlanId', 'saved-plan');
    expect(ctx.plan?.id).toBe('saved-plan');
  });

  it('flushes the current edit before selecting a saved plan when auto-save is on', async () => {
    await renderProvider();
    const savedPlan = { ...ctx.plan!, id: 'saved-plan', name: 'Saved Plan' };
    vi.mocked(getPlan).mockResolvedValueOnce(savedPlan);

    act(() => ctx.setAutoSave(true));
    act(() => ctx.setPlan({ ...ctx.plan!, name: 'EDIT-BEFORE-SWITCH' }));
    await act(async () => {
      await ctx.selectPlan('saved-plan');
    });

    expect(vi.mocked(savePlan).mock.calls[0]?.[0]?.name).toBe('EDIT-BEFORE-SWITCH');
    expect(setSetting).toHaveBeenCalledWith('activePlanId', 'saved-plan');
    expect(ctx.plan?.id).toBe('saved-plan');
  });

  it('saves a copy with the lowest missing plan number', async () => {
    await renderProvider();
    const edited = {
      ...ctx.plan!,
      id: 'draft',
      planNumber: 99,
      name: 'Plan 99 / copy',
      statProfile: {
        ...ctx.plan!.statProfile,
        stats: { ...ctx.plan!.statProfile.stats, spd: ctx.plan!.statProfile.stats.spd + 1 },
      },
    };
    vi.mocked(getPlan).mockResolvedValue(undefined);
    const existing = [
      { ...ctx.plan!, id: 'p1', planNumber: 1 },
      { ...ctx.plan!, id: 'p3', planNumber: 3 },
    ];
    vi.mocked(listPlans).mockResolvedValue(existing);

    act(() => ctx.setDraftPlan(edited));
    let saved!: typeof edited;
    await act(async () => {
      saved = await ctx.saveCurrentPlanAs();
    });

    expect(saved.planNumber).toBe(2);
    expect(saved.id).not.toBe('draft');
    expect(saved.name).toBe('Plan 99 / copy');
    expect(vi.mocked(savePlan).mock.calls.at(-1)?.[0]).toMatchObject({ planNumber: 2 });
  });

  it('adds a numeric suffix when Save would duplicate another plan name', async () => {
    await renderProvider();
    const edited = { ...ctx.plan!, name: 'My custom plan' };
    vi.mocked(listPlans).mockResolvedValue([
      { ...ctx.plan!, id: 'other-plan', name: 'My custom plan' },
      { ...ctx.plan!, id: ctx.plan!.id, name: 'Old name' },
    ]);

    await act(async () => {
      await ctx.saveCurrentPlan(edited);
    });

    expect(vi.mocked(savePlan).mock.calls.at(-1)?.[0]?.name).toBe('My custom plan (1)');
    expect(ctx.plan?.name).toBe('My custom plan (1)');
  });

  it('adds the next numeric suffix when Save as duplicates an existing name', async () => {
    await renderProvider();
    const draft = { ...ctx.plan!, id: 'draft', name: 'Random name' };
    vi.mocked(listPlans).mockResolvedValue([
      { ...ctx.plan!, id: 'p1', name: 'Random name', planNumber: 1 },
      { ...ctx.plan!, id: 'p2', name: 'Random name (1)', planNumber: 2 },
    ]);

    let saved!: typeof draft;
    await act(async () => {
      saved = await ctx.saveCurrentPlanAs(draft);
    });

    expect(saved.name).toBe('Random name (2)');
  });

  it('advances an existing custom suffix instead of nesting another suffix', async () => {
    await renderProvider();
    const draft = { ...ctx.plan!, id: 'draft', name: 'Plan 1 (1)' };
    vi.mocked(listPlans).mockResolvedValue([
      { ...ctx.plan!, id: 'p1', name: 'Plan 1', planNumber: 1 },
      { ...ctx.plan!, id: 'p2', name: 'Plan 1 (1)', planNumber: 2 },
    ]);

    let saved!: typeof draft;
    await act(async () => {
      saved = await ctx.saveCurrentPlanAs(draft);
    });

    expect(saved.name).toBe('Plan 1 (2)');
  });

  it('deletes a non-active saved plan and refreshes the inventory', async () => {
    await renderProvider();
    const active = ctx.plan!;
    const other = { ...active, id: 'other-plan', name: 'Other Plan' };
    vi.mocked(listPlans).mockResolvedValueOnce([active]);

    await act(async () => {
      await ctx.deleteSavedPlan(other.id);
    });

    expect(deletePlan).toHaveBeenCalledWith('other-plan');
    expect(ctx.plan?.id).toBe(active.id);
    expect(ctx.savedPlans.map((plan) => plan.id)).toEqual([active.id]);
  });

  it('switches to another saved plan when deleting the active plan', async () => {
    await renderProvider();
    const activeId = ctx.plan!.id;
    const fallback = { ...ctx.plan!, id: 'fallback-plan', name: 'Fallback Plan' };
    vi.mocked(listPlans).mockResolvedValueOnce([fallback]);

    await act(async () => {
      await ctx.deleteSavedPlan(activeId);
    });

    expect(deletePlan).toHaveBeenCalledWith(activeId);
    expect(setSetting).toHaveBeenCalledWith('activePlanId', 'fallback-plan');
    expect(ctx.plan?.id).toBe('fallback-plan');
  });

  it('leaves the inventory empty when deleting the final saved plan', async () => {
    await renderProvider();
    const activeId = ctx.plan!.id;
    vi.mocked(listPlans).mockResolvedValueOnce([]);

    await act(async () => {
      await ctx.deleteSavedPlan(activeId);
    });

    expect(deletePlan).toHaveBeenCalledWith(activeId);
    expect(ctx.savedPlans).toEqual([]);
    expect(savePlan).not.toHaveBeenCalled();
    expect(ctx.plan?.id).not.toBe(activeId);
    expect(ctx.plan?.name).toBe('');
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
    expect(plan.name).toBe('');
    expect(plan.cmRef.courseId).toBe('10811');
  });

  it('falls back to the latest preset overall when none are Global', () => {
    const plan = makeDefaultPlan([
      preset({ name: 'JP Old', date: '2025-01-01', server: 'jp' }),
      preset({ name: 'JP New', date: '2026-02-02', server: 'jp' }),
    ]);
    expect(plan.name).toBe('');
  });

  it('still produces a usable plan with no presets at all', () => {
    const plan = makeDefaultPlan([]);
    expect(plan.name).toBe('');
    expect(plan.statProfile.mood).toBe(2);
    expect(plan.wishlist).toEqual([]);
  });
});
