import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { CmPlan, LineageAffinity, Parent } from '@/core/types';
import type { CourseCatalogEntry } from '@/sim/courseCatalog';

const plan: CmPlan = {
  id: 'p1', name: 'Cancer Cup — Late ace', planNumber: 1,
  cmRef: { kind: 'cm', cmId: 'CM15', cmNumber: 15, courseId: '10906', surface: 'turf', distance: 2400 },
  scenarioId: 4, umaId: '106801', uniqueSkillId: '', role: 'ace', strategy: 'late',
  statProfile: { stats: { spd: 1200, sta: 900, pow: 1000, gut: 600, wit: 1100 }, mood: 2 },
  sparkGoals: { pink: [], blue: {} }, wishlist: [], parents: {},
  patch: { version: 'x' }, server: 'global', dataVersion: 'x',
} as CmPlan;

const planWithWishlist: CmPlan = {
  ...plan,
  id: 'p2', planNumber: 2,
  wishlist: [{ skillId: '200011', priority: 1, source: 'targeted' }],
};

// M1.4b Task 9 — Parent 2 DRAFT mode: a green clause targeting the same skill
// id as the wishlist (the stubbed skillById/greenMap has no unique-rarity
// entries, so reconcileGreenSkillId passes '200011' through unchanged — the
// draft's synthetic parent's greenSpark then matches the wishlist row directly).
const planDraftGreen: CmPlan = {
  ...plan,
  id: 'p3', planNumber: 3,
  wishlist: [{ skillId: '200011', priority: 1, source: 'targeted' }],
  parent2Mode: 'draft',
  rentalDraft: {
    filters: [{ id: 'g1', kind: 'green', skillId: '200011', legacyMin: 0, totalMin: 1 }],
    forcedTier: 'double',
  },
} as CmPlan;

// M1.4b Task 9 — Parent 2 RENTAL mode: a recorded veteran whose white spark
// covers the wishlist skill directly.
const planRentalWhite: CmPlan = {
  ...plan,
  id: 'p4', planNumber: 4,
  wishlist: [{ skillId: '200011', priority: 1, source: 'targeted' }],
  parent2Mode: 'rental',
  rentalRecorded: {
    id: '__rental__', umaId: '999',
    blueSpark: { stat: 'spd', stars: 3 },
    pinkSpark: { aptitude: 'turf', stars: 3 },
    whiteSparks: [{ skillId: '200011', stars: 3 }],
    source: 'friend_rental',
  },
} as CmPlan;

// M1.4b Task 9 (review-fix) — fixtures for making the `p2IsReal` coverage gate
// load-bearing (InheritancePage.tsx's `affinityIdx && planUmaId && pA && pB &&
// p2IsReal`). Parent 1 lives on the roster; the two plans below differ ONLY in
// parent2Mode/rentalDraft-vs-rentalRecorded, so the sole variable under test is
// whether Parent 2 resolves to a REAL veteran (owned/rental) vs a draft's
// synthetic stand-in.
const parentA: Parent = {
  id: 'parentA1', umaId: '100101',
  blueSpark: { stat: 'spd', stars: 3 },
  pinkSpark: { aptitude: 'turf', stars: 3 },
  whiteSparks: [],
  source: 'mine',
};
const parentBRental: Parent = {
  id: 'parentB1', umaId: '100201',
  blueSpark: { stat: 'spd', stars: 3 },
  pinkSpark: { aptitude: 'turf', stars: 3 },
  whiteSparks: [],
  source: 'friend_rental',
};
const planDraftForGate: CmPlan = {
  ...plan,
  id: 'p6', planNumber: 6,
  parents: { a: 'parentA1' },
  parent2Mode: 'draft',
  rentalDraft: {
    filters: [{ id: 'g1', kind: 'green', skillId: '200011', legacyMin: 0, totalMin: 1 }],
    forcedTier: 'double',
  },
} as CmPlan;
const planRentalForGate: CmPlan = {
  ...plan,
  id: 'p7', planNumber: 7,
  parents: { a: 'parentA1' },
  parent2Mode: 'rental',
  rentalRecorded: parentBRental,
} as CmPlan;

// Stub the ActivePlan context so the page test needs no Dexie provider.
// useActivePlan is a vi.fn() so individual tests can override with mockReturnValueOnce.
const mockUseActivePlan = vi.fn(() => ({
  uma1Plan: plan,
  plan,
  uma2Plan: null,
  savedPlans: [plan],
  setPlan: vi.fn(),
  loadPlanIntoSlot: vi.fn(),
  deleteSavedPlan: vi.fn(),
  importSavedPlans: vi.fn(),
  deleteAllSavedPlans: vi.fn(),
  saveCurrentPlan: vi.fn(),
}));
vi.mock('@/app/ActivePlanContext', () => ({
  useActivePlan: () => mockUseActivePlan(),
}));
// Empty roster → the card resolves no uma (placeholder portrait, no GameIcon → no provider needed).
vi.mock('@/features/parents/useUmas', () => ({
  useUmas: () => ({ umas: [], umaById: new Map() }),
  umaName: (_m: unknown, id: string) => `Uma ${id}`,
}));
// The page resolves wishlist skills (skillById) + the M1.5 Deck card art (cardById)
// via useGameData; stub both. sparkRates is needed for buildCoverageMatrix.
const STUB_SPARK_RATES = {
  baseProcPctByStars: {
    blue: [70, 80, 90] as [number, number, number],
    pink: [1, 3, 5] as [number, number, number],
    green: [5, 10, 15] as [number, number, number],
    whiteSkill: [3, 6, 9] as [number, number, number],
    whiteRace: [1, 2, 3] as [number, number, number],
    whiteScenario: [3, 6, 9] as [number, number, number],
  },
  inspirationEvents: 2 as const,
  affinityScaling: 'per_member_multiplicative_pct' as const,
};
const STUB_SKILL_BY_ID = new Map([
  ['200011', { skillId: '200011', nameEn: 'Corner Adept', rarity: 'white', iconId: '10001', baseSpCost: 90, variantSkillIds: [], conditions: '', server: 'global', dataVersion: 'fixture' }],
]);
vi.mock('@/features/data/gameData', () => ({
  useGameData: () => ({
    skills: [...STUB_SKILL_BY_ID.values()],
    skillById: STUB_SKILL_BY_ID,
    cardById: new Map(),
    cards: [],
    sparkRates: STUB_SPARK_RATES,
  }),
  BASE_URL: '',
}));
// The page's pickers read the app-wide planning horizon; default = current.
vi.mock('@/app/useAvailability', () => ({
  useAvailability: () => ({
    visible: (r: { server: string }) => r.server === 'global',
    tierOf: () => 'now' as const,
    horizon: { kind: 'current' },
    setHorizon: vi.fn(),
    cutoffISO: '2026-07-02',
    todayISO: '2026-07-02',
    planCmISO: '2026-07-02',
    futureCms: [],
  }),
}));
// Stub the heavyweight inventory card (own courseCatalog import + GameIcon need providers).
vi.mock('@/features/cm-planner/PlanInventoryCard', () => ({
  PlanInventoryCard: (props: { uma1PlanId?: string }) => (
    <div data-testid="plan-inventory" data-uma1={props.uma1PlanId} />
  ),
}));
// InheritanceCard (M1.4) deps: useRoster (Dexie), useAffinityIndex (fetch), GameIcon, UploadDataButton.
// Both wrapped in a vi.fn() (mockUseActivePlan pattern) so the p2IsReal-gate
// tests below can override them per-test (default stays empty roster / no
// affinity index, matching every pre-existing test's expectations).
const mockUseRoster = vi.fn(() => ({ roster: [] as Parent[], importedAt: null as string | null, importFromFile: vi.fn() }));
vi.mock('./useRoster', () => ({
  useRoster: () => mockUseRoster(),
  ROSTER_IMPORTED_AT_KEY: 'umaExtractorImportedAt',
  makeWhiteResolver: () => () => undefined,
}));
const mockUseAffinityIndex = vi.fn(() => null as { byChara: Map<number, Map<number, number>>; aff2Cache: Map<string, number>; aff3Cache: Map<string, number> } | null);
vi.mock('./useAffinityIndex', () => ({ useAffinityIndex: () => mockUseAffinityIndex() }));
vi.mock('./useG1SaddleSet', () => ({ useG1SaddleSet: () => new Set<string>() }));
vi.mock('@/features/data/GameIcon', () => ({ GameIcon: () => null }));
vi.mock('./UploadDataButton', () => ({ UploadDataButton: () => null }));
// M1.4b Task 9 (review-fix) — spy on planLineageAffinity so the p2IsReal gate
// (InheritancePage.tsx's coverage useMemo) is load-bearing in this test file:
// mutation-testing this gate away previously left the whole suite green
// because no existing test exercised the affinityIdx/pA/pB-all-truthy branch.
const planLineageAffinitySpy = vi.fn(
  (
    _idx: unknown,
    _traineeUmaId: string,
    _parentA: Parent,
    _parentB: Parent,
    _g1Set?: ReadonlySet<string>,
  ): LineageAffinity => ({
    aff2: { tA: 0, tB: 0, aB: 0 },
    aff3: { tA_gA1: 0, tA_gA2: 0, tB_gB1: 0, tB_gB2: 0 },
    lineageTotal: 0,
    memberScores: { parentA: 0, parentB: 0, gA1: 0, gA2: 0, gB1: 0, gB2: 0 },
    tiers: { parentA: '△', parentB: '△', gA1: '△', gA2: '△', gB1: '△', gB2: '△' },
    displayTotal: 0,
    staticOnly: true,
  }),
);
vi.mock('@/core/lineageAffinity', () => ({
  planLineageAffinity: (...args: Parameters<typeof planLineageAffinitySpy>) => planLineageAffinitySpy(...args),
}));

import { InheritancePage } from './InheritancePage';
import { __clearJsonCacheForTests } from './dataCache';

afterEach(() => {
  cleanup();
  // The page's lazy datasets go through a module-level promise cache — reset it
  // so tests with different fetch behaviour stay isolated.
  __clearJsonCacheForTests();
});

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

  it('renders the M1.7 coverage matrix (no placeholder) for a plan with a wishlist', async () => {
    mockUseActivePlan.mockReturnValueOnce({
      uma1Plan: planWithWishlist,
      plan: planWithWishlist,
      uma2Plan: null,
      savedPlans: [planWithWishlist],
      setPlan: vi.fn(),
      loadPlanIntoSlot: vi.fn(),
      deleteSavedPlan: vi.fn(),
      importSavedPlans: vi.fn(),
      deleteAllSavedPlans: vi.fn(),
      saveCurrentPlan: vi.fn(),
    });
    render(<InheritancePage deps={deps} />);
    expect(await screen.findByText('Obtainable vs. wishlist')).toBeTruthy();
    expect(screen.queryByText('M1.7')).toBeNull(); // placeholder gone
  });

  it('M1.4b: a draft Parent 2 (green clause) covers a matching wishlist skill via the synthetic parent, without throwing', async () => {
    // mockReturnValue (not -Once): async effects (e.g. the track-catalog load)
    // trigger a re-render mid-test, and a spent -Once queue would fall back to
    // the describe-level default plan (empty wishlist) before our assertion runs.
    mockUseActivePlan.mockReturnValue({
      uma1Plan: planDraftGreen,
      plan: planDraftGreen,
      uma2Plan: null,
      savedPlans: [planDraftGreen],
      setPlan: vi.fn(),
      loadPlanIntoSlot: vi.fn(),
      deleteSavedPlan: vi.fn(),
      importSavedPlans: vi.fn(),
      deleteAllSavedPlans: vi.fn(),
      saveCurrentPlan: vi.fn(),
    });
    render(<InheritancePage deps={deps} />);
    await screen.findByText('Obtainable vs. wishlist');
    const matrix = document.querySelector('.inh-cov-matrix') as HTMLElement;
    const row = within(matrix).getByText('Corner Adept').closest('tr');
    expect(row).not.toHaveClass('row-uncovered');
  });

  it('M1.4b: a rental Parent 2 (recorded white spark) covers a matching wishlist skill', async () => {
    mockUseActivePlan.mockReturnValue({
      uma1Plan: planRentalWhite,
      plan: planRentalWhite,
      uma2Plan: null,
      savedPlans: [planRentalWhite],
      setPlan: vi.fn(),
      loadPlanIntoSlot: vi.fn(),
      deleteSavedPlan: vi.fn(),
      importSavedPlans: vi.fn(),
      deleteAllSavedPlans: vi.fn(),
      saveCurrentPlan: vi.fn(),
    });
    render(<InheritancePage deps={deps} />);
    await screen.findByText('Obtainable vs. wishlist');
    const matrix = document.querySelector('.inh-cov-matrix') as HTMLElement;
    const row = within(matrix).getByText('Corner Adept').closest('tr');
    expect(row).not.toHaveClass('row-uncovered');
  });

  // M1.4b Task 9 (review-fix) — make the coverage useMemo's `p2IsReal` gate
  // load-bearing. Both plans below share the same affinityIdx-truthy /
  // planUmaId-truthy / pA-truthy setup (Parent 1 resolved from the roster);
  // the ONLY thing that differs is whether Parent 2 resolves to a real
  // veteran (rental) or a draft's synthetic stand-in — so a failure here can
  // only be explained by the `&& p2IsReal` clause.
  it('M1.4b: a DRAFT Parent 2 never reaches planLineageAffinity, even with every other gate input present', async () => {
    mockUseRoster.mockReturnValueOnce({ roster: [parentA], importedAt: null, importFromFile: vi.fn() });
    mockUseAffinityIndex.mockReturnValueOnce({ byChara: new Map(), aff2Cache: new Map(), aff3Cache: new Map() });
    mockUseActivePlan.mockReturnValue({
      uma1Plan: planDraftForGate,
      plan: planDraftForGate,
      uma2Plan: null,
      savedPlans: [planDraftForGate],
      setPlan: vi.fn(),
      loadPlanIntoSlot: vi.fn(),
      deleteSavedPlan: vi.fn(),
      importSavedPlans: vi.fn(),
      deleteAllSavedPlans: vi.fn(),
      saveCurrentPlan: vi.fn(),
    });
    render(<InheritancePage deps={deps} />);
    await screen.findByText('Obtainable vs. wishlist');
    expect(planLineageAffinitySpy).not.toHaveBeenCalled();
  });

  it('M1.4b: a RENTAL Parent 2 (real veteran) DOES reach planLineageAffinity, keyed on the recorded parent', async () => {
    mockUseRoster.mockReturnValueOnce({ roster: [parentA], importedAt: null, importFromFile: vi.fn() });
    mockUseAffinityIndex.mockReturnValueOnce({ byChara: new Map(), aff2Cache: new Map(), aff3Cache: new Map() });
    mockUseActivePlan.mockReturnValue({
      uma1Plan: planRentalForGate,
      plan: planRentalForGate,
      uma2Plan: null,
      savedPlans: [planRentalForGate],
      setPlan: vi.fn(),
      loadPlanIntoSlot: vi.fn(),
      deleteSavedPlan: vi.fn(),
      importSavedPlans: vi.fn(),
      deleteAllSavedPlans: vi.fn(),
      saveCurrentPlan: vi.fn(),
    });
    render(<InheritancePage deps={deps} />);
    await screen.findByText('Obtainable vs. wishlist');
    expect(planLineageAffinitySpy).toHaveBeenCalledTimes(1);
    const [, , , pB] = planLineageAffinitySpy.mock.calls[0]!;
    expect(pB).toEqual(parentBRental);
  });
});
