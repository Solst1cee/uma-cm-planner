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

export type CoverageColumn = 'innate' | 'event' | 'parent' | 'gp' | 'hint' | 'chain' | 'random';
export const COVERAGE_COLUMNS: CoverageColumn[] = ['innate', 'event', 'parent', 'gp', 'hint', 'chain', 'random'];

export interface CoverageChip {
  kind: CoverageColumn; label: string; title: string;
  pct?: number; tier?: string; cardType?: CardType;
  /** Support-card id for deck-source chips (hint/chain/random) — lets the UI
   *  render the real card icon instead of name initials. */
  cardId?: string;
  /** For event chips: the uma's event-pool skill id that covers this row
   *  (family-resolved) — lets the UI look up the granting event's details. */
  skillId?: string;
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
  planUma: {
    umaId: string; nameEn: string; innateSkills?: string[]; eventSkills?: string[];
    /** skillId → potential (awakening) level that unlocks it (1–5). When present,
     *  the innate chip shows "LvN" instead of the uma's initials. */
    innateRankBySkillId?: Record<string, number>;
  } | null;
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

const CROSS = '×'; // "×" negative-variant glyph (e.g. "Right-Handed ×")

/** A white "positive-circle" variant (○ or ◎) — not the "×" and not the gold. */
function isWhiteCircle(s: SkillRecord): boolean {
  return s.rarity === 'white' && !s.nameEn.includes(CROSS);
}

/**
 * Are two skills interchangeable for coverage? ○ and ◎ are the same white skill
 * at different grades, so they cover each other. The gold version (e.g.
 * "Right-Handed Demon") and the "×" negative variant are SEPARATE — they match
 * only their exact id. Identical ids always match.
 */
function coverageEquivalent(aId: string, bId: string, skillById: Map<string, SkillRecord>): boolean {
  if (aId === bId) return true;
  const a = skillById.get(aId);
  const b = skillById.get(bId);
  if (!a || !b) return false;
  if (!isWhiteCircle(a) || !isWhiteCircle(b)) return false; // only ○/◎ collapse
  return (a.variantSkillIds ?? []).includes(bId) || (b.variantSkillIds ?? []).includes(aId);
}

/** The first `have` id that covers `want` (○/◎ family or exact), else null. */
function coveringId(want: string, have: Iterable<string>, skillById: Map<string, SkillRecord>): string | null {
  for (const h of have) if (coverageEquivalent(h, want, skillById)) return h;
  return null;
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

  // Innate = the uma's built-in NON-unique kit (white + gold). Matched by variant
  // family + coverage tier, so an innate "Right-Handed ○" covers a wishlisted
  // "Right-Handed ◎" (same skill, higher grade) but not the gold "Demon".
  const innateSkills = planUma?.innateSkills ?? [];
  // Career training-event availability: the skill ids this uma's story/training
  // events can grant (source-inverted from daftuyda's `char_e`, see uma_events.json).
  const eventSkills = planUma?.eventSkills ?? [];

  const rows: CoverageRow[] = wishlistSkillIds.map((skillId) => {
    const rec = skillById.get(skillId);
    const cells: Record<CoverageColumn, CoverageChip[]> = {
      innate: [], event: [], parent: [], gp: [], hint: [], chain: [], random: [],
    };

    // Innate (○/◎ family-aware, gold separate). Chip shows the potential level
    // ("Lv5") that unlocks the covering skill when known, else uma initials.
    const innateCover = coveringId(skillId, innateSkills, skillById);
    if (innateCover) {
      const rank = planUma?.innateRankBySkillId?.[innateCover];
      cells.innate.push({
        kind: 'innate',
        label: rank !== undefined ? `Lv${rank}` : initials(planUma?.nameEn ?? '?'),
        title: rank !== undefined
          ? `${planUma?.nameEn ?? 'Innate'} — unlocks at potential Lv${rank}`
          : planUma?.nameEn ?? 'Innate',
      });
    }

    // Career training-event (○/◎ family-aware, gold separate). Availability —
    // whether this uma's events *can* grant it — not a per-run guarantee.
    const eventCover = coveringId(skillId, eventSkills, skillById);
    if (eventCover) {
      cells.event.push({
        kind: 'event',
        label: initials(planUma?.nameEn ?? '?'),
        title: `${planUma?.nameEn ?? 'Uma'} — training event`,
        skillId: eventCover,
      });
    }

    // Parent + grandparent (isolated per-member pct, priced off the held spark)
    for (const { parent } of activeParents) {
      // The parent's own white spark that covers this wishlist skill (○/◎), if any.
      const pWhiteCover = coveringId(skillId, parent.whiteSparks.map((w) => w.skillId), skillById);
      const pGreenCovers = !!(parent.greenSpark && reconcileGreenSkillId(parent.greenSpark.skillId, greenMap) === skillId);
      if (pWhiteCover || pGreenCovers) {
        // Isolated parent-self pct: strip grandparents so only parent-self sparks contribute.
        // Reconcile greenSpark.skillId so sparkChance's green path (native→9xxxxx) can match.
        const parentSelf: Parent = {
          ...parent,
          greenSpark: parent.greenSpark
            ? { ...parent.greenSpark, skillId: reconcileGreenSkillId(parent.greenSpark.skillId, greenMap) }
            : undefined,
          grandparents: undefined,
        };
        // Price the spark the parent actually holds (its ○), not the wishlisted ◎.
        const priceSkillId = pWhiteCover ?? skillId;
        const parentPct = sparkChance({
          parents: [parentSelf], skillId: priceSkillId, rates: sparkRates,
          opts: { memberAffinity, skillRarity: rarityLookup },
        }).pct;
        cells.parent.push({
          kind: 'parent',
          label: umaLabel(String(parent.umaId), String(parent.umaId)),
          title: `${umaTitle(String(parent.umaId), 'Parent')} · parent ${pWhiteCover ? 'white' : 'green'} spark`,
          pct: Math.round(parentPct),
        });
      }
      (parent.grandparents ?? []).forEach((ref, gpIndex) => {
        if (!ref) return;
        const gpWhiteCover = coveringId(skillId, ref.whiteSparks?.map((w) => w.skillId) ?? [], skillById);
        const gpGreenCovers = !!(ref.greenSpark && reconcileGreenSkillId(ref.greenSpark.skillId, greenMap) === skillId);
        if (!gpWhiteCover && !gpGreenCovers) return;
        // sparkChance only prices gp WHITE sparks (green gp math deferred, mechanics-notes §10).
        // Attach pct only for a white cover; green-only match → pct undefined (honest "unpriced").
        let gpPct: number | undefined;
        if (gpWhiteCover) {
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
            parents: [gpOnly], skillId: gpWhiteCover, rates: sparkRates,
            opts: { memberAffinity, skillRarity: rarityLookup },
          }).pct);
        }
        cells.gp.push({
          kind: 'gp',
          label: umaLabel(String(ref.umaId), String(ref.umaId)),
          title: `${umaTitle(String(ref.umaId), 'Grandparent')} · grandparent ${gpWhiteCover ? 'white' : 'green'} spark${gpWhiteCover ? '' : ' (unpriced)'}`,
          ...(gpPct !== undefined ? { pct: gpPct } : {}),
        });
      });
    }

    // Deck: hint / chain / random (○/◎ family-aware, gold separate)
    for (const c of deckCards) {
      const lb = deckLbByCardId.get(c.cardId) ?? 4;
      for (const cs of c.skills) {
        if (!coverageEquivalent(cs.skillId, skillId, skillById)) continue;
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
  // A source skill is a "bonus" only if it doesn't cover ANY wishlist skill
  // (○/◎ family-aware — a parent's ○ that fulfils a wishlisted ◎ isn't a bonus).
  const coversAnyWishlist = (id: string) =>
    wishlistSkillIds.some((w) => coverageEquivalent(id, w, skillById));
  const bonusMap = new Map<string, CoverageChip[]>();
  const addBonus = (id: string, chip: CoverageChip) => {
    if (coversAnyWishlist(id)) return;
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
