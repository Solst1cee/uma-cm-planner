// src/features/inheritance/skillSort.ts
/**
 * M1.7 coverage-table sort — by in-game skill ICON, per the user's spec
 * (2026-07-03). Skills sort:
 *   1. uniques + inherited-uniques first (a top group, A-Z) — their skill icon
 *      is generic, so they're grouped by rarity, not icon.
 *   2. then the icon subcategories below, in order; a subcategory's white + gold
 *      icons share a rank so the family clusters.
 *   3. within a subcategory: A-Z by the white base name, with a gold skill
 *      placed directly ABOVE its white twin (gold-first within a family).
 *
 * `200224` in the source spec is the × icon `20024` (recovery family). Icons not
 * listed sort last. Edit ICON_SUBCATEGORIES to re-order.
 */
import type { SkillRarity } from '@/core/types';

/** Ordered icon subcategories (each row = one subcategory; its icons share a rank). */
export const ICON_SUBCATEGORIES: string[][] = [
  // Green skills
  ['10011', '10012'], ['10014'], ['10021', '10022'], ['10024'], ['10031', '10032'], ['10034'],
  ['10041'], ['10044'], ['10051'], ['10054'], ['10061', '10062'], ['40012'],
  // Stamina skills
  ['20021', '20022'], ['20024'],
  // Velocity skills
  ['20011', '20012'], ['20014'], ['2010010'],
  // Acceleration skills
  ['20041', '20042'], ['20044'],
  // Movement skills
  ['20051', '20052'],
  // Late start skills
  ['20061', '20062'], ['20064'],
  // FOV skills
  ['20091', '20092'],
  // Aoharu scenario
  ['20101', '20102'], ['20111', '20112'], ['20121', '20122'], ['20131', '20132'],
  // Trackblazer scenario
  ['20141', '20142'],
  // Debuff skills
  ['30011', '30012'], ['30021', '30022'], ['30041'], ['30051', '30052'], ['30071', '30072'],
  // Event skills
  ['1010011'],
];

/** iconId → subcategory rank (0-based). */
export function buildIconRank(subs: string[][] = ICON_SUBCATEGORIES): Map<string, number> {
  const m = new Map<string, number>();
  subs.forEach((icons, i) => icons.forEach((ic) => m.set(ic, i)));
  return m;
}

const UNIQUE_RANK = -1;
const UNLISTED_RANK = 9999;

export interface SortSkillMeta { iconId: string; rarity: SkillRarity; group: number; name: string }

function isUnique(r: SkillRarity): boolean {
  return r === 'unique' || r === 'inherited_unique';
}

/**
 * Build a skill comparator (by skillId) honouring the icon spec.
 * - `metaOf` resolves a skill's icon / rarity / group / name (undefined ⇒ sorts last).
 * - `iconRank` from buildIconRank.
 * - `whiteNameOfGroup` gives a group's white base name so a gold sorts adjacent
 *   to (just above) its white twin.
 */
export function buildSkillComparator(
  metaOf: (skillId: string) => SortSkillMeta | undefined,
  iconRank: Map<string, number>,
  whiteNameOfGroup: (group: number) => string | undefined,
): (aId: string, bId: string) => number {
  const keyOf = (id: string) => {
    const m = metaOf(id);
    if (!m) return { rank: UNLISTED_RANK, base: id, gold: 1 };
    const rank = isUnique(m.rarity) ? UNIQUE_RANK : (iconRank.get(m.iconId) ?? UNLISTED_RANK);
    const gold = m.rarity === 'gold' ? 0 : 1;
    // A gold skill sorts under its white twin's name (so it lands just above it).
    const base = m.rarity === 'gold' ? (whiteNameOfGroup(m.group) ?? m.name) : m.name;
    return { rank, base, gold };
  };
  return (aId, bId) => {
    const a = keyOf(aId);
    const b = keyOf(bId);
    return a.rank - b.rank || a.base.localeCompare(b.base) || a.gold - b.gold || aId.localeCompare(bId);
  };
}
