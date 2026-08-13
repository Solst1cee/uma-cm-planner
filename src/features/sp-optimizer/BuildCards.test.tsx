import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/features/data/gameData', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/data/gameData')>();
  const { fixtureGameData } = await import('@/features/testing/fixtureGameData');
  return { ...actual, useGameData: () => ({ ...fixtureGameData(), status: 'ready' as const }) };
});

import { BuildCards } from '@/features/sp-optimizer/BuildCards';
import type { RankResult } from '@/features/sp-optimizer/rankBaskets';

afterEach(cleanup);
const result: RankResult = {
  mode: 'exact', greedyScore: 0, candidates: [],
  baskets: [
    { skills: ['200332'], score: 4.39, spUsed: 2310, spLeft: 90, descriptor: '+4.4 lengths · tight spread' },
    { skills: ['200012'], score: 4.31, spUsed: 2270, spLeft: 130, descriptor: '+4.3 lengths · moderate spread' },
  ],
};

describe('BuildCards', () => {
  it('renders generic basket labels + mean L, no win%', () => {
    render(<BuildCards result={result} selectedIdx={0} onSelect={() => {}} onCompare={() => {}} />);
    expect(screen.getByText('Basket #1')).toBeInTheDocument();
    expect(screen.getByText(/\+4\.39/)).toBeInTheDocument();
    expect(screen.queryByText(/win vs field/i)).not.toBeInTheDocument();
  });
  it('calls onSelect when a card is clicked and onCompare on the button', async () => {
    const onSelect = vi.fn(); const onCompare = vi.fn();
    render(<BuildCards result={result} selectedIdx={0} onSelect={onSelect} onCompare={onCompare} />);
    await userEvent.click(screen.getByText('Basket #2'));
    expect(onSelect).toHaveBeenCalledWith(1);
    await userEvent.click(screen.getAllByRole('button', { name: /Compare vs veteran/i })[0]!);
    expect(onCompare).toHaveBeenCalled();
  });
});
