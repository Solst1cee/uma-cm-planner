/**
 * Active-plan persistence: the debounced save must be flushable (export/import
 * snapshot Dexie directly — review 2026-06-12: stale export within the 400ms
 * window) and must flush on pagehide (tab close / mobile background-kill).
 * Also covers the shared first-run Kitasan baseline.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, waitFor } from '@testing-library/react';
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

describe('ActivePlanProvider first run', () => {
  it('persists the Kitasan baseline when the device has no saved plans', async () => {
    render(
      <ActivePlanProvider>
        <Grab />
      </ActivePlanProvider>,
    );

    await waitFor(() => expect(savePlan).toHaveBeenCalledTimes(1));
    expect(vi.mocked(savePlan).mock.calls[0]?.[0]).toMatchObject({
      name: 'CM15 / Kitasan Black / Ace / Front',
      umaId: '106801',
      strategy: 'front',
      cmRef: { cmId: 'CM15', courseId: '10906' },
    });
  });

  it('migrates the untouched legacy starter already stored on a device', async () => {
    const legacy = {
      ...makeDefaultPlan(),
      id: 'legacy-starter',
      name: '',
      umaId: '',
      uniqueSkillId: '',
      strategy: 'pace' as const,
      statProfile: { stats: { spd: 1000, sta: 600, pow: 600, gut: 400, wit: 400 }, mood: 2 as const },
      sparkGoals: { pink: [], blue: {} },
    };
    vi.mocked(listPlans).mockResolvedValueOnce([legacy]).mockResolvedValueOnce([]);

    render(
      <ActivePlanProvider>
        <Grab />
      </ActivePlanProvider>,
    );

    await waitFor(() => expect(ctx.plan?.umaId).toBe('106801'));
    expect(deletePlan).toHaveBeenCalledWith('legacy-starter');
    expect(savePlan).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'CM15 / Kitasan Black / Ace / Front',
        umaId: '106801',
        strategy: 'front',
      }),
    );
  });
});

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

  it('refreshes the inventory without swapping the loaded plan when deleting the active plan', async () => {
    await renderProvider();
    const activeId = ctx.plan!.id;
    const fallback = { ...ctx.plan!, id: 'fallback-plan', name: 'Fallback Plan' };
    vi.mocked(listPlans).mockResolvedValueOnce([fallback]);

    await act(async () => {
      await ctx.deleteSavedPlan(activeId);
    });

    expect(deletePlan).toHaveBeenCalledWith(activeId);
    // New contract: loaded plan is NOT swapped; activePlanId is NOT updated.
    expect(setSetting).not.toHaveBeenCalledWith('activePlanId', expect.anything());
    expect(ctx.plan?.id).toBe(activeId);
    // Inventory is refreshed to the post-delete list.
    expect(ctx.savedPlans.map((p) => p.id)).toEqual(['fallback-plan']);
  });

  it('refreshes the inventory to empty without swapping the loaded plan when deleting the final saved plan', async () => {
    await renderProvider();
    const activeId = ctx.plan!.id;
    vi.mocked(listPlans).mockResolvedValueOnce([]);

    await act(async () => {
      await ctx.deleteSavedPlan(activeId);
    });

    expect(deletePlan).toHaveBeenCalledWith(activeId);
    expect(ctx.savedPlans).toEqual([]);
    // New contract: the loaded plan id and name are unchanged (no swap, no new default).
    expect(savePlan).not.toHaveBeenCalled();
    expect(ctx.plan?.id).toBe(activeId);
  });

  it('imports an id collision as a named copy instead of overwriting', async () => {
    await renderProvider();
    const existing = ctx.plan!;
    vi.mocked(listPlans).mockResolvedValueOnce([existing]).mockResolvedValueOnce([existing]);

    await act(async () => {
      await ctx.importSavedPlans([{ ...existing }]);
    });

    const imported = vi.mocked(savePlan).mock.calls.at(-1)?.[0];
    expect(imported?.id).not.toBe(existing.id);
    expect(imported?.name).toBe(`${existing.name} (1)`);
  });

  it('deletes every saved plan and leaves a fresh unsaved draft', async () => {
    await renderProvider();
    const first = ctx.plan!;
    const second = { ...first, id: 'second-plan', name: 'Second Plan' };
    vi.mocked(listPlans).mockResolvedValueOnce([first, second]);

    await act(async () => {
      await ctx.deleteAllSavedPlans();
    });

    expect(deletePlan).toHaveBeenCalledWith(first.id);
    expect(deletePlan).toHaveBeenCalledWith(second.id);
    expect(ctx.savedPlans).toEqual([]);
    expect(ctx.plan?.id).not.toBe(first.id);
    expect(savePlan).not.toHaveBeenCalled();
  });
});

describe('makeDefaultPlan', () => {
  it('uses the same CM15 Kitasan baseline as the New action', () => {
    const plan = makeDefaultPlan();
    expect(plan).toMatchObject({
      name: 'CM15 / Kitasan Black / Ace / Front',
      umaId: '106801',
      uniqueSkillId: '',
      role: 'ace',
      strategy: 'front',
      cmRef: {
        kind: 'cm',
        cmId: 'CM15',
        cmNumber: 15,
        courseId: '10906',
        surface: 'turf',
        distance: 2200,
      },
      statProfile: { stats: { spd: 1200, sta: 900, pow: 1000, gut: 600, wit: 1100 }, mood: 2 },
      sparkGoals: {
        blue: {},
        pink: [
          { aptKey: { kind: 'surface', key: 'turf' }, target: 'A' },
          { aptKey: { kind: 'distance', key: 'medium' }, target: 'S' },
          { aptKey: { kind: 'strategy', key: 'front' }, target: 'A' },
        ],
      },
    });
    expect(plan.wishlist).toEqual([]);
  });

  it('defaults uniqueSkillLevel to 5', () => {
    expect(makeDefaultPlan().uniqueSkillLevel).toBe(5);
  });
});
