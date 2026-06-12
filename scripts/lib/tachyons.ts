/**
 * Extraction helpers for the jechto/Tachyons-lab event-reward dataset
 * (borrowed `tachyons-data.json`, pin in scripts/fetch-borrowed.ts;
 * docs/provenance.md §4.1, retrieved 2026-06-12).
 *
 * Why this source exists: GameTora's eventData parse (upstream
 * fetch-event-skill-sources.ts) reads only the 'arrows'/'random' categories
 * and only 'sk' rewards, silently dropping chain-finale skill CHOICES,
 * date-event skills and direct skill grants (Phase 1 review, critical
 * finding, 2026-06-12). Tachyons-lab's all_events carries the full reward
 * lists per event category.
 */
import type { TachyonsCard, TachyonsDataJson, TachyonsEvent } from './upstream-types';

/**
 * Reward types that put a skill id in `detail` (verified against the pinned
 * data 2026-06-12):
 * - 'Skill Hint'   — grants a hint at `value` levels (e.g. "+1/+3");
 * - 'Skill Choice' — chain-finale pick-one between sibling rewards;
 * - 'sg'           — direct skill grant (skill learned outright, no SP).
 *   Decision (review follow-up): direct grants ARE included as obtainable
 *   skill sources, classified by their containing event category — they are
 *   real skills on the card (the known instances are the Sasami 10074/30080
 *   debuff trio 200283/200353/200521 and Bamboo Memory 30042's 200521).
 */
const SKILL_REWARD_TYPES = new Set(['Skill Hint', 'Skill Choice', 'sg']);

function collectSkillIds(events: readonly TachyonsEvent[] | undefined): Set<number> {
  const out = new Set<number>();
  for (const event of events ?? []) {
    // `history` (pre-anniversary event versions) is deliberately ignored:
    // current `choices` reflect the live event tables.
    for (const choice of event.choices ?? []) {
      for (const reward of choice.rewards ?? []) {
        if (SKILL_REWARD_TYPES.has(reward.type) && typeof reward.detail === 'number') {
          out.add(reward.detail);
        }
      }
    }
  }
  return out;
}

export interface TachyonsEventSkills {
  chain: Set<number>;
  /** Friend/group date (outing) events — GameTora's 'dates'/'dates_random'. */
  date: Set<number>;
  random: Set<number>;
  /** Bond-line specials; NOT auto-classified (residual card_source_overrides). */
  special: Set<number>;
}

export function extractTachyonsEventSkills(card: TachyonsCard | undefined): TachyonsEventSkills {
  return {
    chain: collectSkillIds(card?.all_events?.chain_events),
    date: collectSkillIds(card?.all_events?.dates),
    random: collectSkillIds(card?.all_events?.random_events),
    special: collectSkillIds(card?.all_events?.special_events),
  };
}

/** Training-hint-pool skill id → hint levels granted per take (hint_value_2). */
export function extractTachyonsHintLevels(card: TachyonsCard | undefined): Map<number, number> {
  const out = new Map<number, number>();
  for (const hint of card?.hints_table ?? []) {
    if (hint.type === 'skill_hint' && typeof hint.hint_level === 'number') {
      out.set(hint.skill_id, hint.hint_level);
    }
  }
  return out;
}

/** data.json is keyed by array index, not card id — index it once. */
export function indexTachyonsById(data: TachyonsDataJson): Map<number, TachyonsCard> {
  return new Map(Object.values(data).map((card) => [card.id, card]));
}
