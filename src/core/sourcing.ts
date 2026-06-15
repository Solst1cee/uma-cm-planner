/**
 * Module 4 core — per-skill sourcing join (slice 1).
 *
 * Builds a reverse index (skill → cards that can hint it) once, then joins a
 * single skill against it into a tiered, gap-flagged sourcing row for the UI.
 * Pure; operates strictly on the lists/maps it is given.
 *
 * TODO(slice-1b): add an uma-innate column once umas.json carries innate skills.
 */
import { tierForCardSkill, tierRank } from '@/core/coverage';
import type { LimitBreak, SkillSourceType, SupportCardRecord, Tier } from '@/core/types';

export type CardHint = { cardId: string; sourceType: string };

export type SourcingCard = { cardId: string; cardName: string; tier: Tier };

export type SourcingRow = { skillId: string; cardHints: SourcingCard[]; gap: boolean };

/**
 * skillId → every card that can grant it (with the card's sourceType for that
 * skill). A card contributes one entry per matching `skills` row.
 */
export function buildCardHintIndex(cards: SupportCardRecord[]): Map<string, CardHint[]> {
  const index = new Map<string, CardHint[]>();
  for (const card of cards) {
    for (const cardSkill of card.skills) {
      const hints = index.get(cardSkill.skillId) ?? [];
      hints.push({ cardId: card.cardId, sourceType: cardSkill.sourceType });
      index.set(cardSkill.skillId, hints);
    }
  }
  return index;
}

/**
 * Join one skill against the index into a tiered sourcing row. Cards missing
 * from `cardById` are skipped; rows are sorted best-tier-first. `gap` is true
 * when nothing in the inventory can hint the skill.
 */
export function sourcingForSkill(
  skillId: string,
  index: Map<string, CardHint[]>,
  cardById: Map<string, SupportCardRecord>,
  lb: LimitBreak,
): SourcingRow {
  const hints = index.get(skillId) ?? [];
  const cardHints: SourcingCard[] = hints
    .flatMap((h) => {
      const card = cardById.get(h.cardId);
      if (!card) return [];
      return [
        {
          cardId: card.cardId,
          cardName: card.nameEn,
          tier: tierForCardSkill(card, lb, h.sourceType as SkillSourceType),
        },
      ];
    })
    .sort((a, b) => tierRank(a.tier) - tierRank(b.tier));
  return { skillId, cardHints, gap: cardHints.length === 0 };
}
