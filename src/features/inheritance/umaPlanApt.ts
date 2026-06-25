/** The pink aptitude chips on the M1 "Uma plan" card (handoff README
 *  §"1. Your uma plan panel"): the plan's three active aptitudes —
 *  distance · surface · strategy — each with its target grade (e.g. "Long A").
 *  Uses the same source as the M4 sidebar (`targetAptitude`): the stored pink
 *  goal if set, else the active default (distance S, surface/strategy A). So it
 *  always shows all three and follows the selected plan's race + strategy. */
import { currentAptitudeKeys, targetAptitude } from '@/core/simBuild';
import type { AptKey, CmPlan, Grade } from '@/core/types';
import { cap } from './labels';

export interface AptChip {
  label: string;
  grade: Grade;
}

export function umaPlanAptChips(plan: CmPlan): AptChip[] {
  const keys = currentAptitudeKeys(plan);
  const chip = (key: AptKey): AptChip => ({
    label: cap(key.key),
    grade: targetAptitude(plan, key) ?? 'A',
  });
  return [chip(keys.distance), chip(keys.surface), chip(keys.strategy)];
}
