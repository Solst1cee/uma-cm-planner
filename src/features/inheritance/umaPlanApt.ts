// src/features/inheritance/umaPlanApt.ts
/** The three pink aptitude chips shown on the M1 "Your uma plan" card
 *  (handoff README §"1. Your uma plan panel"): the plan's current surface /
 *  distance / strategy keys, graded by the selected uma's base aptitudes. */
import { currentAptitudeKeys } from '@/core/simBuild';
import type { CmPlan, Grade, Strategy, UmaRecord } from '@/core/types';
import { STRATEGY_LABEL, cap } from './labels';

export interface AptChip {
  label: string;
  grade: Grade;
}

export function umaPlanAptChips(plan: CmPlan, uma: UmaRecord | null): AptChip[] {
  const apt = uma?.baseAptitudes;
  if (!apt) return [];
  const keys = currentAptitudeKeys(plan);
  // currentAptitudeKeys guarantees each AptKey's discriminant, so the narrowing
  // casts below are safe (surface→turf/dirt, distance→short/…/long, strategy→Strategy).
  const surface = keys.surface.key as 'turf' | 'dirt';
  const distance = keys.distance.key as 'short' | 'mile' | 'medium' | 'long';
  const strategy = keys.strategy.key as Strategy;
  return [
    { label: cap(surface), grade: apt.surface[surface] },
    { label: cap(distance), grade: apt.distance[distance] },
    { label: STRATEGY_LABEL[strategy], grade: apt.strategy[strategy] },
  ];
}
