// src/core/coverageMatrix.ts
/**
 * M1.7 — "Obtainable vs. wishlist" coverage. Pure: crosses each wishlist skill
 * against innate / parent / grandparent / deck (hint·chain·random) sources with
 * real inherit-% (spark.ts). Real-data port of the design handoff's detailFor.
 */
import type {
  CardType, LimitBreak, Parent, SkillRarity, SkillRecord, SparkRates, SupportCardRecord,
} from '@/core/types';
import { tierForCardSkill } from '@/core/coverage';
import { sparkChance } from '@/core/spark';
import { reconcileGreenSkillId } from '@/core/greenSparkReconcile';

export type CoverageColumn = 'innate' | 'parent' | 'gp' | 'hint' | 'chain' | 'random';
export const COVERAGE_COLUMNS: CoverageColumn[] = ['innate', 'parent', 'gp', 'hint', 'chain', 'random'];

export interface CoverageChip {
  kind: CoverageColumn; label: string; title: string;
  pct?: number; tier?: string; cardType?: CardType;
}
export interface CoverageRow {
  skillId: string; name: string; isGold: boolean;
  cells: Record<CoverageColumn, CoverageChip[]>; covered: boolean;
}
export interface CoverageBar { column: CoverageColumn | 'uncovered'; count: number; pct: number; }
export interface BonusEntry { skillId: string; name: string; chips: CoverageChip[]; }
export interface CoverageResult { rows: CoverageRow[]; bars: CoverageBar[]; bonus: BonusEntry[]; }

export interface CoverageInput {
  wishlistSkillIds: string[];
  planUma: { umaId: string; nameEn: string; innateSkills?: string[] } | null;
  planUniqueSkillId?: string;
  activeParents: Array<{ parent: Parent; isA: boolean }>;
  deckCards: SupportCardRecord[];
  deckLbByCardId: Map<string, LimitBreak>;
  skillById: Map<string, SkillRecord>;
  cardById: Map<string, SupportCardRecord>;
  greenMap: Map<string, string>;
  sparkRates: SparkRates;
  memberAffinity?: (ctx: { parentId: string; grandparent: boolean; gpIndex: number }) => number | undefined;
}

function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

/** A parent's own spark that grants `skillId` (white match, or green reconciled). */
function parentGrantsSkill(p: Parent, skillId: string, greenMap: Map<string, string>): boolean {
  if (p.whiteSparks.some((w) => w.skillId === skillId)) return true;
  if (p.greenSpark && reconcileGreenSkillId(p.greenSpark.skillId, greenMap) === skillId) return true;
  return false;
}
function refGrantsSkill(ref: NonNullable<Parent['grandparents']>[number], skillId: string, greenMap: Map<string, string>): boolean {
  if (!ref) return false;
  if (ref.whiteSparks?.some((w) => w.skillId === skillId)) return true;
  if (ref.greenSpark && reconcileGreenSkillId(ref.greenSpark.skillId, greenMap) === skillId) return true;
  return false;
}

export function buildCoverageMatrix(input: CoverageInput): CoverageResult {
  const {
    wishlistSkillIds, planUma, planUniqueSkillId, activeParents, deckCards, deckLbByCardId,
    skillById, greenMap, sparkRates, memberAffinity,
  } = input;
  const rarityLookup = (id: string): SkillRarity | undefined => skillById.get(id)?.rarity;

  const innateSet = new Set(
    (planUma?.innateSkills ?? (planUniqueSkillId ? [planUniqueSkillId] : []))
      .map((id) => reconcileGreenSkillId(id, greenMap)),
  );

  const rows: CoverageRow[] = wishlistSkillIds.map((skillId) => {
    const rec = skillById.get(skillId);
    const cells: Record<CoverageColumn, CoverageChip[]> = {
      innate: [], parent: [], gp: [], hint: [], chain: [], random: [],
    };

    // Innate
    if (innateSet.has(reconcileGreenSkillId(skillId, greenMap)) || innateSet.has(skillId)) {
      cells.innate.push({ kind: 'innate', label: initials(planUma?.nameEn ?? '?'), title: planUma?.nameEn ?? 'Innate' });
    }

    // Parent + grandparent
    for (const { parent } of activeParents) {
      if (parentGrantsSkill(parent, skillId, greenMap)) {
        const pct = sparkChance({
          parents: [parent], skillId, rates: sparkRates,
          opts: { memberAffinity, skillRarity: rarityLookup },
        }).pct;
        cells.parent.push({ kind: 'parent', label: initials(String(parent.umaId)), title: `Parent ${parent.umaId}`, pct: Math.round(pct) });
      }
      (parent.grandparents ?? []).forEach((ref, _gpIndex) => {
        if (refGrantsSkill(ref, skillId, greenMap)) {
          const pct = sparkChance({
            parents: [parent], skillId, rates: sparkRates,
            opts: { memberAffinity, skillRarity: rarityLookup },
          }).pct;
          cells.gp.push({ kind: 'gp', label: initials(String(ref!.umaId)), title: `Grandparent ${ref!.umaId}`, pct: Math.round(pct) });
        }
      });
    }

    // Deck: hint / chain / random
    for (const c of deckCards) {
      const lb = deckLbByCardId.get(c.cardId) ?? 4;
      for (const cs of c.skills) {
        if (cs.skillId !== skillId) continue;
        if (cs.sourceType === 'hint_pool') {
          cells.hint.push({ kind: 'hint', label: initials(c.nameEn), title: c.nameEn, tier: tierForCardSkill(c, lb, 'hint_pool'), cardType: c.type });
        } else if (cs.sourceType === 'chain') {
          cells.chain.push({ kind: 'chain', label: initials(c.nameEn), title: c.nameEn, cardType: c.type });
        } else {
          cells.random.push({ kind: 'random', label: initials(c.nameEn), title: c.nameEn, cardType: c.type });
        }
      }
    }

    const covered = COVERAGE_COLUMNS.some((col) => cells[col].length > 0);
    return { skillId, name: rec?.nameEn ?? skillId, isGold: rec?.rarity === 'gold', cells, covered };
  });

  // Bars
  const total = rows.length;
  const bars: CoverageBar[] = COVERAGE_COLUMNS.map((col) => {
    const count = rows.filter((r) => r.cells[col].length > 0).length;
    return { column: col, count, pct: total ? Math.round((count / total) * 100) : 0 };
  });
  const uncoveredCount = rows.filter((r) => !r.covered).length;
  bars.push({ column: 'uncovered', count: uncoveredCount, pct: total ? Math.round((uncoveredCount / total) * 100) : 0 });

  // Bonus: deck + inheritance skills not on the wishlist
  const wishSet = new Set(wishlistSkillIds);
  const bonusMap = new Map<string, CoverageChip[]>();
  const addBonus = (id: string, chip: CoverageChip) => {
    if (wishSet.has(id)) return;
    const arr = bonusMap.get(id) ?? [];
    arr.push(chip);
    bonusMap.set(id, arr);
  };
  for (const { parent } of activeParents) {
    for (const w of parent.whiteSparks) addBonus(w.skillId, { kind: 'parent', label: initials(String(parent.umaId)), title: `Parent ${parent.umaId}` });
    if (parent.greenSpark) addBonus(reconcileGreenSkillId(parent.greenSpark.skillId, greenMap), { kind: 'parent', label: initials(String(parent.umaId)), title: `Parent ${parent.umaId}` });
  }
  for (const c of deckCards) {
    for (const cs of c.skills) {
      const kind: CoverageColumn = cs.sourceType === 'hint_pool' ? 'hint' : cs.sourceType === 'chain' ? 'chain' : 'random';
      addBonus(cs.skillId, { kind, label: initials(c.nameEn), title: c.nameEn, cardType: c.type });
    }
  }
  const bonus: BonusEntry[] = [...bonusMap.entries()].map(([skillId, chips]) => ({
    skillId, name: skillById.get(skillId)?.nameEn ?? skillId, chips: chips.slice(0, 4),
  }));

  return { rows, bars, bonus };
}
