import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  const timeline = [
    {
      id: 'cm15',
      type: 'cm',
      title: 'Cancer Cup',
      dates: { finals: '2026-06-30' },
      cm: {
        cmNumber: 15,
        courseId: '10906',
        conditions: { ground: 'good', weather: 'cloudy', season: 'summer' },
      },
      tier: 'official',
      status: 'confirmed',
      source: { kind: 'official', url: '' },
      server: 'global',
      dataVersion: 't',
    },
    {
      id: 'cm16',
      type: 'cm',
      title: 'Leo Cup',
      dates: { finals: '2026-07-31' },
      cm: {
        cmNumber: 16,
        courseId: '10501',
        conditions: { ground: 'firm', weather: 'sunny', season: 'summer' },
      },
      tier: 'official',
      status: 'confirmed',
      source: { kind: 'official', url: '' },
      server: 'global',
      dataVersion: 't',
    },
  ];
  const plan = {
    id: 'p',
    name: 'p',
    planNumber: 1,
    cmRef: { kind: 'cm', cmId: 'CM15', cmNumber: 15, courseId: '10906', surface: 'turf', distance: 2200 },
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
      kind: 'custom',
      courseId: '10906',
      surface: 'turf',
      distance: 2200,
      ground: 'soft',
      weather: 'rainy',
      season: 'winter',
    },
    role: 'hybrid',
    strategy: 'late',
  };
  const listPlans = vi.fn(async () => [plan, customPlan]);
  const savedPlans = [plan, customPlan];
  const selectPlan = vi.fn(async (_id: string) => undefined);
  const deleteSavedPlan = vi.fn(async () => undefined);
  const importSavedPlans = vi.fn(async (plans: unknown[]) => plans.length);
  const deleteAllSavedPlans = vi.fn(async () => undefined);
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
    timeline,
    umaById: new Map(umas.map((u) => [u.umaId, u])),
    courseData,
    plan,
    customPlan,
    savedPlans,
    listPlans,
    selectPlan,
    deleteSavedPlan,
    importSavedPlans,
    deleteAllSavedPlans,
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
// An open SkillDetailDisclosure with a traceContext would construct a real SimClient Worker
// (jsdom has none). Mock the hook to an idle state — see the jsdom gotcha in the module-4 doc.
vi.mock('./useSkillTrace', () => ({
  useSkillTrace: () => ({
    status: 'idle', run: null, runChoice: 'median', setRunChoice: () => {},
    impact: null, impactStatus: 'idle', rate: null,
  }),
}));
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
vi.mock('@/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/db')>();
  return {
    ...actual,
    listPlans: h.listPlans,
    getSetting: h.getSetting,
    setSetting: h.setSetting,
  };
});
vi.mock('@/features/data/gameData', () => ({
  useGameData: () => ({
    status: 'ready',
    skills: h.skills,
    skillById: h.skillById,
    umas: h.umas,
    umaById: h.umaById,
    timeline: h.timeline,
    iconManifest: null,
  }),
}));
// Stateful active-plan mock: selecting/setting a plan actually swaps the active
// plan so the single-state page re-derives its race view from plan.cmRef.
vi.mock('@/app/ActivePlanContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/ActivePlanContext')>();
  const { useState, useCallback } = await import('react');
  type PlanShape = typeof h.plan;
  return {
    ...actual,
    useActivePlan: () => {
      const [plan, setPlanState] = useState<PlanShape>(h.plan);
      const setPlan = useCallback((next: PlanShape) => {
        h.setPlan(next);
        setPlanState(next);
      }, []);
      const selectPlan = useCallback(async (id: string) => {
        await h.selectPlan(id);
        const found = h.savedPlans.find((p) => p.id === id);
        if (found) setPlanState(found as PlanShape);
      }, []);
      return {
        plan,
        savedPlans: h.savedPlans,
        autoSave: false,
        isSaved: true,
        setAutoSave: h.setAutoSave,
        setPlan,
        selectPlan,
        deleteSavedPlan: h.deleteSavedPlan,
        importSavedPlans: h.importSavedPlans,
        deleteAllSavedPlans: h.deleteAllSavedPlans,
        setDraftPlan: h.setDraftPlan,
        saveCurrentPlan: h.saveCurrentPlan,
        saveCurrentPlanAs: h.saveCurrentPlanAs,
        flushPendingSave: h.saveCurrentPlan,
        loadError: null,
      };
    },
  };
});
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
  h.importSavedPlans.mockClear();
  h.deleteAllSavedPlans.mockClear();
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

  it('shows CM15 conditions in the readout (Hanshin, inner layout)', async () => {
    render(<CmPlannerPage />);
    const cond = within(screen.getByLabelText('Race conditions'));
    // The course catalog resolves async; the racetrack/layout appear once it does.
    expect(await cond.findByText('Hanshin')).toBeInTheDocument();
    expect(cond.getByText('2,200m (Inner)')).toBeInTheDocument();
  });

  it('shows saved plans grouped under the plan inventory card', async () => {
    render(<CmPlannerPage />);
    const inventory = screen.getByLabelText('Plan Inventory');
    expect(inventory).toBeInTheDocument();
    expect(await within(inventory).findByRole('button', { name: /^CM15 1$/ })).toBeInTheDocument();
    expect(await within(inventory).findByText('p')).toBeInTheDocument();
    expect(await within(inventory).findByText('Hanshin Trial')).toBeInTheDocument();
    expect(within(inventory).getAllByText('1200 / 650 / 900 / 400 / 600')).toHaveLength(2);
    expect(within(inventory).getByText('Turf A / Medium S / Front A')).toBeInTheDocument();
    expect(within(inventory).getByText('Turf A / Medium S / Late A')).toBeInTheDocument();
    expect(within(inventory).getAllByRole('button', { name: 'Delete plan' })).toHaveLength(2);
    expect(await within(inventory).findByRole('button', { name: /^Hanshin 2,200m \(Inner\) 1$/ })).toBeInTheDocument();
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
        [expect.objectContaining({ cmRef: expect.objectContaining({ kind: 'custom', ground: 'soft' }) })],
        [expect.objectContaining({ cmRef: expect.objectContaining({ kind: 'custom', weather: 'rainy' }) })],
        [expect.objectContaining({ cmRef: expect.objectContaining({ kind: 'custom', season: 'winter' }) })],
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
    const savedPlan = await within(inventory).findByRole('button', { name: /^Hanshin Trial 1200/ });

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
    const savedPlan = await within(inventory).findByRole('button', { name: /^Hanshin Trial 1200/ });

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
    fireEvent.click(await within(inventory).findByRole('button', { name: /^Hanshin Trial 1200/ }));

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

  it('shows upload, ZIP download, delete-all, and per-plan download controls', async () => {
    render(<CmPlannerPage />);
    const inventory = screen.getByLabelText('Plan Inventory');
    await within(inventory).findByText('Hanshin Trial');
    const header = inventory.querySelector<HTMLElement>('.cmp-plan-card-head');
    expect(header).not.toBeNull();

    expect(within(header!).getByRole('button', { name: 'Upload plan JSON' })).toBeInTheDocument();
    expect(within(header!).getByRole('button', { name: 'Download all plans as ZIP' })).toBeInTheDocument();
    expect(within(header!).getByRole('button', { name: 'Delete all plans' })).toBeInTheDocument();
    const groupDownloads = within(inventory).getAllByRole('button', { name: /^Download all plans in / });
    const groupDeletes = within(inventory).getAllByRole('button', { name: /^Delete all plans in / });
    expect(groupDownloads).toHaveLength(2);
    expect(groupDeletes).toHaveLength(2);
    const groupHead = groupDownloads[0]?.closest<HTMLElement>('.cmp-inventory-group-head');
    const groupActions = groupDownloads[0]?.closest<HTMLElement>('.cmp-inventory-group-actions');
    expect(groupActions).not.toBeNull();
    expect(within(groupActions!).getByRole('button', { name: /^Download all plans in / })).toBe(groupDownloads[0]);
    expect(within(groupActions!).getByRole('button', { name: /^Delete all plans in / })).toBe(groupDeletes[0]);
    expect(groupHead?.children[1]).toBe(groupActions);
    expect(groupHead?.children[2]).toHaveClass('cmp-inventory-group-caret-btn');
    expect(within(inventory).getByRole('button', { name: 'Download p' })).toBeInTheDocument();
    expect(within(inventory).getByRole('button', { name: 'Download Hanshin Trial' })).toBeInTheDocument();
  });

  it('uploads multiple plan JSON files together', async () => {
    const user = userEvent.setup();
    render(<CmPlannerPage />);
    const input = screen.getByLabelText('Upload plan files');
    const files = [
      new File([JSON.stringify(h.plan)], 'plan-one.json', { type: 'application/json' }),
      new File([JSON.stringify(h.customPlan)], 'plan-two.json', { type: 'application/json' }),
    ];

    await user.upload(input, files);

    await waitFor(() => expect(h.importSavedPlans).toHaveBeenCalledTimes(1));
    expect(h.importSavedPlans.mock.calls[0]?.[0]).toHaveLength(2);
  });

  it('requires inline confirmation for delete all and cancels on outside click', () => {
    render(<CmPlannerPage />);
    const inventory = screen.getByLabelText('Plan Inventory');

    fireEvent.click(within(inventory).getByRole('button', { name: 'Delete all plans' }));
    expect(within(inventory).getByText('Confirm delete all items?')).toBeInTheDocument();
    expect(within(inventory).getByRole('button', { name: 'Confirm delete all plans' })).toBeInTheDocument();

    fireEvent.pointerDown(document.body);
    expect(within(inventory).queryByText('Confirm delete all items?')).not.toBeInTheDocument();
    expect(within(inventory).getByRole('button', { name: 'Delete all plans' })).toBeInTheDocument();
  });

  it('deletes all plans after inline confirmation', async () => {
    render(<CmPlannerPage />);
    const inventory = screen.getByLabelText('Plan Inventory');

    fireEvent.click(within(inventory).getByRole('button', { name: 'Delete all plans' }));
    fireEvent.click(within(inventory).getByRole('button', { name: 'Confirm delete all plans' }));

    await waitFor(() => expect(h.deleteAllSavedPlans).toHaveBeenCalledTimes(1));
  });

  it('requires inline confirmation for group delete and cancels on outside click', async () => {
    render(<CmPlannerPage />);
    const inventory = screen.getByLabelText('Plan Inventory');

    const deleteGroup = await within(inventory).findByRole('button', { name: 'Delete all plans in CM15' });
    fireEvent.click(deleteGroup);
    const groupHead = within(inventory)
      .getByRole('button', { name: 'Confirm delete all plans in CM15' })
      .closest<HTMLElement>('.cmp-inventory-group-head');
    expect(groupHead).not.toBeNull();
    expect(within(groupHead!).getByText('Confirm delete all items?')).toBeInTheDocument();
    expect(within(groupHead!).getByRole('button', { name: 'Cancel delete all plans in CM15' })).toBeInTheDocument();

    fireEvent.pointerDown(document.body);

    expect(within(inventory).queryByRole('button', { name: 'Confirm delete all plans in CM15' })).not.toBeInTheDocument();
    expect(within(inventory).getByRole('button', { name: 'Delete all plans in CM15' })).toBeInTheDocument();
    expect(h.deleteSavedPlan).not.toHaveBeenCalled();
  });

  it('deletes only the plans in a confirmed inventory group', async () => {
    render(<CmPlannerPage />);
    const inventory = screen.getByLabelText('Plan Inventory');
    const groupLabel = 'Hanshin 2,200m (Inner)';

    const deleteGroup = await within(inventory).findByRole('button', { name: `Delete all plans in ${groupLabel}` });
    fireEvent.click(deleteGroup);
    fireEvent.click(within(inventory).getByRole('button', { name: `Confirm delete all plans in ${groupLabel}` }));

    await waitFor(() => expect(h.deleteSavedPlan).toHaveBeenCalledTimes(1));
    expect(h.deleteSavedPlan).toHaveBeenCalledWith('custom-hanshin');
    expect(h.deleteSavedPlan).not.toHaveBeenCalledWith('p');
  });

  it('collapses and expands inventory track groups', async () => {
    render(<CmPlannerPage />);
    const inventory = screen.getByLabelText('Plan Inventory');
    const customGroup = await within(inventory).findByRole('button', { name: /^Hanshin 2,200m \(Inner\) 1$/ });
    expect(await within(inventory).findByText('Hanshin Trial')).toBeInTheDocument();

    fireEvent.click(customGroup);
    expect(within(inventory).queryByText('Hanshin Trial')).not.toBeInTheDocument();

    fireEvent.click(customGroup);
    expect(within(inventory).getByText('Hanshin Trial')).toBeInTheDocument();
  });

  it('renders the Race comparison panel', async () => {
    render(<CmPlannerPage />);
    expect(await screen.findByText(/Race comparison/i)).toBeTruthy();
  });
});
