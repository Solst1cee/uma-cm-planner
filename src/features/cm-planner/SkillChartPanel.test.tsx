import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
  const g1 = mk({ skillId: 'g1', nameEn: 'Adept Demon', rarity: 'gold', baseSpCost: 170, variantSkillIds: ['wA', 'wB'], prereqSkillId: 'wA' });
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
vi.mock('@/core/simBuild', () => ({
  planToSimBuild: () => ({ stats: { spd: 1200 }, strategy: 'end' }),
  chartBaselineBuild: () => ({ stats: { spd: 1200 }, strategy: 'end', skills: [] }),
}));

import { SkillChartPanel } from './SkillChartPanel';

const basePlan = {
  server: 'global',
  strategy: 'end',
  cmRef: { kind: 'cm', cmId: 'CM15', cmNumber: 15, courseId: '10906', surface: 'turf', distance: 2200 },
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
  localStorage.clear();
  h.useGameData.mockReturnValue(h.defaultGameData);
});

describe('SkillChartPanel', () => {
  const TARGET_ID = h.skills[0]!.skillId;
  const TARGET_NAME = h.skills[0]!.nameEn;
  const GOLD_ID = 'g1';
  const GOLD_NAME = 'Adept Demon';

  it('shows exactly one "in build" row when a gold variant is targeted (no family duplicate)', async () => {
    const targetedPlan = {
      ...basePlan,
      wishlist: [{ skillId: GOLD_ID, priority: 1, source: 'targeted', projectedL: 2.5 }],
    } as typeof basePlan;
    render(<SkillChartPanel courseId="10906" plan={targetedPlan} onChange={vi.fn()} deps={{ skillDelta: h.skillDelta }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Run' }));
    await waitFor(() => expect(screen.getByLabelText('Acquirable skill ranking')).toBeInTheDocument());
    // exactly one "in build" badge (the L-cell pill), not the header annotation
    const inBuildBadges = within(list()).getAllByText((_t, el) => el?.classList.contains('cmp-inbuild') ?? false);
    expect(inBuildBadges).toHaveLength(1);
    // and it is the gold skill, with its stamped L
    const row = inBuildBadges[0]!.closest('li')!;
    expect(within(row).getByText(GOLD_NAME)).toBeInTheDocument();
  });

  it('excludes a targeted skill from the ranked sims and shows it as an "in build" row', async () => {
    const targetedPlan = {
      ...basePlan,
      wishlist: [{ skillId: TARGET_ID, priority: 1, source: 'targeted', projectedL: 1.23 }],
    } as typeof basePlan;
    render(<SkillChartPanel courseId="10906" plan={targetedPlan} onChange={vi.fn()} deps={{ skillDelta: h.skillDelta }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Run' }));
    await waitFor(() => expect(screen.getByLabelText('Acquirable skill ranking')).toBeInTheDocument());
    // the targeted skill was NOT re-simmed
    expect(h.skillDelta.mock.calls.map((c) => c[2])).not.toContain(TARGET_ID);
    // …but it is shown, badged "in build", with its stamped L
    const row = within(screen.getByLabelText('Acquirable skill ranking')).getByText(TARGET_NAME).closest('li')!;
    const badge = within(row).getByText((_t, el) => el?.classList.contains('cmp-inbuild') ?? false);
    expect(badge).toBeInTheDocument();
    // its stamped L renders alongside the "in build" badge in the L cell
    expect(badge.parentElement).toHaveTextContent(/\+1\.23/);
  });

  it('renders "—" (not a fabricated +0.00) for an in-build row with no projected L yet', async () => {
    const targetedPlan = {
      ...basePlan,
      wishlist: [{ skillId: TARGET_ID, priority: 1, source: 'targeted' }], // un-simmed: no projectedL
    } as typeof basePlan;
    render(<SkillChartPanel courseId="10906" plan={targetedPlan} onChange={vi.fn()} deps={{ skillDelta: h.skillDelta }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Run' }));
    await waitFor(() => expect(screen.getByLabelText('Acquirable skill ranking')).toBeInTheDocument());
    const row = within(screen.getByLabelText('Acquirable skill ranking')).getByText(TARGET_NAME).closest('li')!;
    const cell = within(row).getByText((_t, el) => el?.classList.contains('cmp-inbuild') ?? false).parentElement!;
    expect(cell).toHaveTextContent('—');
    expect(cell).not.toHaveTextContent(/\+0\.00/);
  });

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

  it('explains the chart via the help popup (not an inline caption)', async () => {
    render(<SkillChartPanel courseId="10906" plan={basePlan} onChange={vi.fn()} deps={{ skillDelta: h.skillDelta }} />);
    const caption = /rank acquirable/i;
    // No inline caption — the explanation is behind the "?" help button.
    expect(screen.queryByText(caption)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /how the skill chart works/i }));
    expect(screen.getByText(caption)).toBeInTheDocument();
  });

  it('sorts by SP ascending (cheapest first) when the SP header is clicked', async () => {
    await runFull();
    await userEvent.click(screen.getByRole('button', { name: 'SP' }));
    // cheapest SP first: i1 (0) → wA (90) → s1 (120) → g1 (170+90 prereq = 260)
    expect(within(list()).getAllByRole('listitem')[0]).toHaveTextContent('Inherited One');
  });

  it('prices a gold skill as gold + white prerequisite (bundled SP)', async () => {
    await runFull();
    await userEvent.click(screen.getByRole('button', { name: 'gold' }));
    // g1 gold base 170 + its white prereq wA base 90 = 260 (no hint discount in chart)
    expect(within(list()).getAllByRole('listitem')[0]).toHaveTextContent('260');
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

  it('shows a stamina-out banner with the survival % when survival is below the threshold', async () => {
    const vacuum = vi.fn(async () => ({
      mean: 0, median: 0, min: 0, max: 0, nsamples: 30, results: [],
      aFirstPlaceRate: 0, bFirstPlaceRate: 0, aStaminaSurvival: 0.5, bStaminaSurvival: 0.5,
      aFullSpurtRate: 0, bFullSpurtRate: 0, aFinalHp: [], bFinalHp: [],
    }));
    render(<SkillChartPanel courseId="10906" plan={basePlan} onChange={vi.fn()} deps={{ skillDelta: h.skillDelta, vacuum }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Run' }));
    expect(await screen.findByText(/survives only 50% of runs/i)).toBeInTheDocument();
  });

  it('hides the banner when the user lowers the threshold below the survival rate (no re-run)', async () => {
    const vacuum = vi.fn(async () => ({
      mean: 0, median: 0, min: 0, max: 0, nsamples: 30, results: [],
      aFirstPlaceRate: 0, bFirstPlaceRate: 0, aStaminaSurvival: 0.5, bStaminaSurvival: 0.5,
      aFullSpurtRate: 0, bFullSpurtRate: 0, aFinalHp: [], bFinalHp: [],
    }));
    render(<SkillChartPanel courseId="10906" plan={basePlan} onChange={vi.fn()} deps={{ skillDelta: h.skillDelta, vacuum }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Run' }));
    await screen.findByText(/survives only 50% of runs/i);
    const calls = vacuum.mock.calls.length;
    fireEvent.change(screen.getByLabelText('Stamina warning threshold (%)'), { target: { value: '40' } });
    expect(screen.queryByText(/survives only 50% of runs/i)).not.toBeInTheDocument();
    expect(vacuum.mock.calls.length).toBe(calls); // pure re-evaluate, no extra probe
  });
});
