/**
 * Display metadata for coverage tiers. Order mirrors the reliability ranking
 * in plan §6 / docs/mechanics-notes.md — best first. Colors live in
 * src/styles/app.css under `.tier-<kind>`.
 */
import type { Tier } from '@/core/types';

export const TIER_ORDER: readonly Tier[] = [
  'chain',
  'scenario',
  'date_event',
  'hint_strong',
  'hint_weak',
  'random',
  'spark',
  'uncovered',
];

export const TIER_LABEL: Record<Tier, string> = {
  chain: 'Chain',
  scenario: 'Scenario',
  date_event: 'Date event',
  hint_strong: 'Hint+',
  hint_weak: 'Hint−',
  random: 'Random',
  spark: 'Spark',
  uncovered: 'Uncovered',
};

/** Long-form reliability description, surfaced in the details drawer (P3). */
export const TIER_DESCRIPTION: Record<Tier, string> = {
  chain: 'Chain event — most reliable card source; full-chain completion is still RNG.',
  scenario:
    'Scenario-exclusive — near-deterministic milestone/ending rewards if conditions are met; only valid while the plan uses this scenario.',
  date_event: 'Friend/group date event — reliable if the date chain is run.',
  hint_strong: 'Hint pool, favorable odds (high hint frequency vs pool size).',
  hint_weak: 'Hint pool, unfavorable odds (low hint frequency or large pool).',
  random: 'Random (non-chain) event — never count on it for core skills.',
  spark: 'Inheritance spark — probabilistic; spark math lands in Phase 2.',
  uncovered: 'No reliable source in the current inventory/scenario.',
};

export function tierRank(tier: Tier): number {
  const idx = TIER_ORDER.indexOf(tier);
  return idx === -1 ? TIER_ORDER.length : idx;
}

export function bestTierOf<T extends { kind: Tier }>(sources: readonly T[]): T | undefined {
  let best: T | undefined;
  for (const s of sources) {
    if (!best || tierRank(s.kind) < tierRank(best.kind)) best = s;
  }
  return best;
}
