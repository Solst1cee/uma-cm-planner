import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import type { BashinStats, SimBuild } from '@/sim';
import type { CmPlan } from '@/core/types';

const h = vi.hoisted(() => {
  const umas = [
    { umaId: '100101', charaId: '1001', nameEn: 'Special Week', epithet: 'Special Dreamer', server: 'global', dataVersion: 't' },
    { umaId: '100201', charaId: '1002', nameEn: 'Silence Suzuka', epithet: 'Innocent Silence', server: 'global', dataVersion: 't' },
  ];
  const umaById = new Map(umas.map((u) => [u.umaId, u]));
  const uniqueByUmaId = new Map<string, { skillId: string; nameEn: string; iconId: string; rarity: string; baseSpCost: number; conditions: string }>([
    ['100101', { skillId: 'u1', nameEn: 'Shooting Star', iconId: '20013', rarity: 'unique', baseSpCost: 0, conditions: 'phase>=2' }],
    ['100201', { skillId: 'u2', nameEn: 'Silent Speedline', iconId: '20013', rarity: 'unique', baseSpCost: 0, conditions: 'corner!=0' }],
  ]);
  const bs = (mean: number): BashinStats => ({ mean, median: mean, min: mean, max: mean, nsamples: 30, results: [] });
  // Per-style L: u2 is best as an End Closer (2.0); u1 is best as a Front Runner (1.0).
  // So "rank by best" puts u2 first, but forcing Front Runner flips u1 to the top.
  const styleL: Record<string, Record<string, number>> = {
    u1: { front: 1.0, pace: 0.2, late: 0.2, end: 0.3 },
    u2: { front: 0.3, pace: 0.2, late: 0.2, end: 2.0 },
  };
  const skillDelta = vi.fn(async (b: SimBuild, _r: unknown, id: string) => bs(styleL[id]?.[b.strategy] ?? 0.1));
  return { umas, umaById, uniqueByUmaId, skillDelta };
});

vi.mock('@/features/data/gameData', () => ({
  useGameData: () => ({ status: 'ready', umas: h.umas, umaById: h.umaById, skillById: new Map(), iconManifest: null }),
}));
vi.mock('./skillTechnicalDetails', () => ({
  loadUniqueSkillByUmaId: vi.fn(async () => h.uniqueByUmaId),
  loadSkillTechnicalDetail: vi.fn(async () => null),
  skillRecordToSummary: (s: unknown) => s,
}));
vi.mock('./useSkillTrace', () => ({
  useSkillTrace: (): import('./useSkillTrace').SkillTraceState => ({
    status: 'idle', run: null, runChoice: 'median', setRunChoice: vi.fn(),
    meanL: null, impact: null, impactStatus: 'idle',
  }),
}));

import { UmaChartPanel } from './UmaChartPanel';

const plan = { umaId: '', server: 'global' } as unknown as CmPlan;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('UmaChartPanel', () => {
  it('does not simulate before Run', () => {
    render(<UmaChartPanel courseId="10906" plan={plan} onSelectRunner={vi.fn()} deps={{ skillDelta: h.skillDelta }} />);
    expect(h.skillDelta).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Run' })).toBeInTheDocument();
  });

  it('Run ranks umas by best unique L and Select commits the runner', async () => {
    const onSelectRunner = vi.fn();
    render(<UmaChartPanel courseId="10906" plan={plan} onSelectRunner={onSelectRunner} deps={{ skillDelta: h.skillDelta }} />);
    // wait for the lazy unique map so Run is enabled
    await waitFor(() => expect(screen.getByRole('button', { name: 'Run' })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: 'Run' }));
    await waitFor(() => expect(screen.getByLabelText('Uma unique-skill ranking')).toBeInTheDocument());
    const rows = within(screen.getByLabelText('Uma unique-skill ranking')).getAllByRole('listitem');
    // rows now show the unique skill (uma name removed); u2 (2.0) ranks above u1 (1.0)
    expect(rows[0]).toHaveTextContent('Silent Speedline');
    // one button per row (the Select action; the style picker is a combobox)
    await userEvent.click(within(rows[0]!).getByRole('button'));
    expect(onSelectRunner).toHaveBeenCalledWith('100201', 'u2');
  });

  it('filters displayed rows by search without re-running', async () => {
    render(<UmaChartPanel courseId="10906" plan={plan} onSelectRunner={vi.fn()} deps={{ skillDelta: h.skillDelta }} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Run' })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: 'Run' }));
    await waitFor(() => expect(screen.getByLabelText('Uma unique-skill ranking')).toBeInTheDocument());
    const callsAfterRun = h.skillDelta.mock.calls.length;
    await userEvent.type(screen.getByLabelText('Search uma'), 'Suzuka');
    const list = screen.getByLabelText('Uma unique-skill ranking');
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    expect(h.skillDelta.mock.calls.length).toBe(callsAfterRun); // no re-sim
  });

  it('shows "Done" in the header after a full run', async () => {
    render(<UmaChartPanel courseId="10906" plan={plan} onSelectRunner={vi.fn()} deps={{ skillDelta: h.skillDelta }} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Run' })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: 'Run' }));
    await waitFor(() => expect(screen.getByText('Done')).toBeInTheDocument());
  });

  it('turns Run into a Stop control while running and stops on click', async () => {
    const pending = vi.fn(() => new Promise<BashinStats>(() => {})); // never resolves → stays running
    render(<UmaChartPanel courseId="10906" plan={plan} onSelectRunner={vi.fn()} deps={{ skillDelta: pending }} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Run' })).toBeEnabled());
    const btn = screen.getByRole('button', { name: 'Run' });
    await userEvent.click(btn);
    await waitFor(() => expect(btn).toHaveAttribute('aria-label', 'Stop ranking'));
    await userEvent.click(btn);
    expect(btn).toHaveAttribute('aria-label', 'Re-run');
  });

  it('inverts the min/max/mean/median sort when the active column is clicked again', async () => {
    render(<UmaChartPanel courseId="10906" plan={plan} onSelectRunner={vi.fn()} deps={{ skillDelta: h.skillDelta }} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Run' })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: 'Run' }));
    await waitFor(() => expect(screen.getByLabelText('Uma unique-skill ranking')).toBeInTheDocument());
    const rankList = () => screen.getByLabelText('Uma unique-skill ranking');
    // default Mean desc → u2 (Silent Speedline, 2.0) first
    expect(within(rankList()).getAllByRole('listitem')[0]).toHaveTextContent('Silent Speedline');
    // click Mean again → invert to asc → u1 (Shooting Star, 1.0) first
    await userEvent.click(screen.getByRole('button', { name: 'Mean' }));
    expect(within(rankList()).getAllByRole('listitem')[0]).toHaveTextContent('Shooting Star');
  });

  it('rank-by-style dropdown re-ranks every uma by the chosen style without re-running', async () => {
    render(<UmaChartPanel courseId="10906" plan={plan} onSelectRunner={vi.fn()} deps={{ skillDelta: h.skillDelta }} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Run' })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: 'Run' }));
    await waitFor(() => expect(screen.getByLabelText('Uma unique-skill ranking')).toBeInTheDocument());
    const rankList = () => screen.getByLabelText('Uma unique-skill ranking');
    // "rank by best" → u2 (Silent Speedline, best is End 2.0) first
    expect(within(rankList()).getAllByRole('listitem')[0]).toHaveTextContent('Silent Speedline');
    const callsAfterRun = h.skillDelta.mock.calls.length;
    // force Front Runner → u1 (front 1.0) now beats u2 (front 0.3); pure re-rank, no re-sim
    await userEvent.selectOptions(screen.getByLabelText('Rank by style'), 'front');
    expect(within(rankList()).getAllByRole('listitem')[0]).toHaveTextContent('Shooting Star');
    expect(h.skillDelta.mock.calls.length).toBe(callsAfterRun);
  });

  it('keeps only one skill disclosure open at a time (accordion)', async () => {
    render(<UmaChartPanel courseId="10906" plan={plan} onSelectRunner={vi.fn()} deps={{ skillDelta: h.skillDelta }} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Run' })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: 'Run' }));
    await waitFor(() => expect(screen.getByLabelText('Uma unique-skill ranking')).toBeInTheDocument());
    const summaries = document.querySelectorAll<HTMLElement>('details.cmp-uma-plate summary');
    expect(summaries.length).toBeGreaterThanOrEqual(2);
    await userEvent.click(summaries[0]!);
    await userEvent.click(summaries[1]!);
    expect(document.querySelectorAll('details.cmp-uma-plate[open]').length).toBe(1);
  });
});
