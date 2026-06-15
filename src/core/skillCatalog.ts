/** The acquirable-skill catalog for the §1 chart: purchasable + inherited-unique
 *  skills on the plan's server (P4: never mix JP into a Global chart). Native
 *  runner uniques (rarity 'unique') belong to the Uma chart, not here. */
import type { Server, SkillRecord } from '@/core/types';

const CHART_RARITIES = new Set(['white', 'gold', 'inherited_unique']);

export function acquirableSkills(skills: SkillRecord[], server: Server): SkillRecord[] {
  return skills.filter((s) => s.server === server && CHART_RARITIES.has(s.rarity));
}

export type SkillCategory = 'normal' | 'scenario' | 'inherited';

export function skillCategory(skill: SkillRecord): SkillCategory {
  if (skill.rarity === 'inherited_unique') return 'inherited';
  if (skill.scenarioId !== undefined) return 'scenario';
  return 'normal';
}
