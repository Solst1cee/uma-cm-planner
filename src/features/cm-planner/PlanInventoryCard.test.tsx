import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// PlanInventoryCard imports GameIcon (lazy/async) — stub it so tests stay sync
vi.mock('@/features/data/GameIcon', () => ({
  GameIcon: () => <span data-testid="game-icon" />,
}));
// courseCatalog is a lazy sim import — stub it
vi.mock('@/sim/courseCatalog', () => ({
  courseCatalog: async () => [],
}));

import { PlanInventoryCard } from './PlanInventoryCard';
import { FIXTURE_PLAN } from '@/core/fixtures';
import type { CmPlan } from '@/core/types';

afterEach(cleanup);

const planA: CmPlan = { ...FIXTURE_PLAN, id: 'a', name: 'Plan A' };
const planB: CmPlan = { ...FIXTURE_PLAN, id: 'b', name: 'Plan B' };
const planC: CmPlan = { ...FIXTURE_PLAN, id: 'c', name: 'Plan C' };

const baseProps = {
  activePlan: planA,
  autoApplyTrack: true,
  plans: [planA, planB, planC],
  onAutoApplyTrackChange: vi.fn(),
  onDeletePlan: vi.fn(async () => undefined),
  onDeleteAllPlans: vi.fn(async () => undefined),
  onImportPlans: vi.fn(async () => 0),
  onSelectPlan: vi.fn(async () => undefined),
};

// --- existing zip tests (non-render) ---
import { createPlansZip } from './PlanInventoryCard';
import { strFromU8, unzipSync } from 'fflate';

describe('createPlansZip', () => {
  it('stores every saved plan as a separate readable JSON file', () => {
    const plans = [
      { ...FIXTURE_PLAN, id: 'one', name: 'CM15 / Kitasan' },
      { ...FIXTURE_PLAN, id: 'two', name: 'Rainy: Trial?' },
    ];

    const files = unzipSync(createPlansZip(plans));
    const names = Object.keys(files).sort();

    expect(names).toEqual(['01-CM15 - Kitasan.json', '02-Rainy- Trial-.json']);
    expect(JSON.parse(strFromU8(files[names[0]!]!))).toMatchObject({ id: 'one', name: 'CM15 / Kitasan' });
    expect(JSON.parse(strFromU8(files[names[1]!]!))).toMatchObject({ id: 'two', name: 'Rainy: Trial?' });
  });
});

// --- sliver (collapsed) tests ---
describe('PlanInventoryCard sliver', () => {
  it('inventory renders a sliver with the plan count when collapsed', () => {
    render(<PlanInventoryCard {...baseProps} plans={[planA, planB, planC]} collapsed onCollapsedChange={() => {}} />);
    expect(screen.getByRole('button', { name: /expand inventory/i })).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();             // plan count
    expect(screen.queryByText('Plan Inventory')).toBeNull();        // full header hidden
  });

  it('calls onCollapsedChange(false) when the expand button is clicked', () => {
    const onCollapsedChange = vi.fn();
    render(<PlanInventoryCard {...baseProps} collapsed onCollapsedChange={onCollapsedChange} />);
    screen.getByRole('button', { name: /expand inventory/i }).click();
    expect(onCollapsedChange).toHaveBeenCalledWith(false);
  });
});
