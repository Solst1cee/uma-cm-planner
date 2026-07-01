// src/core/coverageMatrix.ts
/**
 * M1.7 — "Obtainable vs. wishlist" coverage. Pure: crosses each wishlist skill
 * against innate / parent / grandparent / deck (hint·chain·random) sources with
 * real inherit-% (spark.ts). Real-data port of the design handoff's detailFor.
 */
import type {
  CardType, LimitBreak, Parent, ParentRef, SkillRarity, SkillRecord, SparkRates, SupportCardRecord,
} from '@/core/types';
import { tierForCardSkill } from '@/core/coverage';
import { sparkChance } from '@/core/spark';
import { reconcileGreenSkillId } from '@/core/greenSparkReconcile';

export type CoverageColumn = 'innate' | 'parent' | 'gp' | 'hint' | 'chain' | 'random';
export const COVERAGE_COLUMNS: CoverageColumn[] = ['innate', 'parent', 'gp', 'hint', 'chain', 'random'];

export interface CoverageChip {
  kind: CoverageColumn; label: string; title: string;
  pct?: number; tier?: string; cardType?: CardType;
  /** Support-card id for deck-source chips (hint/chain/random) — lets the UI
   *  render the real card icon instead of name initials. */
  cardId?: string;
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
  /** `innateSkills` = the uma's built-in NON-unique kit (white + gold). The
   *  unique and inherited-unique are deliberately excluded — they aren't
   *  "innate" in the coverage sense (the unique you always have; the
   *  inherited-unique is what a parent passes down). */
  planUma: { umaId: string; nameEn: string; innateSkills?: string[] } | null;
  activeParents: Array<{ parent: Parent; isA: boolean }>;
  deckCards: SupportCardRecord[];
  deckLbByCardId: Map<string, LimitBreak>;
  skillById: Map<string, SkillRecord>;
  cardById: Map<string, SupportCardRecord>;
  greenMap: Map<string, string>;
  sparkRates: SparkRates;
  memberAffinity?: (ctx: { parentId: string; grandparent: boolean; gpIndex: number }) => number | undefined;
  /** Optional: resolve display names for parent/grandparent chips. Key = umaId string. */
  umaNameById?: Map<string, string>;
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
    wishlistSkillIds, planUma, activeParents, deckCards, deckLbByCardId,
    skillById, greenMap, sparkRates, memberAffinity, umaNameById,
  } = input;
  const rarityLookup = (id: string): SkillRarity | undefined => skillById.get(id)?.rarity;

  /** Resolve a display name for a umaId, falling back to the raw id. */
  const umaLabel = (umaId: string, fallback: string) =>
    initials(umaNameById?.get(umaId) ?? fallback);
  const umaTitle = (umaId: string, prefix: string) =>
    umaNameById?.get(umaId) ?? `${prefix} ${umaId}`;

  // Innate = the uma's built-in NON-unique kit (white + gold), matched directly
  // against the wishlist. No green reconciliation here — unique / inherited-unique
  // are excluded upstream, so there is nothing to translate.
  const innateSet = new Set(planUma?.innateSkills ?? []);

  const rows: CoverageRow[] = wishlistSkillIds.map((skillId) => {
    const rec = skillById.get(skillId);
    const cells: Record<CoverageColumn, CoverageChip[]> = {
      innate: [], parent: [], gp: [], hint: [], chain: [], random: [],
    };

    // Innate
    if (innateSet.has(skillId)) {
      cells.innate.push({ kind: 'innate', label: initials(planUma?.nameEn ?? '?'), title: planUma?.nameEn ?? 'Innate' });
    }

    // Parent + grandparent (FIX 1: isolated per-member pct)
    for (const { parent } of activeParents) {
      if (parentGrantsSkill(parent, skillId, greenMap)) {
        // Isolated parent-self pct: strip grandparents so only parent-self sparks contribute.
        // FIX A: reconcile greenSpark.skillId so sparkChance's green path (native→9xxxxx) can match.
        const parentSelf: Parent = {
          ...parent,
          greenSpark: parent.greenSpark
            ? { ...parent.greenSpark, skillId: reconcileGreenSkillId(parent.greenSpark.skillId, greenMap) }
            : undefined,
          grandparents: undefined,
        };
        const parentPct = sparkChance({
          parents: [parentSelf], skillId, rates: sparkRates,
          opts: { memberAffinity, skillRarity: rarityLookup },
        }).pct;
        cells.parent.push({
          kind: 'parent',
          label: umaLabel(String(parent.umaId), String(parent.umaId)),
          title: umaTitle(String(parent.umaId), 'Parent'),
          pct: Math.round(parentPct),
        });
      }
      (parent.grandparents ?? []).forEach((ref, gpIndex) => {
        if (refGrantsSkill(ref, skillId, greenMap)) {
          // FIX B: sparkChance only prices gp WHITE sparks (green gp math deferred, mechanics-notes §10).
          // Only attach pct when the gp match is via a white spark; green-only match → pct undefined
          // (omitting it is honest — "unpriced" not "~0%").
          const gpWhiteMatch = ref!.whiteSparks?.some((w) => w.skillId === skillId) ?? false;
          let gpPct: number | undefined;
          if (gpWhiteMatch) {
            // Isolated gp pct: no parent-self sparks; only that grandparent at its original index.
            const gpOnly: Parent = {
              ...parent,
              whiteSparks: [],
              greenSpark: undefined,
              grandparents: (gpIndex === 0
                ? [ref, undefined]
                : [undefined, ref]) as [ParentRef?, ParentRef?],
            };
            gpPct = Math.round(sparkChance({
              parents: [gpOnly], skillId, rates: sparkRates,
              opts: { memberAffinity, skillRarity: rarityLookup },
            }).pct);
          }
          cells.gp.push({
            kind: 'gp',
            label: umaLabel(String(ref!.umaId), String(ref!.umaId)),
            title: umaTitle(String(ref!.umaId), 'Grandparent'),
            ...(gpPct !== undefined ? { pct: gpPct } : {}),
          });
        }
      });
    }

    // Deck: hint / chain / random
    for (const c of deckCards) {
      const lb = deckLbByCardId.get(c.cardId) ?? 4;
      for (const cs of c.skills) {
        if (cs.skillId !== skillId) continue;
        if (cs.sourceType === 'hint_pool') {
          cells.hint.push({ kind: 'hint', label: initials(c.nameEn), title: c.nameEn, tier: tierForCardSkill(c, lb, 'hint_pool'), cardType: c.type, cardId: c.cardId });
        } else if (cs.sourceType === 'chain') {
          cells.chain.push({ kind: 'chain', label: initials(c.nameEn), title: c.nameEn, cardType: c.type, cardId: c.cardId });
        } else {
          cells.random.push({ kind: 'random', label: initials(c.nameEn), title: c.nameEn, cardType: c.type, cardId: c.cardId });
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
  // FIX 2: no .slice(0, 4) — return ALL chips; capping is a UI concern.
  // FIX 3: include grandparent sparks in addition to parent sparks.
  const wishSet = new Set(wishlistSkillIds);
  const bonusMap = new Map<string, CoverageChip[]>();
  const addBonus = (id: string, chip: CoverageChip) => {
    if (wishSet.has(id)) return;
    const arr = bonusMap.get(id) ?? [];
    arr.push(chip);
    bonusMap.set(id, arr);
  };
  for (const { parent } of activeParents) {
    // Parent-self sparks
    for (const w of parent.whiteSparks) {
      addBonus(w.skillId, {
        kind: 'parent',
        label: umaLabel(String(parent.umaId), String(parent.umaId)),
        title: umaTitle(String(parent.umaId), 'Parent'),
      });
    }
    if (parent.greenSpark) {
      addBonus(reconcileGreenSkillId(parent.greenSpark.skillId, greenMap), {
        kind: 'parent',
        label: umaLabel(String(parent.umaId), String(parent.umaId)),
        title: umaTitle(String(parent.umaId), 'Parent'),
      });
    }
    // Grandparent sparks (FIX 3)
    for (const gp of parent.grandparents ?? []) {
      if (!gp) continue;
      for (const w of gp.whiteSparks ?? []) {
        addBonus(w.skillId, {
          kind: 'gp',
          label: umaLabel(String(gp.umaId), String(gp.umaId)),
          title: umaTitle(String(gp.umaId), 'Grandparent'),
        });
      }
      if (gp.greenSpark) {
        addBonus(reconcileGreenSkillId(gp.greenSpark.skillId, greenMap), {
          kind: 'gp',
          label: umaLabel(String(gp.umaId), String(gp.umaId)),
          title: umaTitle(String(gp.umaId), 'Grandparent'),
        });
      }
    }
  }
  for (const c of deckCards) {
    for (const cs of c.skills) {
      const kind: CoverageColumn = cs.sourceType === 'hint_pool' ? 'hint' : cs.sourceType === 'chain' ? 'chain' : 'random';
      addBonus(cs.skillId, { kind, label: initials(c.nameEn), title: c.nameEn, cardType: c.type, cardId: c.cardId });
    }
  }
  // FIX 2: no .slice(0, 4) — return all chips
  const bonus: BonusEntry[] = [...bonusMap.entries()].map(([skillId, chips]) => ({
    skillId, name: skillById.get(skillId)?.nameEn ?? skillId, chips,
  }));

  return { rows, bars, bonus };
}
