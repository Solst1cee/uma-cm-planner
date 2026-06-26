// src/features/inheritance/labels.ts
/** Shared display labels for the M1 inheritance workbench (strategy names +
 *  capitalize). Kept in one place so the header, the uma-plan card, and later
 *  M1 cards format aptitude/strategy labels identically. */
import type { Strategy } from '@/core/types';

export const STRATEGY_LABEL: Record<Strategy, string> = {
  front: 'Front',
  pace: 'Pace',
  late: 'Late',
  end: 'End',
};

export const cap = (v: string): string => v.charAt(0).toUpperCase() + v.slice(1);
