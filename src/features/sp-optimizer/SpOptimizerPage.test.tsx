import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SpOptimizerPage } from '@/features/sp-optimizer/SpOptimizerPage';

vi.mock('@/features/data/gameData', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/data/gameData')>();
  const { fixtureGameData } = await import('@/features/testing/fixtureGameData');
  return { ...actual, useGameData: () => ({ ...fixtureGameData(), status: 'ready' as const }) };
});

vi.mock('@/db', () => ({
  listCaptures: vi.fn(async () => []),
  saveCapture: vi.fn(async (d: { label: string; bundle: unknown }) => ({ id: 'id1', ...d })),
  deleteCapture: vi.fn(async () => undefined),
}));

vi.mock('@/features/sp-optimizer/rankBaskets', () => ({
  rankBaskets: vi.fn(() => ({ mode: 'exact', baskets: [{ skills: ['200332'], score: 1, spUsed: 110, spLeft: 0, descriptor: 'd' }] })),
}));

vi.mock('@/app/ActivePlanContext', () => ({
  useActivePlan: () => ({
    plan: { wishlist: [{ skillId: '200332', priority: 1, source: 'targeted' }] },
    setPlan: vi.fn(), flushPendingSave: vi.fn(), loadError: null,
  }),
}));

afterEach(cleanup);

describe('SpOptimizerPage', () => {
  it('seeds the form from the M4 wishlist and can Analyze', async () => {
    const user = userEvent.setup();
    render(<SpOptimizerPage />);

    await user.click(screen.getByRole('button', { name: /Copy from M4 wishlist/i }));
    await user.click(screen.getByRole('button', { name: 'Analyze' }));
    expect(screen.getByText('Suggested baskets')).toBeInTheDocument();
  });
});
