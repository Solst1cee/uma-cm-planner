import type { SkillRecord, WishlistItem } from '@/core/types';

const EMPTY_SKILL_IDS = new Set<string>();
const DOUBLE_CIRCLE = '\u25ce';
const CIRCLE = '\u25cb';
const CROSS = '\u00d7';

export function inheritedUniqueFor(
  skill: SkillRecord,
  skillById: ReadonlyMap<string, SkillRecord>,
): SkillRecord | null {
  if (skill.rarity !== 'unique') return null;
  const guessedInheritedId = skill.skillId.replace(/^1/, '9');
  const guessed = skillById.get(guessedInheritedId);
  if (guessed?.rarity === 'inherited_unique') return guessed;
  for (const candidate of skillById.values()) {
    if (
      candidate.rarity === 'inherited_unique'
      && candidate.server === skill.server
      && candidate.nameEn === skill.nameEn
    ) {
      return candidate;
    }
  }
  return null;
}

export function wishlistSkillRecord(
  skillId: string,
  skillById: ReadonlyMap<string, SkillRecord>,
): SkillRecord | null {
  const skill = skillById.get(skillId);
  if (!skill) return null;
  return inheritedUniqueFor(skill, skillById) ?? skill;
}

export function wishlistSkillId(
  skillId: string,
  skillById: ReadonlyMap<string, SkillRecord>,
): string {
  return wishlistSkillRecord(skillId, skillById)?.skillId ?? skillId;
}

export function skillVariantOptions(
  skill: SkillRecord,
  skillById: ReadonlyMap<string, SkillRecord>,
): SkillRecord[] {
  const family = [skill.skillId, ...(skill.variantSkillIds ?? [])]
    .map((id) => skillById.get(id))
    .filter((candidate): candidate is SkillRecord => candidate !== undefined);
  family.sort((a, b) => skillVariantRank(b) - skillVariantRank(a) || Number(a.skillId) - Number(b.skillId));
  return family;
}

export function areSkillVariants(a: SkillRecord, b: SkillRecord): boolean {
  if (a.skillId === b.skillId) return true;
  return (a.variantSkillIds ?? []).includes(b.skillId) || (b.variantSkillIds ?? []).includes(a.skillId);
}

export function skillVariantRank(skill: SkillRecord): number {
  let score = 0;
  if (skill.rarity === 'gold') score += 3000;
  if (skill.nameEn.includes(DOUBLE_CIRCLE)) score += 2000;
  if (skill.nameEn.includes(CIRCLE)) score += 1000;
  if (skill.nameEn.includes(CROSS)) score -= 1000;
  score += Math.min(skill.baseSpCost, 999);
  return score;
}

export function isBlockedBySelectedVariant(
  candidate: SkillRecord,
  selectedSkillIds: Iterable<string>,
  skillById: ReadonlyMap<string, SkillRecord>,
): boolean {
  if ((candidate.variantSkillIds ?? []).length === 0) return false;
  const candidateRank = skillVariantRank(candidate);
  for (const selectedId of selectedSkillIds) {
    const selected = wishlistSkillRecord(selectedId, skillById);
    if (!selected || !areSkillVariants(candidate, selected)) continue;
    if (skillVariantRank(selected) >= candidateRank) return true;
  }
  return false;
}

function resetProjectedSkill(item: WishlistItem, skillId: string): WishlistItem {
  const next = {
    ...item,
    skillId,
    manualAdd: true,
  };
  delete next.projectedL;
  delete next.projectedLStale;
  return next;
}

export function addOrReplaceWishlistSkill(
  wishlist: WishlistItem[],
  rawSkillId: string,
  skillById: ReadonlyMap<string, SkillRecord>,
  hiddenSkillIds: ReadonlySet<string> = EMPTY_SKILL_IDS,
): WishlistItem[] {
  const resolvedSkillId = wishlistSkillId(rawSkillId, skillById);
  if (hiddenSkillIds.has(resolvedSkillId)) return wishlist;
  const candidate = skillById.get(resolvedSkillId);
  if (!candidate) return wishlist;

  let replaced = false;
  const next = wishlist.map((item) => {
    const existing = wishlistSkillRecord(item.skillId, skillById);
    if (!existing || !areSkillVariants(existing, candidate)) return item;
    replaced = true;
    return resetProjectedSkill(item, candidate.skillId);
  });
  if (replaced) return next;

  return [
    ...wishlist,
    { skillId: candidate.skillId, priority: 1, source: 'targeted', manualAdd: true },
  ];
}

export function replaceWishlistSkillVariant(
  wishlist: WishlistItem[],
  currentSkillId: string,
  nextSkillId: string,
  skillById: ReadonlyMap<string, SkillRecord>,
): WishlistItem[] {
  const candidate = wishlistSkillRecord(nextSkillId, skillById);
  if (!candidate) return wishlist;
  return wishlist.map((item) => (
    item.skillId === currentSkillId ? resetProjectedSkill(item, candidate.skillId) : item
  ));
}
