// src/app/ActivePlanContext.dualplan.test.tsx
import { act, render, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { ActivePlanProvider, useActivePlan } from './ActivePlanContext';

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
  await act(async () => { value.setUma2Plan(draft); });
  await waitFor(() => expect(value.uma2Plan?.id).toBe('uma2-test'));
  await act(async () => { value.setFocused('uma2'); });
  await waitFor(() => expect(value.focusedPlan?.id).toBe('uma2-test'));
});
