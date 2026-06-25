// src/features/inheritance/planContextHeader.ts
/** Pure view-model for the M1 workbench plan-context header (handoff README
 *  §"Top: Plan context header"). Derives display strings from the active CmPlan
 *  plus an already-resolved racetrack name (resolution itself is async + lives
 *  in the page, so this stays pure + unit-testable). */
import { distanceClass } from '@/core/simBuild';
import type { CmPlan, Strategy } from '@/core/types';

export interface PlanContextView {
  /** "PLAN #N" badge text. */
  planLabel: string;
  /** Plan name (falls back to "Untitled plan"). */
  name: string;
  /** "From CM Planner · {Track} Racecourse" (suffix dropped when track unknown). */
  source: string;
  /** Right-aligned chips: surface / distance / strategy. */
  chips: { surface: string; distance: string; strategy: string };
}

const STRATEGY_LABEL: Record<Strategy, string> = { front: 'Front', pace: 'Pace', late: 'Late', end: 'End' };
const cap = (v: string): string => v.charAt(0).toUpperCase() + v.slice(1);

export function planContextView(plan: CmPlan, trackName: string | null): PlanContextView {
  const dist = plan.cmRef.distance;
  return {
    planLabel: `PLAN #${plan.planNumber}`,
    name: plan.name.trim() || 'Untitled plan',
    source: trackName ? `From CM Planner · ${trackName} Racecourse` : 'From CM Planner',
    chips: {
      surface: cap(plan.cmRef.surface),
      distance: `${cap(distanceClass(dist))} · ${dist}m`,
      strategy: STRATEGY_LABEL[plan.strategy],
    },
  };
}
