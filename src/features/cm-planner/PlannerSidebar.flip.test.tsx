import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { CmPlan } from '@/core/types';

// CRITICAL: mock useSkillTrace before the sidebar is imported — opening a
// SkillDetailDisclosure with a traceContext would construct a real Worker
// (jsdom has none). See the jsdom Worker gotcha in CLAUDE.md.
vi.mock('./useSkillTrace', () => ({
  useSkillTrace: (): import('./useSkillTrace').SkillTraceState => ({
    status: 'idle', run: null, runChoice: 'median', setRunChoice: vi.fn(),
    meanL: null, impact: null, impactStatus: 'idle',
  }),
}));

const h = vi.hoisted(() => {
  const skill = (
    skillId: string,
    nameEn: string,
    rarity: 'white' | 'gold' | 'unique' | 'inherited_unique',
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
    skill('a', 'Escape Artist', 'white', '20011', 'distance_rate>=50', 240),
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
  ];
  const skillById = new Map(skills.map((s) => [s.skillId, s]));
  const umaById = new Map(umas.map((u) => [u.umaId, u]));
  const uniqueByUmaId = new Map([
    ['100101', { skillId: 'u', nameEn: 'Victory Cheer!', iconId: '20013', rarity: 'unique', baseSpCost: 0, conditions: 'phase>=2&order>=1' }],
  ]);
  const plan: CmPlan = {
    id: 'p',
    name: 'Test Plan',
    planNumber: 1,
    cmRef: { kind: 'cm' as const, cmId: 'CM15' as import('@/core/types').CmId, cmNumber: 15, courseId: '10906', surface: 'turf' as const, distance: 2200 },
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
    saveAs: vi.fn(async () => undefined),
    newPlan: vi.fn(),
    setAutoSave: vi.fn(),
    loadUniqueSkillByUmaId: vi.fn(async () => uniqueByUmaId),
    loadSkillTechnicalDetail: vi.fn(async () => null),
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

const sidebarProps = {
  plan: h.plan,
  autoSave: false,
  isSaved: true,
  onChange: h.setPlan,
  onSave: h.save,
  onSaveAs: h.saveAs,
  onNew: h.newPlan,
  onAutoSaveChange: h.setAutoSave,
};

describe('PlannerSidebar flip card', () => {
  it('sidebar shows UMA1/UMA2 toggle and recolors on focus', () => {
    const onFocusChange = vi.fn();
    const { rerender } = render(
      <PlannerSidebar {...sidebarProps} focused="uma1" onFocusChange={onFocusChange} uma2Empty />,
    );

    const card = screen.getByTestId('cmp-flip-card');
    expect(card).toHaveAttribute('data-uma', 'uma1');

    fireEvent.click(screen.getByRole('button', { name: 'UMA2' }));
    expect(onFocusChange).toHaveBeenCalledWith('uma2');

    rerender(
      <PlannerSidebar {...sidebarProps} focused="uma2" onFocusChange={onFocusChange} uma2Empty />,
    );
    expect(screen.getByTestId('cmp-flip-card')).toHaveAttribute('data-uma', 'uma2');
  });

  it('shows the empty-uma2 placeholder when focused=uma2 and uma2Empty is true', () => {
    render(
      <PlannerSidebar {...sidebarProps} focused="uma2" onFocusChange={vi.fn()} uma2Empty />,
    );

    expect(screen.getByTestId('cmp-flip-card')).toHaveAttribute('data-uma', 'uma2');
    expect(screen.getByText('No uma2 yet.')).toBeInTheDocument();
    // The plan body (e.g. the plan name input) should NOT be rendered
    expect(screen.queryByLabelText('Plan name')).not.toBeInTheDocument();
  });

  it('renders the plan body when focused=uma2 and uma2Empty is false', () => {
    render(
      <PlannerSidebar {...sidebarProps} focused="uma2" onFocusChange={vi.fn()} uma2Empty={false} />,
    );

    expect(screen.getByTestId('cmp-flip-card')).toHaveAttribute('data-uma', 'uma2');
    // Plan body is rendered
    expect(screen.getByLabelText('Plan name')).toBeInTheDocument();
  });

  it('sets the --uma-accent CSS var to blue for uma1 and red for uma2', () => {
    const { rerender } = render(
      <PlannerSidebar {...sidebarProps} focused="uma1" onFocusChange={vi.fn()} uma2Empty />,
    );

    const card = screen.getByTestId('cmp-flip-card');
    expect(card).toHaveStyle({ '--uma-accent': '#5aa0ff' });

    rerender(
      <PlannerSidebar {...sidebarProps} focused="uma2" onFocusChange={vi.fn()} uma2Empty />,
    );
    expect(screen.getByTestId('cmp-flip-card')).toHaveStyle({ '--uma-accent': '#e0564f' });
  });

  it('UMA1 button has the "on" class when focused=uma1, UMA2 has it when focused=uma2', () => {
    const { rerender } = render(
      <PlannerSidebar {...sidebarProps} focused="uma1" onFocusChange={vi.fn()} uma2Empty />,
    );

    expect(screen.getByRole('button', { name: 'UMA1' })).toHaveClass('on');
    expect(screen.getByRole('button', { name: 'UMA2' })).not.toHaveClass('on');

    rerender(
      <PlannerSidebar {...sidebarProps} focused="uma2" onFocusChange={vi.fn()} uma2Empty />,
    );

    expect(screen.getByRole('button', { name: 'UMA1' })).not.toHaveClass('on');
    expect(screen.getByRole('button', { name: 'UMA2' })).toHaveClass('on');
  });

  it('works with no focused/onFocusChange/uma2Empty props (backwards compat defaults)', () => {
    // Should render without crashing; defaults to uma1 face showing the plan body
    render(<PlannerSidebar {...sidebarProps} />);
    expect(screen.getByTestId('cmp-flip-card')).toHaveAttribute('data-uma', 'uma1');
    expect(screen.getByLabelText('Plan name')).toBeInTheDocument();
  });

  it('duplicate uma1 -> uma2 calls handler from the empty uma2 face', () => {
    const onDup = vi.fn();
    render(<PlannerSidebar {...sidebarProps} focused="uma2" uma2Empty onDuplicateUma1ToUma2={onDup} onReplicateUma2ToUma1={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /duplicate uma1/i }));
    expect(onDup).toHaveBeenCalled();
  });

  it('replicate uma2 -> uma1 is disabled when uma2 is empty', () => {
    render(<PlannerSidebar {...sidebarProps} focused="uma1" uma2Empty onReplicateUma2ToUma1={vi.fn()} onDuplicateUma1ToUma2={vi.fn()} />);
    expect(screen.getByRole('button', { name: /replicate uma2/i })).toBeDisabled();
  });
});
