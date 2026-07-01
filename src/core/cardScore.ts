// src/core/cardScore.ts
/** M1.6 — wraps the vendored euophrys scorer (src/vendor/uma-tiers, MIT).
 *  Scores each card under ITS OWN training type's weights, as the marginal
 *  addition to the current deck. P3: this is training-power, not inheritance
 *  value — see docs/superpowers/specs/2026-06-26-m1-6-support-card-pool-design.md. */
import type { LimitBreak, Stat } from '@/core/types';
import type { DeckState } from '@/features/inheritance/deckOps';
import type { UmaTiersCard, UmaTiersScenario } from '@/vendor/uma-tiers/index';
import glCards from '@/vendor/uma-tiers/gl';
import { processCards } from '@/vendor/uma-tiers/tierlist-calc';
import { getDefaultScenario } from '@/vendor/uma-tiers/scenarios';

export const DEFAULT_SCENARIO: UmaTiersScenario = getDefaultScenario('gl');

export interface ScoredCard {
  score: number;
  lb: LimitBreak;
}

/** The scorer's `general.umaBonus` (a per-stat training-gain multiplier) derived
 *  from a uma's growth bonuses (% → multiplier). Order [spd,sta,pow,gut,wit,skill];
 *  the skill slot has no growth → 1. E.g. {spd:20,gut:10} → [1.2,1,1,1.1,1,1]. */
export function umaBonusFromGrowth(growth: Record<Stat, number>): number[] {
  const m = (p: number) => 1 + (p ?? 0) / 100;
  return [m(growth.spd), m(growth.sta), m(growth.pow), m(growth.gut), m(growth.wit), 1];
}

/** Map of every vendored row keyed "id:lb" (e.g. "30028:4"). */
export function cardRowsByKey(): Map<string, UmaTiersCard> {
  const m = new Map<string, UmaTiersCard>();
  for (const c of glCards) m.set(`${c.id}:${c.limit_break}`, c);
  return m;
}

/** euophrys training type (0-4, 6) → the scenario stat-subobject key. */
const TYPE_KEY: Record<number, keyof UmaTiersScenario> = {
  0: 'speed', 1: 'stamina', 2: 'power', 3: 'guts', 4: 'wisdom', 6: 'friend',
};

export function resolveDeckObjects(deck: DeckState, byKey: Map<string, UmaTiersCard>): UmaTiersCard[] {
  const out: UmaTiersCard[] = [];
  deck.slots.forEach((cardId, i) => {
    if (!cardId) return;
    const row = byKey.get(`${cardId}:${deck.slotLb[i] ?? 4}`);
    if (row) out.push(row);
  });
  return out;
}

export function scoreCards(
  scenario: UmaTiersScenario,
  deckObjs: UmaTiersCard[],
  rows: UmaTiersCard[],
): Map<string, ScoredCard> {
  const byType = new Map<number, UmaTiersCard[]>();
  for (const c of rows) {
    const t = c.type;
    if (!(t in TYPE_KEY)) continue;
    (byType.get(t) ?? byType.set(t, []).get(t)!).push(c);
  }
  const out = new Map<string, ScoredCard>();
  for (const [type, typeRows] of byType) {
    // type is always present in TYPE_KEY — byType only gets entries that passed `t in TYPE_KEY`
    const typeKey = TYPE_KEY[type] as keyof UmaTiersScenario;
    const stat = scenario[typeKey] as Record<string, unknown>;
    const weights = { ...stat, ...scenario.general } as never;
    for (const scored of processCards(typeRows, weights, deckObjs)) {
      out.set(String(scored.id), { score: scored.score, lb: scored.lb as LimitBreak });
    }
  }
  return out;
}
