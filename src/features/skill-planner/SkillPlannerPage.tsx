/**
 * Module 4 page: plan header + inventory + read-only coverage matrix
 * (plan §6 build steps 2–3). Panels stack vertically — mobile-first.
 */
import { useActivePlan } from '@/app/ActivePlanContext';
import { useGameData } from '@/features/data/gameData';
import { useInventory } from '@/features/inventory/useInventory';
import { InventoryPanel } from '@/features/inventory/InventoryPanel';
import { PlanHeaderPanel } from '@/features/skill-planner/PlanHeaderPanel';
import { CoverageMatrixPanel } from '@/features/coverage/CoverageMatrixPanel';

export function SkillPlannerPage() {
  const { status } = useGameData();
  const { plan, setPlan, loadError } = useActivePlan();
  const inventory = useInventory();

  if (loadError) {
    return (
      <p className="error" role="alert">
        Failed to load plan: {loadError}
      </p>
    );
  }
  if (status === 'loading' || plan === null) {
    return <p className="muted">Loading…</p>;
  }

  return (
    <div className="page">
      <PlanHeaderPanel plan={plan} onChange={setPlan} />
      <InventoryPanel
        inventory={inventory.items}
        error={inventory.error}
        onAdd={inventory.add}
        onSetLimitBreak={inventory.setLimitBreak}
        onRemove={inventory.remove}
      />
      <CoverageMatrixPanel plan={plan} inventory={inventory.items ?? []} />
    </div>
  );
}
