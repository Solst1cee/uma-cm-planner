/**
 * Module 4 panel §3 — "Where do I get these?". For each wishlist skill, joins
 * against the support-card hint index and lists the cards that can hint it,
 * flagging a gap when nothing in the inventory sources the skill.
 *
 * P3 honesty: uma-innate sources are not yet joined here (slice-1b) — the note
 * at the bottom says so rather than implying card hints are the only route.
 */
import { useMemo } from 'react';
import type { CmPlan } from '@/core/types';
import { buildCardHintIndex, sourcingForSkill } from '@/core/sourcing';
import { useGameData } from '@/features/data/gameData';

export function SourcingPanel({ plan }: { plan: CmPlan }) {
  const { cards, cardById, skillById } = useGameData();
  // P4 guard: only Global-released cards source skills here. Upcoming (server:'jp')
  // cards exist in the dataset for preview (data-overrides/upcoming_cards.json) but
  // must not silently appear as sources — the "include upcoming" toggle (M4 §3,
  // deferred) will opt them in, gated by the CM date.
  const index = useMemo(() => buildCardHintIndex(cards.filter((c) => c.server === 'global')), [cards]);

  return (
    <section className="panel" aria-labelledby="sourcing-h">
      <h2 id="sourcing-h">Where do I get these?</h2>

      {plan.wishlist.length === 0 ? (
        <p className="muted">Add target skills to see where to get them.</p>
      ) : (
        <ul className="sourcing-list" aria-label="Skill sourcing">
          {plan.wishlist.map((item) => {
            const row = sourcingForSkill(item.skillId, index, cardById, 4);
            const name = skillById.get(item.skillId)?.nameEn ?? item.skillId;
            return (
              <li key={item.skillId} className="sourcing-row">
                <span className="sourcing-name">{name}</span>
                {row.gap ? (
                  <span className="badge gap">⚠ no source — inherit or add a card</span>
                ) : (
                  row.cardHints.map((h) => (
                    <span key={h.cardId} className={`badge tier-${h.tier}`}>
                      {h.cardName}
                    </span>
                  ))
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="muted small">Uma-innate sources land in a later slice.</p>
    </section>
  );
}
