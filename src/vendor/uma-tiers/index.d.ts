// Type surface for the vendored uma-tiers scorer (Euophrys/umamusume-tierlist, MIT).
// Sidecar .d.ts files (gl.d.ts / tierlist-calc.d.ts / scenarios.d.ts) provide per-module
// declarations; this file holds the shared interfaces they reference.
export interface UmaTiersCard {
  id: number; type: number; group: boolean; rarity: number; limit_break: number;
  char_name: string; starting_stats: number[]; stat_bonus: number[]; race_bonus: number;
  specialty_rate: number; tb: number; mb: number; fs_bonus: number; fs_stats: number[];
  hint_rate: number; sb: number; [k: string]: unknown;
}
export interface UmaTiersScoredRow { id: number; lb: number; score: number; info: unknown; char_name: string }
export interface UmaTiersStatType { type: number; stats: number[]; cap: number; minimum: number; prioritize?: boolean; onlySummer?: boolean }
export interface UmaTiersGeneral {
  bondPerDay: number; races: number[]; umaBonus: number[]; multi: number; bonusSpec: number;
  motivation: number; scenarioBonus: number; fanBonus: number; scenarioLink: number[];
  unbondedTrainingGain: number[][]; bondedTrainingGain: number[][]; summerTrainingGain: number[][];
}
export interface UmaTiersScenario extends Record<string, unknown> {
  version: number; currentState: string; show: boolean; general: UmaTiersGeneral;
  speed: UmaTiersStatType; stamina: UmaTiersStatType; power: UmaTiersStatType;
  guts: UmaTiersStatType; wisdom: UmaTiersStatType; friend: UmaTiersStatType;
}
export type UmaTiersWeights = UmaTiersStatType & UmaTiersGeneral;
