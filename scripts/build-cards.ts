/**
 * public/data/support_cards.json — SupportCardRecord[] for the 217 Global
 * support cards.
 *
 * Skill sources (provenance §4): hint pool = master hintSkills
 * (single_mode_hint_gain); chain/random = GameTora per-card eventData
 * (event-skill-sources.json). Skills that only appear in the master flat
 * eventSkills list (friend/group date events) default to 'random_event' here
 * and are patched to 'date_event' by data-overrides/card_source_overrides.json.
 */
import type { CardSkill, CardType, SupportCardRecord } from '@/core/types';
import { buildPerLevel } from './lib/lerp';
import type { EventSkillSourcesJson, GtCard, MasterCardsJson } from './lib/upstream-types';

/** Verified against umalator support-card-loader.ts supportCardTypeMap (5 = "intelligence" = wit). */
const CARD_TYPE: Record<number, CardType> = {
  1: 'speed',
  2: 'stamina',
  3: 'power',
  4: 'guts',
  5: 'wit',
  6: 'friend',
  7: 'group',
};

const CARD_RARITY: Record<number, 'R' | 'SR' | 'SSR'> = { 1: 'R', 2: 'SR', 3: 'SSR' };

export function buildCards(inputs: {
  master: MasterCardsJson;
  gametoraCards: GtCard[];
  eventSources: EventSkillSourcesJson;
  /** Keys of the master skills extract — the Global-released cutover. */
  releasedSkillIds: ReadonlySet<string>;
  dataVersion: string;
}): SupportCardRecord[] {
  const { master, gametoraCards, eventSources, releasedSkillIds, dataVersion } = inputs;
  const gtById = new Map<number, GtCard>(gametoraCards.map((c) => [c.support_id, c]));

  // P4: GameTora eventData spans JP+Global; skills missing from the Global
  // master extract are not obtainable on Global and must not slip in.
  const dropped = new Set<string>();
  const isReleased = (id: number): boolean => {
    if (releasedSkillIds.has(String(id))) return true;
    dropped.add(String(id));
    return false;
  };

  const records: SupportCardRecord[] = [];
  for (const card of Object.values(master)) {
    const cardId = String(card.id);
    const rarity = CARD_RARITY[card.rarity];
    const type = CARD_TYPE[card.supportCardType];
    if (rarity === undefined || type === undefined) {
      throw new Error(`card ${cardId}: unknown rarity ${card.rarity} / type ${card.supportCardType}`);
    }
    const gt = gtById.get(card.id);
    if (!gt?.effects) {
      throw new Error(`card ${cardId}: no GameTora effects matrix — upstream data drifted?`);
    }

    const sources = eventSources[cardId];
    const chain = new Set(sources?.chain_event_skills ?? []);
    const random = new Set(sources?.random_event_skills ?? []);

    const skills: CardSkill[] = [];
    for (const hint of [...card.hintSkills].sort((a, b) => a.id - b.id)) {
      if (isReleased(hint.id)) skills.push({ skillId: String(hint.id), sourceType: 'hint_pool' });
    }
    // Event skills = master flat list ∪ GameTora chain/random (GameTora's
    // eventData is authoritative for classification; a skill listed as both
    // chain and random — one card, Twin Turbo 30026 — counts as chain, the
    // more reliable source).
    const eventIds = new Set<number>([
      ...card.eventSkills.map((s) => s.id),
      ...chain,
      ...random,
    ]);
    for (const id of [...eventIds].sort((a, b) => a - b)) {
      if (!isReleased(id)) continue;
      const sourceType = chain.has(id) ? 'chain' : 'random_event';
      skills.push({ skillId: String(id), sourceType });
    }

    records.push({
      cardId,
      nameEn: card.name,
      charName: card.charaName,
      rarity,
      type,
      perLevel: buildPerLevel(gt.effects, rarity),
      skills,
      hintPoolSize: skills.filter((s) => s.sourceType === 'hint_pool').length,
      server: 'global',
      dataVersion,
    });
  }

  if (dropped.size > 0) {
    console.warn(
      `build-cards: dropped ${dropped.size} JP-ahead skill id(s) not in the Global ` +
        `release cutover (P4): ${[...dropped].sort().join(', ')}`,
    );
  }

  records.sort((a, b) => Number(a.cardId) - Number(b.cardId));
  return records;
}

/** Recount after overrides may have re-typed sources (kept derived — types.ts). */
export function recomputeHintPoolSizes(cards: SupportCardRecord[]): void {
  for (const card of cards) {
    card.hintPoolSize = card.skills.filter((s) => s.sourceType === 'hint_pool').length;
  }
}
