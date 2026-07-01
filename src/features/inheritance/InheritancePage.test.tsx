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
// The page resolves wishlist skills (skillById) + the M1.5 Deck card art (cardById)
// via useGameData; stub both (empty maps → no wishlist rows / placeholder deck art).
vi.mock('@/features/data/gameData', () => ({
  useGameData: () => ({ skills: [], skillById: new Map(), cardById: new Map(), cards: [] }),
  BASE_URL: '',
}));
// Stub the heavyweight inventory card (own courseCatalog import + GameIcon need providers).
vi.mock('@/features/cm-planner/PlanInventoryCard', () => ({
  PlanInventoryCard: (props: { uma1PlanId?: string }) => (
    <div data-testid="plan-inventory" data-uma1={props.uma1PlanId} />
  ),
}));
// InheritanceCard (M1.4) deps: useRoster (Dexie), useAffinityIndex (fetch), GameIcon, UploadDataButton.
vi.mock('./useRoster', () => ({
  useRoster: () => ({ roster: [], importedAt: null, importFromFile: vi.fn() }),
  ROSTER_IMPORTED_AT_KEY: 'umaExtractorImportedAt',
  makeWhiteResolver: () => () => undefined,
}));
vi.mock('./useAffinityIndex', () => ({ useAffinityIndex: () => null }));
vi.mock('@/features/data/GameIcon', () => ({ GameIcon: () => null }));
vi.mock('./UploadDataButton', () => ({ UploadDataButton: () => null }));

import { InheritancePage } from './InheritancePage';

afterEach(cleanup);

const CATALOG: CourseCatalogEntry[] = [
  { courseId: '10906', raceTrackId: 10006, surface: 'turf', distance: 2400, distanceClass: 'long', course: 2, turn: 2 },
];
const deps = { loadCatalog: () => Promise.resolve(CATALOG) };

describe('InheritancePage', () => {
  it('renders the Deck panel with 6 empty slots', () => {
    render(<InheritancePage deps={deps} />);
    expect(screen.getByText('Deck')).toBeInTheDocument();
    for (let n = 1; n <= 6; n++) expect(screen.getByText(String(n))).toBeInTheDocument();
  });

  it('renders the header, the 3-column shell, and the uma-plan + plan-targets cards', async () => {
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

  it('renders the Inheritance card (M1.4) in the center column', async () => {
    render(<InheritancePage deps={deps} />);
    // After render, the M1.4 placeholder is gone and the card header shows.
    expect(await screen.findByText('Inheritance')).toBeInTheDocument();
    expect(screen.queryByText('M1.4')).not.toBeInTheDocument();
  });
});
