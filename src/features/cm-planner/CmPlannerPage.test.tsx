import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
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
  return {
    skillById,
    skills,
    umas,
    umaById: new Map(umas.map((u) => [u.umaId, u])),
    courseData,
    plan,
  };
});

// The track + race-setup lazy-import the engine; mock them so the page test stays in jsdom.
vi.mock('@/sim/courseData', () => ({ courseDataFor: () => h.courseData }));
vi.mock('@/sim/courseCatalog', () => ({ courseCatalog: () => [] }));
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
    setPlan: () => {},
    flushPendingSave: async () => undefined,
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

describe('CmPlannerPage', () => {
  it('defaults to the CM15 preset in the race-setup chooser', () => {
    render(<CmPlannerPage />);
    expect(screen.getByRole('option', { name: /CM15.*Cancer Cup/ })).toBeInTheDocument();
  });

  it('renders the section 0 track for the selected course (CM15)', async () => {
    render(<CmPlannerPage />);
    await waitFor(() => expect(document.querySelector('#race-phases')).toBeInTheDocument());
  });

  it('shows CM15 conditions in the readout (Hanshin, medium, inner)', () => {
    render(<CmPlannerPage />);
    const cond = within(screen.getByLabelText('Race conditions'));
    expect(cond.getByText('Hanshin')).toBeInTheDocument();
    expect(cond.getByText('2,200m (Medium)')).toBeInTheDocument();
    expect(cond.getByText('Inner')).toBeInTheDocument();
  });
});
