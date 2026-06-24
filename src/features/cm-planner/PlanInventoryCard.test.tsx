import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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

const planP: CmPlan = { ...FIXTURE_PLAN, id: 'p', name: 'p' };

const baseProps = {
  activePlan: planA,
  autoApplyTrack: true,
  plans: [planA, planB, planC],
  onAutoApplyTrackChange: vi.fn(),
  onDeletePlan: vi.fn(async () => undefined),
  onDeleteAllPlans: vi.fn(async () => undefined),
  onImportPlans: vi.fn(async () => 0),
  onLoadPlanIntoSlot: vi.fn(async () => undefined),
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

// --- shared render helper ---
async function renderInventory(overrides: Partial<Parameters<typeof PlanInventoryCard>[0]> = {}) {
  const plans = overrides.plans ?? [planP];
  render(
    <PlanInventoryCard
      activePlan={planP}
      plans={plans}
      autoApplyTrack={false}
      onAutoApplyTrackChange={vi.fn()}
      onDeletePlan={vi.fn(async () => {})}
      onDeleteAllPlans={vi.fn(async () => {})}
      onImportPlans={vi.fn(async () => 0)}
      onLoadPlanIntoSlot={vi.fn(async () => {})}
      {...overrides}
    />,
  );
  // Wait for the async course catalog load to complete so groups are rendered.
  // Await the EFFECTIVE first plan (not a hardcoded name) so a `plans` override
  // doesn't leave a floating findByText that rejects after the test. For collapsed
  // mode there are no groups, so skip the wait.
  if (!overrides.collapsed) {
    await screen.findByText(plans[0]!.name);
  }
}

// --- sliver (collapsed) tests ---
describe('PlanInventoryCard sliver', () => {
  it('inventory renders a sliver with a backpack and no count when collapsed', () => {
    render(<PlanInventoryCard {...baseProps} plans={[planA, planB, planC]} collapsed onCollapsedChange={() => {}} />);
    expect(screen.getByRole('button', { name: /expand inventory/i })).toBeInTheDocument();
    expect(screen.queryByText('3')).toBeNull();                     // no plan count
    expect(screen.queryByText('Plan Inventory')).toBeNull();        // full header hidden
  });

  it('calls onCollapsedChange(false) when the expand button is clicked', () => {
    const onCollapsedChange = vi.fn();
    render(<PlanInventoryCard {...baseProps} collapsed onCollapsedChange={onCollapsedChange} />);
    screen.getByRole('button', { name: /expand inventory/i }).click();
    expect(onCollapsedChange).toHaveBeenCalledWith(false);
  });
});

// --- edit mode tests ---
describe('PlanInventoryCard edit mode', () => {
  it('hides per-item and per-group destructive buttons until edit mode is on', async () => {
    await renderInventory();
    // header trio always present
    expect(screen.getByRole('button', { name: /Download all plans as ZIP/i })).toBeInTheDocument();
    // per-item / per-group hidden by default
    expect(screen.queryByRole('button', { name: /^Delete plan$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Download all plans in /i })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Edit inventory/i }));
    expect(screen.getAllByRole('button', { name: /^Delete plan$/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /^Download all plans in /i }).length).toBeGreaterThan(0);
  });

  it('exits edit mode on an outside click but stays when an action is clicked', async () => {
    await renderInventory();
    fireEvent.click(screen.getByRole('button', { name: /Edit inventory/i }));
    // delete an item → still in edit mode (delete buttons still present)
    fireEvent.click(screen.getAllByRole('button', { name: /^Delete plan$/i })[0]!);
    expect(screen.getAllByRole('button', { name: /^Delete plan$/i }).length).toBeGreaterThan(0);
    // outside click → exit
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('button', { name: /^Delete plan$/i })).toBeNull();
  });

  it('collapsed sliver shows the backpack with no count', async () => {
    await renderInventory({ collapsed: true });
    expect(screen.queryByText(/^\d+$/)).toBeNull(); // no plan count number
    expect(screen.getByRole('button', { name: /Expand inventory/i })).toBeInTheDocument();
  });
});

describe('PlanInventoryCard slot picking', () => {
  it('row body loads the focused slot; badges load the explicit slot', async () => {
    const onLoad = vi.fn();
    await renderInventory({ focused: 'uma2', onLoadPlanIntoSlot: onLoad });
    const planName = await screen.findByText('p'); // fixture plan name
    fireEvent.click(planName.closest('button')!);   // row body
    expect(onLoad).toHaveBeenLastCalledWith('p', 'uma2');

    fireEvent.click(screen.getByRole('button', { name: /load .* as uma1/i }));
    expect(onLoad).toHaveBeenLastCalledWith('p', 'uma1');
    fireEvent.click(screen.getByRole('button', { name: /load .* as uma2/i }));
    expect(onLoad).toHaveBeenLastCalledWith('p', 'uma2');
  });

  it('glows the uma1 row blue and the uma2 row red', async () => {
    await renderInventory({ plans: [planA, planB], uma1PlanId: planA.id, uma2PlanId: planB.id });
    expect(document.querySelector(`.cmp-inventory-row.is-uma1`)).not.toBeNull();
    expect(document.querySelector(`.cmp-inventory-row.is-uma2`)).not.toBeNull();
  });

  it('hides slot badges in edit mode', async () => {
    await renderInventory();
    expect(screen.getByRole('button', { name: /load .* as uma1/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Edit inventory/i }));
    expect(screen.queryByRole('button', { name: /load .* as uma1/i })).toBeNull();
  });
});
