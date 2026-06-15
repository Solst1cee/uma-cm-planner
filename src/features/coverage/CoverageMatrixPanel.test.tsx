/**
 * Coverage matrix rendering against the fixture plan, with deterministic
 * mocked core output (the core's own behavior is covered by coverage.test.ts
 * / spark.test.ts) and a mocked db (parents resolution).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import type {
  CmPlan,
  CoverageRow,
  CoverageSource,
  OwnedCard,
  Parent,
  SkillRecord,
} from '@/core/types';
import { FIXTURE_PLAN } from '@/core/fixtures';
import { CoverageMatrixPanel } from '@/features/coverage/CoverageMatrixPanel';

const mocked = vi.hoisted(() => {
  // Rows deliberately NOT in priority order — the panel must sort them.
  // Card sources carry ownedId + limitBreak (core sets both since the
  // duplicate-copy fix); the panel must filter cells by ownedId.
  // Spark sources carry parentId (+ sparkPct/approximate/detail) — the panel
  // must route them to the chosen-parent columns, never to card columns.
  const rows = [
    {
      skillId: '210061', // Shooting for the Top
      priority: 3,
      sources: [],
      bestTier: 'uncovered',
    },
    {
      skillId: '200331', // Professor of Curvature (gold; prereq 200332)
      priority: 1,
      sources: [
        {
          kind: 'chain',
          cardId: '30028',
          ownedId: 1,
          limitBreak: 3,
          detail: { hintPoolSize: 2, hintFrequency: 40, specialtyPriority: 100 },
        },
      ],
      bestTier: 'chain',
    },
    {
      skillId: '200014', // Right Turns ◎
      priority: 2,
      sources: [
        { kind: 'random', cardId: '30028', ownedId: 1, limitBreak: 3 },
        { kind: 'scenario' },
      ],
      bestTier: 'random',
    },
    {
      skillId: '200332', // Corner Adept ○ (white; hint + both parents' sparks)
      priority: 2,
      sources: [
        {
          kind: 'hint_strong',
          cardId: '30028',
          ownedId: 1,
          limitBreak: 3,
          detail: { hintPoolSize: 2, hintFrequency: 40, specialtyPriority: 100 },
        },
        {
          kind: 'spark',
          parentId: 'p1',
          sparkPct: 17.4,
          detail: { sparkStars: 3, grandparent: false, affinityUsed: 102 },
        },
        {
          kind: 'spark',
          parentId: 'p2',
          sparkPct: 9.6,
          approximate: true,
          detail: { sparkStars: 2, grandparent: true, affinityUsed: 51 },
        },
      ],
      bestTier: 'hint_strong',
    },
  ];
  const parents = [
    {
      id: 'p1',
      umaId: '100201', // in the mocked uma list → column shows the uma name
      blueSpark: { stat: 'spd', stars: 3 },
      pinkSpark: { aptitude: 'turf', stars: 3 },
      whiteSparks: [{ skillId: '200332', stars: 3 }],
      source: 'mine',
    },
    {
      id: 'p2',
      umaId: '100999', // NOT in the uma list → column falls back to 'Parent 2'
      blueSpark: { stat: 'sta', stars: 2 },
      pinkSpark: { aptitude: 'long', stars: 1 },
      whiteSparks: [{ skillId: '200332', stars: 2 }],
      source: 'friend_rental',
    },
  ];
  const umas = [
    {
      umaId: '100201',
      charaId: '1002',
      nameEn: 'Daiwa Scarlet',
      server: 'global',
      dataVersion: 'fixture',
    },
  ];
  return { rows, parents, umas };
});

vi.mock('@/features/data/gameData', async () => {
  const { fixtureGameData } = await import('@/features/testing/fixtureGameData');
  return {
    useGameData: () => ({
      ...fixtureGameData(),
      umas: mocked.umas,
      umaById: new Map(mocked.umas.map((u) => [u.umaId, u])),
    }),
  };
});

vi.mock('@/db', () => ({
  listParents: vi.fn(async () => mocked.parents as unknown as Parent[]),
}));

vi.mock('@/core/coverage', () => ({
  buildCoverageMatrix: vi.fn(() => mocked.rows as unknown as CoverageRow[]),
  classifyHintTier: vi.fn(() => 'hint_weak' as const),
  effectiveSpCost: vi.fn((skill: SkillRecord) => skill.baseSpCost),
  // Core contract: >0 only for training-hint tiers; 0 for event-granted
  // sources (chain/date/random/scenario) = show full cost.
  expectedHintLevel: vi.fn((source: CoverageSource) =>
    source.kind === 'hint_strong' || source.kind === 'hint_weak' ? 2 : 0,
  ),
  bundledSpCost: vi.fn(
    (gold: SkillRecord, white: SkillRecord) => gold.baseSpCost + white.baseSpCost,
  ),
}));

// FINDING 4(a): the panel combines spark % via core combinedSparkChance (raw
// float, single pass). Mock it deterministically — the real math is covered by
// spark.test.ts. Per-parent for the chip; both parents together for the drawer.
vi.mock('@/core/spark', () => ({
  combinedSparkChance: vi.fn(
    (args: { parents: Array<{ id: string }> }): { pct: number; approximate: boolean } => {
      const ids = args.parents.map((p) => p.id).sort();
      if (ids.length === 1 && ids[0] === 'p1') return { pct: 17.4, approximate: false };
      if (ids.length === 1 && ids[0] === 'p2') return { pct: 9.6, approximate: true };
      // [p1, p2] together — the cross-parent combined figure.
      return { pct: 25.3, approximate: true };
    },
  ),
}));

const INVENTORY: OwnedCard[] = [{ id: 1, cardId: '30028', limitBreak: 3 }];

const PLAN_WITH_PARENTS: CmPlan = { ...FIXTURE_PLAN, parents: { a: 'p1', b: 'p2' } };

afterEach(cleanup);

function renderPanel(inventory: OwnedCard[] = INVENTORY, plan: CmPlan = FIXTURE_PLAN) {
  return render(<CoverageMatrixPanel plan={plan} inventory={inventory} />);
}

describe('CoverageMatrixPanel', () => {
  it('renders one row per target skill, sorted by priority, with tier chips', () => {
    renderPanel();
    const rowHeaders = screen.getAllByRole('rowheader');
    expect(rowHeaders.map((h) => h.textContent)).toEqual([
      expect.stringContaining('Professor of Curvature'),
      expect.stringContaining('Right Turns ◎'),
      expect.stringContaining('Corner Adept ○'),
      expect.stringContaining('Shooting for the Top'),
    ]);

    expect(
      screen.getByRole('button', {
        name: 'Professor of Curvature via Kitasan Black LB3: Chain',
      }),
    ).toHaveTextContent('Chain');
    expect(
      screen.getByRole('button', {
        name: 'Right Turns ◎ via Kitasan Black LB3: Random',
      }),
    ).toHaveTextContent('Random');
  });

  it('renders the scenario pseudo-column with its own chip', () => {
    renderPanel();
    expect(screen.getByRole('columnheader', { name: 'Scenario' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Right Turns ◎ via scenario: Scenario' }),
    ).toBeInTheDocument();
  });

  it('flags uncovered skills with the buy-or-drop note', () => {
    renderPanel();
    const row = screen
      .getByRole('rowheader', { name: /Shooting for the Top/ })
      .closest('tr');
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByRole('img', { name: 'uncovered' })).toBeInTheDocument();
    expect(
      screen.getByText('no reliable source — buy at full SP or drop'),
    ).toBeInTheDocument();
  });

  it('attributes cell sources to the owning copy, not every copy of the cardId', () => {
    // Two copies of Kitasan (id 1 @ LB3, id 2 @ LB0); all mocked sources
    // carry ownedId 1, so the LB0 column must stay empty.
    renderPanel([
      { id: 1, cardId: '30028', limitBreak: 3 },
      { id: 2, cardId: '30028', limitBreak: 0 },
    ]);
    expect(
      screen.getByRole('button', {
        name: 'Professor of Curvature via Kitasan Black LB3: Chain',
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: 'Professor of Curvature via Kitasan Black LB0: Chain',
      }),
    ).not.toBeInTheDocument();
  });

  it('shows full cost + unverified caveat and the white-prereq bundle for an event-granted gold', async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(
      screen.getByRole('button', {
        name: 'Professor of Curvature via Kitasan Black LB3: Chain',
      }),
    );
    const drawer = screen.getByRole('dialog', {
      name: 'Coverage details: Professor of Curvature',
    });
    const inDrawer = within(drawer);
    expect(inDrawer.getByText('Hint pool size').nextElementSibling).toHaveTextContent('2');
    expect(inDrawer.getByText('Hint frequency passive').nextElementSibling).toHaveTextContent(
      '40',
    );
    // expectedHintLevel = 0 for chain → full base cost (P3, unverified
    // event-granted hint levels). effectiveSpCost mocked to baseSpCost = 160.
    expect(inDrawer.getByText('Effective SP cost').nextElementSibling).toHaveTextContent(
      '160 SP',
    );
    expect(
      inDrawer.getByText(/event-granted hint levels unverified — full SP cost shown/),
    ).toBeInTheDocument();
    expect(inDrawer.queryByText(/Assumes one hint event/)).not.toBeInTheDocument();
    // Gold bundles its white prereq (Corner Adept ○, 110 SP) — bundledSpCost
    // mocked to the plain sum 160 + 110 = 270.
    expect(inDrawer.getByText('With white prereq').nextElementSibling).toHaveTextContent(
      '270 SP',
    );
    expect(
      inDrawer.getByText(/White prereq Corner Adept ○ assumed unhinted/),
    ).toBeInTheDocument();

    await user.click(inDrawer.getByRole('button', { name: 'Close details' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the hint-level assumption and discounted cost for a hint-pool source', async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(
      screen.getByRole('button', {
        name: 'Corner Adept ○ via Kitasan Black LB3: Hint+',
      }),
    );
    const drawer = screen.getByRole('dialog', {
      name: 'Coverage details: Corner Adept ○',
    });
    const inDrawer = within(drawer);
    // expectedHintLevel mocked to 2 for hint tiers; effectiveSpCost mocked to
    // baseSpCost (110) — the assumption line carries the level.
    expect(inDrawer.getByText('Effective SP cost').nextElementSibling).toHaveTextContent(
      '110 SP',
    );
    expect(inDrawer.getByText(/Assumes one hint event taken at Lv 2/)).toBeInTheDocument();
    // White skill, no prereq → no bundle row.
    expect(inDrawer.queryByText('With white prereq')).not.toBeInTheDocument();
  });

  it('shows an empty-state prompt when the plan has no target skills', () => {
    render(
      <CoverageMatrixPanel
        plan={{ ...FIXTURE_PLAN, wishlist: [] }}
        inventory={INVENTORY}
      />,
    );
    expect(screen.getByText('Add target skills above to see coverage.')).toBeInTheDocument();
  });

  describe('parent spark columns', () => {
    it('renders no parent columns when no parents are chosen', () => {
      renderPanel();
      expect(
        screen.queryByRole('columnheader', { name: /Parent \d/ }),
      ).not.toBeInTheDocument();
      expect(screen.queryByText(/spark/)).not.toBeInTheDocument();
    });

    it('renders one column per chosen parent, named by uma when known', async () => {
      renderPanel(INVENTORY, PLAN_WITH_PARENTS);
      // p1's uma is in the dataset → uma name; p2's is not → positional label.
      expect(
        await screen.findByRole('columnheader', { name: /Daiwa Scarlet/ }),
      ).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'Parent 2' })).toBeInTheDocument();
    });

    it('shows spark % chips, ≈-prefixed when the number is approximate', async () => {
      renderPanel(INVENTORY, PLAN_WITH_PARENTS);
      expect(
        await screen.findByRole('button', {
          name: 'Corner Adept ○ via Daiwa Scarlet: spark 17%',
        }),
      ).toHaveTextContent('spark 17%');
      expect(
        screen.getByRole('button', {
          name: 'Corner Adept ○ via Parent 2: spark ≈10%',
        }),
      ).toHaveTextContent('spark ≈10%');
    });

    it('spark drawer shows stars, origin, affinity, combined % and the P3 caveat', async () => {
      const user = userEvent.setup();
      renderPanel(INVENTORY, PLAN_WITH_PARENTS);
      await user.click(
        await screen.findByRole('button', {
          name: 'Corner Adept ○ via Daiwa Scarlet: spark 17%',
        }),
      );
      const drawer = screen.getByRole('dialog', {
        name: 'Coverage details: Corner Adept ○',
      });
      const inDrawer = within(drawer);
      expect(inDrawer.getByText(/via Daiwa Scarlet/)).toBeInTheDocument();
      expect(inDrawer.getByText('Spark stars').nextElementSibling).toHaveTextContent('3★');
      expect(inDrawer.getByText('Origin').nextElementSibling).toHaveTextContent(/^Parent$/);
      expect(inDrawer.getByText('Affinity used').nextElementSibling).toHaveTextContent('102');
      expect(inDrawer.getByText('Chance (this line)').nextElementSibling).toHaveTextContent(
        '17%',
      );
      // combinedSparkChance([p1,p2]) mocked to 25.3; ≈ because it's approximate.
      expect(
        inDrawer.getByText('Combined (all parents)').nextElementSibling,
      ).toHaveTextContent('≈25%');
      expect(
        inDrawer.getByText(
          /probability of the spark proccing at least once across both inspiration events — estimation, not a guarantee/,
        ),
      ).toBeInTheDocument();
      // No hint-cost block for sparks: SP branches live in the contingency view.
      expect(inDrawer.queryByText('Effective SP cost')).not.toBeInTheDocument();
    });

    it('marks grandparent-origin sparks and their approximate chance in the drawer', async () => {
      const user = userEvent.setup();
      renderPanel(INVENTORY, PLAN_WITH_PARENTS);
      await user.click(
        await screen.findByRole('button', {
          name: 'Corner Adept ○ via Parent 2: spark ≈10%',
        }),
      );
      const drawer = screen.getByRole('dialog', {
        name: 'Coverage details: Corner Adept ○',
      });
      const inDrawer = within(drawer);
      expect(inDrawer.getByText('Origin').nextElementSibling).toHaveTextContent(
        /^Grandparent$/,
      );
      expect(inDrawer.getByText('Chance (this line)').nextElementSibling).toHaveTextContent(
        '≈10%',
      );
      expect(
        inDrawer.getByText(/grandparent affinity fallback — mechanics-notes §4/),
      ).toBeInTheDocument();
    });

    it('FINDING 4: drawer discloses the total-affinity upper bound and the multi-parent combination', async () => {
      const user = userEvent.setup();
      renderPanel(INVENTORY, PLAN_WITH_PARENTS);
      // p1's line used a positive total affinity (affinityUsed 102) as a
      // per-member upper bound — the drawer must disclose that (FINDING 4b).
      await user.click(
        await screen.findByRole('button', {
          name: 'Corner Adept ○ via Daiwa Scarlet: spark 17%',
        }),
      );
      const drawer = screen.getByRole('dialog', {
        name: 'Coverage details: Corner Adept ○',
      });
      const inDrawer = within(drawer);
      expect(
        inDrawer.getByText(/entered TOTAL affinity as a per-member upper bound/),
      ).toBeInTheDocument();
      // Two parents contribute → the cross-parent combination is explained (4c).
      expect(
        inDrawer.getByText(/Combined across the contributing parents/),
      ).toBeInTheDocument();
    });
  });
});
