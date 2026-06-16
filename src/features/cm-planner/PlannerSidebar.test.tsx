import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import type { CmPlan } from '@/core/types';

const h = vi.hoisted(() => {
  const skill = (
    skillId: string,
    nameEn: string,
    rarity: 'white' | 'gold' | 'unique',
    iconId: string,
    conditions: string,
    baseSpCost = 0,
  ) => ({
    skillId,
    nameEn,
    nameJp: '',
    baseSpCost,
    rarity,
    iconId,
    conditions,
    server: 'global',
    dataVersion: 't',
  });
  const skills = [
    skill('u', 'Victory Cheer!', 'unique', '20013', 'phase>=2&order>=1'),
    skill('v', 'Silent Speedline', 'unique', '20013', 'corner!=0'),
    skill('a', 'Escape Artist', 'white', '20011', 'distance_rate>=50', 240),
    skill('b', 'Professor of Curvature', 'gold', '20012', 'corner_random==1', 160),
  ];
  const umas = [
    {
      umaId: '100101',
      charaId: '1001',
      nameEn: 'Special Week',
      epithet: 'Special Dreamer',
      server: 'global',
      dataVersion: 't',
    },
    {
      umaId: '100201',
      charaId: '1002',
      nameEn: 'Silence Suzuka',
      epithet: 'Innocent Silence',
      server: 'global',
      dataVersion: 't',
    },
  ];
  const skillById = new Map(skills.map((s) => [s.skillId, s]));
  const umaById = new Map(umas.map((u) => [u.umaId, u]));
  const uniqueByUmaId = new Map([
    ['100101', { skillId: 'u', nameEn: 'Victory Cheer!', iconId: '20013', rarity: 'unique', baseSpCost: 0, conditions: 'phase>=2&order>=1' }],
    ['100201', { skillId: 'v', nameEn: 'Silent Speedline', iconId: '20013', rarity: 'unique', baseSpCost: 0, conditions: 'corner!=0' }],
  ]);
  const plan = {
    id: 'p',
    name: 'Plan 2 / CM15 / Special',
    planNumber: 2,
    cmRef: { cmId: 'CM15', cmNumber: 15, courseId: '10906', surface: 'turf', distance: 2200 },
    umaId: '100101',
    uniqueSkillId: 'u',
    role: 'ace',
    strategy: 'front',
    statProfile: { stats: { spd: 1200, sta: 650, pow: 900, gut: 400, wit: 600 }, mood: 2 },
    sparkGoals: { pink: [], blue: {} },
    wishlist: [{ skillId: 'a', priority: 1, source: 'targeted' }],
    lockedDeckSlots: [],
    parents: {},
    patch: { version: 't' },
    server: 'global',
    dataVersion: 't',
  };
  return {
    skills,
    skillById,
    umas,
    umaById,
    uniqueByUmaId,
    plan,
    setPlan: vi.fn(),
    save: vi.fn(async () => undefined),
    loadUniqueSkillByUmaId: vi.fn(async () => uniqueByUmaId),
    loadSkillTechnicalDetail: vi.fn(async (skillId: string) => {
      const summary = uniqueByUmaId.get('100101')?.skillId === skillId
        ? uniqueByUmaId.get('100101')
        : uniqueByUmaId.get('100201')?.skillId === skillId
          ? uniqueByUmaId.get('100201')
          : undefined;
      const record = skillById.get(skillId);
      return {
        summary: summary ?? {
          skillId,
          nameEn: record?.nameEn ?? skillId,
          iconId: record?.iconId ?? '',
          rarity: record?.rarity ?? 'white',
          baseSpCost: record?.baseSpCost ?? 0,
          conditions: record?.conditions ?? '',
        },
        alternatives: [
          {
            precondition: '',
            condition: record?.conditions ?? 'phase>=2',
            baseDuration: 50000,
            cooldownTime: 5000000,
            effects: [{ type: 27, modifier: 2500, target: 1 }],
          },
        ],
        sources: [],
      };
    }),
  };
});

vi.mock('@/features/data/gameData', () => ({
  useGameData: () => ({
    status: 'ready',
    skills: h.skills,
    skillById: h.skillById,
    umas: h.umas,
    umaById: h.umaById,
    iconManifest: null,
  }),
}));

vi.mock('./skillTechnicalDetails', () => ({
  loadUniqueSkillByUmaId: h.loadUniqueSkillByUmaId,
  loadSkillTechnicalDetail: h.loadSkillTechnicalDetail,
  skillRecordToSummary: (skill: {
    skillId: string;
    nameEn: string;
    iconId: string;
    rarity: 'white' | 'gold' | 'unique' | 'inherited_unique';
    baseSpCost: number;
    conditions: string;
  }) => ({
    skillId: skill.skillId,
    nameEn: skill.nameEn,
    iconId: skill.iconId,
    rarity: skill.rarity,
    baseSpCost: skill.baseSpCost,
    conditions: skill.conditions,
  }),
}));

import { PlannerSidebar } from './PlannerSidebar';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderSidebar(plan: CmPlan = h.plan as CmPlan) {
  return render(<PlannerSidebar plan={plan} onChange={h.setPlan} onSave={h.save} />);
}

async function waitForUniqueMap() {
  await waitFor(() => expect(h.loadUniqueSkillByUmaId).toHaveBeenCalledTimes(1));
  const result = h.loadUniqueSkillByUmaId.mock.results[0];
  if (result?.type === 'return') {
    await act(async () => {
      await result.value;
    });
  }
}

describe('PlannerSidebar', () => {
  it('selects an uma and writes the matching native unique skill', async () => {
    const user = userEvent.setup();
    renderSidebar();
    await waitForUniqueMap();

    await user.clear(screen.getByLabelText('Search uma or unique skill'));
    await user.type(screen.getByLabelText('Search uma or unique skill'), 'speedline');
    await user.click(await screen.findByRole('button', { name: /Silence Suzuka.*Silent Speedline/i }));

    expect(h.setPlan).toHaveBeenCalledWith(
      expect.objectContaining({ umaId: '100201', uniqueSkillId: 'v' }),
    );
  });

  it('selects an uma with arrow keys and Enter', async () => {
    const user = userEvent.setup();
    renderSidebar();
    await waitForUniqueMap();

    const input = screen.getByLabelText('Search uma or unique skill');
    await user.clear(input);
    await user.type(input, 's');
    await user.keyboard('{ArrowDown}{Enter}');

    expect(h.setPlan).toHaveBeenCalledWith(
      expect.objectContaining({ umaId: '100201', uniqueSkillId: 'v' }),
    );
  });

  it('shows the displayed native unique without cost or fixed controls', async () => {
    renderSidebar();
    await screen.findByText('Victory Cheer!');

    expect(screen.queryByText('fixed')).not.toBeInTheDocument();
    expect(screen.queryByText('SP 0')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add Victory Cheer! to wishlist/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Priority/i })).not.toBeInTheDocument();
  });

  it('auto-generates the plan name from current planner fields', async () => {
    const user = userEvent.setup();
    renderSidebar();

    await user.click(screen.getByRole('button', { name: 'Auto-generate' }));

    expect(h.setPlan).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Plan 2 / CM15 / Special Week / Ace / Front' }),
    );
  });

  it('prefills current CM aptitude targets while leaving unrelated aptitudes open', () => {
    renderSidebar();

    expect(screen.getByLabelText('Turf target aptitude')).toHaveValue('A');
    expect(screen.getByLabelText('Medium target aptitude')).toHaveValue('S');
    expect(screen.getByLabelText('Strategy')).toHaveValue('front');
    expect(screen.getByLabelText('Strategy target aptitude')).toHaveValue('A');
    expect(screen.queryByLabelText('Front Runner target aptitude')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Pace Chaser target aptitude')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Dirt target aptitude')).toHaveValue('');
    expect(screen.getAllByRole('option', { name: 'A/S' }).length).toBeGreaterThan(0);
  });

  it('stores an explicit aptitude target for a non-current aptitude', async () => {
    const user = userEvent.setup();
    renderSidebar();

    await user.selectOptions(screen.getByLabelText('Dirt target aptitude'), 'B');

    expect(h.setPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        sparkGoals: {
          blue: {},
          pink: expect.arrayContaining([
            { aptKey: { kind: 'surface', key: 'dirt' }, target: 'B' },
          ]),
        },
      }),
    );
  });

  it('changes the selected strategy and clears other strategy aptitude targets', async () => {
    const user = userEvent.setup();
    renderSidebar({
      ...(h.plan as CmPlan),
      sparkGoals: {
        blue: {},
        pink: [
          { aptKey: { kind: 'strategy', key: 'front' }, target: 'S' },
          { aptKey: { kind: 'strategy', key: 'late' }, target: 'B' },
          { aptKey: { kind: 'surface', key: 'turf' }, target: 'A' },
        ],
      },
    });

    await user.selectOptions(screen.getByLabelText('Strategy'), 'pace');

    const next = h.setPlan.mock.lastCall![0] as CmPlan;
    expect(next.strategy).toBe('pace');
    expect(next.sparkGoals.pink).toContainEqual({ aptKey: { kind: 'strategy', key: 'pace' }, target: 'S' });
    expect(next.sparkGoals.pink).toContainEqual({ aptKey: { kind: 'surface', key: 'turf' }, target: 'A' });
    expect(next.sparkGoals.pink.filter((goal) => goal.aptKey.kind === 'strategy')).toHaveLength(1);
  });

  it('adds a searched skill to the wishlist and can remove an existing skill', async () => {
    const user = userEvent.setup();
    renderSidebar();

    await user.type(screen.getByLabelText('Search skills by name'), 'professor');
    await user.click(screen.getByRole('button', { name: /Professor of Curvature/i }));

    expect(h.setPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        wishlist: expect.arrayContaining([expect.objectContaining({ skillId: 'b' })]),
      }),
    );

    await user.click(screen.getByRole('button', { name: /Remove Escape Artist/i }));
    expect(h.setPlan).toHaveBeenCalledWith(
      expect.objectContaining({ wishlist: [] }),
    );
  });

  it('flushes the pending save when Save is clicked', async () => {
    const user = userEvent.setup();
    renderSidebar();

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(h.save).toHaveBeenCalledTimes(1);
    await screen.findByText('saved');
  });

  it('expands skill technical detail with conditions and raw effects', async () => {
    const user = userEvent.setup();
    renderSidebar();

    await user.click(screen.getByText('Victory Cheer!'));

    expect(await screen.findByText('Alternative 1')).toBeInTheDocument();
    expect(screen.getAllByText('phase>=2 &').length).toBeGreaterThan(0);
    expect(screen.getAllByText('order>=1').length).toBeGreaterThan(0);
    expect(screen.getByText('type 27')).toBeInTheDocument();
    expect(screen.getByText('modifier 2500')).toBeInTheDocument();
    expect(screen.getByText('target 1')).toBeInTheDocument();
  });
});
