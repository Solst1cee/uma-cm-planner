/**
 * Image-retrofit integration: when the icon manifest is loaded, Module 4
 * surfaces render the bundled images alongside their existing text labels.
 * Covers the coverage matrix (skill icon per row) and an inventory card chip.
 * The text labels must remain (images augment, never replace).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { CmPlan, CoverageRow, OwnedCard } from '@/core/types';
import type { IconManifest } from '@/core/icons';
import { FIXTURE_PLAN } from '@/core/fixtures';

const ICON_MANIFEST: IconManifest = {
  dataVersion: 'test',
  format: 'webp',
  // FIXTURE_SKILLS: 200331 -> iconId 20012, 200014 -> 10012, 210061 -> 20142.
  skill: ['20012', '10012', '20142'],
  // FIXTURE_CARDS: Kitasan Black = 30028.
  card: ['30028'],
  uma: ['100201'],
};

vi.mock('@/features/data/gameData', async () => {
  const { fixtureGameData } = await import('@/features/testing/fixtureGameData');
  return {
    BASE_URL: '/base/',
    useGameData: () => ({ ...fixtureGameData(), iconManifest: ICON_MANIFEST }),
  };
});

// Coverage matrix deps (mirrors CoverageMatrixPanel.test): deterministic core.
const mocked = vi.hoisted(() => {
  const rows = [
    {
      skillId: '200331', // Professor of Curvature, iconId 20012
      priority: 1,
      sources: [{ kind: 'chain', cardId: '30028', ownedId: 1, limitBreak: 3 }],
      bestTier: 'chain',
    },
  ];
  return { rows };
});

vi.mock('@/db', () => ({
  listParents: vi.fn(async () => []),
  listOwnedCards: vi.fn(async () => [{ id: 1, cardId: '30028', limitBreak: 2 }]),
  addOwnedCard: vi.fn(async () => 2),
  updateOwnedCard: vi.fn(async () => undefined),
  removeOwnedCard: vi.fn(async () => undefined),
}));

vi.mock('@/core/coverage', () => ({
  buildCoverageMatrix: vi.fn(() => mocked.rows as unknown as CoverageRow[]),
  classifyHintTier: vi.fn(() => 'hint_weak' as const),
  effectiveSpCost: vi.fn(() => 100),
  expectedHintLevel: vi.fn(() => 0),
  bundledSpCost: vi.fn(() => 200),
}));

vi.mock('@/core/spark', () => ({
  combinedSparkChance: vi.fn(() => ({ pct: 0, approximate: false })),
}));

const { CoverageMatrixPanel } = await import('@/features/coverage/CoverageMatrixPanel');
const { InventoryPanel } = await import('@/features/inventory/InventoryPanel');

const INVENTORY: OwnedCard[] = [{ id: 1, cardId: '30028', limitBreak: 3 }];
const PLAN: CmPlan = { ...FIXTURE_PLAN, targetSkills: [{ skillId: '200331', priority: 1 }] };

afterEach(cleanup);

describe('coverage matrix skill icons', () => {
  it('renders a skill icon (resolved src) beside the skill name, keeping the text label', () => {
    render(<CoverageMatrixPanel plan={PLAN} inventory={INVENTORY} />);
    const rowHeader = screen.getByRole('rowheader', { name: /Professor of Curvature/ });
    // Text label still present (augment, not replace).
    expect(rowHeader).toHaveTextContent('Professor of Curvature');
    // Decorative icon (alt="") so it's not in the a11y tree — assert via DOM.
    const img = rowHeader.querySelector('img.game-icon');
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute('src', '/base/data/icons/skill/20012.webp');
  });
});

describe('inventory card chip', () => {
  it('renders the support-card image next to the owned card, keeping the name', () => {
    render(
      <InventoryPanel
        inventory={INVENTORY}
        error={null}
        onAdd={() => undefined}
        onSetLimitBreak={() => undefined}
        onRemove={() => undefined}
      />,
    );
    const list = screen.getByRole('list', { name: 'Owned cards' });
    const row = within(list).getByText('Kitasan Black').closest('.owned-row');
    expect(row).not.toBeNull();
    const img = (row as HTMLElement).querySelector('img.game-icon');
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute('src', '/base/data/icons/support/30028.webp');
  });
});
