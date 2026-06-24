import type { SkillFrame } from '@/sim/types';

export interface StaminaVerdict {
  finishes: boolean;
  minHp: number;
  minHpPos: number;
  distance: number;
}

/**
 * Derive a stamina verdict from the baseline HP trace (`without` run from a skill trace).
 * Finds the minimum HP across all frames; `finishes` is true when HP never reaches ~0.
 * `minHpPos` is the course position (metres) where the minimum HP first occurs.
 */
export function staminaVerdict(without: SkillFrame[], distance: number): StaminaVerdict {
  let minHp = Infinity, minHpPos = 0;
  for (const f of without) {
    if (f.hp < minHp) {
      minHp = f.hp;
      minHpPos = f.pos;
    }
  }
  // "runs out" = HP bottoms out at ~0 anywhere in the race.
  return { finishes: minHp > 0.0001, minHp, minHpPos, distance };
}
