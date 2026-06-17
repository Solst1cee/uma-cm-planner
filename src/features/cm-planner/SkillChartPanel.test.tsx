import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import type { BashinStats, SimBuild } from '@/sim';
import type { CmPlan, SkillRecord } from '@/core/types';

const h = vi.hoisted(() => {
  const mk = (over: Partial<SkillRecord> & { skillId: string }): SkillRecord => ({
    nameEn: over.nameEn ?? `Skill ${over.skillId}`, nameJp: '',
    baseSpCost: over.baseSpCost ?? 100, rarity: over.rarity ?? 'white', iconId: '1',
    conditions: '', server: 'global', dataVersion: 't', ...over,
  });
  const white = mk({ skillId: '100', nameEn: 'Corner Adept', rarity: 'white', baseSpCost: 90, variantSkillIds: ['101'] });
  const gold = mk({ skillId: '101', nameEn: 'Corner Adept ◎', rarity: 'gold', baseSpCost: 170, variantSkillIds: ['100'] });
  const solo = mk({ skillId: '200', nameEn: 'Straightaway Spurt', rarity: 'white', baseSpCost: 120 });
  const skills = [white, gold, solo];
  const skillById = new Map(skills.map((s) => [s.skillId, s]));
  const bs = (mean: number): BashinStats => ({ mean, median: mean, min: mean, max: mean, nsamples: 30, results: [] });
  // gold family (101) stronger than the solo (200)
  const skillDelta = vi.fn(async (_b: SimBuild, _r: unknown, id: string) => bs(id === '101' ? 2.0 : 1.0));
  return { skills, skillById, skillDelta };
});

vi.mock('@/features/data/gameData', () => ({
  useGameData: () => ({ status: 'ready', skills: h.skills, skillById: h.skillById, sparkRates: {}, umas: [], umaById: new Map(), iconManifest: null }),
}));
vi.mock('./skillTechnicalDetails', () => ({
  loadSkillTechnicalDetail: vi.fn(async () => null),
  skillRecordToSummary: (s: unknown) => s,
}));
vi.mock('@/core/simBuild', () => ({ planToSimBuild: () => ({ stats: { spd: 1200 }, strategy: 'end' }) }));

import { SkillChartPanel } from './SkillChartPanel';

const basePlan = {
  server: 'global',
  strategy: 'end',
  statProfile: { stats: { spd: 1200, sta: 1000, pow: 1000, gut: 1000, wit: 1000 }, mood: 2 },
  wishlist: [],
} as unknown as CmPlan;

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('SkillChartPanel', () => {
  it('collapses variant families to one row and ranks by L on Run', async () => {
    render(<SkillChartPanel courseId="10906" plan={basePlan} onChange={vi.fn()} deps={{ skillDelta: h.skillDelta }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Run' }));
    // wait for the stream to finish (2 family reps → 2 rows)
    await waitFor(() =>
      expect(within(screen.getByLabelText('Acquirable skill ranking')).getAllByRole('listitem')).toHaveLength(2),
    );
    const rows = within(screen.getByLabelText('Acquirable skill ranking')).getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('Corner Adept ◎'); // gold rep, L 2.0, ranks first
    // family collapsed to 2 reps → exactly 2 sims (100+101 collapse to one; 200 stands alone)
    expect(h.skillDelta).toHaveBeenCalledTimes(2);
  });

  it('+ target adds the family rep with its projectedL and flips to the targeted mark', async () => {
    const onChange = vi.fn();
    render(<SkillChartPanel courseId="10906" plan={basePlan} onChange={onChange} deps={{ skillDelta: h.skillDelta }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Run' }));
    await waitFor(() =>
      expect(within(screen.getByLabelText('Acquirable skill ranking')).getAllByRole('listitem')).toHaveLength(2),
    );
    const rows = within(screen.getByLabelText('Acquirable skill ranking')).getAllByRole('listitem');
    await userEvent.click(within(rows[0]!).getByRole('button', { name: /target/i }));
    const next = onChange.mock.calls[0]![0] as CmPlan;
    expect(next.wishlist).toHaveLength(1);
    expect(next.wishlist[0]).toMatchObject({ skillId: '101', projectedL: 2.0, projectedLStale: false });
  });

  it('shows the speed-required prompt and never sims when spd is 0', () => {
    const noSpeed = { ...basePlan, statProfile: { stats: { spd: 0, sta: 0, pow: 0, gut: 0, wit: 0 }, mood: 2 } } as unknown as CmPlan;
    render(<SkillChartPanel courseId="10906" plan={noSpeed} onChange={vi.fn()} deps={{ skillDelta: h.skillDelta }} />);
    expect(screen.getByText(/Speed is required/i)).toBeInTheDocument();
    expect(h.skillDelta).not.toHaveBeenCalled();
  });
});
