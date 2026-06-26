import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { CmPlan } from '@/core/types';
import type { CourseCatalogEntry } from '@/sim/courseCatalog';

const plan: CmPlan = {
  id: 'p1', name: 'Cancer Cup — Late ace', planNumber: 1,
  cmRef: { kind: 'cm', cmId: 'CM15', cmNumber: 15, courseId: '10906', surface: 'turf', distance: 2400 },
  scenarioId: 4, umaId: '106801', uniqueSkillId: '', role: 'ace', strategy: 'late',
  statProfile: { stats: { spd: 1200, sta: 900, pow: 1000, gut: 600, wit: 1100 }, mood: 2 },
  sparkGoals: { pink: [], blue: {} }, wishlist: [], parents: {},
  patch: { version: 'x' }, server: 'global', dataVersion: 'x',
} as CmPlan;

// Stub the ActivePlan context so the page test needs no Dexie provider.
vi.mock('@/app/ActivePlanContext', () => ({
  useActivePlan: () => ({
    uma1Plan: plan,
    plan,
    uma2Plan: null,
    savedPlans: [plan],
    setPlan: vi.fn(),
    loadPlanIntoSlot: vi.fn(),
    deleteSavedPlan: vi.fn(),
    importSavedPlans: vi.fn(),
    deleteAllSavedPlans: vi.fn(),
  }),
}));
// Empty roster → the card resolves no uma (placeholder portrait, no GameIcon → no provider needed).
vi.mock('@/features/parents/useUmas', () => ({
  useUmas: () => ({ umas: [], umaById: new Map() }),
  umaName: (_m: unknown, id: string) => `Uma ${id}`,
}));
// Plan-targets wishlist resolves skills via useGameData; stub it (empty map → no rows).
vi.mock('@/features/data/gameData', () => ({
  useGameData: () => ({ skillById: new Map() }),
  BASE_URL: '',
}));
// Stub the heavyweight inventory card (own courseCatalog import + GameIcon need providers).
vi.mock('@/features/cm-planner/PlanInventoryCard', () => ({
  PlanInventoryCard: (props: { uma1PlanId?: string }) => (
    <div data-testid="plan-inventory" data-uma1={props.uma1PlanId} />
  ),
}));

import { InheritancePage } from './InheritancePage';

afterEach(cleanup);

const CATALOG: CourseCatalogEntry[] = [
  { courseId: '10906', raceTrackId: 10006, surface: 'turf', distance: 2400, distanceClass: 'long', course: 2, turn: 2 },
];
const deps = { loadCatalog: () => Promise.resolve(CATALOG) };

describe('InheritancePage', () => {
  it('renders the header, the 3-column shell, and the uma-plan card', async () => {
    render(<InheritancePage deps={deps} />);
    expect(screen.getByText('PLAN #1')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Cancer Cup — Late ace' })).toBeInTheDocument();
    expect(document.querySelectorAll('.inh-col').length).toBe(3);
    // "Your uma plan" card is in the left column (empty roster → no uma resolved).
    expect(screen.getByText('No uma selected')).toBeInTheDocument();
    // "Plan targets" card is wired in below it.
    expect(screen.getByText('Plan targets')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText('From CM Planner · Tokyo Racecourse')).toBeInTheDocument(),
    );
  });

  it('pops the inventory card from the inventory icon, wired to the active plan', () => {
    render(<InheritancePage deps={deps} />);
    // Hidden until the inventory icon is clicked.
    expect(screen.queryByTestId('plan-inventory')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Choose plan from inventory' }));
    expect(screen.getByTestId('plan-inventory')).toHaveAttribute('data-uma1', 'p1');
  });
});
