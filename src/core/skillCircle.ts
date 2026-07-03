// src/core/skillCircle.ts
/**
 * White sparks only ever grant the single-circle (○) grade of a skill, but a
 * parent's recorded spark id can point at the double-circle (◎) variant (a
 * parent that holds the ◎ in its own kit). This normalises a white ○/◎ id to
 * its ○ family member so M1.7 displays "…○", not "…◎".
 *
 * The ○ member is the family variant whose name contains the ○ glyph; ◎/× and
 * the gold are left unchanged, and any id with no ○ variant is returned as-is.
 */
import type { SkillRecord } from '@/core/types';

const SINGLE = '○';
const DOUBLE = '◎';

/** Map a white ◎ id to its ○ family variant; otherwise return the id unchanged. */
export function toSingleCircle(skillId: string, skillById: Map<string, SkillRecord>): string {
  const rec = skillById.get(skillId);
  if (!rec || rec.rarity !== 'white' || !rec.nameEn.includes(DOUBLE)) return skillId;
  for (const vid of rec.variantSkillIds ?? []) {
    const v = skillById.get(vid);
    if (v && v.rarity === 'white' && v.nameEn.includes(SINGLE)) return vid;
  }
  return skillId;
}
