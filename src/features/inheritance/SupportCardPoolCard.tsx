// src/features/inheritance/SupportCardPoolCard.tsx
/** M1.6 — "Support cards" pool panel: shell + header + filters + Icon view.
 *  Provider-free — all data comes via props. */
import { useEffect, useState } from 'react';
import type { CardBaseEffect, CardEffect, CardType, LimitBreak } from '@/core/types';
import { TYPE_COLORS, TYPE_LABEL } from './deckOps';
import { isTraineeConflict } from './deckConflicts';
import {
  filterPool,
  sortPool,
  type PoolFilters,
  type PoolItem,
  type PoolSort,
} from './poolModel';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SupportCardPoolCardProps {
  items: PoolItem[];
  wishlistSkillNames: { id: string; name: string }[];
  statsShown: string[];
  cardLb: Record<string, LimitBreak>;
  onCardLb: (cardId: string, lb: LimitBreak) => void;
  deckCardIds: ReadonlySet<string>;
  /** Trainee's character name — cards of this character are blocked + greyed. */
  traineeCharName?: string | null;
  /** Character names occupying the deck — sibling cards are blocked + greyed. */
  deckCharNames?: ReadonlySet<string>;
  onAdd: (cardId: string) => void;
  renderIcon: (item: PoolItem, size: number) => React.ReactNode;
  /** Render the in-game coloured stat tile for a type filter chip; return null
   *  for types with no stat icon (friend/group) → falls back to the text label. */
  renderTypeIcon?: (type: CardType, size: number) => React.ReactNode;
  /** The currently-selected card (its detail shows in the right sidebar), or null. */
  selectedCardId?: string | null;
  /** Click an icon to select it (toggles); the page shows its detail card. */
  onSelectCard?: (cardId: string) => void;
  /** Optional node rendered between the search/filters and the grid (e.g. the
   *  Scoring weights card). */
  weightsSlot?: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TYPES: CardType[] = ['speed', 'stamina', 'power', 'guts', 'wit', 'friend', 'group'];

const DEFAULT_FILTERS: PoolFilters = {
  rarity: 'all',
  type: 'all',
  skill: null,
  search: '',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SupportCardPoolCard({
  items,
  wishlistSkillNames,
  cardLb,
  onCardLb,
  deckCardIds,
  traineeCharName = null,
  deckCharNames,
  onAdd,
  renderIcon,
  renderTypeIcon,
  selectedCardId = null,
  onSelectCard,
  weightsSlot,
}: SupportCardPoolCardProps) {
  const [view, setView] = useState<'icon' | 'plot'>('icon');
  const [sort, setSort] = useState<PoolSort>('matches');
  const [filters, setFilters] = useState<PoolFilters>(DEFAULT_FILTERS);

  const filtered = sortPool(filterPool(items, filters), sort);

  function setRarity(rarity: PoolFilters['rarity']) {
    setFilters((f) => ({ ...f, rarity }));
  }

  function setType(type: PoolFilters['type']) {
    setFilters((f) => ({ ...f, type }));
  }

  function setSkill(skill: string | null) {
    setFilters((f) => ({ ...f, skill }));
  }

  function setSearch(search: string) {
    setFilters((f) => ({ ...f, search }));
  }

  return (
    <div className="inh-deck inh-pool">
      {/* ── Head ── */}
      <div className="inh-deck-head inh-pool-head">
        <span className="inh-pool-title">Support cards</span>
        <div className="inh-pool-head-right">
          {/* View toggle */}
          <div className="inh-pool-toggle-group" role="group" aria-label="View">
            {(['icon', 'plot'] as const).map((v) => (
              <button
                key={v}
                type="button"
                className={`inh-pool-toggle-btn${view === v ? ' is-active' : ''}`}
                onClick={() => setView(v)}
                aria-pressed={view === v}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
          {/* Sort toggle — hidden in Plot view */}
          {view !== 'plot' && (
            <div className="inh-pool-toggle-group" role="group" aria-label="Sort">
              {(['matches', 'effect'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`inh-pool-toggle-btn${sort === s ? ' is-active' : ''}`}
                  onClick={() => setSort(s)}
                  aria-pressed={sort === s}
                >
                  {s === 'matches' ? 'Matches' : 'Effect'}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="inh-deck-body inh-pool-body">
        {/* ── Filters ── */}
        <div className="inh-pool-filters">
          {/* Rarity */}
          <div className="inh-pool-filter-row">
            <span className="inh-pool-filter-label">Rarity</span>
            <div className="inh-pool-chip-group">
              {(['all', 'SSR', 'SR', 'R'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  className={`inh-pool-chip${filters.rarity === r ? ' is-active' : ''}`}
                  onClick={() => setRarity(r)}
                >
                  {r === 'all' ? 'All' : r}
                </button>
              ))}
            </div>
          </div>

          {/* Type */}
          <div className="inh-pool-filter-row">
            <span className="inh-pool-filter-label">Type</span>
            <div className="inh-pool-chip-group">
              <button
                type="button"
                className={`inh-pool-chip${filters.type === 'all' ? ' is-active' : ''}`}
                onClick={() => setType('all')}
              >
                All
              </button>
              {TYPES.map((t) => {
                const icon = renderTypeIcon?.(t, 18);
                const active = filters.type === t;
                return (
                  <button
                    key={t}
                    type="button"
                    className={`inh-pool-chip${icon ? ' inh-pool-chip-icon' : ''}${active ? ' is-active' : ''}`}
                    // Inactive: a per-type colour border tint. Active: the shared
                    // accent fill (.is-active), same as every other filter row.
                    style={active ? undefined : { borderColor: TYPE_COLORS[t] }}
                    onClick={() => setType(t)}
                    aria-label={TYPE_LABEL[t]}
                    aria-pressed={active}
                    title={TYPE_LABEL[t]}
                  >
                    {icon ?? TYPE_LABEL[t]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Skill */}
          {wishlistSkillNames.length > 0 && (
            <div className="inh-pool-filter-row">
              <span className="inh-pool-filter-label">Skill</span>
              <div className="inh-pool-chip-group">
                <button
                  type="button"
                  className={`inh-pool-chip${filters.skill === null ? ' is-active' : ''}`}
                  onClick={() => setSkill(null)}
                >
                  Any
                </button>
                {wishlistSkillNames.map((sk) => (
                  <button
                    key={sk.id}
                    type="button"
                    className={`inh-pool-chip${filters.skill === sk.id ? ' is-active' : ''}`}
                    onClick={() => setSkill(sk.id)}
                  >
                    {sk.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search */}
          <div className="inh-pool-filter-row">
            <label className="inh-pool-filter-label" htmlFor="inh-pool-search">Search</label>
            <input
              id="inh-pool-search"
              type="text"
              className="inh-pool-search"
              placeholder="Card or character name…"
              value={filters.search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Optional card (Scoring weights) between the search/filters and the grid. */}
        {weightsSlot}

        {/* ── Grid ── */}
        {view === 'icon' ? (
          <div className="inh-pool-grid">
            {filtered.map((item) => {
              const inDeck = deckCardIds.has(item.cardId);
              const sameAsTrainee = isTraineeConflict(item.charName, traineeCharName);
              // Blocked = trainee's own character, or a sibling of a character already
              // in the deck (only one support card per character).
              const blocked =
                !inDeck &&
                (sameAsTrainee || (deckCharNames?.has(item.charName) ?? false));
              return (
                <PoolTile
                  key={item.cardId}
                  item={item}
                  lb={cardLb[item.cardId] ?? 4}
                  onCardLb={onCardLb}
                  inDeck={inDeck}
                  blocked={blocked}
                  blockReason={sameAsTrainee ? 'trainee' : 'duplicate'}
                  onAdd={onAdd}
                  renderIcon={renderIcon}
                  selected={selectedCardId === item.cardId}
                  onSelect={() => onSelectCard?.(item.cardId)}
                />
              );
            })}
          </div>
        ) : (
          <PoolPlot items={filtered} onAdd={onAdd} />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pool tile (Icon view)
// ---------------------------------------------------------------------------

interface PoolTileProps {
  item: PoolItem;
  lb: LimitBreak;
  onCardLb: (cardId: string, lb: LimitBreak) => void;
  inDeck: boolean;
  /** Can't be added (trainee's own character or a same-character duplicate). */
  blocked?: boolean;
  blockReason?: 'trainee' | 'duplicate';
  onAdd: (cardId: string) => void;
  renderIcon: (item: PoolItem, size: number) => React.ReactNode;
  selected: boolean;
  onSelect: () => void;
}

function PoolTile({ item, lb, onCardLb, inDeck, blocked = false, blockReason, onAdd, renderIcon, selected, onSelect }: PoolTileProps) {
  function handleDragStart(e: React.DragEvent) {
    // Blocked cards can't be dropped into the deck — cancel the drag.
    if (blocked) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('text/card-id', item.cardId);
    e.dataTransfer.setData('text/card-lb', String(lb));
  }
  const blockTitle =
    blockReason === 'trainee'
      ? 'Same character as the trainee — can’t be used'
      : 'Only one support card per character in a deck';

  return (
    <div
      className={`inh-pool-tile${selected ? ' is-selected' : ''}${inDeck ? ' is-in-deck' : ''}${blocked ? ' is-blocked' : ''}`}
      data-testid={`pool-tile-${item.cardId}`}
      title={blocked ? blockTitle : undefined}
      draggable={!blocked}
      onDragStart={handleDragStart}
    >
      <div className="inh-pool-tile-iconwrap">
        {/* Icon = select toggle; the full detail opens in the right sidebar. */}
        <button
          type="button"
          className="inh-pool-tile-iconbtn"
          aria-pressed={selected}
          aria-label={`${item.name} details`}
          onClick={onSelect}
        >
          {renderIcon(item, 60)}
          {item.matchCount > 0 && (
            <span className="inh-pool-tile-wishbadge" title={`${item.matchCount} wishlist skills`}>
              {item.matchCount}
            </span>
          )}
        </button>
        {/* Hover-only quick-add (top-right of the icon). Hidden once in the deck
            or when the card can't be added (trainee / duplicate character). */}
        {!inDeck && !blocked && (
          <button
            type="button"
            className="inh-pool-tile-quickadd"
            aria-label={`Add ${item.name} to deck`}
            title="Add to deck"
            onClick={() => onAdd(item.cardId)}
          >
            +
          </button>
        )}
        {/* Blocked indicator — centered chip, same design as the deck-slot badge. */}
        {blocked && (
          <span className="inh-pool-tile-blockbadge">
            {blockReason === 'trainee' ? 'Trainee' : 'Dup'}
          </span>
        )}
      </div>

      <div className="inh-deck-lb">
        <span className="inh-deck-lb-label">LB</span>
        <div className="inh-deck-lb-diamonds">
          {([1, 2, 3, 4] as const).map((level) => (
            <button
              key={level}
              type="button"
              className={`inh-deck-diamond${lb >= level ? ' is-on' : ''}`}
              aria-label={`LB ${level}`}
              // Clicking the current LB clears it to 0.
              onClick={() => onCardLb(item.cardId, lb === level ? 0 : level)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card detail (right sidebar) — full art + everything about the selected card.
// Reuses the old expanded-tile content; the page renders it next to M1.8.
// ---------------------------------------------------------------------------

export interface CardDetailCardProps {
  item: PoolItem;
  lb: LimitBreak;
  onCardLb: (cardId: string, lb: LimitBreak) => void;
  inDeck: boolean;
  onAdd: (cardId: string) => void;
  /** Can't be added: trainee's own character or a same-character duplicate. */
  blocked?: boolean;
  blockReason?: 'trainee' | 'duplicate';
  /** True when the deck has no free slot — Add then shows a "deck full" notice. */
  deckFull?: boolean;
  /** Deselect → hides this card. */
  onClose: () => void;
  /** Full-art node, built by the page (GameIcon kind="card-art", no badge). */
  art: React.ReactNode;
  /** The in-game stat-type tile node (shown by the name), or null. */
  typeIcon?: React.ReactNode;
  /** The card's resolved unique-effect lines (shown under the E value). */
  uniqueEffects?: CardEffect[];
  /** The card's full base (always-on) effect set, LB-aware. */
  baseEffects?: CardBaseEffect[];
  skillName?: (id: string) => string;
}

export function CardDetailCard({
  item,
  lb,
  onCardLb,
  inDeck,
  onAdd,
  blocked = false,
  blockReason,
  deckFull = false,
  onClose,
  art,
  typeIcon = null,
  uniqueEffects = [],
  baseEffects = [],
  skillName = (id) => id,
}: CardDetailCardProps) {
  const matched = new Set(item.matchedIds);
  const sections: { label: string; ids: string[] }[] = [
    { label: 'Chain', ids: [...new Set(item.chain)] },
    { label: 'Random', ids: [...new Set(item.random)] },
    { label: 'Hint', ids: [...new Set(item.hint)] },
  ].filter((s) => s.ids.length > 0);

  // Click the art → centered full-art viewer; click the grey backdrop / Esc closes.
  const [artOpen, setArtOpen] = useState(false);
  useEffect(() => {
    if (!artOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setArtOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [artOpen]);

  // Transient "deck is full" notice shown when Add can't add (auto-clears).
  const [showFull, setShowFull] = useState(false);
  useEffect(() => {
    if (!showFull) return;
    const t = setTimeout(() => setShowFull(false), 3000);
    return () => clearTimeout(t);
  }, [showFull]);

  return (
    <>
    <div className="inh-deck inh-card-detail">
      <div className="inh-deck-head inh-card-detail-head">
        <span>Card details</span>
        <button
          type="button"
          className="inh-card-detail-close"
          aria-label="Close card details"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <div className="inh-deck-body inh-card-detail-body">
        {/* Section 1 — art (left, half) | name + card stats + LB stepper (right). */}
        {/* Names — one centered column, full width, above the 2-column section. */}
        <div className="inh-card-detail-names">
          <span className="inh-pool-tile-name" data-testid="detail-card-name">{item.name}</span>
          {item.charName !== item.name && (
            <span className="inh-pool-tile-char inh-card-detail-uma">{item.charName}</span>
          )}
        </div>

        {/* Full art — single column, full width. */}
        <button
          type="button"
          className="inh-card-detail-art"
          aria-label="View full art"
          onClick={() => setArtOpen(true)}
        >
          {art}
        </button>

        {/* Meta row — stat-type tile + LB stepper · wishlist count · E score. */}
        <div className="inh-card-detail-meta">
          <div className="inh-card-detail-iconlb">
            <div className="inh-card-detail-typerow">
              {typeIcon && <span className="inh-card-detail-typeicon">{typeIcon}</span>}
              <span className="inh-card-detail-rarity">{item.rarity}</span>
            </div>
            <div className="inh-deck-lb inh-card-detail-lb">
              <span className="inh-deck-lb-label">LB</span>
              <div className="inh-deck-lb-diamonds">
                {([1, 2, 3, 4] as const).map((level) => (
                  <button
                    key={level}
                    type="button"
                    className={`inh-deck-diamond${lb >= level ? ' is-on' : ''}`}
                    aria-label={`LB ${level}`}
                    // Clicking the current LB clears it to 0.
                    onClick={() => onCardLb(item.cardId, lb === level ? 0 : level)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Unique Effect — above the base effect list (lines can wrap). */}
        {uniqueEffects.length > 0 && (
          <div className="inh-card-detail-unique">
            <span className="inh-card-detail-unique-label">Unique Effect</span>
            {uniqueEffects.map((e, i) => (
              <span key={`${e.type}-${i}`} className="inh-card-detail-unique-line">
                {e.conditional
                  ? e.descEn
                  : `${e.descEn} (${e.value}${e.symbol === 'percent' ? '%' : ''})`}
              </span>
            ))}
          </div>
        )}

        {/* Full base-effect list (all always-on effects) at the selected LB. */}
        {baseEffects.length > 0 && (
          <div className="inh-card-detail-effects">
            <span className="inh-card-detail-section-label">Effects</span>
            <div className="inh-card-detail-effects-grid">
              {baseEffects.map((e) => {
                const v = e.valuesByLb[lb] ?? 0;
                if (v === 0) return null;
                return (
                  <div key={e.type} className="inh-pool-stat-row">
                    <span className="inh-pool-stat-label">{e.nameEn}</span>
                    <span className="inh-pool-stat-val">+{v}{e.symbol === 'percent' ? '%' : ''}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Estimated effect value (the euophrys E-score) — under the effect list. */}
        <div className="inh-card-detail-evalue">
          <span className="inh-card-detail-section-label">Estimated Effect Value</span>
          <span className="inh-pool-tile-score">E {item.score !== null ? item.score.toFixed(2) : '—'}</span>
        </div>

        {/* Section 2 — obtainable skills; wishlist count on the first line, right. */}
        {sections.length > 0 && (
          <div className="inh-card-detail-skills">
            {item.matchCount > 0 && (
              <span className="inh-pool-tile-match inh-card-detail-match">{item.matchCount} wishlist</span>
            )}
            {sections.map((s) => (
              <div key={s.label} className="inh-pool-skill-section">
                <span className="inh-pool-skill-section-label">{s.label}</span>
                <div className="inh-pool-skill-chips">
                  {s.ids.map((id) => (
                    <span
                      key={id}
                      className={`inh-pool-skill-chip${matched.has(id) ? ' is-match' : ''}`}
                    >
                      {skillName(id)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Stays in place when added — greyed + disabled, label flips to "Added".
            Blocked cards (trainee / duplicate character) are disabled with a reason. */}
        <button
          type="button"
          className="inh-card-detail-add"
          disabled={inDeck || blocked}
          onClick={() => {
            if (deckFull) {
              setShowFull(true);
              return;
            }
            onAdd(item.cardId);
          }}
        >
          {inDeck
            ? 'Added'
            : blocked
              ? blockReason === 'trainee'
                ? 'Same as trainee'
                : 'Character already in deck'
              : '+ Add to deck'}
        </button>
        {showFull && !inDeck && (
          <span className="inh-card-detail-fullmsg" role="status">
            Deck is full — remove a card first.
          </span>
        )}
      </div>
    </div>

    {/* Full-art viewer: greyed backdrop + centered art; click outside / Esc closes. */}
    {artOpen && (
      <div
        className="inh-art-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Full art"
        onClick={() => setArtOpen(false)}
      >
        <div className="inh-art-modal-art" onClick={(e) => e.stopPropagation()}>{art}</div>
      </div>
    )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Plot view (SVG scatter)
// ---------------------------------------------------------------------------

interface PoolPlotProps {
  items: PoolItem[];
  onAdd: (cardId: string) => void;
}

const PLOT_W = 480;
const PLOT_H = 320;
const PLOT_PAD = { top: 24, right: 80, bottom: 40, left: 48 };

function PoolPlot({ items, onAdd }: PoolPlotProps) {
  const scored = items.filter((it): it is PoolItem & { score: number } => it.score !== null);
  const unscoredCount = items.length - scored.length;

  // Compute axis ranges over scored items
  const xValues = scored.map((it) => it.matchCount);
  const yValues = scored.map((it) => it.score);
  const xMin = xValues.length > 0 ? Math.min(...xValues) : 0;
  const xMax = xValues.length > 0 ? Math.max(...xValues) : 1;
  const yMin = yValues.length > 0 ? Math.min(...yValues) : 0;
  const yMax = yValues.length > 0 ? Math.max(...yValues) : 1;

  // Guard divide-by-zero when all x/y equal (single point or all equal)
  const xRange = xMax === xMin ? 1 : xMax - xMin;
  const yRange = yMax === yMin ? 1 : yMax - yMin;

  const chartW = PLOT_W - PLOT_PAD.left - PLOT_PAD.right;
  const chartH = PLOT_H - PLOT_PAD.top - PLOT_PAD.bottom;

  function scaleX(v: number): number {
    return PLOT_PAD.left + ((v - xMin) / xRange) * chartW;
  }
  function scaleY(v: number): number {
    // Invert y so higher score = higher on chart
    return PLOT_PAD.top + chartH - ((v - yMin) / yRange) * chartH;
  }

  return (
    <div className="inh-pool-plot">
      <svg
        className="inh-pool-plot-svg"
        viewBox={`0 0 ${PLOT_W} ${PLOT_H}`}
        width={PLOT_W}
        height={PLOT_H}
        aria-label="Support card effectiveness scatter plot"
      >
        {/* Axis labels */}
        <text
          x={PLOT_PAD.left + chartW / 2}
          y={PLOT_H - 6}
          textAnchor="middle"
          className="inh-plot-axis-label"
        >
          Wishlist matches →
        </text>
        <text
          x={12}
          y={PLOT_PAD.top + chartH / 2}
          textAnchor="middle"
          transform={`rotate(-90, 12, ${PLOT_PAD.top + chartH / 2})`}
          className="inh-plot-axis-label"
        >
          Effectiveness →
        </text>

        {/* Top-right hint */}
        <text
          x={PLOT_W - PLOT_PAD.right + 4}
          y={PLOT_PAD.top + 4}
          className="inh-plot-hint-label"
        >
          ★ best picks
        </text>

        {/* Scored nodes */}
        {scored.map((item) => {
          const cx = scaleX(item.matchCount);
          const cy = scaleY(item.score);
          return (
            <g
              key={item.cardId}
              role="button"
              aria-label={`add ${item.name}`}
              tabIndex={0}
              onClick={() => onAdd(item.cardId)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onAdd(item.cardId);
                }
              }}
              style={{ cursor: 'pointer' }}
            >
              <circle
                cx={cx}
                cy={cy}
                r={8}
                fill={item.typeColor}
                opacity={0.85}
              />
              <title>{item.name} — E {item.score}, {item.matchCount} wishlist</title>
            </g>
          );
        })}
      </svg>

      {/* Footnote for unscored cards */}
      {unscoredCount > 0 && (
        <p className="inh-plot-footnote">
          {unscoredCount} cards have no score and are not shown.
        </p>
      )}
    </div>
  );
}
