/** The selected uma2 (comparison plan) shown exactly like an active inventory row
 *  (`cmp-inventory-row is-active`) but with a red/maroon accent (uma2 = red theme). */
import type { CmPlan } from '@/core/types';
import { GameIcon } from '@/features/data/GameIcon';
import { statLine, aptitudeLine } from './planSummary';

export function Uma2Card({ plan }: { plan: CmPlan }) {
  return (
    <article className="cmp-inventory-row is-active cmp-uma2-card">
      <div className="cmp-inventory-select">
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
      </div>
    </article>
  );
}
