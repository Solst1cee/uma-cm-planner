// src/features/inheritance/PlanContextHeader.tsx
/** M1 workbench plan-context header (handoff README §"Top: Plan context header").
 *  Presentational — derives its strings from planContextView so it stays testable
 *  without the ActivePlan context. */
import type { CmPlan } from '@/core/types';
import { planContextView } from './planContextHeader';

export function PlanContextHeader({ plan, trackName }: { plan: CmPlan | null; trackName: string | null }) {
  if (!plan) {
    return (
      <div className="panel inh-context inh-context-empty" role="status">
        <span className="inh-context-source">Loading plan…</span>
      </div>
    );
  }
  const v = planContextView(plan, trackName);
  return (
    <div className="panel inh-context">
      <span className="badge inh-plan-badge">{v.planLabel}</span>
      <h1 className="inh-context-name">{v.name}</h1>
      <span className="inh-context-source">{v.source}</span>
      <div className="inh-context-chips">
        <span className="chip-sm">{v.chips.surface}</span>
        <span className="chip-sm">{v.chips.distance}</span>
        <span className="chip-sm">{v.chips.strategy}</span>
      </div>
    </div>
  );
}
