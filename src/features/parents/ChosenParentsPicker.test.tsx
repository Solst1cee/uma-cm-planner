/**
 * ChosenParentsPicker: two plan slots backed by saved parents; writes
 * plan.chosenParents ids via setPlan. '@/db', useActivePlan and useGameData
 * are mocked.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import type { CmPlan, Parent } from '@/core/types';
import { FIXTURE_PLAN } from '@/core/fixtures';
import { listParents } from '@/db';
import { ChosenParentsPicker } from '@/features/parents/ChosenParentsPicker';

vi.mock('@/features/data/gameData', async () => {
  const { parentsTestGameData } = await import('@/features/parents/testGameData');
  return { useGameData: () => parentsTestGameData() };
});

const active = vi.hoisted(() => ({
  plan: null as CmPlan | null,
  setPlan: vi.fn(),
}));

vi.mock('@/app/ActivePlanContext', () => ({
  useActivePlan: () => ({
    plan: active.plan,
    setPlan: active.setPlan,
    flushPendingSave: async () => undefined,
    loadError: null,
  }),
}));

vi.mock('@/db', () => ({
  listParents: vi.fn(async (): Promise<Parent[]> => []),
}));

const P1: Parent = {
  id: 'p1',
  umaId: '100201', // Silence Suzuka
  blueSpark: { stat: 'spd', stars: 3 },
  pinkSpark: { aptitude: 'turf', stars: 2 },
  whiteSparks: [{ skillId: '200332', stars: 2 }],
  source: 'mine',
};

const P2: Parent = {
  id: 'p2',
  umaId: '100101', // Special Week
  blueSpark: { stat: 'pow', stars: 2 },
  pinkSpark: { aptitude: 'long', stars: 3 },
  whiteSparks: [{ skillId: '200012', stars: 1 }],
  source: 'friend_rental',
};

beforeEach(() => {
  active.plan = { ...FIXTURE_PLAN, parents: {} };
});

afterEach(cleanup);

async function renderLoaded(parents: Parent[] = [P1, P2]) {
  vi.mocked(listParents).mockResolvedValue(parents);
  render(<ChosenParentsPicker />);
  await waitFor(() => expect(screen.getByLabelText('Parent 1')).toBeEnabled());
}

describe('ChosenParentsPicker', () => {
  it('writes the picked parent id into slot 1 of plan.chosenParents', async () => {
    const user = userEvent.setup();
    await renderLoaded();
    await user.selectOptions(screen.getByLabelText('Parent 1'), 'p1');
    expect(active.setPlan).toHaveBeenCalledWith({
      ...active.plan,
      parents: { a: 'p1' },
    });
  });

  it('writes slot 2 independently and clears a slot back to empty', async () => {
    const user = userEvent.setup();
    active.plan = { ...FIXTURE_PLAN, parents: { a: 'p1' } };
    await renderLoaded();

    await user.selectOptions(screen.getByLabelText('Parent 2'), 'p2');
    expect(active.setPlan).toHaveBeenCalledWith(
      expect.objectContaining({ parents: { a: 'p1', b: 'p2' } }),
    );

    await user.selectOptions(screen.getByLabelText('Parent 1'), '');
    expect(active.setPlan).toHaveBeenCalledWith(
      expect.objectContaining({ parents: {} }),
    );
  });

  it('labels options with uma name, spark summary and rental marker', async () => {
    await renderLoaded();
    expect(
      screen.getAllByRole('option', {
        name: 'Silence Suzuka — Speed ★★★ · Turf ★★ · 1 white',
      }),
    ).toHaveLength(2); // one per slot
    expect(
      screen.getAllByRole('option', {
        name: 'Special Week (rental) — Power ★★ · Long ★★★ · 1 white',
      }),
    ).toHaveLength(2);
  });

  it('disables a parent already used in the other slot', async () => {
    active.plan = { ...FIXTURE_PLAN, parents: { a: 'p1' } };
    await renderLoaded();
    const slot2 = screen.getByLabelText('Parent 2');
    const opt = Array.from(slot2.querySelectorAll('option')).find((o) => o.value === 'p1');
    expect(opt).toBeDisabled();
  });

  it('keeps a stale id selectable as "(missing parent)" instead of mis-rendering', async () => {
    active.plan = { ...FIXTURE_PLAN, parents: { a: 'ghost' } };
    await renderLoaded([P1]);
    expect(screen.getByLabelText('Parent 1')).toHaveDisplayValue('(missing parent)');
  });

  it('points at the Parents page when nothing is saved yet', async () => {
    await renderLoaded([]);
    expect(screen.getByText(/No saved parents yet/)).toBeInTheDocument();
  });
});
