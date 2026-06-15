import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { CmPlan, SkillRecord } from '@/core/types';
import type { CourseGeometry } from '@/core/track';
import { SelectedSkillProvider } from './useSelectedSkill';
import { TrackDiagramPanel } from './TrackDiagramPanel';

afterEach(cleanup);

const skill = (skillId: string, nameEn: string, conditions: string): SkillRecord =>
  ({
    skillId,
    nameEn,
    nameJp: '',
    baseSpCost: 0,
    rarity: 'white',
    iconId: '',
    conditions,
    server: 'global',
    dataVersion: 't',
  }) as SkillRecord;

const skillById = new Map<string, SkillRecord>([
  ['u', skill('u', 'Victory Cheer!', 'phase>=2')],
  ['a', skill('a', 'Escape Artist', 'distance_rate>=50')],
]);

vi.mock('@/features/data/gameData', () => ({
  useGameData: () => ({ skillById }),
}));

const HANSHIN_2200: CourseGeometry = {
  distance: 2200,
  turn: 1,
  corners: [
    { start: 520, length: 190 },
    { start: 710, length: 190 },
    { start: 1250, length: 300 },
    { start: 1550, length: 300 },
  ],
  straights: [
    { start: 0, end: 520 },
    { start: 900, end: 1250 },
    { start: 1850, end: 2200 },
  ],
  slopes: [],
};

function makePlan(over: Partial<CmPlan> = {}): CmPlan {
  return {
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
    ...over,
  } as CmPlan;
}

const deps = { resolveGeometry: () => HANSHIN_2200 };

function renderPanel(plan: CmPlan) {
  return render(
    <SelectedSkillProvider>
      <TrackDiagramPanel plan={plan} deps={deps} />
    </SelectedSkillProvider>,
  );
}

describe('TrackDiagramPanel', () => {
  it('renders the course segments (Hanshin 2200m = 7 segments)', async () => {
    renderPanel(makePlan());
    await waitFor(() => expect(document.querySelectorAll('.tseg')).toHaveLength(7));
  });

  it('shows an activation band for the unique plus every wishlist skill', async () => {
    renderPanel(makePlan());
    expect(await screen.findByRole('button', { name: /Victory Cheer! \(unique\) activation zone/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Escape Artist activation zone/ })).toBeInTheDocument();
  });

  it('highlights a band when its skill is selected', async () => {
    renderPanel(makePlan());
    const band = await screen.findByRole('button', { name: /Escape Artist activation zone/ });
    expect(band).not.toHaveClass('hot');
    fireEvent.click(band);
    expect(band).toHaveClass('hot');
  });

  it('surfaces the approximate-widths caveat (P3 honesty)', async () => {
    renderPanel(makePlan());
    expect(await screen.findByText(/approximate/i)).toBeInTheDocument();
  });

  it('degrades gracefully when the course geometry cannot be resolved', async () => {
    const failing = {
      resolveGeometry: () => {
        throw new Error('Unknown course: x');
      },
    };
    render(
      <SelectedSkillProvider>
        <TrackDiagramPanel plan={makePlan()} deps={failing} />
      </SelectedSkillProvider>,
    );
    expect(await screen.findByText(/unavailable/i)).toBeInTheDocument();
    expect(document.querySelectorAll('.tseg')).toHaveLength(0);
  });
});
