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
    conditions: over.conditions ?? '', server: 'global', dataVersion: 't', ...over,
  });
  // Accel skill A: a simple positional accel skill
  const accelA = mk({ skillId: 'accelA', nameEn: 'Accel A', rarity: 'white', baseSpCost: 90, conditions: 'order_rate<=40' });
  // Accel skill B: a wit-gated accel skill (all_corner_random)
  const accelB = mk({ skillId: 'accelB', nameEn: 'Accel B', rarity: 'gold', baseSpCost: 170, conditions: 'all_corner_random==1' });
  // Non-accel skill C: speed skill, should be excluded
  const speedC = mk({ skillId: 'speedC', nameEn: 'Speed C', rarity: 'white', baseSpCost: 120, conditions: '' });

  const skills = [accelA, accelB, speedC];
  const skillById = new Map(skills.map((s) => [s.skillId, s]));

  const bs = (mean: number): BashinStats => ({ mean, median: mean, min: mean, max: mean, nsamples: 30, results: [] });
  const L: Record<string, number> = { accelA: 1.5, accelB: 2.0, speedC: 1.0 };
  const skillDelta = vi.fn(async (_b: SimBuild, _r: unknown, id: string) => bs(L[id] ?? 0.5));

  const defaultGameData = {
    status: 'ready', skills, skillById, sparkRates: {}, umas: [], umaById: new Map(),
    iconManifest: null, timeline: [] as unknown[],
  };
  const useGameData = vi.fn(() => defaultGameData);

  // Default accel IDs: only A and B are accel, C is excluded
  const defaultAccelIds = new Set<string>(['accelA', 'accelB']);
  // Effect values are RAW engine modifiers (large); the table shows them ÷100 as integers.
  // A = 2000 → "20", B = 3500 → "35".
  const defaultEffectValues = new Map<string, number>([['accelA', 2000], ['accelB', 3500]]);

  const loadAccelSkillIds = vi.fn(async () => defaultAccelIds);
  const loadSkillEffectValues = vi.fn(async () => defaultEffectValues);

  return { skills, skillById, skillDelta, useGameData, defaultGameData, loadAccelSkillIds, loadSkillEffectValues, defaultAccelIds, defaultEffectValues };
});

vi.mock('@/features/data/gameData', () => ({ useGameData: h.useGameData }));
vi.mock('./skillTechnicalDetails', () => ({
  loadSkillTechnicalDetail: vi.fn(async () => null),
  skillRecordToSummary: (s: unknown) => s,
  loadAccelSkillIds: h.loadAccelSkillIds,
  loadSkillEffectValues: h.loadSkillEffectValues,
}));
vi.mock('@/core/simBuild', () => ({
  planToSimBuild: () => ({ stats: { spd: 1200 }, strategy: 'end' }),
  chartBaselineBuild: () => ({ stats: { spd: 1200 }, strategy: 'end', skills: [] }),
}));

import { AccelChartPanel } from './AccelChartPanel';

const basePlan = {
  server: 'global',
  strategy: 'end',
  cmRef: { kind: 'cm', cmId: 'CM15', cmNumber: 15, courseId: '10906', surface: 'turf', distance: 2200 },
  statProfile: { stats: { spd: 1200, sta: 1000, pow: 1000, gut: 1000, wit: 1000 }, mood: 2 },
  wishlist: [],
} as unknown as CmPlan;

const list = () => screen.getByLabelText('Accel skill ranking');
const rowTexts = () => within(list()).getAllByRole('listitem').map((li) => li.textContent ?? '');

/** Renders AccelChartPanel, clicks Run, and waits until the row count settles. */
async function runFull(opts: { plan?: typeof basePlan; onChange?: ReturnType<typeof vi.fn> } = {}) {
  const onChange = opts.onChange ?? vi.fn();
  const plan = opts.plan ?? basePlan;
  render(
    <AccelChartPanel
      courseId="10906"
      plan={plan}
      onChange={onChange}
      deps={{
        skillDelta: h.skillDelta,
        loadAccelSkillIds: h.loadAccelSkillIds,
        loadSkillEffectValues: h.loadSkillEffectValues,
      }}
    />,
  );
  // Wait for the async accel ids to load (chart becomes non-empty after load)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Run' })).toBeInTheDocument());
  await userEvent.click(screen.getByRole('button', { name: 'Run' }));
  // 2 accel skills: accelA (white) and accelB (gold)
  await waitFor(() => expect(within(list()).getAllByRole('listitem')).toHaveLength(2));
  return onChange;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  localStorage.clear();
  h.useGameData.mockReturnValue(h.defaultGameData);
  h.loadAccelSkillIds.mockResolvedValue(h.defaultAccelIds);
  h.loadSkillEffectValues.mockResolvedValue(h.defaultEffectValues);
});

describe('AccelChartPanel', () => {
  it('lists only acceleration skills and excludes non-accel ids', async () => {
    await runFull();
    const texts = rowTexts();
    // Accel A and B are listed
    expect(texts.some((t) => t.includes('Accel A'))).toBe(true);
    expect(texts.some((t) => t.includes('Accel B'))).toBe(true);
    // Speed C (non-accel) is excluded
    expect(texts.some((t) => t.includes('Speed C'))).toBe(false);
    // skillDelta is only called for accel skills
    const calledIds = h.skillDelta.mock.calls.map((c) => c[2]);
    expect(calledIds).toContain('accelA');
    expect(calledIds).toContain('accelB');
    expect(calledIds).not.toContain('speedC');
  });

  it('renders positioning, wit-check, and effect-value columns', async () => {
    await runFull();
    const rows = within(list()).getAllByRole('listitem');

    // accelB (higher L) sorts first; accelA second
    // Find the row for Accel A (conditions: order_rate<=40 → '≤40% back')
    const rowA = rows.find((r) => r.textContent?.includes('Accel A'))!;
    expect(rowA).toBeDefined();
    // Position cell: describePositioning('order_rate<=40') = '≤40% back'
    expect(rowA.textContent).toContain('≤40% back');
    // Wit cell: no random condition → '✗'
    expect(rowA.textContent).toContain('✗');
    // Effect value: 2000 ÷ 100 = 20
    expect(rowA.textContent).toContain('20');

    // Find the row for Accel B (conditions: all_corner_random==1 → wit check required)
    const rowB = rows.find((r) => r.textContent?.includes('Accel B'))!;
    expect(rowB).toBeDefined();
    // Wit cell: witCheckPassChance(1000) = round(max(100-9000/1000,20)) = round(max(91,20)) = 91
    expect(rowB.textContent).toContain('91%');
    // Effect value: 3500 ÷ 100 = 35
    expect(rowB.textContent).toContain('35');
  });

  it('sort by effect value orders rows by magnitude', async () => {
    await runFull();
    // Default sort is L. Click Effect header to sort by effect value descending.
    await userEvent.click(screen.getByRole('button', { name: /effect/i }));
    const rows = within(list()).getAllByRole('listitem');
    // accelB effect=0.35 > accelA effect=0.20, so B should be first
    expect(rows[0]).toHaveTextContent('Accel B');
    expect(rows[1]).toHaveTextContent('Accel A');
  });

  it('shows the in-build chip for a targeted accel skill', async () => {
    const targetedPlan = {
      ...basePlan,
      wishlist: [{ skillId: 'accelA', priority: 1, source: 'targeted', projectedL: 1.23 }],
    } as typeof basePlan;
    await runFull({ plan: targetedPlan });
    // accelA is in the wishlist — it should appear as in-build row
    const inBuildBadges = within(list()).getAllByText((_t, el) => el?.classList.contains('cmp-inbuild') ?? false);
    expect(inBuildBadges).toHaveLength(1);
    const row = inBuildBadges[0]!.closest('li')!;
    expect(within(row).getByText('Accel A')).toBeInTheDocument();
    // The chip lives in the skill plate now; the stamped L renders in the L column of the same row.
    expect(row.querySelector('.cmp-uma-num')).toHaveTextContent(/\+1\.23/);
  });
});
