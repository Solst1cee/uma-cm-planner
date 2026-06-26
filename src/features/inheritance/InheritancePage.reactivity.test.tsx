import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ActivePlanProvider, useActivePlan } from '@/app/ActivePlanContext';
import type { CmPlan, UmaRecord } from '@/core/types';

const agnes: UmaRecord = {
  umaId: '103201', charaId: '1032', nameEn: 'Agnes Tachyon', epithet: 'x',
  baseAptitudes: {
    surface: { turf: 'A', dirt: 'G' },
    distance: { short: 'G', mile: 'D', medium: 'A', long: 'B' },
    strategy: { front: 'E', pace: 'A', late: 'B', end: 'F' },
  },
  server: 'global', dataVersion: 'x',
};

const mkPlan = (id: string, strategy: 'front' | 'end'): CmPlan =>
  ({
    id, name: `plan ${id}`, planNumber: 1,
    cmRef: { kind: 'cm', cmId: 'CM15', cmNumber: 15, courseId: '10906', surface: 'turf', distance: 2200 },
    scenarioId: 4, umaId: '103201', uniqueSkillId: '', role: 'ace', strategy,
    statProfile: { stats: { spd: 1, sta: 1, pow: 1, gut: 1, wit: 1 }, mood: 2 },
    sparkGoals: { pink: [], blue: {} }, wishlist: [], parents: {},
    patch: { version: 'x' }, server: 'global', dataVersion: 'x',
  }) as CmPlan;

const planA = mkPlan('A', 'end'); // Agnes end F → A = ★10 "End Closer"
const planB = mkPlan('B', 'front'); // Agnes front E → A = ★10 "Front Runner"

vi.mock('@/features/data/gameData', () => ({
  useGameData: () => ({ status: 'ready', currentCm: null, skillById: new Map() }),
  BASE_URL: '',
}));
vi.mock('@/features/parents/useUmas', () => ({
  useUmas: () => ({ umas: [agnes], umaById: new Map([[agnes.umaId, agnes]]) }),
  umaName: () => 'Agnes Tachyon',
}));
vi.mock('@/features/cm-planner/PlanInventoryCard', () => ({ PlanInventoryCard: () => <div /> }));
vi.mock('@/features/data/GameIcon', () => ({ GameIcon: () => <span /> }));
vi.mock('@/db', () => ({
  getPlan: vi.fn(async (id: string) => (id === 'A' ? planA : id === 'B' ? planB : undefined)),
  getSetting: vi.fn(async (k: string) => (k === 'activePlanId' ? 'A' : undefined)),
  listPlans: vi.fn(async () => [planA, planB]),
  savePlan: vi.fn(async () => undefined),
  setSetting: vi.fn(async () => undefined),
  deletePlan: vi.fn(async () => undefined),
}));

import { InheritancePage } from './InheritancePage';

let ctx: ReturnType<typeof useActivePlan>;
function Grab() {
  ctx = useActivePlan();
  return null;
}

afterEach(cleanup);

describe('Plan targets — pink reacts to a plan swap', () => {
  it('updates pink chips when the active plan is swapped', async () => {
    render(
      <ActivePlanProvider>
        <Grab />
        <InheritancePage deps={{ loadCatalog: () => Promise.resolve([]) }} />
      </ActivePlanProvider>,
    );
    // plan A (strategy end) → "End Closer ★10"
    await waitFor(() => expect(screen.getByText('End Closer ★10')).toBeInTheDocument());

    await act(async () => {
      await ctx.loadPlanIntoSlot('B', 'uma1');
    });

    // plan B (strategy front) → pink should switch to "Front Runner ★10"
    await waitFor(() => expect(screen.getByText('Front Runner ★10')).toBeInTheDocument());
    expect(screen.queryByText('End Closer ★10')).not.toBeInTheDocument();
  });
});
