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

import { BuyableSkillsTable } from '@/features/sp-optimizer/BuyableSkillsTable';
import type { RankResult } from '@/features/sp-optimizer/rankBaskets';

afterEach(cleanup);
const rows = [
  { skillId: '200332', rarity: 'white' as const, deltaL: 1.42, screenSpCost: 144, baseSpCost: 240, lPerSp: 9.9, hintLevel: 3 as const, pinned: false },
  { skillId: '200012', rarity: 'white' as const, deltaL: 0.31, screenSpCost: 130, lPerSp: 2.4, pinned: false },
];
const result: RankResult = { mode: 'exact', greedyScore: 0, candidates: rows, baskets: [{ skills: ['200332'], score: 1.42, spUsed: 144, spLeft: 0, descriptor: 'd' }] };

describe('BuyableSkillsTable', () => {
  it('renders a row per candidate with ΔL and L/SP', () => {
    render(<BuyableSkillsTable result={result} rows={rows} selectedIdx={0} pins={new Set()} onTogglePin={() => {}} onEditCost={() => {}} onSetHint={() => {}} />);
    expect(screen.getByText('+1.42')).toBeInTheDocument();
    expect(screen.getByText('9.9')).toBeInTheDocument();
    expect(screen.getByText(/240/)).toBeInTheDocument(); // struck base
  });
  it('fires onTogglePin when a lock cell is clicked', async () => {
    const onTogglePin = vi.fn();
    render(<BuyableSkillsTable result={result} rows={rows} selectedIdx={0} pins={new Set()} onTogglePin={onTogglePin} onEditCost={() => {}} onSetHint={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /lock 200332/i }));
    expect(onTogglePin).toHaveBeenCalledWith('200332');
  });
  it('does not strike base cost when screenSpCost exceeds base (no discount)', () => {
    // Second fixture row (200012): screenSpCost 130 exceeds its base cost from fixture data.
    // The struck-base span should not render for this row.
    render(<BuyableSkillsTable result={result} rows={rows} selectedIdx={0} pins={new Set()} onTogglePin={() => {}} onEditCost={() => {}} onSetHint={() => {}} />);
    // The first row (200332) has base 240 and screenSpCost 144, so its base SHOULD strike.
    expect(screen.getByText('240')).toBeInTheDocument();
    // The second row (200012) has screenSpCost 130 which exceeds its base; no strike should render.
    // Query for the struck base "90" in the entire document; it should not exist for row 200012.
    const strikeSpans = screen.queryAllByText('90');
    expect(strikeSpans.length).toBe(0);
  });
});
