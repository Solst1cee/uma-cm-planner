# M1.4 Uma Picker Modal (spark-filter parent finder) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the inline parent picker with a full-screen modal that filters the imported roster by spark criteria (blue/pink/white legacy+total, any-blue) and shows rich tiles with a computed lineage affinity.

**Architecture:** Pure core first — `sparkAggregate` rolls a veteran + its 2 grandparents into per-stat/apt/skill totals; `sparkFilter` is an AND clause model; `candidateAffinity` reuses the M1.0 affinity core; `useAffinityIndex` lazy-loads `affinity.json`. Then a presentational portal modal (`UmaPickerModal`) owns the filter-builder UI and applies the pure functions. Finally `InheritanceCard` wires Pick/Change → the modal.

**Tech Stack:** TypeScript (strict), React 19, Vitest (jsdom) + Testing Library. Path alias `@/*` → `src/*`. Single test: `pnpm vitest run <path>`.

**Spec:** [docs/superpowers/specs/2026-06-26-m1-4-uma-picker-spark-filter-design.md](../specs/2026-06-26-m1-4-uma-picker-spark-filter-design.md)

## Global Constraints

- **Pure core (P6):** `sparkAggregate`, `sparkFilter`, `candidateAffinity` are pure — no React/Dexie/DOM imports.
- **Spark math:** `legacy` = the veteran's OWN factor stars (max 3); `total` = that factor summed across the veteran + its two grandparents (`Parent.grandparents`, max 9). Each veteran/GP has ONE blue + ONE pink factor; white sparks are arrays.
- **Filter thresholds are all `>=`** (choosing 2 means "2 or higher"); `0` = no constraint. Blue/pink/white are symmetric: `{ legacyMin, totalMin }`. A new white row defaults `totalMin` to 1.
- **`Parent.pinkSpark.aptitude` convention:** `'turf'|'dirt'|'sprint'|'mile'|'medium'|'long'|'front'|'pace'|'late'|'end'`.
- **Affinity = display only**, never a filter. Per tile = candidate-branch lineage affinity + the G1 win bonus (`computeWinBonus(...).parentA`). `null` index ⇒ show "—".
- **Roster pool** = `useRoster().roster` filtered to `source: 'mine'`.
- **Selection persists** to `CmPlan.parents.{a,b}` via `setPlan` (existing `select(slot, id)` helper).
- **Windows case-FS:** component files use a `Modal`/`View` suffix; pure helpers are lower-camel siblings. Never collide case-insensitively.
- **Test races:** trust `pnpm typecheck`; re-run a flaky UI file once (do not run with `pnpm dev` active). Multi-render test files need `afterEach(cleanup)`.
- **Commit footer:** end every commit message with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

## File Structure

- `src/features/inheritance/sparkAggregate.ts` — `aggregate(veteran)` → `SparkAgg` (Task 1)
- `src/features/inheritance/sparkFilter.ts` — `SparkFilter`, `clauseMatches`, `matchesFilters` (Task 2)
- `src/features/inheritance/candidateAffinity.ts` — `candidateAffinity(args)` (Task 3)
- `src/features/inheritance/useAffinityIndex.ts` — lazy affinity-index loader hook (Task 4)
- `src/features/inheritance/UmaPickerModal.tsx` — portal modal + filter builder + tiles (Task 5)
- `src/features/inheritance/inheritance.css` — modal styles appended (Task 5)
- `src/features/inheritance/InheritanceCard.tsx` — wire Pick/Change → modal (Task 6)

---

### Task 1: Spark aggregate (`sparkAggregate.ts`)

**Files:**
- Create: `src/features/inheritance/sparkAggregate.ts`
- Test: `src/features/inheritance/sparkAggregate.test.ts`

**Interfaces:**
- Consumes: `Parent`, `Stat` from `@/core/types`.
- Produces:
  - `interface SparkAgg { blueTotals: Partial<Record<Stat, number>>; blueLegacy: { stat: Stat; stars: number }; maxBlueTotal: number; pinkTotals: Record<string, number>; pinkLegacy: { aptitude: string; stars: number }; whites: Map<string, { total: number; legacy: number }> }`
  - `aggregate(veteran: Parent): SparkAgg`

- [ ] **Step 1: Write the failing test**

```ts
// src/features/inheritance/sparkAggregate.test.ts
import { describe, expect, it } from 'vitest';
import type { Parent } from '@/core/types';
import { aggregate } from './sparkAggregate';

const veteran: Parent = {
  id: 'v', umaId: '101501', source: 'mine',
  blueSpark: { stat: 'pow', stars: 3 },
  pinkSpark: { aptitude: 'medium', stars: 3 },
  whiteSparks: [{ skillId: '200361', stars: 2 }],
  grandparents: [
    { umaId: '100701', blueSpark: { stat: 'pow', stars: 3 }, pinkSpark: { aptitude: 'medium', stars: 2 }, whiteSparks: [{ skillId: '200361', stars: 1 }] },
    { umaId: '100601', blueSpark: { stat: 'pow', stars: 2 }, pinkSpark: { aptitude: 'long', stars: 1 }, whiteSparks: [{ skillId: '200999', stars: 1 }] },
  ],
};

describe('aggregate', () => {
  it('sums blue across veteran + 2 grandparents and keeps legacy', () => {
    const a = aggregate(veteran);
    expect(a.blueTotals).toEqual({ pow: 8 }); // 3 + 3 + 2
    expect(a.blueLegacy).toEqual({ stat: 'pow', stars: 3 });
    expect(a.maxBlueTotal).toBe(8);
  });

  it('sums pink per aptitude across the lineage', () => {
    const a = aggregate(veteran);
    expect(a.pinkTotals).toEqual({ medium: 5, long: 1 }); // medium 3+2, long 1
    expect(a.pinkLegacy).toEqual({ aptitude: 'medium', stars: 3 });
  });

  it('sums white sparks per skill with legacy = veteran-own only', () => {
    const a = aggregate(veteran);
    expect(a.whites.get('200361')).toEqual({ total: 3, legacy: 2 }); // 2(own) + 1(gp)
    expect(a.whites.get('200999')).toEqual({ total: 1, legacy: 0 }); // gp-only
  });

  it('handles a veteran with no grandparents', () => {
    const a = aggregate({ ...veteran, grandparents: undefined });
    expect(a.blueTotals).toEqual({ pow: 3 });
    expect(a.whites.get('200361')).toEqual({ total: 2, legacy: 2 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/inheritance/sparkAggregate.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/features/inheritance/sparkAggregate.ts
/**
 * Roll a roster veteran + its two grandparents into the spark totals the parent
 * picker filters on. legacy = the veteran's OWN factor; total = summed across
 * the veteran + both grandparents (the combined factor stars the game shows).
 */
import type { Parent, ParentRef, Stat } from '@/core/types';

export interface SparkAgg {
  blueTotals: Partial<Record<Stat, number>>;
  blueLegacy: { stat: Stat; stars: number };
  maxBlueTotal: number;
  pinkTotals: Record<string, number>;
  pinkLegacy: { aptitude: string; stars: number };
  whites: Map<string, { total: number; legacy: number }>;
}

export function aggregate(veteran: Parent): SparkAgg {
  const members: Array<Parent | ParentRef> = [veteran, ...(veteran.grandparents ?? []).filter((g): g is ParentRef => !!g)];

  const blueTotals: Partial<Record<Stat, number>> = {};
  const pinkTotals: Record<string, number> = {};
  const whites = new Map<string, { total: number; legacy: number }>();

  for (const m of members) {
    if (m.blueSpark) blueTotals[m.blueSpark.stat] = (blueTotals[m.blueSpark.stat] ?? 0) + m.blueSpark.stars;
    if (m.pinkSpark) pinkTotals[m.pinkSpark.aptitude] = (pinkTotals[m.pinkSpark.aptitude] ?? 0) + m.pinkSpark.stars;
    for (const w of m.whiteSparks ?? []) {
      const prev = whites.get(w.skillId) ?? { total: 0, legacy: 0 };
      whites.set(w.skillId, { total: prev.total + w.stars, legacy: prev.legacy });
    }
  }
  // legacy = the veteran's own sparks only
  for (const w of veteran.whiteSparks ?? []) {
    const prev = whites.get(w.skillId) ?? { total: 0, legacy: 0 };
    whites.set(w.skillId, { total: prev.total, legacy: prev.legacy + w.stars });
  }

  const maxBlueTotal = Math.max(0, ...Object.values(blueTotals));
  return {
    blueTotals,
    blueLegacy: { stat: veteran.blueSpark.stat, stars: veteran.blueSpark.stars },
    maxBlueTotal,
    pinkTotals,
    pinkLegacy: { aptitude: veteran.pinkSpark.aptitude, stars: veteran.pinkSpark.stars },
    whites,
  };
}
```

> Note: `Parent.whiteSparks` is required (array), `ParentRef.whiteSparks` is optional — the `?? []` covers the ref case. `Parent.blueSpark`/`pinkSpark` are required; `ParentRef.blueSpark`/`pinkSpark` optional (the `if (m.blueSpark)` guard covers both).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/features/inheritance/sparkAggregate.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/inheritance/sparkAggregate.ts src/features/inheritance/sparkAggregate.test.ts
git commit -m "feat(m1): spark aggregate (veteran + grandparents totals) for the picker (M1.4)"
```

---

### Task 2: Spark filter (`sparkFilter.ts`)

**Files:**
- Create: `src/features/inheritance/sparkFilter.ts`
- Test: `src/features/inheritance/sparkFilter.test.ts`

**Interfaces:**
- Consumes: `SparkAgg` from `./sparkAggregate` (Task 1); `Stat` from `@/core/types`.
- Produces:
  - `type SparkFilter = { id: string; kind: 'blue'; stat: Stat; legacyMin: number; totalMin: number } | { id: string; kind: 'pink'; aptitude: string; legacyMin: number; totalMin: number } | { id: string; kind: 'white'; skillId: string; legacyMin: number; totalMin: number } | { id: string; kind: 'anyBlue'; totalMin: number }`
  - `clauseMatches(agg: SparkAgg, f: SparkFilter): boolean`
  - `matchesFilters(agg: SparkAgg, filters: SparkFilter[]): boolean`

- [ ] **Step 1: Write the failing test**

```ts
// src/features/inheritance/sparkFilter.test.ts
import { describe, expect, it } from 'vitest';
import type { SparkAgg } from './sparkAggregate';
import { clauseMatches, matchesFilters, type SparkFilter } from './sparkFilter';

// veteran: pow legacy 3 / total 8; medium legacy 3 / total 6; whites groundwork(total3,legacy2), corner(total1,legacy0)
const agg: SparkAgg = {
  blueTotals: { pow: 8, spd: 2 }, blueLegacy: { stat: 'pow', stars: 3 }, maxBlueTotal: 8,
  pinkTotals: { medium: 6 }, pinkLegacy: { aptitude: 'medium', stars: 3 },
  whites: new Map([['groundwork', { total: 3, legacy: 2 }], ['corner', { total: 1, legacy: 0 }]]),
};
const f = (x: Partial<SparkFilter> & Pick<SparkFilter, 'kind'>): SparkFilter => ({ id: 'x', legacyMin: 0, totalMin: 0, ...(x as object) } as SparkFilter);

describe('clauseMatches', () => {
  it('blue: legacy + total both >=', () => {
    expect(clauseMatches(agg, f({ kind: 'blue', stat: 'pow', legacyMin: 3, totalMin: 8 } as SparkFilter))).toBe(true);
    expect(clauseMatches(agg, f({ kind: 'blue', stat: 'pow', legacyMin: 3, totalMin: 9 } as SparkFilter))).toBe(false); // total only 8
    expect(clauseMatches(agg, f({ kind: 'blue', stat: 'spd', legacyMin: 1, totalMin: 1 } as SparkFilter))).toBe(false); // spd not legacy
  });
  it('pink: legacy + total', () => {
    expect(clauseMatches(agg, f({ kind: 'pink', aptitude: 'medium', legacyMin: 3, totalMin: 6 } as SparkFilter))).toBe(true);
    expect(clauseMatches(agg, f({ kind: 'pink', aptitude: 'long', legacyMin: 0, totalMin: 1 } as SparkFilter))).toBe(false);
  });
  it('white: legacy + total', () => {
    expect(clauseMatches(agg, f({ kind: 'white', skillId: 'groundwork', legacyMin: 2, totalMin: 3 } as SparkFilter))).toBe(true);
    expect(clauseMatches(agg, f({ kind: 'white', skillId: 'corner', legacyMin: 0, totalMin: 1 } as SparkFilter))).toBe(true);
    expect(clauseMatches(agg, f({ kind: 'white', skillId: 'corner', legacyMin: 1, totalMin: 1 } as SparkFilter))).toBe(false); // legacy 0
    expect(clauseMatches(agg, f({ kind: 'white', skillId: 'absent', legacyMin: 0, totalMin: 1 } as SparkFilter))).toBe(false);
  });
  it('anyBlue: max stat total >=', () => {
    expect(clauseMatches(agg, { id: 'x', kind: 'anyBlue', totalMin: 8 })).toBe(true);
    expect(clauseMatches(agg, { id: 'x', kind: 'anyBlue', totalMin: 9 })).toBe(false);
  });
});

describe('matchesFilters', () => {
  it('empty filters pass all', () => { expect(matchesFilters(agg, [])).toBe(true); });
  it('example 1: pow legacy3 total8', () => {
    expect(matchesFilters(agg, [{ id: '1', kind: 'blue', stat: 'pow', legacyMin: 3, totalMin: 8 }])).toBe(true);
  });
  it('example 2: groundwork + corner + anyBlue>=8', () => {
    expect(matchesFilters(agg, [
      { id: '1', kind: 'white', skillId: 'groundwork', legacyMin: 0, totalMin: 1 },
      { id: '2', kind: 'white', skillId: 'corner', legacyMin: 0, totalMin: 1 },
      { id: '3', kind: 'anyBlue', totalMin: 8 },
    ])).toBe(true);
  });
  it('example 3: medium legacy3 total6 + anyBlue>=8', () => {
    expect(matchesFilters(agg, [
      { id: '1', kind: 'pink', aptitude: 'medium', legacyMin: 3, totalMin: 6 },
      { id: '2', kind: 'anyBlue', totalMin: 8 },
    ])).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/inheritance/sparkFilter.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/features/inheritance/sparkFilter.ts
/**
 * AND-clause spark filter over a SparkAgg. Every threshold is a `>=` (choosing
 * 2 means "2 or higher"); 0 = no constraint. legacy = veteran's own; total =
 * summed across the lineage. blue/pink/white are symmetric.
 */
import type { Stat } from '@/core/types';
import type { SparkAgg } from './sparkAggregate';

export type SparkFilter =
  | { id: string; kind: 'blue'; stat: Stat; legacyMin: number; totalMin: number }
  | { id: string; kind: 'pink'; aptitude: string; legacyMin: number; totalMin: number }
  | { id: string; kind: 'white'; skillId: string; legacyMin: number; totalMin: number }
  | { id: string; kind: 'anyBlue'; totalMin: number };

export function clauseMatches(agg: SparkAgg, f: SparkFilter): boolean {
  switch (f.kind) {
    case 'blue': {
      const total = agg.blueTotals[f.stat] ?? 0;
      const legacy = agg.blueLegacy.stat === f.stat ? agg.blueLegacy.stars : 0;
      return total >= f.totalMin && legacy >= f.legacyMin;
    }
    case 'pink': {
      const total = agg.pinkTotals[f.aptitude] ?? 0;
      const legacy = agg.pinkLegacy.aptitude === f.aptitude ? agg.pinkLegacy.stars : 0;
      return total >= f.totalMin && legacy >= f.legacyMin;
    }
    case 'white': {
      const w = agg.whites.get(f.skillId);
      return (w?.total ?? 0) >= f.totalMin && (w?.legacy ?? 0) >= f.legacyMin;
    }
    case 'anyBlue':
      return agg.maxBlueTotal >= f.totalMin;
  }
}

export function matchesFilters(agg: SparkAgg, filters: SparkFilter[]): boolean {
  return filters.every((f) => clauseMatches(agg, f));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/features/inheritance/sparkFilter.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/inheritance/sparkFilter.ts src/features/inheritance/sparkFilter.test.ts
git commit -m "feat(m1): AND spark-filter clause model (blue/pink/white/anyBlue) (M1.4)"
```

---

### Task 3: Candidate affinity (`candidateAffinity.ts`)

**Files:**
- Create: `src/features/inheritance/candidateAffinity.ts`
- Test: `src/features/inheritance/candidateAffinity.test.ts`

**Interfaces:**
- Consumes: `aff2`, `aff3`, `charaIdOf`, `AffinityIndex`, `buildAffinityIndex` from `@/core/affinity`; `computeWinBonus` from `@/core/winBonus`; `Parent` from `@/core/types`.
- Produces: `candidateAffinity(args: { idx: AffinityIndex; traineeUmaId: string; candidate: Parent; other?: Parent }): number`

**Context — charaId math:** `charaIdOf(umaId)` = `floor(Number(umaId)/100)`, so umaIds in the same group must be chosen so `aff2`/`aff3` produce non-zero. Use `buildAffinityIndex` with synthetic groups whose `members` are the candidate/trainee charaIds.

- [ ] **Step 1: Write the failing test**

```ts
// src/features/inheritance/candidateAffinity.test.ts
import { describe, expect, it } from 'vitest';
import { buildAffinityIndex } from '@/core/affinity';
import type { Parent } from '@/core/types';
import { candidateAffinity } from './candidateAffinity';

// charaIds: trainee 1000, candidate 1007, gp 1006, other 1008
// group with point 5 shared by trainee+candidate → aff2(T,A) = 5
const idx = buildAffinityIndex([
  { relationType: 101, point: 5, members: [1000, 1007] },
  { relationType: 102, point: 3, members: [1007, 1008] }, // candidate+other → cross term 3
]);
const mk = (umaId: string, over: Partial<Parent> = {}): Parent => ({
  id: umaId, umaId, source: 'mine', blueSpark: { stat: 'spd', stars: 1 }, pinkSpark: { aptitude: 'turf', stars: 1 }, whiteSparks: [], ...over,
});

describe('candidateAffinity', () => {
  it('sums trainee↔candidate aff2 (no other slot)', () => {
    // umaId 100700 → charaId 1007 (candidate); trainee 100000 → 1000
    expect(candidateAffinity({ idx, traineeUmaId: '100000', candidate: mk('100700') })).toBe(5);
  });

  it('adds the cross term when the other slot is set', () => {
    // other umaId 100800 → 1008; aff2(1007,1008) = 3 → 5 + 3
    expect(candidateAffinity({ idx, traineeUmaId: '100000', candidate: mk('100700'), other: mk('100800') })).toBe(8);
  });

  it('adds the G1 win bonus from shared wins', () => {
    // candidate + other both won G1 race "7001" → +3 to parentA
    const cand = mk('100700', { wonRaces: ['7001'] });
    const other = mk('100800', { wonRaces: ['7001'] });
    expect(candidateAffinity({ idx, traineeUmaId: '100000', candidate: cand, other })).toBe(8 + 3);
  });

  it('returns 0 for unknown charas without crashing', () => {
    expect(candidateAffinity({ idx, traineeUmaId: '999900', candidate: mk('888800') })).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/inheritance/candidateAffinity.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/features/inheritance/candidateAffinity.ts
/**
 * Display-only affinity for one candidate veteran in the picker — the
 * candidate-branch lineage affinity (trainee↔candidate + grandparent triples,
 * plus the cross term to the other chosen slot when set) + the G1 win bonus
 * (computeWinBonus parentA). Pair-independent when `other` is absent.
 */
import { aff2, aff3, charaIdOf, type AffinityIndex } from '@/core/affinity';
import { computeWinBonus } from '@/core/winBonus';
import type { Parent } from '@/core/types';

export function candidateAffinity(args: {
  idx: AffinityIndex;
  traineeUmaId: string;
  candidate: Parent;
  other?: Parent;
}): number {
  const { idx, traineeUmaId, candidate, other } = args;
  const T = charaIdOf(traineeUmaId);
  const A = charaIdOf(candidate.umaId);
  const gps = candidate.grandparents ?? [];
  const gA1 = gps[0] ? charaIdOf(gps[0].umaId) : undefined;
  const gA2 = gps[1] ? charaIdOf(gps[1].umaId) : undefined;

  let base = aff2(idx, T, A);
  if (gA1 !== undefined) base += aff3(idx, T, A, gA1);
  if (gA2 !== undefined) base += aff3(idx, T, A, gA2);
  if (other) base += aff2(idx, A, charaIdOf(other.umaId));

  const oGps = other?.grandparents ?? [];
  const win = computeWinBonus({
    parentA: { wonRaces: candidate.wonRaces },
    parentB: { wonRaces: other?.wonRaces },
    gA1: { wonRaces: gps[0]?.wonRaces },
    gA2: { wonRaces: gps[1]?.wonRaces },
    gB1: { wonRaces: oGps[0]?.wonRaces },
    gB2: { wonRaces: oGps[1]?.wonRaces },
  }).parentA;

  return base + win;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/features/inheritance/candidateAffinity.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/inheritance/candidateAffinity.ts src/features/inheritance/candidateAffinity.test.ts
git commit -m "feat(m1): candidate-branch affinity + G1 win bonus for picker tiles (M1.4)"
```

---

### Task 4: Affinity-index loader hook (`useAffinityIndex.ts`)

**Files:**
- Create: `src/features/inheritance/useAffinityIndex.ts`
- Test: `src/features/inheritance/useAffinityIndex.test.ts`

**Interfaces:**
- Consumes: `buildAffinityIndex`, `AffinityIndex` from `@/core/affinity`; `AffinityGroup` from `@/core/types`.
- Produces: `useAffinityIndex(): AffinityIndex | null`

**Context:** `affinity.json` shape is `{ server, dataVersion, groups: AffinityGroup[] }` where `AffinityGroup = { relationType: number; point: number; members: number[] }`. Fetch from `${import.meta.env.BASE_URL}data/affinity.json` (same base as `gameData.ts`). Memoise the built index at module scope so repeated mounts don't re-fetch.

- [ ] **Step 1: Write the failing test**

```ts
// src/features/inheritance/useAffinityIndex.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { aff2 } from '@/core/affinity';
import { useAffinityIndex } from './useAffinityIndex';

afterEach(cleanup);

function Probe() {
  const idx = useAffinityIndex();
  return <div data-testid="aff">{idx ? `score:${aff2(idx, 1000, 1007)}` : 'loading'}</div>;
}

describe('useAffinityIndex', () => {
  it('loads affinity.json and builds a working index', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ server: 'global', dataVersion: 'x', groups: [{ relationType: 101, point: 5, members: [1000, 1007] }] }),
    })) as unknown as typeof fetch);
    render(<Probe />);
    await waitFor(() => expect(screen.getByTestId('aff')).toHaveTextContent('score:5'));
    vi.unstubAllGlobals();
  });
});
```

> The test needs `@testing-library/jest-dom/vitest` for `toHaveTextContent` — add that import at the top (`import '@testing-library/jest-dom/vitest';`), matching sibling test files.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/inheritance/useAffinityIndex.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/features/inheritance/useAffinityIndex.ts
/** Lazy-load public/data/affinity.json → AffinityIndex (memoised at module
 *  scope). null while loading or on failure (tiles then show affinity as "—"). */
import { useEffect, useState } from 'react';
import { buildAffinityIndex, type AffinityIndex } from '@/core/affinity';
import type { AffinityGroup } from '@/core/types';

let cached: AffinityIndex | null = null;
let inflight: Promise<AffinityIndex | null> | null = null;

function load(): Promise<AffinityIndex | null> {
  if (cached) return Promise.resolve(cached);
  if (inflight) return inflight;
  inflight = fetch(`${import.meta.env.BASE_URL}data/affinity.json`)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((j: { groups: AffinityGroup[] }) => {
      cached = buildAffinityIndex(j.groups);
      return cached;
    })
    .catch(() => null);
  return inflight;
}

export function useAffinityIndex(): AffinityIndex | null {
  const [idx, setIdx] = useState<AffinityIndex | null>(cached);
  useEffect(() => {
    if (idx) return;
    let cancelled = false;
    void load().then((built) => { if (!cancelled) setIdx(built); });
    return () => { cancelled = true; };
  }, [idx]);
  return idx;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/features/inheritance/useAffinityIndex.test.ts`
Expected: PASS. (If module-scope `cached` leaks across tests in the file later, it only ever helps — the single test is unaffected.)

- [ ] **Step 5: Commit**

```bash
git add src/features/inheritance/useAffinityIndex.ts src/features/inheritance/useAffinityIndex.test.ts
git commit -m "feat(m1): lazy affinity.json loader hook (M1.4)"
```

---

### Task 5: Picker modal (`UmaPickerModal.tsx`) + styles

**Files:**
- Create: `src/features/inheritance/UmaPickerModal.tsx`
- Modify: `src/features/inheritance/inheritance.css` (append modal styles)
- Test: `src/features/inheritance/UmaPickerModal.test.tsx`

**Interfaces:**
- Consumes: `SparkAgg` (Task 1); `SparkFilter`, `matchesFilters` (Task 2).
- Produces:
  - `interface UmaPickerItem { id: string; name: string; rating?: string; portrait: ReactNode; agg: SparkAgg; affinity: number | null }`
  - `interface UmaPickerModalProps { open: boolean; items: UmaPickerItem[]; skillName: (id: string) => string; whiteSkillOptions: Array<{ id: string; name: string }>; onPick: (id: string) => void; onClose: () => void }`
  - `UmaPickerModal(props): JSX.Element | null`

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/inheritance/UmaPickerModal.test.tsx
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { SparkAgg } from './sparkAggregate';
import { UmaPickerModal, type UmaPickerItem } from './UmaPickerModal';

const agg = (over: Partial<SparkAgg>): SparkAgg => ({
  blueTotals: {}, blueLegacy: { stat: 'spd', stars: 0 }, maxBlueTotal: 0,
  pinkTotals: {}, pinkLegacy: { aptitude: 'turf', stars: 0 }, whites: new Map(), ...over,
});
const items: UmaPickerItem[] = [
  { id: 'a', name: 'Alpha', portrait: null, affinity: 50, agg: agg({ blueTotals: { pow: 8 }, blueLegacy: { stat: 'pow', stars: 3 }, maxBlueTotal: 8 }) },
  { id: 'b', name: 'Beta', portrait: null, affinity: 10, agg: agg({ blueTotals: { spd: 2 }, blueLegacy: { stat: 'spd', stars: 2 }, maxBlueTotal: 2 }) },
];
const base = { items, skillName: (id: string) => id, whiteSkillOptions: [], onPick: vi.fn(), onClose: vi.fn() };

afterEach(cleanup);

describe('UmaPickerModal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<UmaPickerModal {...base} open={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('lists all items when open, sorted by affinity desc', () => {
    render(<UmaPickerModal {...base} open />);
    const tiles = screen.getAllByRole('button', { name: /Alpha|Beta/ });
    expect(tiles[0]).toHaveTextContent('Alpha'); // 50 before 10
    expect(screen.getByText(/2 match/)).toBeInTheDocument();
  });

  it('adding an any-blue >=8 filter narrows to matching tiles', () => {
    render(<UmaPickerModal {...base} open />);
    fireEvent.click(screen.getByRole('button', { name: /add filter/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /any blue/i }));
    const input = screen.getByLabelText(/any-blue total/i);
    fireEvent.change(input, { target: { value: '8' } });
    expect(screen.getByRole('button', { name: /Alpha/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Beta/ })).not.toBeInTheDocument();
    expect(screen.getByText(/1 match/)).toBeInTheDocument();
  });

  it('clicking a tile calls onPick', () => {
    const onPick = vi.fn();
    render(<UmaPickerModal {...base} open onPick={onPick} />);
    fireEvent.click(screen.getByRole('button', { name: /Alpha/ }));
    expect(onPick).toHaveBeenCalledWith('a');
  });

  it('Escape and backdrop click call onClose; window click does not', () => {
    const onClose = vi.fn();
    render(<UmaPickerModal {...base} open onClose={onClose} />);
    fireEvent.click(within(screen.getByRole('dialog')).getByText('Pick a parent')); // inside window
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('uma-modal-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/inheritance/UmaPickerModal.test.tsx`
Expected: FAIL — module missing.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/features/inheritance/UmaPickerModal.tsx
/** Full-screen parent picker: a spark-filter builder over the imported roster
 *  with rich tiles (sparks + affinity). Presentational + portal; the container
 *  passes already-aggregated items. */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { Stat } from '@/core/types';
import { STAT_LABEL, aptitudeLabel, APTITUDE_OPTIONS, STAT_OPTIONS, starsGlyph } from '@/features/parents/sparkMeta';
import type { SparkAgg } from './sparkAggregate';
import { matchesFilters, type SparkFilter } from './sparkFilter';

export interface UmaPickerItem {
  id: string;
  name: string;
  rating?: string;
  portrait: ReactNode;
  agg: SparkAgg;
  affinity: number | null;
}
export interface UmaPickerModalProps {
  open: boolean;
  items: UmaPickerItem[];
  skillName: (id: string) => string;
  whiteSkillOptions: Array<{ id: string; name: string }>;
  onPick: (id: string) => void;
  onClose: () => void;
}

let seq = 0;
const newId = () => `f${(seq += 1)}`;

export function UmaPickerModal({ open, items, skillName, whiteSkillOptions, onPick, onClose }: UmaPickerModalProps) {
  const [filters, setFilters] = useState<SparkFilter[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const shown = useMemo(
    () =>
      items
        .filter((it) => matchesFilters(it.agg, filters))
        .sort((a, b) => (b.affinity ?? -1) - (a.affinity ?? -1) || a.name.localeCompare(b.name)),
    [items, filters],
  );

  if (!open) return null;

  const add = (f: SparkFilter) => { setFilters((xs) => [...xs, f]); setMenuOpen(false); };
  const update = (id: string, patch: Partial<SparkFilter>) =>
    setFilters((xs) => xs.map((f) => (f.id === id ? ({ ...f, ...patch } as SparkFilter) : f)));
  const remove = (id: string) => setFilters((xs) => xs.filter((f) => f.id !== id));

  const numIn = (val: number, on: (n: number) => void, label: string, max: number) => (
    <label className="inh-uma-min">
      <span className="muted small">{label}</span>
      <input type="number" min={0} max={max} value={val} aria-label={label}
        onChange={(e) => on(Math.max(0, Math.min(max, Number(e.target.value) || 0)))} />
    </label>
  );

  const filterRow = (f: SparkFilter) => (
    <div key={f.id} className="inh-uma-filter-row">
      {f.kind === 'blue' && (
        <>
          <span className="badge spark-blue">Blue</span>
          <select aria-label="stat" value={f.stat} onChange={(e) => update(f.id, { stat: e.target.value as Stat })}>
            {STAT_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
          {numIn(f.legacyMin, (n) => update(f.id, { legacyMin: n }), 'legacy ≥', 3)}
          {numIn(f.totalMin, (n) => update(f.id, { totalMin: n }), 'total ≥', 9)}
        </>
      )}
      {f.kind === 'pink' && (
        <>
          <span className="badge spark-pink">Pink</span>
          <select aria-label="aptitude" value={f.aptitude} onChange={(e) => update(f.id, { aptitude: e.target.value })}>
            {APTITUDE_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
          {numIn(f.legacyMin, (n) => update(f.id, { legacyMin: n }), 'legacy ≥', 3)}
          {numIn(f.totalMin, (n) => update(f.id, { totalMin: n }), 'total ≥', 9)}
        </>
      )}
      {f.kind === 'white' && (
        <>
          <span className="badge">White</span>
          <select aria-label="skill" value={f.skillId} onChange={(e) => update(f.id, { skillId: e.target.value })}>
            {whiteSkillOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          {numIn(f.legacyMin, (n) => update(f.id, { legacyMin: n }), 'legacy ≥', 3)}
          {numIn(f.totalMin, (n) => update(f.id, { totalMin: n }), 'total ≥', 9)}
        </>
      )}
      {f.kind === 'anyBlue' && (
        <>
          <span className="badge spark-blue">Any blue</span>
          {numIn(f.totalMin, (n) => update(f.id, { totalMin: n }), 'any-blue total ≥', 9)}
        </>
      )}
      <button type="button" className="cmp-small-btn inh-uma-filter-x" aria-label="Remove filter" onClick={() => remove(f.id)}>✕</button>
    </div>
  );

  const body = (
    <div className="inh-uma-modal-backdrop" data-testid="uma-modal-backdrop" onClick={onClose}>
      <div className="cmp-plan-card inh-uma-modal" role="dialog" aria-modal="true" aria-label="Pick a parent"
        onClick={(e) => e.stopPropagation()}>
        <header className="cmp-plan-card-head inh-uma-modal-head">
          <span>Pick a parent</span>
          <span className="muted small">{shown.length} match</span>
          <button type="button" className="cmp-small-btn inh-uma-modal-x" aria-label="Close" onClick={onClose}>✕</button>
        </header>
        <div className="inh-uma-filterbar">
          <div className="inh-uma-add">
            <button type="button" className="cmp-small-btn" aria-haspopup="menu" onClick={() => setMenuOpen((o) => !o)}>+ Add filter</button>
            {menuOpen && (
              <div className="inh-uma-add-menu" role="menu">
                <button type="button" role="menuitem" onClick={() => add({ id: newId(), kind: 'blue', stat: 'spd', legacyMin: 0, totalMin: 0 })}>Blue (stat)</button>
                <button type="button" role="menuitem" onClick={() => add({ id: newId(), kind: 'pink', aptitude: 'turf', legacyMin: 0, totalMin: 0 })}>Pink (aptitude)</button>
                <button type="button" role="menuitem" onClick={() => add({ id: newId(), kind: 'white', skillId: whiteSkillOptions[0]?.id ?? '', legacyMin: 0, totalMin: 1 })}>White skill</button>
                <button type="button" role="menuitem" onClick={() => add({ id: newId(), kind: 'anyBlue', totalMin: 0 })}>Any blue</button>
              </div>
            )}
          </div>
          {filters.map(filterRow)}
        </div>
        <div className="cmp-plan-card-body inh-uma-grid">
          {shown.length === 0 && <p className="muted small">No veterans match.</p>}
          {shown.map((it) => (
            <button key={it.id} type="button" className="inh-uma-tile" onClick={() => onPick(it.id)}>
              <span className="inh-uma-tile-top">
                <span className="inh-uma-tile-portrait">{it.portrait}</span>
                <span className="inh-uma-tile-id">
                  <span className="inh-uma-tile-name">{it.name}</span>
                  {it.rating && <span className="muted small">{it.rating}</span>}
                </span>
                <span className="inh-uma-aff" title="Affinity (incl. G1 win bonus)">{it.affinity ?? '—'}</span>
              </span>
              <span className="spark-chips inh-uma-tile-sparks">
                <span className="badge spark-blue">{STAT_LABEL[it.agg.blueLegacy.stat]} {it.agg.maxBlueTotal}★</span>
                <span className="badge spark-pink">{aptitudeLabel(it.agg.pinkLegacy.aptitude)} {starsGlyph(it.agg.pinkLegacy.stars)}</span>
                {[...it.agg.whites.keys()].slice(0, 3).map((sid) => (
                  <span key={sid} className="badge inh-uma-white-chip">{skillName(sid)}</span>
                ))}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
  return createPortal(body, document.body);
}
```

> `STAT_OPTIONS`/`APTITUDE_OPTIONS`/`STAT_LABEL`/`aptitudeLabel`/`starsGlyph` already exist in `@/features/parents/sparkMeta` (verified). If `STAT_OPTIONS` is not exported there, export it (it is defined in that file).

Append to `src/features/inheritance/inheritance.css`:

```css
/* Uma picker modal (M1.4) */
.inh-uma-modal-backdrop {
  position: fixed; inset: 0; z-index: 60;
  background: rgba(0, 0, 0, 0.55);
  display: flex; align-items: center; justify-content: center;
  padding: 1rem;
}
.inh-uma-modal {
  width: min(820px, 94vw); max-height: 85vh;
  display: flex; flex-direction: column; overflow: hidden;
}
.inh-uma-modal-head { gap: 0.5rem; }
.inh-uma-modal-x, .inh-uma-modal-head .muted { margin-left: auto; }
.inh-uma-modal-x { margin-left: 0.4rem; }
.inh-uma-filterbar {
  display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center;
  padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--border); background: var(--bg-2);
}
.inh-uma-add { position: relative; }
.inh-uma-add-menu {
  position: absolute; top: calc(100% + 0.25rem); left: 0; z-index: 2;
  display: flex; flex-direction: column; min-width: 9rem;
  border: 1px solid var(--border); border-radius: 8px; background: var(--bg-1);
  box-shadow: 0 8px 24px rgb(20 30 50 / 0.18); overflow: hidden;
}
.inh-uma-add-menu button { text-align: left; padding: 0.4rem 0.6rem; background: none; border: none; cursor: pointer; }
.inh-uma-add-menu button:hover { background: var(--bg-2); }
.inh-uma-filter-row {
  display: inline-flex; align-items: center; gap: 0.35rem;
  border: 1px solid var(--border); border-radius: 8px; padding: 0.25rem 0.4rem; background: var(--bg-1);
}
.inh-uma-min { display: inline-flex; align-items: center; gap: 0.2rem; }
.inh-uma-min input { width: 2.8rem; }
.inh-uma-filter-x { color: var(--error); }
.inh-uma-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 0.5rem; overflow-y: auto;
}
.inh-uma-tile {
  display: flex; flex-direction: column; gap: 0.35rem; text-align: left;
  border: 1px solid var(--border); border-radius: 9px; background: var(--bg-1);
  padding: 0.5rem; cursor: pointer;
}
.inh-uma-tile:hover { border-color: var(--accent); background: var(--bg-2); }
.inh-uma-tile-top { display: flex; align-items: center; gap: 0.45rem; }
.inh-uma-tile-id { display: flex; flex-direction: column; min-width: 0; }
.inh-uma-tile-name { font-weight: 700; overflow: hidden; text-overflow: ellipsis; }
.inh-uma-aff {
  margin-left: auto; flex: none; font-weight: 800; color: var(--accent);
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  border-radius: 999px; padding: 0.05rem 0.5rem;
}
.inh-uma-white-chip { background: var(--bg-2); }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/features/inheritance/UmaPickerModal.test.tsx`
Expected: PASS (5 tests). Then `pnpm typecheck` — fix any type slips.

- [ ] **Step 5: Commit**

```bash
git add src/features/inheritance/UmaPickerModal.tsx src/features/inheritance/UmaPickerModal.test.tsx src/features/inheritance/inheritance.css
git commit -m "feat(m1): Uma picker modal — spark-filter builder + affinity tiles (M1.4)"
```

---

### Task 6: Wire the modal into `InheritanceCard`

**Files:**
- Modify: `src/features/inheritance/InheritanceCard.tsx`
- Test: `src/features/inheritance/InheritanceCard.test.tsx` (extend)

**Interfaces:**
- Consumes: `UmaPickerModal`, `UmaPickerItem` (Task 5); `aggregate` (Task 1); `candidateAffinity` (Task 3); `useAffinityIndex` (Task 4); `useGameData` from `@/features/data/gameData`.

**Behavior:** `mode[slot]==='change'` → open `UmaPickerModal` (instead of inline `SearchPicker`). Build items from `pool` with `aggregate` + `candidateAffinity` (`other` = the opposite slot's parent). White options + skill names from `useGameData`.

- [ ] **Step 1: Write the failing test** (extend `InheritanceCard.test.tsx`)

Add to the existing mocks block at the top (after the existing `vi.mock` calls):

```tsx
vi.mock('./useAffinityIndex', () => ({ useAffinityIndex: () => null }));
vi.mock('@/features/data/gameData', () => ({ useGameData: () => ({ skills: [], skillById: new Map() }) }));
```

Add this test inside the `describe('InheritanceCard', …)` block:

```tsx
it('opens the picker modal on Change and persists the pick', () => {
  render(<InheritanceCard />);
  // Parent 1 starts empty → its action button reads "Pick"
  fireEvent.click(screen.getAllByRole('button', { name: /^Pick$/i })[0]!);
  // modal lists the roster (Uma 101501 from the ROSTER fixture)
  const dialog = screen.getByRole('dialog', { name: /pick a parent/i });
  fireEvent.click(within(dialog).getByRole('button', { name: /Uma 101501/ }));
  expect(setPlan).toHaveBeenCalledWith(expect.objectContaining({ parents: { a: 'a' } }));
});
```

> Add `within` to the `@testing-library/react` import in this file if not present. The existing `ROSTER` fixture's first parent has `id:'a'`, `umaId:'101501'`; `umaName` mock returns `Uma 101501`. Parent records in the fixture need `blueSpark`/`pinkSpark` (they already do) for `aggregate`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/inheritance/InheritanceCard.test.tsx`
Expected: FAIL — no modal / `dialog` role not found (still inline `SearchPicker`).

- [ ] **Step 3: Implement the wiring**

In `src/features/inheritance/InheritanceCard.tsx`:

(a) Add imports:
```tsx
import { useGameData } from '@/features/data/gameData';
import { UmaPickerModal, type UmaPickerItem } from './UmaPickerModal';
import { aggregate } from './sparkAggregate';
import { candidateAffinity } from './candidateAffinity';
import { useAffinityIndex } from './useAffinityIndex';
```

(b) Inside the component, after `const { umaById } = useUmas();`:
```tsx
  const { skills, skillById } = useGameData();
  const idx = useAffinityIndex();
```

(c) After `const byId = …` and `select`, add item-building + white options:
```tsx
  const whiteSkillOptions = useMemo(
    () => skills.filter((s) => s.rarity === 'white').map((s) => ({ id: s.skillId, name: s.nameEn })),
    [skills],
  );
  const skillName = (id: string) => skillById.get(id)?.nameEn ?? id;
  const itemsFor = (slot: Slot): UmaPickerItem[] => {
    const otherId = uma1Plan.parents[slot === 'a' ? 'b' : 'a'];
    const other = otherId ? byId.get(otherId) : undefined;
    return pool.map((p) => ({
      id: p.id,
      name: umaName(umaById, p.umaId),
      rating: p.rating,
      portrait: <GameIcon kind="uma" id={p.umaId} size={42} alt="" />,
      agg: aggregate(p),
      affinity: idx ? candidateAffinity({ idx, traineeUmaId: uma1Plan.umaId, candidate: p, other }) : null,
    }));
  };
```

(d) In `slotPicker`, DELETE the `if (m === 'change') { return <SearchPicker … /> }` branch (the modal replaces it; keep the `'find'` branch). The `SearchPicker`/`SearchItem` imports + the `items` const become unused — remove them.

(e) Before the final `return (`, build the two modals (one per slot):
```tsx
  const modals = (['a', 'b'] as const).map((slot) => (
    <UmaPickerModal
      key={slot}
      open={mode[slot] === 'change'}
      items={mode[slot] === 'change' ? itemsFor(slot) : []}
      skillName={skillName}
      whiteSkillOptions={whiteSkillOptions}
      onPick={(id) => select(slot, id)}
      onClose={() => setMode((m) => ({ ...m, [slot]: null }))}
    />
  ));
```

(f) Render `{modals}` inside the root `<div className="cmp-plan-card inh-inheritance-card">` (e.g. right before its closing `</div>`), so both slots' modals mount (each portals to body; `open` gates visibility).

- [ ] **Step 4: Run the test + typecheck**

Run: `pnpm vitest run src/features/inheritance/InheritanceCard.test.tsx`
Expected: PASS (existing + new test).

Run: `pnpm typecheck`
Expected: no errors (the removed `SearchPicker`/`items`/`SearchItem` leave nothing dangling).

- [ ] **Step 5: Commit**

```bash
git add src/features/inheritance/InheritanceCard.tsx src/features/inheritance/InheritanceCard.test.tsx
git commit -m "feat(m1): open the spark-filter picker modal from Pick/Change (M1.4)"
```

- [ ] **Step 6: Full-suite gate**

Run: `pnpm typecheck` then `pnpm test`
Expected: all pass (prior 965 + the new M1.4 picker tests). Re-run a flaky UI file once if needed.

```bash
# no commit if clean; if a pre-existing test needed a mock for the new hook, fix + commit it
```

---

## Self-Review notes (addressed)

- **Spec coverage:** §3.1 `aggregate` (Task 1), §3.2 `sparkFilter` incl. the 3 examples (Task 2), §3.3 `candidateAffinity` (Task 3), §3.4 `useAffinityIndex` (Task 4), §4.1 modal + filter builder + tiles + CSS (Task 5), §4.2 wiring (Task 6). White symmetry (legacy+total) is in Tasks 2/5.
- **Type consistency:** `SparkAgg` shape identical across Tasks 1/2/5; `SparkFilter` union identical Tasks 2/5; `UmaPickerItem`/`UmaPickerModalProps` defined Task 5, consumed Task 6; `candidateAffinity` args identical Tasks 3/6. `select(slot, id)` is the existing helper (Task 6 reuses it).
- **Deferred:** ranking beyond affinity-desc, Find-candidates fold-in, full-pair affinity refinement (spec §6) — not in scope.
