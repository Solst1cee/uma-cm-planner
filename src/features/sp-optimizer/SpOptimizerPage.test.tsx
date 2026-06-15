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
  rankBaskets: vi.fn(() => ({
    mode: 'exact',
    baskets: [{ skills: ['200332'], score: 1, spUsed: 100, spLeft: 200, descriptor: '+1.0 lengths · tight spread' }],
  })),
}));

afterEach(cleanup);

describe('SpOptimizerPage', () => {
  it('analyzes a manual entry then saves the capture', async () => {
    const user = userEvent.setup();
    const { saveCapture } = await import('@/db');
    render(<SpOptimizerPage />);

    // useCaptures starts in null/loading state; wait for listCaptures() to resolve
    expect(await screen.findByText('No saved captures yet.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Skill id'), '200332');
    await user.type(screen.getByLabelText('On-screen SP cost'), '100');
    await user.click(screen.getByRole('button', { name: 'Add skill' }));
    await user.click(screen.getByRole('button', { name: 'Analyze' }));

    expect(screen.getByText('Suggested baskets')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Save as'), 'CM14 ace');
    await user.click(screen.getByRole('button', { name: 'Save capture' }));

    expect(saveCapture).toHaveBeenCalledTimes(1);
    expect(vi.mocked(saveCapture).mock.calls[0]![0].label).toBe('CM14 ace');
  });
});
