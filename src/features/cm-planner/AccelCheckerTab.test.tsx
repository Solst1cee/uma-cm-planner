import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { SkillImpact } from '@/sim';
import { AccelCheckerTab } from './AccelCheckerTab';

afterEach(cleanup);

// Mock courseData so tests don't touch the real engine bundle.
// course: distance 2200, final straight starts at 1850 (frontType 1, ends at 2200).
vi.mock('@/sim/courseData', () => ({
  courseDataFor: () => ({
    courseId: 10906,
    distance: 2200,
    surface: 1,
    turn: 1,
    corners: [],
    straights: [
      { start: 0, end: 520, frontType: 1 },    // spurious first straight (frontType 1 but not at course end)
      { start: 900, end: 1250, frontType: 2 },  // back straight
      { start: 1850, end: 2200, frontType: 1 }, // final straight — ends at distance
    ],
    slopes: [],
  }),
}));

// --- plan fixture ---
const plan = {
  id: 'p',
  name: 'p',
  planNumber: 1,
  cmRef: {
    kind: 'cm' as const,
    cmId: 'CM15' as const,
    cmNumber: 15,
    courseId: '10906',
    surface: 'turf' as const,
    distance: 2200,
  },
  umaId: '100101',
  uniqueSkillId: 'u',
  role: 'ace' as const,
  strategy: 'front' as const,
  statProfile: { stats: { spd: 1200, sta: 650, pow: 900, gut: 400, wit: 600 }, mood: 0 as const },
  sparkGoals: { pink: [], blue: {} },
  wishlist: [{ skillId: 'w1', priority: 1 as const, source: 'targeted' as const }],
  lockedDeckSlots: [],
  parents: {},
  patch: { version: 't' },
  server: 'global' as const,
  dataVersion: 't',
};

// --- helpers to build a SkillImpact with specific positions ---
function makeImpact(positions: number[], nsamples = 100): SkillImpact {
  return {
    nsamples,
    distance: 2200,
    samples: positions.map((pos) => ({ horseLength: 1, positions: [pos] })),
  };
}

describe('AccelCheckerTab', () => {
  it('shows guard when spd is 0', () => {
    const zeroPlan = { ...plan, statProfile: { ...plan.statProfile, stats: { ...plan.statProfile.stats, spd: 0 } } };
    render(<AccelCheckerTab plan={zeroPlan} />);
    expect(screen.getByText(/set a speed stat/i)).toBeInTheDocument();
  });

  it('shows empty state when there are no skills', () => {
    const emptyPlan = { ...plan, uniqueSkillId: '', wishlist: [] };
    render(<AccelCheckerTab plan={emptyPlan} />);
    expect(screen.getByText(/add skills to the plan/i)).toBeInTheDocument();
  });

  it('classifies a skill firing in the final straight as Optimal', async () => {
    // single-skill plan to avoid duplicate-text issues: unique only, no wishlist
    const singlePlan = { ...plan, wishlist: [] };
    // medianPos = 1900 (>= fs 1850) → optimal
    const impact = makeImpact([1900]);
    const deps = { skillImpact: vi.fn(async () => impact) };
    render(<AccelCheckerTab plan={singlePlan} deps={deps} />);

    await waitFor(() =>
      expect(screen.getByText('Optimal (final straight)')).toBeInTheDocument(),
    );
  });

  it('classifies a skill firing mid-race as Mid race', async () => {
    const singlePlan = { ...plan, wishlist: [] };
    // medianPos = 1200 (>= 1100 = 2200*0.5 but < 1850 fs) → mid
    const impact = makeImpact([1200]);
    const deps = { skillImpact: vi.fn(async () => impact) };
    render(<AccelCheckerTab plan={singlePlan} deps={deps} />);

    await waitFor(() => expect(screen.getByText('Mid race')).toBeInTheDocument());
  });

  it('classifies a skill firing too early as Too early', async () => {
    const singlePlan = { ...plan, wishlist: [] };
    // medianPos = 400 (< 1100 = 2200*0.5) → early
    const impact = makeImpact([400]);
    const deps = { skillImpact: vi.fn(async () => impact) };
    render(<AccelCheckerTab plan={singlePlan} deps={deps} />);

    await waitFor(() => expect(screen.getByText('Too early')).toBeInTheDocument());
  });

  it('shows Won\'t fire for a skill with no activations', async () => {
    const singlePlan = { ...plan, wishlist: [] };
    // samples empty → medianPos null → none
    const impact: SkillImpact = { nsamples: 100, distance: 2200, samples: [] };
    const deps = { skillImpact: vi.fn(async () => impact) };
    render(<AccelCheckerTab plan={singlePlan} deps={deps} />);

    await waitFor(() => expect(screen.getByText("Won't fire")).toBeInTheDocument());
  });

  it('renders a row for the unique skill and each wishlist skill', async () => {
    const deps = {
      skillImpact: vi.fn(async (_, __, skillId: string) =>
        makeImpact(skillId === 'u' ? [1900] : [400]),
      ),
    };
    render(<AccelCheckerTab plan={plan} deps={deps} />);

    // table has header + 2 data rows (unique 'u' + wishlist 'w1')
    await waitFor(() => {
      const rows = screen.getAllByRole('row');
      // 1 header row + 2 data rows = 3
      expect(rows).toHaveLength(3);
    });
  });

  it('shows the rounded median position', async () => {
    const singlePlan = { ...plan, wishlist: [] };
    // Two firing positions: 1860, 1880 → median 1870
    const impact = makeImpact([1860, 1880]);
    const deps = { skillImpact: vi.fn(async () => impact) };
    render(<AccelCheckerTab plan={singlePlan} deps={deps} />);

    await waitFor(() => expect(screen.getByText('1870 m')).toBeInTheDocument());
  });

  it('calls skillImpact for each skill in the plan', async () => {
    const impact = makeImpact([1900]);
    const deps = { skillImpact: vi.fn(async () => impact) };
    render(<AccelCheckerTab plan={plan} deps={deps} />);

    // unique 'u' + wishlist 'w1' = 2 calls
    await waitFor(() => expect(deps.skillImpact).toHaveBeenCalledTimes(2));
  });
});
