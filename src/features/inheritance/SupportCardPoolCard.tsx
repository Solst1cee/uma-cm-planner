// src/features/inheritance/SupportCardPoolCard.tsx
/** M1.6 — "Support cards" pool panel: shell + header + filters + Icon view.
 *  Provider-free — all data comes via props. */
import { useState } from 'react';
import type { CardType, LimitBreak } from '@/core/types';
import { TYPE_COLORS, TYPE_LABEL } from './deckOps';
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
  onAdd: (cardId: string) => void;
  renderIcon: (item: PoolItem) => React.ReactNode;
  /** Map a skill id to its display name. Defaults to the raw id. */
  skillName?: (id: string) => string;
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
  onAdd,
  renderIcon,
  skillName = (id) => id,
}: SupportCardPoolCardProps) {
  const [view, setView] = useState<'icon' | 'art' | 'plot'>('icon');
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
        <span className="inh-pool-count">{filtered.length} shown</span>
        <div className="inh-pool-head-right">
          {/* View toggle */}
          <div className="inh-pool-toggle-group" role="group" aria-label="View">
            {(['icon', 'art', 'plot'] as const).map((v) => (
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
          {/* Sort toggle */}
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
              {TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`inh-pool-chip${filters.type === t ? ' is-active' : ''}`}
                  style={filters.type === t ? { background: TYPE_COLORS[t], borderColor: TYPE_COLORS[t], color: '#fff' } : { borderColor: TYPE_COLORS[t] }}
                  onClick={() => setType(t)}
                >
                  {TYPE_LABEL[t]}
                </button>
              ))}
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

        {/* ── Grid ── */}
        {view === 'icon' ? (
          <div className="inh-pool-grid">
            {filtered.map((item) => (
              <PoolTile
                key={item.cardId}
                item={item}
                lb={cardLb[item.cardId] ?? 0}
                onCardLb={onCardLb}
                inDeck={deckCardIds.has(item.cardId)}
                onAdd={onAdd}
                renderIcon={renderIcon}
              />
            ))}
          </div>
        ) : view === 'art' ? (
          <div className="inh-pool-art-list">
            {filtered.map((item) => (
              <ArtTile
                key={item.cardId}
                item={item}
                lb={cardLb[item.cardId] ?? 0}
                onCardLb={onCardLb}
                inDeck={deckCardIds.has(item.cardId)}
                onAdd={onAdd}
                renderIcon={renderIcon}
                skillName={skillName}
              />
            ))}
          </div>
        ) : (
          <div className="inh-pool-placeholder">
            Plot view — coming soon
          </div>
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
  onAdd: (cardId: string) => void;
  renderIcon: (item: PoolItem) => React.ReactNode;
}

function PoolTile({ item, lb, onCardLb, inDeck, onAdd, renderIcon }: PoolTileProps) {
  function handleDragStart(e: React.DragEvent) {
    e.dataTransfer.setData('text/card-id', item.cardId);
  }

  return (
    <div
      className="inh-pool-tile"
      draggable
      onDragStart={handleDragStart}
    >
      {/* Icon */}
      <div className="inh-pool-tile-icon">{renderIcon(item)}</div>

      {/* Name */}
      <span className="inh-pool-tile-name" data-testid="pool-card-name">
        {item.name}
      </span>

      {/* Char name — only shown when different from card name */}
      {item.charName !== item.name && (
        <span className="inh-pool-tile-char">{item.charName}</span>
      )}

      {/* Rarity + type badge */}
      <span
        className="inh-pool-tile-rarity"
        style={{ background: item.typeColor }}
      >
        {item.rarity}
      </span>

      {/* Score + match count */}
      <div className="inh-pool-tile-score">
        <span>E {item.score !== null ? item.score : '—'}</span>
        {item.matchCount > 0 && (
          <span className="inh-pool-tile-match">{item.matchCount} wishlist</span>
        )}
      </div>

      {/* Hint chips */}
      {item.hint.length > 0 && (
        <div className="inh-pool-tile-hints">
          {item.hint.map((id) => (
            <span key={id} className="inh-pool-hint-chip">{id}</span>
          ))}
        </div>
      )}

      {/* LB diamonds */}
      <div className="inh-deck-lb">
        <span className="inh-deck-lb-label">LB</span>
        <div className="inh-deck-lb-diamonds">
          {([1, 2, 3, 4] as const).map((level) => (
            <button
              key={level}
              type="button"
              className={`inh-deck-diamond${lb >= level ? ' is-on' : ''}`}
              aria-label={`LB ${level}`}
              onClick={() => onCardLb(item.cardId, level as LimitBreak)}
            />
          ))}
        </div>
      </div>

      {/* Add / Added */}
      {inDeck ? (
        <span className="inh-pool-tile-added">Added</span>
      ) : (
        <button
          type="button"
          className="inh-pool-tile-add"
          onClick={() => onAdd(item.cardId)}
        >
          Add
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Art tile (Art view)
// ---------------------------------------------------------------------------

interface ArtTileProps {
  item: PoolItem;
  lb: LimitBreak;
  onCardLb: (cardId: string, lb: LimitBreak) => void;
  inDeck: boolean;
  onAdd: (cardId: string) => void;
  renderIcon: (item: PoolItem) => React.ReactNode;
  skillName: (id: string) => string;
}

function ArtTile({ item, lb, onCardLb, inDeck, onAdd, renderIcon, skillName }: ArtTileProps) {
  function handleDragStart(e: React.DragEvent) {
    e.dataTransfer.setData('text/card-id', item.cardId);
  }

  return (
    <div
      className="inh-pool-art-tile"
      draggable
      onDragStart={handleDragStart}
    >
      {/* Art / icon column */}
      <div className="inh-pool-art-icon" style={{ background: item.typeColor }}>
        {renderIcon(item)}
      </div>

      {/* Content column */}
      <div className="inh-pool-art-content">
        {/* Name + rarity + type chip */}
        <div className="inh-pool-art-header">
          <span className="inh-pool-tile-name">{item.name}</span>
          {item.charName !== item.name && (
            <span className="inh-pool-tile-char">{item.charName}</span>
          )}
          <span
            className="inh-pool-tile-rarity"
            style={{ background: item.typeColor }}
          >
            {item.rarity}
          </span>
        </div>

        {/* Chain event-skill chips (green) */}
        {item.chain.length > 0 && (
          <div className="inh-pool-art-skill-row">
            <span className="inh-pool-art-skill-label">Chain</span>
            <div className="inh-pool-art-chips">
              {item.chain.map((id) => (
                <span key={id} className="inh-pool-art-chip inh-pool-art-chip--chain">
                  {skillName(id)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Random event-skill chips (orange) */}
        {item.random.length > 0 && (
          <div className="inh-pool-art-skill-row">
            <span className="inh-pool-art-skill-label">Random</span>
            <div className="inh-pool-art-chips">
              {item.random.map((id) => (
                <span key={id} className="inh-pool-art-chip inh-pool-art-chip--random">
                  {skillName(id)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Score */}
        <div className="inh-pool-tile-score">
          <span>E {item.score !== null ? item.score : '—'}</span>
          {item.matchCount > 0 && (
            <span className="inh-pool-tile-match">{item.matchCount} wishlist</span>
          )}
        </div>

        {/* LB diamonds */}
        <div className="inh-deck-lb">
          <span className="inh-deck-lb-label">LB</span>
          <div className="inh-deck-lb-diamonds">
            {([1, 2, 3, 4] as const).map((level) => (
              <button
                key={level}
                type="button"
                className={`inh-deck-diamond${lb >= level ? ' is-on' : ''}`}
                aria-label={`LB ${level}`}
                onClick={() => onCardLb(item.cardId, level as LimitBreak)}
              />
            ))}
          </div>
        </div>

        {/* Add / Added */}
        {inDeck ? (
          <span className="inh-pool-tile-added">Added</span>
        ) : (
          <button
            type="button"
            className="inh-pool-tile-add"
            onClick={() => onAdd(item.cardId)}
          >
            Add
          </button>
        )}
      </div>
    </div>
  );
}
