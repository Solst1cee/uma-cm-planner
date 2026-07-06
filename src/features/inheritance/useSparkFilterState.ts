// src/features/inheritance/useSparkFilterState.ts
/** Derived spark-filter glue shared by the parent picker: blue/pink stat-total
 *  state, green (unique, single-legacy) + white (skill, plural-legacy)
 *  search-clause state, and the unified `sparkValue`/`setSpark`/`sparkMaxTotal`/
 *  `legacyLocked`/`membersUsed` API `SparkFilterCards` needs. Extracted
 *  verbatim from `UmaPickerModal.tsx` (2026-07-06) — no behavior change.
 *
 *  `activeGreen`/`activeWhite` are the RAW green/white search clauses
 *  (`{ id, kind, skillId, legacyMin, totalMin }`) — display-name resolution
 *  (via a `skillName` lookup) stays the caller's job, same as before the
 *  extraction. */
import type { Stat } from '@/core/types';
import type { SparkFilter } from './sparkFilter';
import type { SparkCat, SparkVal } from './SparkFilterCards';
import { maxTotalForKey } from './sparkBudget';

/** Green (unique) + white (skill) totals cap at 3★ (one member's spark). */
const SEARCH_TOTAL_CAP = 3;
type BpKind = 'blue' | 'pink';
type SearchF = Extract<SparkFilter, { kind: 'green' | 'white' }>;

let seq = 0;
const newId = () => `f${(seq += 1)}`;

export interface SparkFilterState {
  sparkValue: (cat: SparkCat, key: string) => SparkVal;
  setSpark: (cat: SparkCat, key: string, legacy: number, total: number) => void;
  sparkMaxTotal: (cat: SparkCat, key: string) => number;
  legacyLocked: (cat: SparkCat, key: string) => boolean;
  membersUsed: (cat: SparkCat) => number;
  /** Raw green search clauses — caller resolves display names. */
  activeGreen: SearchF[];
  /** Raw white search clauses — caller resolves display names. */
  activeWhite: SearchF[];
}

export function useSparkFilterState(
  filters: SparkFilter[],
  setFilters: (updater: (xs: SparkFilter[]) => SparkFilter[]) => void,
): SparkFilterState {
  // --- blue/pink spark state, derived from / written to `filters` ---
  const sameTile = (f: SparkFilter, kind: BpKind, key: string) =>
    (kind === 'blue' && f.kind === 'blue' && f.stat === key) ||
    (kind === 'pink' && f.kind === 'pink' && f.aptitude === key);
  const inCategory = (f: SparkFilter, kind: BpKind) =>
    (kind === 'blue' && f.kind === 'blue') || (kind === 'pink' && f.kind === 'pink');

  const bpValue = (kind: BpKind, key: string): SparkVal => {
    const f = filters.find((x) => sameTile(x, kind, key));
    return f && 'legacyMin' in f ? { legacy: f.legacyMin, total: f.totalMin } : { legacy: 0, total: 0 };
  };
  const bpMaxTotal = (kind: BpKind, key: string): number => {
    const totals: Record<string, number> = {};
    for (const f of filters) {
      if (f.kind === 'blue' && kind === 'blue') totals[f.stat] = f.totalMin;
      else if (f.kind === 'pink' && kind === 'pink') totals[f.aptitude] = f.totalMin;
    }
    return maxTotalForKey(totals, key);
  };
  const bpLegacyLocked = (kind: BpKind, key: string): boolean =>
    filters.some((f) => inCategory(f, kind) && 'legacyMin' in f && f.legacyMin > 0 && !sameTile(f, kind, key));

  const setBp = (kind: BpKind, key: string, legacy: number, total: number) => {
    setFilters((xs) => {
      let others = xs.filter((f) => !sameTile(f, kind, key));
      if (legacy > 0) others = others.map((f) => (inCategory(f, kind) && 'legacyMin' in f ? ({ ...f, legacyMin: 0 } as SparkFilter) : f));
      if (legacy === 0 && total === 0) return others;
      const clause: SparkFilter = kind === 'blue'
        ? { id: newId(), kind: 'blue', stat: key as Stat, legacyMin: legacy, totalMin: total }
        : { id: newId(), kind: 'pink', aptitude: key, legacyMin: legacy, totalMin: total };
      return [...others, clause];
    });
  };

  // --- green (unique) + white (skill) search-clause state ---
  // Green mirrors the singular greenSpark slot → single-legacy invariant (setting
  // own-stars on one unique zeroes the others). White sparks are PLURAL
  // (whiteSparks[]), so multiple white clauses may hold legacyMin simultaneously.
  const makeSearchClauseState = (kind: 'green' | 'white', opts: { singleLegacy: boolean }) => {
    const isKind = (f: SparkFilter): f is SearchF => f.kind === kind;
    const clauses = filters.filter(isKind);
    const legacyLocked = (skillId: string): boolean =>
      opts.singleLegacy && clauses.some((c) => c.legacyMin > 0 && c.skillId !== skillId);
    const set = (skillId: string, legacy: number, total: number) => {
      setFilters((xs) => {
        let others = xs.filter((f) => !(isKind(f) && f.skillId === skillId));
        if (opts.singleLegacy && legacy > 0) others = others.map((f) => (isKind(f) ? ({ ...f, legacyMin: 0 } as SparkFilter) : f));
        if (legacy === 0 && total === 0) return others;
        return [...others, { id: newId(), kind, skillId, legacyMin: legacy, totalMin: total }];
      });
    };
    return { clauses, legacyLocked, set };
  };
  const green = makeSearchClauseState('green', { singleLegacy: true });
  const white = makeSearchClauseState('white', { singleLegacy: false });
  const greenClauses = green.clauses;
  const whiteClauses = white.clauses;

  // --- unified spark API for the cards ---
  const searchClause = (cat: 'green' | 'white', key: string) =>
    (cat === 'green' ? greenClauses : whiteClauses).find((c) => c.skillId === key);
  const sparkValue = (cat: SparkCat, key: string): SparkVal => {
    if (cat === 'green' || cat === 'white') { const c = searchClause(cat, key); return { legacy: c?.legacyMin ?? 0, total: c?.totalMin ?? 0 }; }
    return bpValue(cat, key);
  };
  const setSpark = (cat: SparkCat, key: string, legacy: number, total: number) => {
    if (cat === 'green') green.set(key, legacy, total);
    else if (cat === 'white') white.set(key, legacy, total);
    else setBp(cat, key, legacy, total);
  };
  const sparkMaxTotal = (cat: SparkCat, key: string): number =>
    cat === 'green' || cat === 'white' ? SEARCH_TOTAL_CAP : bpMaxTotal(cat, key);
  const legacyLocked = (cat: SparkCat, key: string): boolean =>
    cat === 'green' ? green.legacyLocked(key) : cat === 'white' ? white.legacyLocked(key) : bpLegacyLocked(cat, key);
  const membersUsed = (cat: SparkCat): number => {
    if (cat === 'green') return greenClauses.length;
    if (cat === 'white') return whiteClauses.length;
    let used = 0;
    for (const f of filters) if ((cat === 'blue' && f.kind === 'blue') || (cat === 'pink' && f.kind === 'pink')) used += Math.ceil(f.totalMin / 3);
    return Math.min(3, used);
  };

  return {
    sparkValue,
    setSpark,
    sparkMaxTotal,
    legacyLocked,
    membersUsed,
    activeGreen: greenClauses,
    activeWhite: whiteClauses,
  };
}
