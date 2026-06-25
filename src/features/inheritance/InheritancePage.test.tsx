import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { CmPlan } from '@/core/types';
import type { CourseCatalogEntry } from '@/sim/courseCatalog';

const plan: CmPlan = {
  id: 'p1', name: 'Cancer Cup — Late ace', planNumber: 1,
  cmRef: { kind: 'cm', cmId: 'CM15', cmNumber: 15, courseId: '10906', surface: 'turf', distance: 2400 },
  scenarioId: 4, umaId: '106801', uniqueSkillId: '', role: 'ace', strategy: 'late',
  statProfile: { stats: { spd: 1200, sta: 900, pow: 1000, gut: 600, wit: 1100 }, mood: 2 },
  sparkGoals: { pink: [], blue: {} }, wishlist: [], lockedDeckSlots: [], parents: {},
  patch: { version: 'x' }, server: 'global', dataVersion: 'x',
} as CmPlan;

// Stub the ActivePlan context so the page test needs no Dexie/gameData providers.
vi.mock('@/app/ActivePlanContext', () => ({
  useActivePlan: () => ({
    uma1Plan: plan,
    plan,
    uma2Plan: null,
    savedPlans: [plan],
    loadPlanIntoSlot: vi.fn(),
    deleteSavedPlan: vi.fn(),
    importSavedPlans: vi.fn(),
    deleteAllSavedPlans: vi.fn(),
  }),
}));
// Stub the heavyweight inventory card (own courseCatalog import + GameIcon need
// providers); the page test only verifies it's wired with the active plan.
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
  it('renders the header, the 3-column shell, and the wired inventory picker', async () => {
    render(<InheritancePage deps={deps} />);
    // Header is present immediately (track suffix fills in after the catalog resolves).
    expect(screen.getByText('PLAN #1')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Cancer Cup — Late ace' })).toBeInTheDocument();
    // Three workbench columns render.
    expect(document.querySelectorAll('.inh-col').length).toBe(3);
    // The shared inventory card is wired into the left column with the active plan.
    expect(screen.getByTestId('plan-inventory')).toHaveAttribute('data-uma1', 'p1');
    // Track name resolves from courseId 10906 → raceTrackId 10006 → "Tokyo".
    await waitFor(() =>
      expect(screen.getByText('From CM Planner · Tokyo Racecourse')).toBeInTheDocument(),
    );
  });
});
