// src/features/inheritance/weightsPanelModel.ts
/** M1.6 — pure immutable setters for ScoreWeightsPanel (mirrors euophrys Weights.jsx state). */
import type { UmaTiersScenario } from '@/vendor/uma-tiers/index';

export type TypeKey = 'speed' | 'stamina' | 'power' | 'guts' | 'wisdom' | 'friend';
export const TYPE_TABS: { key: TypeKey; label: string }[] = [
  { key: 'speed', label: 'Speed' }, { key: 'stamina', label: 'Stamina' },
  { key: 'power', label: 'Power' }, { key: 'guts', label: 'Guts' },
  { key: 'wisdom', label: 'Wisdom' }, { key: 'friend', label: 'Friend' },
];

const clone = (s: UmaTiersScenario): UmaTiersScenario => JSON.parse(JSON.stringify(s));

export function setStatWeight(s: UmaTiersScenario, typeKey: TypeKey, idx: number, val: number) {
  const n = clone(s); (n[typeKey] as { stats: number[] }).stats[idx] = val; return n;
}
export function setStatField(s: UmaTiersScenario, typeKey: TypeKey, key: 'cap' | 'minimum' | 'prioritize' | 'onlySummer', val: number | boolean) {
  const n = clone(s); (n[typeKey] as unknown as Record<string, unknown>)[key] = val; return n;
}
export function setGeneral(s: UmaTiersScenario, key: keyof UmaTiersScenario['general'], val: number) {
  const n = clone(s); (n.general as unknown as Record<string, unknown>)[key] = val; return n;
}
export function setGeneralArray(s: UmaTiersScenario, key: 'races', idx: number, val: number) {
  const n = clone(s); (n.general[key] as number[])[idx] = val; return n;
}
export function setUmaBonus(s: UmaTiersScenario, idx: number, val: number) {
  const n = clone(s); n.general.umaBonus[idx] = val; return n;
}
