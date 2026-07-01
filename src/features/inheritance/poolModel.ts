// src/features/inheritance/poolModel.ts
/** M1.6 — pool view-model: build, filter, sort. Pure helpers. */
import type { CardType, LimitBreak, Server, SupportCardRecord } from '@/core/types';
import { matchedSkillIds } from '@/core/cardMatches';
import { isReleasedBy } from '@/core/availability';
import { TYPE_COLORS, TYPE_LABEL } from './deckOps';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PoolFilters {
  rarity: 'all' | 'R' | 'SR' | 'SSR';
  type: 'all' | CardType;
  /** Skill id to filter on, or null for no skill filter. */
  skill: string | null;
  search: string;
  /** When true, show JP-ahead cards that are released by the CM date. */
  showUpcoming: boolean;
}

export type PoolSort = 'matches' | 'effect';

/** A single displayed effect stat (label + formatted value). */
export interface StatLine {
  label: string;
  value: string;
}

/** The effect fields we read off a vendored euophrys card row (UmaTiersCard
 *  structurally satisfies this). Multipliers: tb/mb/fs_bonus/hint_rate (1.15 →
 *  +15%); raw: race_bonus (%), specialty_rate, sb (starting bond / init gauge). */
export interface CardEffectRow {
  tb: number;
  mb: number;
  fs_bonus: number;
  race_bonus: number;
  specialty_rate: number;
  hint_rate: number;
  sb: number;
}

/** Effect stats for the expanded tile, one line each (mockup order). Empty when
 *  no row is supplied (e.g. a card with no scorer data). */
export function cardStatLines(row: CardEffectRow | undefined): StatLine[] {
  if (!row) return [];
  const pct = (mult: number) => `+${Math.round((mult - 1) * 100)}%`;
  return [
    { label: 'Training', value: pct(row.tb) },
    { label: 'Friendship', value: pct(row.fs_bonus) },
    { label: 'Mood', value: pct(row.mb) },
    { label: 'Specialty', value: String(row.specialty_rate) },
    { label: 'Race bonus', value: `${row.race_bonus}%` },
    { label: 'Init. gauge', value: String(row.sb) },
    { label: 'Hint freq', value: pct(row.hint_rate) },
  ];
}

export interface PoolItem {
  cardId: string;
  name: string;
  charName: string;
  rarity: 'R' | 'SR' | 'SSR';
  type: CardType;
  typeColor: string;
  typeLabel: string;
  score: number | null;
  matchCount: number;
  /** Wishlist skill ids this card provides (card order, de-duped). */
  matchedIds: string[];
  /** All skill ids with sourceType 'chain'. */
  chain: string[];
  /** All skill ids with sourceType 'random_event'. */
  random: string[];
  /** All skill ids with sourceType 'hint_pool'. */
  hint: string[];
  /** Effect stat lines (Training/Friendship/… ) at the selected LB; [] if no row. */
  stats: StatLine[];
  server: Server;
  releaseDate?: string;
  releaseDatePredicted?: boolean;
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

export interface BuildPoolItemOpts {
  score?: number;
  wishlist: ReadonlySet<string>;
  lb: LimitBreak;
  /** The euophrys card row at the selected LB, for the effect-stat lines. */
  statsRow?: CardEffectRow;
}

export function buildPoolItem(card: SupportCardRecord, opts: BuildPoolItemOpts): PoolItem {
  const { score, wishlist } = opts;
  const matchedIds = matchedSkillIds(card, wishlist);

  const chain: string[] = [];
  const random: string[] = [];
  const hint: string[] = [];

  for (const s of card.skills) {
    if (s.sourceType === 'chain') {
      chain.push(s.skillId);
    } else if (s.sourceType === 'random_event') {
      random.push(s.skillId);
    } else if (s.sourceType === 'hint_pool') {
      hint.push(s.skillId);
    }
  }

  return {
    cardId: card.cardId,
    name: card.nameEn,
    charName: card.charName,
    rarity: card.rarity,
    type: card.type,
    typeColor: TYPE_COLORS[card.type],
    typeLabel: TYPE_LABEL[card.type],
    score: score ?? null,
    matchCount: matchedIds.length,
    matchedIds,
    chain,
    random,
    hint,
    stats: cardStatLines(opts.statsRow),
    server: card.server,
    releaseDate: card.releaseDate,
    releaseDatePredicted: card.releaseDatePredicted,
  };
}

// ---------------------------------------------------------------------------
// Filter
// ---------------------------------------------------------------------------

export function filterPool(items: PoolItem[], filters: PoolFilters, asOfISO?: string): PoolItem[] {
  const { rarity, type, skill, search, showUpcoming } = filters;
  const lowerSearch = search.toLowerCase();
  const now = asOfISO ?? new Date().toISOString().slice(0, 10);

  // Availability gate: global cards always show; jp cards only when showUpcoming + released by date
  items = items.filter((it) =>
    it.server === 'global' || (showUpcoming && isReleasedBy(it, now)),
  );

  return items.filter((item) => {
    // Rarity filter
    if (rarity !== 'all' && item.rarity !== rarity) return false;
    // Type filter
    if (type !== 'all' && item.type !== type) return false;
    // Skill filter — check if item provides this skill id
    if (skill !== null && !item.matchedIds.includes(skill)) return false;
    // Search filter
    if (lowerSearch !== '' &&
      !item.name.toLowerCase().includes(lowerSearch) &&
      !item.charName.toLowerCase().includes(lowerSearch)) return false;
    return true;
  });
}

// ---------------------------------------------------------------------------
// Sort
// ---------------------------------------------------------------------------

/** Compare two score values (nulls last). */
function cmpScore(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a; // desc
}

export function sortPool(items: PoolItem[], sort: PoolSort): PoolItem[] {
  const copy = items.slice();
  if (sort === 'matches') {
    copy.sort((a, b) => {
      // matchCount desc
      const byMatch = b.matchCount - a.matchCount;
      if (byMatch !== 0) return byMatch;
      // score desc (nulls last)
      const byScore = cmpScore(a.score, b.score);
      if (byScore !== 0) return byScore;
      // name asc
      return a.name.localeCompare(b.name);
    });
  } else {
    // 'effect'
    copy.sort((a, b) => {
      // score desc (nulls last)
      const byScore = cmpScore(a.score, b.score);
      if (byScore !== 0) return byScore;
      // name asc
      return a.name.localeCompare(b.name);
    });
  }
  return copy;
}
