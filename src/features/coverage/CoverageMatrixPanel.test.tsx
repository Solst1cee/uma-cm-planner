/**
 * Coverage matrix rendering against the fixture plan, with deterministic
 * mocked core output (the core's own behavior is covered by coverage.test.ts).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import type { CoverageRow, OwnedCard, SkillRecord } from '@/core/types';
import { FIXTURE_PLAN } from '@/core/fixtures';
import { CoverageMatrixPanel } from '@/features/coverage/CoverageMatrixPanel';

vi.mock('@/features/data/gameData', async () => {
  const { fixtureGameData } = await import('@/features/testing/fixtureGameData');
  return { useGameData: () => fixtureGameData() };
});

const mocked = vi.hoisted(() => {
  // Rows deliberately NOT in priority order — the panel must sort them.
  const rows = [
    {
      skillId: '210061', // Shooting for the Top
      priority: 3,
      sources: [],
      bestTier: 'uncovered',
    },
    {
      skillId: '200331', // Professor of Curvature
      priority: 1,
      sources: [
        {
          kind: 'chain',
          cardId: '30028',
          detail: { hintPoolSize: 2, hintFrequency: 40, specialtyPriority: 100 },
        },
      ],
      bestTier: 'chain',
    },
    {
      skillId: '200014', // Right Turns ◎
      priority: 2,
      sources: [
        { kind: 'random', cardId: '30028' },
        { kind: 'scenario' },
      ],
      bestTier: 'random',
    },
  ];
  return { rows };
});

vi.mock('@/core/coverage', () => ({
  buildCoverageMatrix: vi.fn(() => mocked.rows as unknown as CoverageRow[]),
  classifyHintTier: vi.fn(() => 'hint_weak' as const),
  effectiveSpCost: vi.fn((skill: SkillRecord) => skill.baseSpCost),
}));

const INVENTORY: OwnedCard[] = [{ id: 1, cardId: '30028', limitBreak: 3 }];

afterEach(cleanup);

function renderPanel() {
  return render(<CoverageMatrixPanel plan={FIXTURE_PLAN} inventory={INVENTORY} />);
}

describe('CoverageMatrixPanel', () => {
  it('renders one row per target skill, sorted by priority, with tier chips', () => {
    renderPanel();
    const rowHeaders = screen.getAllByRole('rowheader');
    expect(rowHeaders.map((h) => h.textContent)).toEqual([
      expect.stringContaining('Professor of Curvature'),
      expect.stringContaining('Right Turns ◎'),
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

  it('opens a details drawer with evidence and effective SP cost on cell tap', async () => {
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
    // effectiveSpCost mocked to baseSpCost; Professor of Curvature = 160.
    expect(inDrawer.getByText('Effective SP cost').nextElementSibling).toHaveTextContent(
      '160 SP',
    );
    expect(inDrawer.getByText(/Assumes one hint event/)).toBeInTheDocument();

    await user.click(inDrawer.getByRole('button', { name: 'Close details' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
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
