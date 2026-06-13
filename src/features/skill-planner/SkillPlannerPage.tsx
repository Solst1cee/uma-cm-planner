/**
 * Module 4 page: plan header + chosen parents + inventory + coverage matrix
 * + deck suggester + spark contingencies (plan §6 build steps 2–5).
 * Panels stack vertically — mobile-first.
 */
import { useActivePlan } from '@/app/ActivePlanContext';
import { useGameData } from '@/features/data/gameData';
import { useInventory } from '@/features/inventory/useInventory';
import { InventoryPanel } from '@/features/inventory/InventoryPanel';
import { ChosenParentsPicker } from '@/features/parents/ChosenParentsPicker';
import { PlanHeaderPanel } from '@/features/skill-planner/PlanHeaderPanel';
import { DeckSuggesterPanel } from '@/features/skill-planner/DeckSuggesterPanel';
import { CoverageMatrixPanel } from '@/features/coverage/CoverageMatrixPanel';
import { SparkContingencyPanel } from '@/features/coverage/SparkContingencyPanel';

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
      <ChosenParentsPicker />
      <InventoryPanel
        inventory={inventory.items}
        error={inventory.error}
        onAdd={inventory.add}
        onSetLimitBreak={inventory.setLimitBreak}
        onRemove={inventory.remove}
      />
      <CoverageMatrixPanel plan={plan} inventory={inventory.items ?? []} />
      <DeckSuggesterPanel
        plan={plan}
        onChange={setPlan}
        inventory={inventory.items ?? []}
      />
      <SparkContingencyPanel plan={plan} inventory={inventory.items ?? []} />
    </div>
  );
}
