import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
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
  // One family "Adept": two white cosmetic tiers (◎/○) + a gold version; all linked.
  const wA = mk({ skillId: 'wA', nameEn: 'Adept ◎', rarity: 'white', baseSpCost: 90, variantSkillIds: ['wB', 'g1'] });
  const wB = mk({ skillId: 'wB', nameEn: 'Adept ○', rarity: 'white', baseSpCost: 60, variantSkillIds: ['wA', 'g1'] });
  const g1 = mk({ skillId: 'g1', nameEn: 'Adept Demon', rarity: 'gold', baseSpCost: 170, variantSkillIds: ['wA', 'wB'] });
  const s1 = mk({ skillId: 's1', nameEn: 'Solo White', rarity: 'white', baseSpCost: 120 });
  const i1 = mk({ skillId: 'i1', nameEn: 'Inherited One', rarity: 'inherited_unique', baseSpCost: 0 });
  const skills = [wA, wB, g1, s1, i1];
  const skillById = new Map(skills.map((s) => [s.skillId, s]));
  const bs = (mean: number): BashinStats => ({ mean, median: mean, min: mean, max: mean, nsamples: 30, results: [] });
  const L: Record<string, number> = { g1: 2.0, wA: 1.5, wB: 1.4, s1: 1.0, i1: 0.8 };
  const skillDelta = vi.fn(async (_b: SimBuild, _r: unknown, id: string) => bs(L[id] ?? 0.5));

  const defaultGameData = {
    status: 'ready', skills, skillById, sparkRates: {}, umas: [], umaById: new Map(),
    iconManifest: null, timeline: [] as unknown[],
  };
  const useGameData = vi.fn(() => defaultGameData);
  return { skills, skillById, skillDelta, useGameData, defaultGameData };
});

vi.mock('@/features/data/gameData', () => ({ useGameData: h.useGameData }));
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

const bs = (mean: number): BashinStats => ({ mean, median: mean, min: mean, max: mean, nsamples: 30, results: [] });

const list = () => screen.getByLabelText('Acquirable skill ranking');
const rowTexts = () => within(list()).getAllByRole('listitem').map((li) => li.textContent ?? '');

async function runFull(onChange = vi.fn()) {
  render(<SkillChartPanel courseId="10906" plan={basePlan} onChange={onChange} deps={{ skillDelta: h.skillDelta }} />);
  await userEvent.click(screen.getByRole('button', { name: 'Run' }));
  await waitFor(() => expect(within(list()).getAllByRole('listitem')).toHaveLength(4));
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  h.useGameData.mockReturnValue(h.defaultGameData);
});

describe('SkillChartPanel', () => {
  it('collapses cosmetic tiers within a rarity, keeps white & gold as distinct rows, ranks by L', async () => {
    await runFull();
    const rows = within(list()).getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('Adept Demon'); // gold, L 2.0
    // the ◎ white tier survives as the white rep; the ○ tier (wB) collapsed away
    expect(rowTexts().some((t) => t.includes('Adept ◎'))).toBe(true);
    expect(rowTexts().some((t) => t.includes('Adept ○'))).toBe(false);
    // 4 reps simulated (wA white-rep, s1, g1 gold, i1 inherited) — NOT wB
    expect(h.skillDelta).toHaveBeenCalledTimes(4);
  });

  it('white filter shows only white skills (no gold, no inherited)', async () => {
    await runFull();
    await userEvent.click(screen.getByRole('button', { name: 'white' }));
    const texts = rowTexts();
    expect(texts).toHaveLength(2); // Adept ◎ + Solo White
    expect(texts.some((t) => t.includes('Adept Demon'))).toBe(false);
    expect(texts.some((t) => t.includes('Inherited One'))).toBe(false);
  });

  it('gold filter shows only gold skills', async () => {
    await runFull();
    await userEvent.click(screen.getByRole('button', { name: 'gold' }));
    const texts = rowTexts();
    expect(texts).toHaveLength(1);
    expect(texts[0]).toContain('Adept Demon');
  });

  it('non-unique filter excludes inherited uniques', async () => {
    await runFull();
    await userEvent.click(screen.getByRole('button', { name: 'non-unique' }));
    const texts = rowTexts();
    expect(texts).toHaveLength(3); // Adept Demon + Adept ◎ + Solo White
    expect(texts.some((t) => t.includes('Inherited One'))).toBe(false);
  });

  it('inherited unique filter shows only inherited uniques', async () => {
    await runFull();
    await userEvent.click(screen.getByRole('button', { name: 'inherited unique' }));
    const texts = rowTexts();
    expect(texts).toHaveLength(1);
    expect(texts[0]).toContain('Inherited One');
  });

  it('+ target adds the rep with its projectedL and flips to the targeted mark', async () => {
    const onChange = vi.fn();
    await runFull(onChange);
    const rows = within(list()).getAllByRole('listitem');
    await userEvent.click(within(rows[0]!).getByRole('button', { name: /target/i })); // Adept Demon (g1)
    const next = onChange.mock.calls[0]![0] as CmPlan;
    expect(next.wishlist).toHaveLength(1);
    expect(next.wishlist[0]).toMatchObject({ skillId: 'g1', projectedL: 2.0, projectedLStale: false });
  });

  it('hides never-proc skills by default and reveals them with the not-activatable toggle', async () => {
    // s1 never procs on this track (activated:false); everything else procs
    const skillDelta = vi.fn(async (_b: SimBuild, _r: unknown, id: string): Promise<BashinStats> =>
      id === 's1'
        ? { mean: 0, median: 0, min: 0, max: 0, nsamples: 30, results: [], activated: false }
        : { mean: 1, median: 1, min: 1, max: 1, nsamples: 30, results: [], activated: true },
    );
    render(<SkillChartPanel courseId="10906" plan={basePlan} onChange={vi.fn()} deps={{ skillDelta }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Run' }));
    // default hides s1 (Solo White) → 3 of the 4 reps
    await waitFor(() => expect(within(list()).getAllByRole('listitem')).toHaveLength(3));
    expect(rowTexts().some((t) => t.includes('Solo White'))).toBe(false);
    // the toggle reveals it
    await userEvent.click(screen.getByRole('checkbox', { name: /not-activatable/i }));
    await waitFor(() => expect(within(list()).getAllByRole('listitem')).toHaveLength(4));
    expect(rowTexts().some((t) => t.includes('Solo White'))).toBe(true);
  });

  it('shows the speed-required prompt and never sims when spd is 0', () => {
    const noSpeed = { ...basePlan, statProfile: { stats: { spd: 0, sta: 0, pow: 0, gut: 0, wit: 0 }, mood: 2 } } as unknown as CmPlan;
    render(<SkillChartPanel courseId="10906" plan={noSpeed} onChange={vi.fn()} deps={{ skillDelta: h.skillDelta }} />);
    expect(screen.getByText(/Speed is required/i)).toBeInTheDocument();
    expect(h.skillDelta).not.toHaveBeenCalled();
  });

  it('shows the plan caption before Run and keeps it after Run', async () => {
    render(<SkillChartPanel courseId="10906" plan={basePlan} onChange={vi.fn()} deps={{ skillDelta: h.skillDelta }} />);
    const caption = /rank acquirable skills by length on your current uma plan/i;
    expect(screen.getByText(caption)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Run' }));
    await waitFor(() => expect(within(list()).getAllByRole('listitem')).toHaveLength(4));
    expect(screen.getByText(caption)).toBeInTheDocument();
  });

  it('sorts by SP ascending (cheapest first) when the SP header is clicked', async () => {
    await runFull();
    await userEvent.click(screen.getByRole('button', { name: 'SP' }));
    // cheapest SP first: i1 (0) → wA (90) → s1 (120) → g1 (170)
    expect(within(list()).getAllByRole('listitem')[0]).toHaveTextContent('Inherited One');
  });

  it('clicking the active sort column again inverts the direction', async () => {
    await runFull();
    expect(within(list()).getAllByRole('listitem')[0]).toHaveTextContent('Adept Demon'); // L desc
    await userEvent.click(screen.getByRole('button', { name: 'L' })); // invert → L asc
    expect(within(list()).getAllByRole('listitem')[0]).toHaveTextContent('Inherited One'); // lowest L
  });

  it('turns the Run button into a Stop control while running and stops on click', async () => {
    const pending = vi.fn(() => new Promise<BashinStats>(() => {})); // never resolves → stays running
    render(<SkillChartPanel courseId="10906" plan={basePlan} onChange={vi.fn()} deps={{ skillDelta: pending }} />);
    const btn = screen.getByRole('button', { name: 'Run' });
    await userEvent.click(btn);
    await waitFor(() => expect(btn).toHaveAttribute('aria-label', 'Stop ranking'));
    await userEvent.click(btn);
    expect(btn).toHaveAttribute('aria-label', 'Re-run');
  });

  it('shows "Done" in the header when a full run completes', async () => {
    render(<SkillChartPanel courseId="10906" plan={basePlan} onChange={vi.fn()} deps={{ skillDelta: h.skillDelta }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Run' }));
    await waitFor(() => expect(screen.getByText('Done')).toBeInTheDocument());
  });

  it('reports a partial "N/total skills ran" count when stopped early', async () => {
    const resolvers: Array<(v: BashinStats) => void> = [];
    const skillDelta = vi.fn(() => new Promise<BashinStats>((res) => { resolvers.push(res); }));
    render(<SkillChartPanel courseId="10906" plan={basePlan} onChange={vi.fn()} deps={{ skillDelta }} />);
    const btn = screen.getByRole('button', { name: 'Run' });
    await userEvent.click(btn);
    await act(async () => { resolvers[0]?.(bs(1)); await Promise.resolve(); }); // first of 4 reps streams
    await waitFor(() => expect(screen.getByText('ranking 1/4')).toBeInTheDocument());
    await userEvent.click(btn); // stop
    expect(screen.getByText('1/4 skills ran')).toBeInTheDocument();
  });

  it('hides upcoming (server:jp) skills until "show upcoming" is toggled', async () => {
    const up = { skillId: 'up1', nameEn: 'Upcoming Gold', nameJp: '', baseSpCost: 170,
      rarity: 'gold', iconId: '1', conditions: '', server: 'jp', dataVersion: 't',
      releaseDate: '2026-06-10' } as unknown as SkillRecord;
    const skills = [...h.skills, up];
    h.useGameData.mockReturnValue({
      status: 'ready', skills, skillById: new Map(skills.map((s) => [s.skillId, s])),
      sparkRates: {}, umas: [], umaById: new Map(), iconManifest: null,
      timeline: [{ type: 'cm', cm: { cmNumber: 15 }, dates: { start: '2026-06-21' } }],
    });
    const plan = { ...basePlan, cmRef: { cmNumber: 15, courseId: '10906' } } as unknown as CmPlan;
    render(<SkillChartPanel courseId="10906" plan={plan} onChange={vi.fn()} deps={{ skillDelta: h.skillDelta }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Run' }));
    await waitFor(() => expect(within(list()).getAllByRole('listitem').length).toBeGreaterThan(0));
    expect(rowTexts().some((t) => t.includes('Upcoming Gold'))).toBe(false); // hidden by default
    await userEvent.click(screen.getByRole('checkbox', { name: /show upcoming/i }));
    await waitFor(() => expect(rowTexts().some((t) => t.includes('Upcoming Gold'))).toBe(true));
  });
});
