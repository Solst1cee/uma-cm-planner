/**
 * Coverage matrix rendering against the fixture plan, with deterministic
 * mocked core output (the core's own behavior is covered by coverage.test.ts).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import type { CoverageRow, CoverageSource, OwnedCard, SkillRecord } from '@/core/types';
import { FIXTURE_PLAN } from '@/core/fixtures';
import { CoverageMatrixPanel } from '@/features/coverage/CoverageMatrixPanel';

vi.mock('@/features/data/gameData', async () => {
  const { fixtureGameData } = await import('@/features/testing/fixtureGameData');
  return { useGameData: () => fixtureGameData() };
});

const mocked = vi.hoisted(() => {
  // Rows deliberately NOT in priority order — the panel must sort them.
  // Card sources carry ownedId + limitBreak (core sets both since the
  // duplicate-copy fix); the panel must filter cells by ownedId.
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
      skillId: '200332', // Corner Adept ○ (white; hint source)
      priority: 2,
      sources: [
        {
          kind: 'hint_strong',
          cardId: '30028',
          ownedId: 1,
          limitBreak: 3,
          detail: { hintPoolSize: 2, hintFrequency: 40, specialtyPriority: 100 },
        },
      ],
      bestTier: 'hint_strong',
    },
  ];
  return { rows };
});

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

const INVENTORY: OwnedCard[] = [{ id: 1, cardId: '30028', limitBreak: 3 }];

afterEach(cleanup);

function renderPanel(inventory: OwnedCard[] = INVENTORY) {
  return render(<CoverageMatrixPanel plan={FIXTURE_PLAN} inventory={inventory} />);
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
        plan={{ ...FIXTURE_PLAN, targetSkills: [] }}
        inventory={INVENTORY}
      />,
    );
    expect(screen.getByText('Add target skills above to see coverage.')).toBeInTheDocument();
  });
});
