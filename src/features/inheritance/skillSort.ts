// src/features/inheritance/skillSort.ts
/**
 * M1.7 coverage-table sort — by in-game skill ICON (finalized scheme 2026-07-05).
 *
 * How it sorts:
 *   1. unique + inherited-unique skills FIRST (top group, A-Z) — ranked by
 *      RARITY, never by icon (see `keyOf`). Consequence: every unique-only icon
 *      listed below is INERT — it documents the family but has no effect on
 *      sorting. That covers the "Unique tier" block (20013/16/23/43), the `…6`
 *      "evolved" variants in each family row (10016/10026/…/20026/20046/…/30056
 *      — all unique-rarity in the data), `2010016`, and the uniques on `0`.
 *   2. then the icon subcategories below, in order; icons on the same row share
 *      a rank so a white+gold family clusters together.
 *   3. within a subcategory: A-Z by the white base name, gold directly ABOVE its
 *      white twin (gold-first within a family — `buildSkillComparator`).
 *
 * `0` is the placeholder icon (skills with no assigned icon yet — mostly JP);
 * its one non-unique skill sorts near the end. Any icon NOT listed sorts LAST
 * (UNLISTED_RANK). When a data refresh adds a new non-unique icon, the
 * coverage-guard test in skillSort.test.ts fails and names it — place it here.
 * See docs/skill-icon-sort-workflow.md.
 */
import type { SkillRarity } from '@/core/types';

/**
 * Ordered icon subcategories (each row = one subcategory; icons on a row share a
 * rank). Rows tagged "unique-only / inert" are documentation — those icons carry
 * only unique-rarity skills, which sort in the top group by rarity (§1 above).
 */
export const ICON_SUBCATEGORIES: string[][] = [
  // Unique tier (inert — unique-rarity, sorted by the top group)
  ['20013'], ['20016'], ['20023'], ['20043'],
  // Green skills (the `…6` third-of-row is the unique "evolved" variant — inert)
  ['10011', '10012', '10016'], ['10014'],
  ['10021', '10022', '10026'], ['10024'],
  ['10031', '10032', '10036'], ['10034'],
  ['10041'], ['10044'],
  ['10051', '10052', '10056'], ['10054'],
  ['10061', '10062', '10066'], ['40012'],
  // Stamina skills
  ['20021', '20022', '20026'], ['20024'],
  // Velocity skills
  ['20011', '20012'], ['20014'], ['20241'],
  // Acceleration skills
  ['20041', '20042', '20046'], ['20044'], ['20351'],
  // Movement skills
  ['20051', '20052'],
  // Late start skills
  ['20061', '20062', '20066'], ['20064'],
  // FOV skills
  ['20091', '20092'],
  // URA scenario
  ['20161'],
  // Aoharu scenario
  ['20101', '20102'], ['20111', '20112'], ['20121', '20122'], ['20131', '20132'],
  // Trackblazer scenario
  ['20141', '20142'],
  // Grand Masters scenario
  ['20191'], ['20201'],
  // Debuff skills
  ['30011', '30012'], ['30021', '30022'], ['30041'], ['30051', '30052', '30056'], ['30071', '30072'],
  // Event skills
  ['1010011'],
  // Uma specific
  ['2010010'], ['2010011'], ['2010016'],
  // Unknown / placeholder (sorts last; future unlisted icons fall through after this)
  ['0'],
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
