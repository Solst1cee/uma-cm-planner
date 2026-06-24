// src/app/ActivePlanContext.dualplan.test.tsx
import { act, render, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { ActivePlanProvider, useActivePlan } from './ActivePlanContext';
import { getPlan, listPlans, setSetting } from '@/db';

vi.mock('@/features/data/gameData', async () => {
  const { fixtureGameData } = await import('@/features/testing/fixtureGameData');
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

function harness(onValue: (v: ReturnType<typeof useActivePlan>) => void) {
  function Probe() { onValue(useActivePlan()); return null; }
  return <ActivePlanProvider><Probe /></ActivePlanProvider>;
}

test('uma2 slot starts empty and does not auto-load', async () => {
  let value!: ReturnType<typeof useActivePlan>;
  render(harness((v) => { value = v; }));
  await waitFor(() => expect(value.uma1Plan).toBeTruthy());
  expect(value.uma2Plan).toBeNull();
  expect(value.focused).toBe('uma1');
  expect(value.focusedPlan).toBe(value.uma1Plan);
});

test('setUma2Plan fills the slot and setFocused routes focusedPlan', async () => {
  let value!: ReturnType<typeof useActivePlan>;
  render(harness((v) => { value = v; }));
  await waitFor(() => expect(value.uma1Plan).toBeTruthy());
  const draft = { ...value.uma1Plan!, id: 'uma2-test', name: 'U2' };
  // Reset setSetting call history so we only observe calls caused by setUma2Plan
  vi.mocked(setSetting).mockClear();
  await act(async () => { value.setUma2Plan(draft); });
  await waitFor(() => expect(value.uma2Plan?.id).toBe('uma2-test'));
  await act(async () => { value.setFocused('uma2'); });
  await waitFor(() => expect(value.focusedPlan?.id).toBe('uma2-test'));
  // Contract: uma2 must NEVER write activePlanId to settings
  expect(setSetting).not.toHaveBeenCalledWith('activePlanId', expect.anything());
});

test('loadPlanIntoSlot duplicates when the same plan is loaded in the other slot', async () => {
  let value!: ReturnType<typeof useActivePlan>;
  render(harness((v) => { value = v; }));
  await waitFor(() => expect(value.uma1Plan).toBeTruthy());

  const uma1 = value.uma1Plan!;
  // Put uma1's plan into uma2 by id → collision → uma2 gets a fresh-id duplicate.
  vi.mocked(getPlan).mockResolvedValue(uma1);
  vi.mocked(listPlans).mockResolvedValue([uma1]);
  await act(async () => { await value.loadPlanIntoSlot(uma1.id, 'uma2'); });

  await waitFor(() => expect(value.uma2Plan).toBeTruthy());
  expect(value.uma2Plan!.id).not.toBe(uma1.id); // duplicated, not shared
});

test('loadPlanIntoSlot into uma2 with no collision loads the plan as-is', async () => {
  let value!: ReturnType<typeof useActivePlan>;
  render(harness((v) => { value = v; }));
  await waitFor(() => expect(value.uma1Plan).toBeTruthy());

  const other = { ...value.uma1Plan!, id: 'other-id', name: 'Other' };
  vi.mocked(getPlan).mockResolvedValue(other);
  vi.mocked(listPlans).mockResolvedValue([value.uma1Plan!, other]);
  await act(async () => { await value.loadPlanIntoSlot('other-id', 'uma2'); });

  await waitFor(() => expect(value.uma2Plan?.id).toBe('other-id'));
});

test('deleting the loaded plan keeps it in the sidebar and flips the saved indicator', async () => {
  let value!: ReturnType<typeof useActivePlan>;
  render(harness((v) => { value = v; }));
  await waitFor(() => expect(value.uma1Plan).toBeTruthy());
  const loaded = value.uma1Plan!;

  // After delete: saved set is empty → isSaved must flip to false.
  vi.mocked(listPlans).mockResolvedValue([]);

  await act(async () => { await value.deleteSavedPlan(loaded.id); });

  await waitFor(() => expect(value.isSaved).toBe(false)); // indicator updated
  expect(value.uma1Plan!.id).toBe(loaded.id);             // still loaded, not swapped
});

test('loadPlanIntoSlot into uma1 with collision (id already in uma2) creates fresh-id draft', async () => {
  let value!: ReturnType<typeof useActivePlan>;
  render(harness((v) => { value = v; }));
  await waitFor(() => expect(value.uma1Plan).toBeTruthy());

  const originalUma1Id = value.uma1Plan!.id;

  // Put a plan with 'shared-id' into uma2
  await act(async () => {
    value.setUma2Plan({ ...value.uma1Plan!, id: 'shared-id', name: 'In Uma2' });
  });
  await waitFor(() => expect(value.uma2Plan?.id).toBe('shared-id'));

  // Seed getPlan so loadPlanIntoSlot can fetch it
  vi.mocked(getPlan).mockResolvedValue({ ...value.uma1Plan!, id: 'shared-id', name: 'In Uma2' });

  // Load the same plan into uma1 → collision → should create a fresh-id draft
  await act(async () => { await value.loadPlanIntoSlot('shared-id', 'uma1'); });

  // The resulting uma1Plan id must be neither 'shared-id' nor the original uma1 id
  expect(value.uma1Plan!.id).not.toBe('shared-id');
  expect(value.uma1Plan!.id).not.toBe(originalUma1Id);
  // uma2 still holds the original 'shared-id' (slots don't share an id)
  expect(value.uma2Plan?.id).toBe('shared-id');
});
