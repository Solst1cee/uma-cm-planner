import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SpOptimizerPage } from '@/features/sp-optimizer/SpOptimizerPage';

const mockGameDataStatus = vi.hoisted(() => ({ status: 'ready' as 'ready' | 'fixture' | 'loading' }));

vi.mock('@/features/data/gameData', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/data/gameData')>();
  const { fixtureGameData } = await import('@/features/testing/fixtureGameData');
  return { ...actual, useGameData: () => ({ ...fixtureGameData(), status: mockGameDataStatus.status }) };
});

vi.mock('@/db', () => ({
  listCaptures: vi.fn(async () => []),
  saveCapture: vi.fn(async (d: { label: string; bundle: unknown }) => ({ id: 'id1', ...d })),
  deleteCapture: vi.fn(async () => undefined),
}));

// The page runs the ASYNC main-thread seam (rankBasketsWithEngine), which in
// production awaits the wasm engine init before ranking. jsdom has no wasm, so
// mock the seam to resolve immediately — no engine touched (keeps the jsdom
// test green without real wasm; see rankBaskets.init.test.ts for the real-seam
// init guard).
vi.mock('@/features/sp-optimizer/rankBaskets', () => ({
  rankBasketsWithEngine: vi.fn(() =>
    Promise.resolve({
      mode: 'exact',
      baskets: [{ skills: ['200332'], score: 1, spUsed: 110, spLeft: 0, descriptor: 'd' }],
      candidates: [{ skillId: '200332', rarity: 'white', deltaL: 1, screenSpCost: 110, lPerSp: 9, pinned: false }],
      greedyScore: 0,
    }),
  ),
}));

vi.mock('@/app/ActivePlanContext', () => ({
  useActivePlan: () => ({
    plan: {
      umaId: '100101',
      cmRef: { courseId: '10906' },
      wishlist: [{ skillId: '200332', priority: 1, source: 'targeted' }],
    },
    setPlan: vi.fn(), flushPendingSave: vi.fn(), loadError: null,
  }),
}));

beforeEach(() => {
  mockGameDataStatus.status = 'ready' as const;
});

afterEach(cleanup);

describe('SpOptimizerPage', () => {
  it('seeds the form from the M4 wishlist and can Analyze', async () => {
    const user = userEvent.setup();
    render(<SpOptimizerPage />);

    await user.click(screen.getByRole('button', { name: /Copy from M4 wishlist/i }));
    await user.click(screen.getByRole('button', { name: 'Analyze' }));
    // analyze() is async now (awaits the main-thread engine-init seam), so the
    // results render on a later tick — findBy waits for it.
    expect(await screen.findByText('Suggested baskets')).toBeInTheDocument();
  });

  it('imports a raw career capture and preserves its SP and discounted cost', async () => {
    const user = userEvent.setup();
    render(<SpOptimizerPage />);
    const raw = {
      capturedAt: '2026-07-10T12:00:00', spBudget: 777,
      stats: { spd: 1000, sta: 800, pow: 700, gut: 400, wit: 900 },
      aptitudes: {
        surface: { turf: 'A', dirt: 'G' }, distance: { short: 'G', mile: 'A', middle: 'S', long: 'B' },
        style: { front: 'G', pace: 'A', late: 'S', end: 'B' },
      },
      strategy: 'late',
      skills: [{ skillId: 200012, isAcquired: 0, needPoint: 71, hintLv: 4 }],
    };
    const json = JSON.stringify(raw);
    const file = new File([json], 'career-capture.json', { type: 'application/json' });
    Object.defineProperty(file, 'text', { value: vi.fn(async () => json) });

    await user.upload(screen.getByLabelText(/Import capture/i), file);

    expect(await screen.findByDisplayValue('777')).toBeInTheDocument();
    expect(screen.getByLabelText('Available SP')).toHaveValue(777);
    expect(screen.getByRole('spinbutton', { name: /Cost for/i })).toHaveValue(71);
  });

  it('shows the two tabs and the F2 placeholder on the compare tab', async () => {
    const user = userEvent.setup();
    render(<SpOptimizerPage />);
    await user.click(screen.getByRole('tab', { name: /Compare vs veteran/i }));
    expect(screen.getByText(/coming in F2/i)).toBeInTheDocument();
  });

  it('marks the result stale after a pin and clears it on Re-analyze', async () => {
    const user = userEvent.setup();
    render(<SpOptimizerPage />);
    await user.click(screen.getByRole('button', { name: /Copy from M4 wishlist/i }));
    await user.click(screen.getByRole('button', { name: /^Analyze$|Re-analyze/i }));
    await screen.findByText('Suggested baskets');
    await user.click(screen.getByRole('button', { name: /Lock 200332/i }));
    expect(screen.getByText(/changes detected/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Re-analyze/i }));
    await screen.findByText('Suggested baskets');
    expect(screen.queryByText(/changes detected/i)).not.toBeInTheDocument();
  });

  it('shows fixture-data alert when status is fixture', () => {
    mockGameDataStatus.status = 'fixture' as const;
    render(<SpOptimizerPage />);
    expect(screen.getByText(/placeholder data.*illustrative/i)).toHaveAttribute('role', 'alert');
  });
});
