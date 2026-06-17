import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const h = vi.hoisted(() => {
  const skill = (skillId: string, nameEn: string, conditions: string) => ({
    skillId,
    nameEn,
    nameJp: '',
    baseSpCost: 0,
    rarity: 'white',
    iconId: '',
    conditions,
    server: 'global',
    dataVersion: 't',
  });
  const skillById = new Map<string, ReturnType<typeof skill>>([
    ['u', skill('u', 'Victory Cheer!', 'phase>=2')],
    ['a', skill('a', 'Escape Artist', 'distance_rate>=50')],
  ]);
  const skills = [...skillById.values()];
  const umas = [
    {
      umaId: '100101',
      charaId: '1001',
      nameEn: 'Special Week',
      epithet: 'Special Dreamer',
      server: 'global',
      dataVersion: 't',
    },
  ];
  const courseData = {
    courseId: 10906,
    distance: 2200,
    surface: 1,
    turn: 1,
    corners: [
      { start: 520, length: 190 },
      { start: 710, length: 190 },
      { start: 1250, length: 300 },
      { start: 1550, length: 300 },
    ],
    straights: [
      { start: 0, end: 520, frontType: 1 },
      { start: 900, end: 1250, frontType: 2 },
      { start: 1850, end: 2200, frontType: 1 },
    ],
    slopes: [
      { start: 0, length: 290, slope: -10000 },
      { start: 295, length: 125, slope: 20000 },
      { start: 1400, length: 595, slope: -10000 },
      { start: 2000, length: 125, slope: 20000 },
    ],
  };
  const plan = {
    id: 'p',
    name: 'p',
    planNumber: 1,
    cmRef: { cmId: 'CM15', cmNumber: 15, courseId: '10906', surface: 'turf', distance: 2200 },
    umaId: '100101',
    uniqueSkillId: 'u',
    role: 'ace',
    strategy: 'front',
    statProfile: { stats: { spd: 1200, sta: 650, pow: 900, gut: 400, wit: 600 }, mood: 0 },
    sparkGoals: { pink: [], blue: {} },
    wishlist: [{ skillId: 'a', priority: 1, source: 'targeted' }],
    lockedDeckSlots: [],
    parents: {},
    patch: { version: 't' },
    server: 'global',
    dataVersion: 't',
  };
  const customPlan = {
    ...plan,
    id: 'custom-hanshin',
    name: 'Hanshin Trial',
    planNumber: 2,
    cmRef: {
      cmId: 'CM0',
      cmNumber: 0,
      courseId: '10906',
      surface: 'turf',
      distance: 2200,
      condition: 'soft',
      weather: 'rainy',
      season: 'winter',
    },
    role: 'hybrid',
    strategy: 'late',
  };
  const listPlans = vi.fn(async () => [plan, customPlan]);
  const savedPlans = [plan, customPlan];
  const selectPlan = vi.fn(async () => undefined);
  const deleteSavedPlan = vi.fn(async () => undefined);
  const saveCurrentPlan = vi.fn(async () => undefined);
  const saveCurrentPlanAs = vi.fn(async () => undefined);
  const setDraftPlan = vi.fn();
  const setAutoSave = vi.fn();
  const setPlan = vi.fn();
  const getSetting = vi.fn(async () => true);
  const setSetting = vi.fn(async () => undefined);
  return {
    skillById,
    skills,
    umas,
    umaById: new Map(umas.map((u) => [u.umaId, u])),
    courseData,
    plan,
    customPlan,
    savedPlans,
    listPlans,
    selectPlan,
    deleteSavedPlan,
    saveCurrentPlan,
    saveCurrentPlanAs,
    setDraftPlan,
    setAutoSave,
    setPlan,
    getSetting,
    setSetting,
  };
});

// The track + race-setup lazy-import the engine; mock them so the page test stays in jsdom.
vi.mock('@/sim/courseData', () => ({ courseDataFor: () => h.courseData }));
vi.mock('@/sim/courseCatalog', () => ({
  courseCatalog: () => [
    {
      courseId: '10906',
      raceTrackId: 10009,
      surface: 'turf',
      distance: 2200,
      distanceClass: 'medium',
      course: 2,
      turn: 1,
    },
  ],
}));
vi.mock('@/db', () => ({
  listPlans: h.listPlans,
  getSetting: h.getSetting,
  setSetting: h.setSetting,
}));
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
vi.mock('@/app/ActivePlanContext', () => ({
  useActivePlan: () => ({
    plan: h.plan,
    savedPlans: h.savedPlans,
    autoSave: false,
    isSaved: true,
    setAutoSave: h.setAutoSave,
    setPlan: h.setPlan,
    selectPlan: h.selectPlan,
    deleteSavedPlan: h.deleteSavedPlan,
    setDraftPlan: h.setDraftPlan,
    saveCurrentPlan: h.saveCurrentPlan,
    saveCurrentPlanAs: h.saveCurrentPlanAs,
    flushPendingSave: h.saveCurrentPlan,
    loadError: null,
  }),
}));
vi.mock('./skillTechnicalDetails', () => ({
  loadUniqueSkillByUmaId: vi.fn(async () => new Map()),
  loadSkillTechnicalDetail: vi.fn(async () => null),
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

import { CmPlannerPage } from './CmPlannerPage';

afterEach(cleanup);
afterEach(() => {
  h.listPlans.mockClear();
  h.selectPlan.mockClear();
  h.deleteSavedPlan.mockClear();
  h.saveCurrentPlan.mockClear();
  h.saveCurrentPlanAs.mockClear();
  h.setDraftPlan.mockClear();
  h.setAutoSave.mockClear();
  h.setPlan.mockClear();
  h.getSetting.mockClear();
  h.setSetting.mockClear();
});

describe('CmPlannerPage', () => {
  it('defaults to the CM15 preset in the race-setup chooser', () => {
    render(<CmPlannerPage />);
    expect(screen.getByRole('option', { name: /CM15.*Cancer Cup/ })).toBeInTheDocument();
  });

  it('renders the section 0 track for the selected course (CM15)', async () => {
    render(<CmPlannerPage />);
    await waitFor(() => expect(document.querySelector('#race-phases')).toBeInTheDocument());
  });

  it('shows CM15 conditions in the readout (Hanshin, inner layout)', () => {
    render(<CmPlannerPage />);
    const cond = within(screen.getByLabelText('Race conditions'));
    expect(cond.getByText('Hanshin')).toBeInTheDocument();
    expect(cond.getByText('2,200m (Inner)')).toBeInTheDocument();
  });

  it('shows saved plans grouped under the plan inventory card', async () => {
    render(<CmPlannerPage />);
    const inventory = screen.getByLabelText('Plan Inventory');
    expect(inventory).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /CM15/ })).toBeInTheDocument();
    expect(await within(inventory).findByText('p')).toBeInTheDocument();
    expect(await within(inventory).findByText('Hanshin Trial')).toBeInTheDocument();
    expect(within(inventory).getAllByText('1200 / 650 / 900 / 400 / 600')).toHaveLength(2);
    expect(within(inventory).getByText('Turf A / Medium S / Front A')).toBeInTheDocument();
    expect(within(inventory).getByText('Turf A / Medium S / Late A')).toBeInTheDocument();
    expect(within(inventory).getAllByRole('button', { name: 'Delete plan' })).toHaveLength(2);
    expect(await within(inventory).findByRole('button', { name: /Hanshin 2,200m \(Inner\)/ })).toBeInTheDocument();
  });

  it('shows and persists the inventory track setup switch', async () => {
    render(<CmPlannerPage />);
    const toggle = screen.getByRole('switch', { name: 'Apply track setup when loading a plan' });
    await waitFor(() => expect(toggle).toBeChecked());

    fireEvent.click(toggle);

    expect(toggle).not.toBeChecked();
    expect(h.setSetting).toHaveBeenCalledWith('cmPlannerInventoryAutoApplyTrack', false);
  });

  it('stores condition, weather, and season when race setup changes', async () => {
    render(<CmPlannerPage />);
    await screen.findByLabelText('Track');

    fireEvent.change(screen.getByLabelText('Ground'), { target: { value: 'soft' } });
    fireEvent.change(screen.getByLabelText('Weather'), { target: { value: 'rainy' } });
    fireEvent.change(screen.getByLabelText('Season'), { target: { value: 'winter' } });

    expect(h.setPlan.mock.calls).toEqual(
      expect.arrayContaining([
        [expect.objectContaining({ cmRef: expect.objectContaining({ condition: 'soft' }) })],
        [expect.objectContaining({ cmRef: expect.objectContaining({ weather: 'rainy' }) })],
        [expect.objectContaining({ cmRef: expect.objectContaining({ season: 'winter' }) })],
      ]),
    );
  });

  it('does not apply track setup just from toggling the setting', async () => {
    render(<CmPlannerPage />);
    const toggle = screen.getByRole('switch', { name: 'Apply track setup when loading a plan' });
    await waitFor(() => expect(toggle).toBeChecked());

    fireEvent.click(toggle);
    fireEvent.click(toggle);

    expect(screen.getByLabelText('Ground')).toHaveValue('good');
    expect(screen.getByLabelText('Season')).toHaveValue('summer');
  });

  it('applies saved condition, weather, and season only when the plan is loaded again', async () => {
    render(<CmPlannerPage />);
    const inventory = screen.getByLabelText('Plan Inventory');
    const savedPlan = await within(inventory).findByRole('button', { name: /Hanshin Trial/ });

    expect(screen.getByLabelText('Ground')).toHaveValue('good');
    fireEvent.click(savedPlan);

    await waitFor(() => expect(screen.getByLabelText('Ground')).toHaveValue('soft'));
    expect(screen.getByLabelText('Weather')).toHaveValue('rainy');
    expect(screen.getByLabelText('Season')).toHaveValue('winter');
  });

  it('shows the active plan JSON in the inventory card', async () => {
    render(<CmPlannerPage />);
    const inventory = screen.getByLabelText('Plan Inventory');
    fireEvent.click(within(inventory).getByText('Active plan JSON'));

    await waitFor(() => expect(within(inventory).getByText(/"cmId": "CM15"/)).toBeInTheDocument());
    expect(within(inventory).getByText(/"wishlist"/)).toBeInTheDocument();
  });

  it('saves and saves-as from the sidebar save row', async () => {
    render(<CmPlannerPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(h.saveCurrentPlan).toHaveBeenCalledTimes(1));
    expect(h.saveCurrentPlan).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'p' }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save as' }));
    await waitFor(() => expect(h.saveCurrentPlanAs).toHaveBeenCalledTimes(1));
    expect(h.saveCurrentPlanAs).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'p' }),
    );
  });

  it('auto-generates the plan name on save only when the name is blank', async () => {
    const originalName = h.plan.name;
    h.plan.name = '';
    try {
      render(<CmPlannerPage />);

      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => expect(h.saveCurrentPlan).toHaveBeenCalledTimes(1));
      expect(h.saveCurrentPlan).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'CM15 / Special Week / Ace / Front' }),
      );
    } finally {
      h.plan.name = originalName;
    }
  });

  it('treats an auto-generated name like a custom name when saving as', async () => {
    const originalName = h.plan.name;
    h.plan.name = 'CM15 / Special Week / Ace / Front';
    try {
      render(<CmPlannerPage />);

      fireEvent.click(screen.getByRole('button', { name: 'Save as' }));

      await waitFor(() => expect(h.saveCurrentPlanAs).toHaveBeenCalledTimes(1));
      expect(h.saveCurrentPlanAs).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'CM15 / Special Week / Ace / Front',
          planNumber: 1,
        }),
      );
    } finally {
      h.plan.name = originalName;
    }
  });

  it('creates a Kitasan default draft for the current track setup', () => {
    render(<CmPlannerPage />);

    fireEvent.click(screen.getByRole('button', { name: 'New' }));

    expect(h.setDraftPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        umaId: '106801',
        name: 'CM15 / Kitasan Black / Ace / Front',
        planNumber: 1,
        uniqueSkillId: '',
        strategy: 'front',
        role: 'ace',
        statProfile: { stats: { spd: 1200, sta: 900, pow: 1000, gut: 600, wit: 1100 }, mood: 2 },
        wishlist: [],
        sparkGoals: {
          blue: {},
          pink: [
            { aptKey: { kind: 'surface', key: 'turf' }, target: 'A' },
            { aptKey: { kind: 'distance', key: 'medium' }, target: 'S' },
            { aptKey: { kind: 'strategy', key: 'front' }, target: 'A' },
          ],
        },
      }),
    );
  });

  it('selects a saved plan from the inventory list', async () => {
    render(<CmPlannerPage />);
    const inventory = screen.getByLabelText('Plan Inventory');
    const savedPlan = await within(inventory).findByRole('button', { name: /Hanshin Trial/ });

    fireEvent.click(savedPlan);

    await waitFor(() => expect(h.selectPlan).toHaveBeenCalledWith('custom-hanshin'));
  });

  it('collapses expanded skill details after loading an inventory plan', async () => {
    render(<CmPlannerPage />);
    const skillDetails = screen.getByText('Victory Cheer!').closest('details');
    expect(skillDetails).not.toBeNull();

    fireEvent.click(within(skillDetails!).getByText('Victory Cheer!'));
    expect(skillDetails).toHaveAttribute('open');

    const inventory = screen.getByLabelText('Plan Inventory');
    fireEvent.click(await within(inventory).findByRole('button', { name: /Hanshin Trial/ }));

    await waitFor(() => expect(skillDetails).not.toHaveAttribute('open'));
  });

  it('deletes a saved plan from the inventory list', async () => {
    render(<CmPlannerPage />);
    const inventory = screen.getByLabelText('Plan Inventory');
    await within(inventory).findByText('Hanshin Trial');
    const deleteButtons = within(inventory).getAllByRole('button', { name: 'Delete plan' });

    fireEvent.click(deleteButtons[1]!);

    await waitFor(() => expect(h.deleteSavedPlan).toHaveBeenCalledWith('custom-hanshin'));
    expect(h.selectPlan).not.toHaveBeenCalled();
  });

  it('collapses and expands inventory track groups', async () => {
    render(<CmPlannerPage />);
    const inventory = screen.getByLabelText('Plan Inventory');
    const customGroup = await within(inventory).findByRole('button', { name: /Hanshin 2,200m \(Inner\)/ });
    expect(await within(inventory).findByText('Hanshin Trial')).toBeInTheDocument();

    fireEvent.click(customGroup);
    expect(within(inventory).queryByText('Hanshin Trial')).not.toBeInTheDocument();

    fireEvent.click(customGroup);
    expect(within(inventory).getByText('Hanshin Trial')).toBeInTheDocument();
  });
});
