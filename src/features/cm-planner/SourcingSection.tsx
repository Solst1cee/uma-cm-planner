/** "Where to get it" — for an ACQUIRABLE (white/gold) skill, the support cards that hint it,
 *  best-tier-first, or a gap warning when none do. Pure data join (no sim): the reverse
 *  card-hint index is built once from the GameData support cards and memoized.
 *  Unique / inherited-unique skills are innate to a uma (not card-sourced) → renders nothing. */
import './sourcing.css';
import { useMemo } from 'react';
import { useGameData } from '@/features/data/gameData';
import { GameIcon } from '@/features/data/GameIcon';
import { buildCardHintIndex, sourcingForSkill } from '@/core/sourcing';
import type { SkillRarity, Tier } from '@/core/types';

/** Tiers are shown at max limit-break — the standard CM planning assumption (hint reliability
 *  rises with LB; surfacing the best case keeps the chip honest about the upper bound). */
const SOURCING_LB = 4;
/** Cap the card list so a heavily-hinted white skill doesn't render a wall of icons. */
const MAX_SHOWN = 6;

const TIER_LABEL: Partial<Record<Tier, string>> = {
  chain: 'Chain event',
  date_event: 'Date event',
  hint_strong: 'Hint (reliable)',
  hint_weak: 'Hint (low)',
  random: 'Random event',
};

/** Reverse card-hint index + cardById, memoized over the (stable) GameData card list. */
export function useCardHintIndex() {
  const { cards } = useGameData();
  return useMemo(() => {
    const list = cards ?? [];
    return { index: buildCardHintIndex(list), cardById: new Map(list.map((c) => [c.cardId, c])) };
  }, [cards]);
}

export function SourcingSection({ skillId, rarity }: { skillId: string; rarity: SkillRarity }) {
  const { index, cardById } = useCardHintIndex();
  const acquirable = rarity === 'white' || rarity === 'gold';
  const row = useMemo(
    () => (acquirable ? sourcingForSkill(skillId, index, cardById, SOURCING_LB) : null),
    [acquirable, skillId, index, cardById],
  );
  if (row === null) return null; // unique/inherited-unique: innate, not card-sourced

  const shown = row.cardHints.slice(0, MAX_SHOWN);
  const extra = row.cardHints.length - shown.length;

  return (
    <section className="cmp-sourcing">
      <h4>Where to get it <small>support-card hints, at max limit-break</small></h4>
      {row.gap ? (
        <p className="cmp-sourcing-gap">⚠ No support card hints this skill — inherit it from a parent, or run a card that grants it.</p>
      ) : (
        <ul className="cmp-sourcing-cards">
          {shown.map((c) => (
            <li key={c.cardId} className="cmp-sourcing-card">
              <GameIcon kind="card" id={c.cardId} size={28} alt="" />
              <span className="cmp-sourcing-card-name">{c.cardName}</span>
              <span className={`cmp-tier-badge is-tier-${c.tier}`}>{TIER_LABEL[c.tier] ?? c.tier}</span>
            </li>
          ))}
          {extra > 0 && <li className="cmp-sourcing-more muted small">+{extra} more card{extra === 1 ? '' : 's'}</li>}
        </ul>
      )}
    </section>
  );
}
