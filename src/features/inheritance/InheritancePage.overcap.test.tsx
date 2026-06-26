import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { CmPlan, UmaRecord } from '@/core/types';

// Real Agnes Tachyon base aptitudes (umas.json 103201).
const uma: UmaRecord = {
  umaId: '103201', charaId: '1032', nameEn: 'Agnes Tachyon', epithet: 'x',
  baseAptitudes: {
    surface: { turf: 'A', dirt: 'G' },
    distance: { short: 'G', mile: 'D', medium: 'A', long: 'B' },
    strategy: { front: 'E', pace: 'A', late: 'B', end: 'F' },
  },
  server: 'global', dataVersion: 'x',
};

// The user's plan: a turf · medium · late race, but pink targets set to S on
// Sprint + Mile + Medium (off-race distances included) — the case the inheritance
// card previously dropped, while the planner showed them.
const plan: CmPlan = {
  id: 'p1', name: 'Test flow', planNumber: 1,
  cmRef: { kind: 'cm', cmId: 'CM15', cmNumber: 15, courseId: '10906', surface: 'turf', distance: 2200 },
  scenarioId: 4, umaId: '103201', uniqueSkillId: '', role: 'ace', strategy: 'late',
  statProfile: { stats: { spd: 1200, sta: 900, pow: 1000, gut: 600, wit: 1100 }, mood: 2 },
  sparkGoals: {
    pink: [
      { aptKey: { kind: 'distance', key: 'short' }, target: 'S' },
      { aptKey: { kind: 'distance', key: 'mile' }, target: 'S' },
      { aptKey: { kind: 'distance', key: 'medium' }, target: 'S' },
    ],
    blue: {},
  },
  wishlist: [], parents: {},
  patch: { version: 'x' }, server: 'global', dataVersion: 'x',
} as CmPlan;

vi.mock('@/app/ActivePlanContext', () => ({
  useActivePlan: () => ({
    uma1Plan: plan, plan, uma2Plan: null, savedPlans: [plan], setPlan: vi.fn(),
    loadPlanIntoSlot: vi.fn(), deleteSavedPlan: vi.fn(), importSavedPlans: vi.fn(), deleteAllSavedPlans: vi.fn(),
  }),
}));
vi.mock('@/features/parents/useUmas', () => ({
  useUmas: () => ({ umas: [uma], umaById: new Map([[uma.umaId, uma]]) }),
  umaName: (_m: unknown, id: string) => `Uma ${id}`,
}));
vi.mock('@/features/data/gameData', () => ({ useGameData: () => ({ skillById: new Map() }), BASE_URL: '' }));
vi.mock('@/features/cm-planner/PlanInventoryCard', () => ({ PlanInventoryCard: () => <div /> }));
vi.mock('@/features/data/GameIcon', () => ({ GameIcon: () => <span data-testid="icon" /> }));

import { InheritancePage } from './InheritancePage';

afterEach(cleanup);

describe('Plan targets — off-race pink targets (matches the planner sidebar)', () => {
  it('shows required stars for every targeted aptitude + the over-budget warning + mid-run', () => {
    render(<InheritancePage deps={{ loadCatalog: () => Promise.resolve([]) }} />);
    // Pink: off-race Sprint/Mile are included, not just the active Medium.
    expect(screen.getByText('Sprint ★10')).toBeInTheDocument();
    expect(screen.getByText('Mile ★7')).toBeInTheDocument();
    expect(screen.getByText('Medium ★1')).toBeInTheDocument();
    expect(screen.getByText('Late Surger ★1')).toBeInTheDocument();
    // 10+7+1+1 = 19 > 18 → over-budget warning.
    expect(screen.getByRole('alert')).toHaveTextContent(/Needs 19★.*over the 18★/);
    // Mid-run matches the planner filter: only Sprint (career-start maxed, still 3 short).
    expect(screen.getByText('Sprint ×3')).toBeInTheDocument();
    expect(screen.queryByText(/Medium ×/)).not.toBeInTheDocument();
  });
});
