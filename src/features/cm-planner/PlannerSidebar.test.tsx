import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import type { CmPlan } from '@/core/types';

const h = vi.hoisted(() => {
  const skill = (
    skillId: string,
    nameEn: string,
    rarity: 'white' | 'gold' | 'unique' | 'inherited_unique',
    iconId: string,
    conditions: string,
    baseSpCost = 0,
    variantSkillIds?: string[],
    prereqSkillId?: string,
  ) => ({
    skillId,
    nameEn,
    nameJp: '',
    baseSpCost,
    rarity,
    iconId,
    ...(prereqSkillId ? { prereqSkillId } : {}),
    ...(variantSkillIds ? { variantSkillIds } : {}),
    conditions,
    server: 'global',
    dataVersion: 't',
  });
  const skills = [
    skill('u', 'Victory Cheer!', 'unique', '20013', 'phase>=2&order>=1'),
    skill('v', 'Silent Speedline', 'unique', '20013', 'corner!=0'),
    skill('a', 'Escape Artist', 'white', '20011', 'distance_rate>=50', 240),
    skill('200011', 'Right-Handed ◎', 'white', '10011', 'rotation==1', 110, ['200012', '200013', '200014']),
    skill('200012', 'Right-Handed ○', 'white', '10011', 'rotation==1', 90, ['200011', '200013', '200014']),
    skill('200013', 'Right-Handed ×', 'white', '10014', 'rotation==1', 50, ['200011', '200012', '200014']),
    skill('200014', 'Right-Handed Demon', 'gold', '10012', 'rotation==1', 130, ['200011', '200012', '200013'], '200012'),
    skill('200331', 'Professor of Curvature', 'gold', '20012', 'all_corner_random==1', 180, ['200332', '200333'], '200332'),
    skill('200332', 'Corner Adept ○', 'white', '20011', 'all_corner_random==1', 180, ['200331', '200333']),
    skill('200333', 'Corner Adept ×', 'white', '20014', 'all_corner_random==1', 100, ['200331', '200332']),
    skill('201472', 'I Can See Right Through You', 'white', '20011', 'running_style==4&is_move_lane==1', 110),
    skill('110061', 'Festive Miracle', 'unique', '20013', 'activate_count_heal>=3&distance_rate>=50'),
    skill('910061', 'Festive Miracle', 'inherited_unique', '20011', 'activate_count_heal>=3&distance_rate>=50', 200),
  ];
  const umas = [
    {
      umaId: '100101',
      charaId: '1001',
      nameEn: 'Special Week',
      epithet: 'Special Dreamer',
      statGrowth: { spd: 0, sta: 20, pow: 0, gut: 0, wit: 10 },
      baseAptitudes: {
        surface: { turf: 'A', dirt: 'G' },
        distance: { short: 'F', mile: 'C', medium: 'A', long: 'A' },
        strategy: { front: 'G', pace: 'A', late: 'A', end: 'C' },
      },
      server: 'global',
      dataVersion: 't',
    },
    {
      umaId: '100201',
      charaId: '1002',
      nameEn: 'Silence Suzuka',
      epithet: 'Innocent Silence',
      statGrowth: { spd: 20, sta: 0, pow: 0, gut: 0, wit: 10 },
      baseAptitudes: {
        surface: { turf: 'A', dirt: 'G' },
        distance: { short: 'D', mile: 'A', medium: 'A', long: 'E' },
        strategy: { front: 'A', pace: 'C', late: 'E', end: 'G' },
      },
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
            effects: [
              { type: 27, modifier: 2500, target: 1, valueUsage: 1, valueLevelUsage: 1 },
              { type: 31, modifier: 2000, target: 1, valueUsage: 1, valueLevelUsage: 1 },
              { type: 8, modifier: 50000, target: 1, valueUsage: 1, valueLevelUsage: 1 },
            ],
          },
        ],
        sources: [{ name: 'Special Week', outfit: '[Special Dreamer]' }],
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
    expect(screen.getByLabelText('Required pink spark summary')).toHaveTextContent('Medium ★1');
    expect(screen.getByLabelText('Required pink spark summary')).toHaveTextContent('Front Runner ★6');
  });

  it('shows selected uma stat growth under the stat inputs', () => {
    renderSidebar();

    expect(screen.getByText('+20%')).toBeInTheDocument();
    expect(screen.getByText('+10%')).toBeInTheDocument();
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
        wishlist: expect.arrayContaining([expect.objectContaining({ skillId: '200331' })]),
      }),
    );

    await user.click(screen.getByRole('button', { name: /Remove Escape Artist/i }));
    expect(h.setPlan).toHaveBeenCalledWith(
      expect.objectContaining({ wishlist: [] }),
    );
  });

  it('clears the wishlist from the section header', async () => {
    const user = userEvent.setup();
    renderSidebar();

    await user.click(screen.getByRole('button', { name: 'Clear' }));

    expect(h.setPlan).toHaveBeenCalledWith(expect.objectContaining({ wishlist: [] }));
  });

  it('only offers inherited uniques in wishlist search results', async () => {
    const user = userEvent.setup();
    renderSidebar({ ...(h.plan as CmPlan), wishlist: [] });

    await user.type(screen.getByLabelText('Search skills by name'), 'festive');

    const festiveResults = await screen.findAllByRole('button', { name: /Festive Miracle/i });
    expect(festiveResults).toHaveLength(1);
    expect(festiveResults[0]).toHaveTextContent('200 SP');
    expect(festiveResults[0]).toHaveClass('cmp-skill-rarity-inherited_unique');
    expect(screen.queryByText('0 SP')).not.toBeInTheDocument();
  });

  it('displays inherited unique details when a native unique is already in the wishlist', () => {
    renderSidebar({
      ...(h.plan as CmPlan),
      wishlist: [{ skillId: '110061', priority: 1, source: 'targeted' }],
    });

    const festive = screen.getByText('Festive Miracle');
    expect(festive.closest('.cmp-skill-detail')).toHaveClass('cmp-skill-rarity-inherited_unique');
    expect(screen.getByText('SP 200')).toBeInTheDocument();
    expect(screen.queryByText('SP 0')).not.toBeInTheDocument();
    expect(screen.getByText(/base SP/i)).toHaveTextContent('200');
  });

  it('hides the inherited version of the current native unique from wishlist search', async () => {
    const user = userEvent.setup();
    renderSidebar({
      ...(h.plan as CmPlan),
      uniqueSkillId: '110061',
      wishlist: [],
    });

    await user.type(screen.getByLabelText('Search skills by name'), 'festive');

    expect(screen.queryByRole('button', { name: /Festive Miracle/i })).not.toBeInTheDocument();
    expect(screen.getByText('No matching skills.')).toBeInTheDocument();
  });

  it('replaces a lower selected variant when a higher variant is picked', async () => {
    const user = userEvent.setup();
    renderSidebar({
      ...(h.plan as CmPlan),
      wishlist: [{ skillId: '200012', priority: 2, source: 'targeted' }],
    });

    await user.type(screen.getByLabelText('Search skills by name'), 'right-handed');
    const results = within(screen.getByRole('list', { name: 'Skill search results' }));
    expect(results.queryByRole('button', { name: /Right-Handed ○/i })).not.toBeInTheDocument();
    expect(results.queryByRole('button', { name: /Right-Handed ×/i })).not.toBeInTheDocument();
    await user.click(results.getByRole('button', { name: /Right-Handed Demon/i }));

    const next = h.setPlan.mock.lastCall![0] as CmPlan;
    expect(next.wishlist).toHaveLength(1);
    expect(next.wishlist[0]).toMatchObject({ skillId: '200014', priority: 2 });
  });

  it('does not offer lower variants when a higher one is already selected', async () => {
    const user = userEvent.setup();
    renderSidebar({
      ...(h.plan as CmPlan),
      wishlist: [{ skillId: '200014', priority: 1, source: 'targeted' }],
    });

    await user.type(screen.getByLabelText('Search skills by name'), 'right-handed');
    const results = within(screen.getByRole('list', { name: 'Skill search results' }));

    expect(results.queryByRole('button', { name: /Right-Handed ○/i })).not.toBeInTheDocument();
    expect(results.queryByRole('button', { name: /Right-Handed ◎/i })).not.toBeInTheDocument();
    expect(results.queryByRole('button', { name: /Right-Handed Demon/i })).not.toBeInTheDocument();
    expect(screen.getByText('No matching skills.')).toBeInTheDocument();
  });

  it('lets wishlist rows switch between skill variants', async () => {
    const user = userEvent.setup();
    renderSidebar({
      ...(h.plan as CmPlan),
      wishlist: [{ skillId: '200332', priority: 1, source: 'targeted' }],
    });

    await user.click(screen.getByText('Corner Adept ○', { selector: 'span.cmp-skill-name' }));
    await user.selectOptions(screen.getByLabelText('Skill variant for Corner Adept ○'), '200333');

    const next = h.setPlan.mock.lastCall![0] as CmPlan;
    expect(next.wishlist).toHaveLength(1);
    expect(next.wishlist[0]).toMatchObject({ skillId: '200333', priority: 1 });
  });

  it('flushes the pending save when Save is clicked', async () => {
    const user = userEvent.setup();
    renderSidebar();

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(h.save).toHaveBeenCalledTimes(1);
    await screen.findByText('saved');
  });

  it('expands skill technical detail with conditions and readable effects', async () => {
    const user = userEvent.setup();
    renderSidebar();

    await user.click(screen.getByText('Victory Cheer!'));

    expect(await screen.findByText('Activation route 1')).toBeInTheDocument();
    expect(screen.getAllByText('phase>=2 &').length).toBeGreaterThan(0);
    expect(screen.getAllByText('order>=1').length).toBeGreaterThan(0);
    expect(screen.queryByText('Trigger')).not.toBeInTheDocument();
    expect(screen.queryByText('1 route')).not.toBeInTheDocument();
    expect(screen.queryByText('3 effects')).not.toBeInTheDocument();
    expect(screen.queryByText('Sources')).not.toBeInTheDocument();
    expect(screen.queryByText('Special Week [Special Dreamer]')).not.toBeInTheDocument();
    expect(screen.getByText('Target speed')).toBeInTheDocument();
    expect(screen.getByText('+0.25m/s')).toBeInTheDocument();
    expect(screen.getByText('+0.25m/s')).toHaveClass('is-positive');
    expect(screen.getByText('Acceleration')).toBeInTheDocument();
    expect(screen.getByText('+0.2m/s²')).toBeInTheDocument();
    expect(screen.getByText('+0.2m/s²')).toHaveClass('is-positive');
    expect(screen.getByText('Field of view')).toBeInTheDocument();
    expect(screen.getByText('+5')).toHaveClass('is-positive');
    expect(screen.getByText('Target speed').closest('.cmp-effect-chip')).toHaveClass('is-target-speed');
    expect(screen.getByText('Acceleration').closest('.cmp-effect-chip')).toHaveClass('is-acceleration');
    expect(screen.queryByText('modifier 2500')).not.toBeInTheDocument();
    expect(screen.queryByText('target 1')).not.toBeInTheDocument();
  });

  it('marks harmful random recovery effects as debuffs', async () => {
    const user = userEvent.setup();
    h.loadSkillTechnicalDetail.mockResolvedValueOnce({
      summary: {
        skillId: 'u',
        nameEn: 'Victory Cheer!',
        iconId: '20013',
        rarity: 'unique',
        baseSpCost: 0,
        conditions: 'phase>=2&order>=1',
      },
      alternatives: [
        {
          precondition: '',
          condition: 'phase>=2&order>=1',
          baseDuration: 50000,
          cooldownTime: 5000000,
          effects: [{ type: 9, modifier: -10000, target: 1, valueUsage: 8, valueLevelUsage: 1 }],
        },
      ],
      sources: [],
    });
    renderSidebar();

    await user.click(screen.getByText('Victory Cheer!'));

    expect(await screen.findByText('HP drain')).toBeInTheDocument();
    expect(screen.getByText('60% none / 30% -2% / 10% -4%')).toBeInTheDocument();
    expect(screen.getByText('60% none / 30% -2% / 10% -4%')).toHaveClass('is-negative');
    expect(screen.getByText('HP drain').closest('.cmp-effect-chip')).toHaveClass('is-debuff');
  });

  it('shows an honest empty state when runtime skill detail is missing', async () => {
    const user = userEvent.setup();
    h.loadSkillTechnicalDetail.mockResolvedValueOnce(null as never);
    renderSidebar();

    await user.click(screen.getByText('Victory Cheer!'));

    expect(await screen.findByText('No runtime technical detail was found for this skill.')).toBeInTheDocument();
    expect(screen.queryByText('Loading technical detail...')).not.toBeInTheDocument();
  });
});
