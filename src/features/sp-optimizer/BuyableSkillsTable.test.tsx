import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/features/data/gameData', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/data/gameData')>();
  const { fixtureGameData } = await import('@/features/testing/fixtureGameData');
  return { ...actual, useGameData: () => ({ ...fixtureGameData(), status: 'ready' as const }) };
});
vi.mock('@/features/sp-optimizer/skillKind', () => ({ useSkillKinds: () => new Map() }));

import { BuyableSkillsTable, type BuyableSkillsTableProps } from '@/features/sp-optimizer/BuyableSkillsTable';
import type { RankResult } from '@/features/sp-optimizer/rankBaskets';

afterEach(cleanup);
const rows = [
  { skillId: '200332', rarity: 'white' as const, deltaL: 1.42, screenSpCost: 144, baseSpCost: 240, lPerSp: 9.9, hintLevel: 3 as const, pinned: false },
  { skillId: '200012', rarity: 'white' as const, deltaL: 0.31, screenSpCost: 130, lPerSp: 2.4, pinned: false },
];
const result: RankResult = { mode: 'exact', greedyScore: 0, candidates: rows, baskets: [{ skills: ['200332'], score: 1.42, spUsed: 144, spLeft: 0, descriptor: 'd' }] };

function makeProps(overrides: Partial<BuyableSkillsTableProps> = {}): BuyableSkillsTableProps {
  return {
    result, rows, selectedIdx: 0, pins: new Set(), excluded: new Set(),
    onCycleLock: () => {}, onSetHint: () => {},
    ...overrides,
  };
}

describe('BuyableSkillsTable', () => {
  it('renders a row per candidate with ΔL and L/SP', () => {
    render(<BuyableSkillsTable {...makeProps()} />);
    expect(screen.getByText('+1.42')).toBeInTheDocument();
    expect(screen.getByText('9.9')).toBeInTheDocument();
    expect(screen.getByText(/240/)).toBeInTheDocument(); // struck base
  });
  it('fires onCycleLock when a lock cell is clicked', async () => {
    const onCycleLock = vi.fn();
    render(<BuyableSkillsTable {...makeProps({ onCycleLock })} />);
    await userEvent.click(screen.getByRole('button', { name: /lock 200332/i }));
    expect(onCycleLock).toHaveBeenCalledWith('200332');
  });
  it('does not strike base cost when screenSpCost exceeds base (no discount)', () => {
    // Second fixture row (200012): screenSpCost 130 exceeds its base cost from fixture data.
    // The struck-base span should not render for this row.
    render(<BuyableSkillsTable {...makeProps()} />);
    // The first row (200332) has base 240 and screenSpCost 144, so its base SHOULD strike.
    expect(screen.getByText('240')).toBeInTheDocument();
    // The second row (200012) has screenSpCost 130 which exceeds its base; no strike should render.
    // Query for the struck base "90" in the entire document; it should not exist for row 200012.
    const strikeSpans = screen.queryAllByText('90');
    expect(strikeSpans.length).toBe(0);
  });
  it('cost is read-only text with a − Lv N + stepper; stepping fires onSetHint ±1', async () => {
    const onSetHint = vi.fn();
    render(<BuyableSkillsTable {...makeProps({ onSetHint })} />);
    // No editable cost input anywhere — cost derives from the hint level.
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    expect(screen.getByText('144')).toBeInTheDocument();
    // Row 200332 is at hint 3 → up gives 4, down gives 2.
    await userEvent.click(screen.getByRole('button', { name: 'Hint up for 200332' }));
    expect(onSetHint).toHaveBeenLastCalledWith('200332', 4);
    await userEvent.click(screen.getByRole('button', { name: 'Hint down for 200332' }));
    expect(onSetHint).toHaveBeenLastCalledWith('200332', 2);
    // Row 200012 has no hint (0) → down is disabled.
    expect(screen.getByRole('button', { name: 'Hint down for 200012' })).toBeDisabled();
  });
  it('renders a negative ΔL without a leading + (−0.06, not +-0.06)', () => {
    const negRows = [{ ...rows[1]!, deltaL: -0.06 }];
    const negResult: RankResult = { ...result, candidates: negRows };
    render(<BuyableSkillsTable {...makeProps({ result: negResult, rows: negRows })} />);
    expect(screen.getByText('-0.06')).toBeInTheDocument();
    expect(screen.queryByText('+-0.06')).not.toBeInTheDocument();
  });
  it('renders an excluded row dimmed with ✕ and no ΔL / L-per-SP numbers', () => {
    render(<BuyableSkillsTable {...makeProps({ excluded: new Set(['200012']) })} />);
    const lockBtn = screen.getByRole('button', { name: /lock 200012/i });
    expect(lockBtn).toHaveTextContent('✕');
    expect(lockBtn.closest('tr')).toHaveClass('is-excluded');
    // Excluded rows show — instead of stale analysis numbers.
    expect(screen.queryByText('+0.31')).not.toBeInTheDocument();
    expect(screen.queryByText('2.4')).not.toBeInTheDocument();
  });
});
