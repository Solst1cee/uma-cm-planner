// src/core/skillCategory.ts
/**
 * Per-skill "in-game icon" category + the order the M1.7 bonus list sorts by.
 * Pure classifier (shared by the build script scripts/build-skill-categories.ts,
 * which supplies the master.mdb ability signals, and the app which reads the
 * baked public/data/skill_categories.json).
 */
import type { SkillRarity } from '@/core/types';

export type SkillCategory = 'unique' | 'normal' | 'recovery' | 'green' | 'debuff';

/** Baked per-skill sort metadata (public/data/skill_categories.json value):
 *  the icon category + the master.mdb `group_id` that clusters a skill's
 *  gold/white/○/◎ family so they sort adjacently. */
export interface SkillSortMeta { category: SkillCategory; group: number; }

/** Bonus-list sort order (index = rank). */
export const CATEGORY_ORDER: SkillCategory[] = ['unique', 'normal', 'recovery', 'green', 'debuff'];

/** Rank of a category (unknown → after all known ones). */
export function categoryRank(category: SkillCategory | undefined): number {
  const i = category ? CATEGORY_ORDER.indexOf(category) : -1;
  return i === -1 ? CATEGORY_ORDER.length : i;
}

/** First effect of a skill, from master.mdb skill_data. */
export interface SkillAbility {
  /** skill_data.skill_category — 0 = race-start passive (緑 green skills). */
  category?: number | null;
  abilityType?: number | null;
  targetType?: number | null;
  value?: number | null;
}

/**
 * Classify one skill by its in-game icon type:
 * - unique  : rarity unique / inherited_unique
 * - debuff  : effect targets opponents (target_type ≠ 1 self), or a negative HP-recovery (stamina drain)
 * - recovery: ability_type 9 (HP recovery) on self
 * - green   : skill_category 0 (race-start condition/aptitude/strategy passives — 緑スキル,
 *             incl. Right-Handed, racecourse, weather, Runaway, …)
 * - normal  : everything else (active speed / accel skills)
 *
 * `ability` is undefined when the skill isn't in skill_data (e.g. an
 * inherited-unique 9xxxxx) — rarity still routes those to `unique`.
 */
export function classifySkill(rarity: SkillRarity | undefined, ability: SkillAbility | undefined): SkillCategory {
  if (rarity === 'unique' || rarity === 'inherited_unique') return 'unique';
  if (ability === undefined) return 'normal';
  const { category: cat, abilityType: a, targetType: t, value: v } = ability;
  if ((t != null && t !== 1) || (a === 9 && v != null && v < 0)) return 'debuff';
  if (a === 9) return 'recovery';
  if (cat === 0) return 'green';
  return 'normal';
}
