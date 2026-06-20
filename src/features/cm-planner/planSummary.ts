/** Compact plan summary lines (stats + aptitudes), shared by the uma2 picker popover and the
 *  selected-uma2 card — mirrors the inventory rows' readout. */
import { currentAptitudeKeys, targetAptitude } from '@/core/simBuild';
import type { CmPlan, Stat, Strategy } from '@/core/types';

const STAT_ORDER: Stat[] = ['spd', 'sta', 'pow', 'gut', 'wit'];
const STRATEGY_LABEL: Record<Strategy, string> = { front: 'Front', pace: 'Pace', late: 'Late', end: 'End' };
const cap = (v: string): string => v.charAt(0).toUpperCase() + v.slice(1);

export const statLine = (p: CmPlan): string => STAT_ORDER.map((s) => p.statProfile.stats[s]).join(' / ');

export function aptitudeLine(p: CmPlan): string {
  const keys = currentAptitudeKeys(p);
  return [
    `${cap(p.cmRef.surface)} ${targetAptitude(p, keys.surface) ?? '-'}`,
    `${cap(keys.distance.key)} ${targetAptitude(p, keys.distance) ?? '-'}`,
    `${STRATEGY_LABEL[p.strategy]} ${targetAptitude(p, keys.strategy) ?? '-'}`,
  ].join(' / ');
}
