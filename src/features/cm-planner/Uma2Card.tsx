/** The selected uma2 (comparison plan) shown as an inventory-style card with a red/maroon accent
 *  (uma2 = red theme). Portrait + name + stat line + aptitude line, matching the inventory rows. */
import type { CmPlan } from '@/core/types';
import { GameIcon } from '@/features/data/GameIcon';
import { statLine, aptitudeLine } from './planSummary';

export function Uma2Card({ plan }: { plan: CmPlan }) {
  return (
    <article className="cmp-inventory-row cmp-uma2-card">
      {plan.umaId ? (
        <GameIcon kind="uma" id={plan.umaId} size={34} alt="" />
      ) : (
        <span className="cmp-inventory-portrait">uma</span>
      )}
      <div className="cmp-inventory-plan-main">
        <strong>{plan.name || plan.id}</strong>
        <span>{statLine(plan)}</span>
        <span>{aptitudeLine(plan)}</span>
      </div>
    </article>
  );
}
