import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ResultBanner } from '@/features/sp-optimizer/ResultBanner';
import type { RankResult } from '@/features/sp-optimizer/rankBaskets';

afterEach(cleanup);
const result: RankResult = {
  mode: 'exact', greedyScore: 4.18, candidates: [],
  baskets: [{ skills: ['a', 'b'], score: 4.39, spUsed: 2310, spLeft: 90, descriptor: 'd' }],
};

describe('ResultBanner', () => {
  it('shows the optimal buy count, +L, mode, and SP used/left', () => {
    render(<ResultBanner result={result} selectedIdx={0} spBudget={2400} />);
    expect(screen.getByText(/Buy 2/)).toBeInTheDocument();
    expect(screen.getByText(/\+4\.39/)).toBeInTheDocument();
    expect(screen.getByText(/EXACT/i)).toBeInTheDocument();
    expect(screen.getByText(/2,?310/)).toBeInTheDocument();
    expect(screen.getByText(/90 SP left/)).toBeInTheDocument();
  });
  it('shows the vs-greedy delta when positive', () => {
    render(<ResultBanner result={result} selectedIdx={0} spBudget={2400} />);
    expect(screen.getByText(/greedy/i)).toBeInTheDocument();
    expect(screen.getByText(/\+0\.21/)).toBeInTheDocument();
  });
});
