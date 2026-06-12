/**
 * Support-card passive matrix evaluation — docs/mechanics-notes.md §9
 * (verified against GLOBAL master.mdb support_card_effect_table, 2026-06-12).
 *
 * Matrix row shape (after stripping the effect-type prefix): 11 values at
 * levels 1/5/10/.../50, -1 = unspecified at that breakpoint.
 * Rules: below the first specified breakpoint the passive is inactive (0);
 * between specified breakpoints, linear interpolation with integer floor;
 * after the last specified breakpoint, carry the last value forward.
 * Reference impl: Tachyons-lab helper.py lerp_levels.
 */
import type { CardPerLevel, LimitBreak } from '@/core/types';

export const MATRIX_LEVELS = [1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50] as const;

/** Level cap at each limit break by rarity (mechanics-notes §9, support_card_limit). */
export const LEVEL_CAPS: Record<'R' | 'SR' | 'SSR', readonly [number, number, number, number, number]> = {
  R: [20, 25, 30, 35, 40],
  SR: [25, 30, 35, 40, 45],
  SSR: [30, 35, 40, 45, 50],
};

/**
 * Passive effect ids used by the hint model (mechanics-notes §9).
 *
 * DELIBERATE Phase-1 omission (review follow-up, 2026-06-12): effect 30 =
 * Skill Point Bonus (33 rows in the Global extract, listed as a model input
 * in mechanics-notes §9) is NOT carried into CardPerLevel — Module 4 coverage
 * doesn't use it. Module 2 (SP Purchase Optimizer, plan §8) must add a
 * `skillPointBonus` field to CardPerLevel (types.ts) and evaluate it here
 * with the same level-cap rule. Dated note: docs/provenance.md §3 known gaps.
 */
export const EFFECT_HINT_LEVELS = 17;
export const EFFECT_HINT_FREQUENCY = 18;
export const EFFECT_SPECIALTY_PRIORITY = 19;

/**
 * Evaluate one passive row at a card level.
 * @param values 11 matrix values aligned to MATRIX_LEVELS (no effect-type prefix).
 */
export function passiveValueAt(values: readonly number[], level: number): number {
  const points: Array<{ lvl: number; val: number }> = [];
  for (let i = 0; i < MATRIX_LEVELS.length; i += 1) {
    const val = values[i];
    if (val !== undefined && val !== -1) {
      points.push({ lvl: MATRIX_LEVELS[i] as number, val });
    }
  }
  const first = points[0];
  const last = points[points.length - 1];
  if (first === undefined || last === undefined) return 0;
  if (level < first.lvl) return 0; // not yet active
  if (level >= last.lvl) return last.val; // carry-forward
  for (let i = 0; i < points.length - 1; i += 1) {
    const lo = points[i] as { lvl: number; val: number };
    const hi = points[i + 1] as { lvl: number; val: number };
    if (level >= lo.lvl && level < hi.lvl) {
      if (level === lo.lvl) return lo.val;
      return Math.floor(lo.val + ((hi.val - lo.val) * (level - lo.lvl)) / (hi.lvl - lo.lvl));
    }
  }
  return last.val; // unreachable: level bounded by first/last above
}

/**
 * Derive the per-limit-break passive values from a card's effects matrix
 * (rows include the effect-type prefix at index 0).
 */
export function buildPerLevel(
  effects: readonly (readonly number[])[],
  rarity: 'R' | 'SR' | 'SSR',
): CardPerLevel[] {
  const rowFor = (effectId: number): readonly number[] | undefined => {
    const row = effects.find((r) => r[0] === effectId);
    return row?.slice(1);
  };
  const hintLevels = rowFor(EFFECT_HINT_LEVELS);
  const hintFrequency = rowFor(EFFECT_HINT_FREQUENCY);
  const specialtyPriority = rowFor(EFFECT_SPECIALTY_PRIORITY);
  const caps = LEVEL_CAPS[rarity];

  return caps.map((cap, lb) => ({
    limitBreak: lb as LimitBreak,
    hintFrequency: hintFrequency ? passiveValueAt(hintFrequency, cap) : 0,
    hintLevels: hintLevels ? passiveValueAt(hintLevels, cap) : 0,
    specialtyPriority: specialtyPriority ? passiveValueAt(specialtyPriority, cap) : 0,
  }));
}
