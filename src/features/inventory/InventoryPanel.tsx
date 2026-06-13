/**
 * Module 4 step 2: inventory UI — add-as-you-go card picker (never forces
 * full-box entry), owned list with editable limit break. Persistence is the
 * caller's job (useInventory writes to Dexie on every mutation).
 */
import { useMemo, useState } from 'react';
import type { LimitBreak, OwnedCard, SupportCardRecord } from '@/core/types';
import { classifyHintTier } from '@/core/coverage';
import { useGameData } from '@/features/data/gameData';
import { GameIcon } from '@/features/data/GameIcon';
import { TIER_LABEL } from '@/features/coverage/tierMeta';

const MAX_RESULTS = 30;
const LIMIT_BREAKS: readonly LimitBreak[] = [0, 1, 2, 3, 4];

function CardBadges({ card }: { card: SupportCardRecord }) {
  return (
    <>
      <span className={`badge rarity-${card.rarity}`}>{card.rarity}</span>
      <span className={`badge type-${card.type}`}>{card.type}</span>
    </>
  );
}

export function InventoryPanel({
  inventory,
  error,
  onAdd,
  onSetLimitBreak,
  onRemove,
}: {
  inventory: OwnedCard[] | null;
  error: string | null;
  onAdd: (cardId: string, limitBreak: LimitBreak) => void;
  onSetLimitBreak: (id: number, limitBreak: LimitBreak) => void;
  onRemove: (id: number) => void;
}) {
  const { cards, cardById } = useGameData();
  const [query, setQuery] = useState('');

  const ownedCardIds = useMemo(
    () => new Set((inventory ?? []).map((o) => o.cardId)),
    [inventory],
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === '') return [];
    return cards
      .filter(
        (c) =>
          c.server === 'global' &&
          (c.nameEn.toLowerCase().includes(q) || c.charName.toLowerCase().includes(q)),
      )
      .slice(0, MAX_RESULTS);
  }, [cards, query]);

  return (
    <section className="panel" aria-labelledby="inv-h">
      <h2 id="inv-h">Owned cards</h2>
      {error && (
        <p className="error" role="alert">
          Inventory error: {error}
        </p>
      )}

      <label className="field">
        <span>Add support card</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by card or character name…"
        />
      </label>
      {query.trim() !== '' && (
        <ul className="picker-results" aria-label="Card search results">
          {results.length === 0 && <li className="muted">No matching cards.</li>}
          {results.map((card) => {
            const owned = ownedCardIds.has(card.cardId);
            return (
              <li key={card.cardId}>
                <button
                  type="button"
                  className="picker-row"
                  disabled={owned}
                  onClick={() => {
                    onAdd(card.cardId, 0);
                    setQuery('');
                  }}
                >
                  <GameIcon kind="card" id={card.cardId} size={32} alt="" />
                  <span className="picker-name">
                    {card.charName} <span className="muted small">{card.nameEn}</span>
                  </span>
                  <CardBadges card={card} />
                  {owned && <span className="muted small">owned</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {inventory === null ? (
        <p className="muted">Loading inventory…</p>
      ) : inventory.length === 0 ? (
        <p className="muted">No cards yet — add the ones you actually plan to run.</p>
      ) : (
        <ul className="owned-list" aria-label="Owned cards">
          {inventory.map((owned, i) => {
            const card = cardById.get(owned.cardId);
            const name = card ? card.charName : owned.cardId;
            return (
              <li key={owned.id ?? `i${i}`} className="owned-row">
                <div className="owned-main">
                  <GameIcon kind="card" id={owned.cardId} size={32} alt="" />
                  <span className="owned-name">{name}</span>
                  {card && (
                    <>
                      <CardBadges card={card} />
                      <span className="chip-sm">
                        {TIER_LABEL[classifyHintTier(card, owned.limitBreak)]}
                      </span>
                    </>
                  )}
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Remove ${name}`}
                    onClick={() => owned.id !== undefined && onRemove(owned.id)}
                  >
                    ✕
                  </button>
                </div>
                <div
                  className="lb-chips"
                  role="group"
                  aria-label={`Limit break for ${name}`}
                >
                  {LIMIT_BREAKS.map((lb) => (
                    <button
                      key={lb}
                      type="button"
                      className="lb-chip"
                      aria-pressed={owned.limitBreak === lb}
                      aria-label={`LB ${lb} for ${name}`}
                      onClick={() => owned.id !== undefined && onSetLimitBreak(owned.id, lb)}
                    >
                      {lb}
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
