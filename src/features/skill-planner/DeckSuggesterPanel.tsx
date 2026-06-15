/**
 * Module 4 step 5 (plan §6 Panel C): locked-slot editor + deck suggestion.
 *
 * Lock edits persist to plan.lockedDeckSlots immediately (via onChange →
 * ActivePlan debounce). The suggestion itself is ephemeral UI state and is
 * invalidated by any lock edit — showing a deck computed under constraints
 * that no longer hold would be a fabricated answer (P3).
 */
import { useEffect, useMemo, useState } from 'react';
import type { CardType, CmPlan, DeckSuggestion, OwnedCard } from '@/core/types';
import { sparkOnlyTargets, suggestDeck } from '@/core/deck';
import { useGameData } from '@/features/data/gameData';
import { useChosenParents } from '@/features/coverage/useChosenParents';

const SLOTS = [0, 1, 2, 3, 4, 5] as const;
type Slot = (typeof SLOTS)[number];

const CARD_TYPES: readonly CardType[] = [
  'speed',
  'stamina',
  'power',
  'guts',
  'wit',
  'friend',
  'group',
];

const MAX_PICKER_RESULTS = 30;

function formatScore(score: number): string {
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}

export function DeckSuggesterPanel({
  plan,
  onChange,
  inventory,
}: {
  plan: CmPlan;
  onChange: (next: CmPlan) => void;
  inventory: OwnedCard[];
}) {
  const { skills, cards, skillById, cardById } = useGameData();
  const { parents, loading: parentsLoading } = useChosenParents(plan);
  const [suggestion, setSuggestion] = useState<DeckSuggestion | null>(null);

  // FINDING 2: a suggestion is computed from plan.wishlist, the resolved
  // parents (and plan.parents that drive them), and inventory. If ANY of
  // those change after a suggestion is shown, the displayed deck/score/missing
  // list describes a plan that no longer holds — a fabricated answer (P3). Lock
  // edits already clear via applyLock; this covers the rest by clearing whenever
  // a suggester input changes.
  useEffect(() => {
    setSuggestion(null);
  }, [plan.wishlist, plan.parents, inventory, parents]);
  /** Slot whose card-lock picker is open (transient; nothing in plan yet). */
  const [picking, setPicking] = useState<Slot | null>(null);
  const [query, setQuery] = useState('');

  // Distinct owned cardIds — the searchable card-lock pool. A lock targets a
  // cardId, not an inventory copy; the suggester resolves which copy to use.
  const ownedChoices = useMemo(() => {
    const seen = new Set<string>();
    const out: Array<{ cardId: string; charName: string; nameEn: string }> = [];
    for (const owned of inventory) {
      if (seen.has(owned.cardId)) continue;
      seen.add(owned.cardId);
      const card = cardById.get(owned.cardId);
      out.push({
        cardId: owned.cardId,
        charName: card?.charName ?? owned.cardId,
        nameEn: card?.nameEn ?? '',
      });
    }
    return out;
  }, [inventory, cardById]);

  const pickerResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool =
      q === ''
        ? ownedChoices
        : ownedChoices.filter(
            (c) =>
              c.charName.toLowerCase().includes(q) || c.nameEn.toLowerCase().includes(q),
          );
    return pool.slice(0, MAX_PICKER_RESULTS);
  }, [ownedChoices, query]);

  function applyLock(slot: Slot, lock: { cardType?: CardType; cardId?: string } | null) {
    const rest = plan.lockedDeckSlots.filter((l) => l.slot !== slot);
    const next =
      lock === null ? rest : [...rest, { slot, ...lock }].sort((a, b) => a.slot - b.slot);
    onChange({ ...plan, lockedDeckSlots: next });
    setSuggestion(null); // constraints changed — a stale suggestion would lie (P3)
  }

  function onModeChange(slot: Slot, value: string) {
    if (value === 'free') {
      setPicking((p) => (p === slot ? null : p));
      setQuery('');
      applyLock(slot, null);
    } else if (value === 'card') {
      // No plan write yet — the lock lands when a card is picked.
      setPicking(slot);
      setQuery('');
    } else {
      setPicking((p) => (p === slot ? null : p));
      applyLock(slot, { cardType: value as CardType });
    }
  }

  const hasTargets = plan.wishlist.length > 0;

  return (
    <section className="panel" aria-labelledby="suggester-h">
      <h2 id="suggester-h">Deck suggester</h2>
      <p className="muted small">
        Lock the slots your training plan already dictates; the suggester fills the rest to
        maximize target-skill coverage.
      </p>

      <ul className="deck-slots" aria-label="Deck slot locks">
        {SLOTS.map((slot) => {
          const lock = plan.lockedDeckSlots.find((l) => l.slot === slot);
          const mode =
            picking === slot
              ? 'card'
              : lock?.cardId !== undefined
                ? 'card'
                : (lock?.cardType ?? 'free');
          const lockedCard = lock?.cardId !== undefined ? cardById.get(lock.cardId) : undefined;
          const unowned =
            lock?.cardId !== undefined && !inventory.some((o) => o.cardId === lock.cardId);
          return (
            <li key={slot} className="deck-slot">
              <label className="field">
                <span>Slot {slot + 1}</span>
                <select
                  value={mode}
                  onChange={(e) => onModeChange(slot, e.target.value)}
                  aria-label={`Slot ${slot + 1} lock`}
                >
                  <option value="free">Free</option>
                  {CARD_TYPES.map((t) => (
                    <option key={t} value={t}>
                      Lock: {t}
                    </option>
                  ))}
                  <option value="card">Lock: specific card…</option>
                </select>
              </label>
              {lock?.cardId !== undefined && (
                <p className="slot-lock-card">
                  {lockedCard ? `${lockedCard.charName} ${lockedCard.nameEn}` : lock.cardId}
                  {unowned && <span className="error small"> (not in inventory)</span>}{' '}
                  <button
                    type="button"
                    className="icon-btn small"
                    onClick={() => {
                      setPicking(slot);
                      setQuery('');
                    }}
                    aria-label={`Change card for slot ${slot + 1}`}
                  >
                    change
                  </button>
                </p>
              )}
              {picking === slot && (
                <div className="slot-card-picker">
                  <label className="field">
                    <span>Lock slot {slot + 1} to card</span>
                    <input
                      type="search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search owned cards…"
                    />
                  </label>
                  <ul
                    className="picker-results"
                    aria-label={`Card choices for slot ${slot + 1}`}
                  >
                    {pickerResults.length === 0 && (
                      <li className="muted">No owned cards match.</li>
                    )}
                    {pickerResults.map((c) => (
                      <li key={c.cardId}>
                        <button
                          type="button"
                          className="picker-row"
                          onClick={() => {
                            applyLock(slot, { cardId: c.cardId });
                            setPicking(null);
                            setQuery('');
                          }}
                        >
                          <span className="picker-name">
                            {c.charName} <span className="muted small">{c.nameEn}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        disabled={!hasTargets || parentsLoading}
        onClick={() =>
          setSuggestion(suggestDeck({ plan, inventory, cards, skills, parents }))
        }
      >
        Suggest deck
      </button>
      {!hasTargets && (
        <p className="muted small">Add target skills above to get a suggestion.</p>
      )}
      {hasTargets && parentsLoading && (
        // FINDING 2: suggesting with parents=[] (still loading) lists
        // parent-spark-covered targets as missing — wait for the Dexie read.
        <p className="muted small">Loading chosen parents…</p>
      )}

      {suggestion &&
        (() => {
          // FINDING 5: targets covered ONLY by a parent spark (RNG inheritance,
          // tier weight 0) are not in `uncovered`, so they'd silently read as
          // "not missing". Surface them as a distinct bucket so the user knows
          // they rest on RNG, not a deck source.
          const sparkOnly = sparkOnlyTargets({
            plan,
            deck: suggestion,
            cards,
            skills,
            parents,
          });
          const nothingMissing = suggestion.uncovered.length === 0 && sparkOnly.length === 0;
          return (
            <div className="suggestion">
              <ol className="deck-result" aria-label="Suggested deck">
                {suggestion.deck.map((d) => {
                  const card = d.cardId !== undefined ? cardById.get(d.cardId) : undefined;
                  return (
                    <li key={d.slot}>
                      <span className="deck-slot-no muted small">Slot {d.slot + 1}</span>
                      <span className="deck-card-name">
                        {d.cardId === undefined ? (
                          <span className="muted">— empty —</span>
                        ) : card ? (
                          `${card.charName} ${card.nameEn}`
                        ) : (
                          d.cardId
                        )}
                      </span>
                      {d.lockedBy !== undefined && (
                        <span className="badge locked-badge">
                          {d.lockedBy === 'cardType' ? 'locked: type' : 'locked: card'}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>
              <p>
                Coverage score: <strong>{formatScore(suggestion.coverageScore)}</strong>{' '}
                <span className="muted small">
                  (Σ priority × tier weight — for comparing decks, not a probability)
                </span>
              </p>
              {suggestion.rationale.length > 0 && (
                <ul className="rationale" aria-label="Why these picks">
                  {suggestion.rationale.map((line, i) => (
                    <li key={i} className="muted small">
                      {line}
                    </li>
                  ))}
                </ul>
              )}
              <h3>What am I missing</h3>
              {nothingMissing && (
                <p className="muted">Nothing — every target has at least one source.</p>
              )}
              {suggestion.uncovered.length > 0 && (
                <ul className="missing-list" aria-label="Uncovered target skills">
                  {suggestion.uncovered.map((skillId) => (
                    <li key={skillId}>{skillById.get(skillId)?.nameEn ?? skillId}</li>
                  ))}
                </ul>
              )}
              {sparkOnly.length > 0 && (
                <div className="spark-only-bucket">
                  <h4 className="spark-only-h">Spark-only (RNG inheritance, no deck source)</h4>
                  <ul className="spark-only-list" aria-label="Spark-only target skills">
                    {sparkOnly.map((skillId) => (
                      <li key={skillId}>{skillById.get(skillId)?.nameEn ?? skillId}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })()}
    </section>
  );
}
