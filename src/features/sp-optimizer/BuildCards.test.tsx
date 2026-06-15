import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import { BuildCards } from '@/features/sp-optimizer/BuildCards';
import type { RankResult } from '@/features/sp-optimizer/rankBaskets';

vi.mock('@/features/data/gameData', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/data/gameData')>();
  const { fixtureGameData } = await import('@/features/testing/fixtureGameData');
  return { ...actual, useGameData: () => fixtureGameData() };
});

afterEach(cleanup);

const RESULT: RankResult = {
  mode: 'exact',
  baskets: [
    { skills: ['200332'], score: 2.4, spUsed: 120, spLeft: 380, descriptor: '+2.4 lengths · tight spread' },
    { skills: ['200331'], score: 1.1, spUsed: 160, spLeft: 340, descriptor: '+1.1 lengths · moderate spread' },
  ],
};

describe('BuildCards', () => {
  it('renders one card per basket with SP used/left and the descriptor', () => {
    render(<BuildCards result={RESULT} />);
    expect(screen.getAllByRole('article')).toHaveLength(2);
    expect(screen.getByText('+2.4 lengths · tight spread')).toBeInTheDocument();
    expect(screen.getByText(/120 SP used/)).toBeInTheDocument();
  });

  it('shows the exact/estimate provenance label', () => {
    render(<BuildCards result={RESULT} />);
    expect(screen.getByText(/exact ranking/i)).toBeInTheDocument();
  });
});
