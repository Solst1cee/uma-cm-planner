# M2 SP Purchase Optimizer — MVP (Plan #1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Manual-input MVP of Module 2 — hand-enter a post-run skill screen (build context + buyable skills + each on-screen SP cost + available SP), then get the top-3 budget-feasible, mutually-diverse baskets, each simulated and ranked on simulated combined Δ-lengths.

**Architecture:** A sim-free pure core (`src/core/spOptimizer.ts`) does prereq-closed subset enumeration, the Δ-L proxy shortlister, and diversity/band selection — taking scores as injected inputs (P6, fully unit-testable). A feature-layer orchestrator (`src/features/sp-optimizer/rankBaskets.ts`) builds a `SimBuild`, computes per-candidate Δ L and per-basket combined Δ L via the vendored `@/sim` engine (injectable for deterministic tests), and applies an M2-scoped cache. The import↔analysis boundary is a serializable `CaptureBundle` JSON, persisted in a new Dexie `captures` store and consumable as a test fixture. UI is a thin manual-entry form + buyable table + 3 build cards under `src/features/sp-optimizer/`.

**Tech Stack:** TypeScript, React 19, Vite, Vitest (jsdom) + Testing Library, Dexie, the vendored umalator engine in `@/sim`. Path alias `@/* → src/*`. Spec: [docs/superpowers/specs/2026-06-14-m2-sp-optimizer-design.md](../specs/2026-06-14-m2-sp-optimizer-design.md).

---

## Conventions all tasks follow (read once)

- **Imports:** `import type { ... }` for types, separate from value imports; alphabetized within braces. Intra-`src` imports use the `@/*` alias, never relative `../`.
- **Vitest core tests:** `import { describe, expect, it } from 'vitest';`. Show-the-math inline comments on numeric assertions. Functions are **pure and total** (degrade gracefully, never throw on bad input).
- **DB tests:** first line `import 'fake-indexeddb/auto';` (before any dexie import), then `beforeEach(async () => { await db.delete(); await db.open(); });`.
- **Component tests:** `import '@testing-library/jest-dom/vitest';` per file; `afterEach(cleanup);`; `const user = userEvent.setup();`. Mock `@/features/data/gameData` and `@/db`; don't wrap in `BrowserRouter`.
- **Run a single test file:** `pnpm vitest run <path>`. **Typecheck:** `pnpm typecheck`. **Full suite:** `pnpm test`.
- **Commit** after each task's tests are green. Baseline before starting: `pnpm test` → 300 passing.

## File structure

| File | Responsibility | Task |
|---|---|---|
| `src/core/spOptimizer.ts` | Pure types + sim-free selection (enumerate, shortlist, diversity/band) | 1–5 |
| `src/core/spOptimizer.test.ts` | Unit tests for the pure core | 1–5 |
| `src/core/__fixtures__/m2/basic-screen.json` | A committed `CaptureBundle` test fixture | 6 |
| `src/features/sp-optimizer/rankBaskets.ts` | Sim orchestrator: `toSimBuild`, Δ L, exact/shortlist, score, M2 cache | 6 |
| `src/features/sp-optimizer/rankBaskets.test.ts` | Orchestrator tests with injected deterministic sim | 6 |
| `src/db/types.ts` | Add `StoredCapture` row type | 7 |
| `src/db/db.ts` | Bump to `version(2)`, add `captures` store | 7 |
| `src/db/capturesApi.ts` | `listCaptures`/`getCapture`/`saveCapture`/`deleteCapture` | 7 |
| `src/db/capturesApi.test.ts` | CRUD tests (fake-indexeddb) | 7 |
| `src/db/index.ts` | Re-export captures api | 7 |
| `src/db/exportImport.ts` | Add `captures` to the export blob (tolerant) | 8 |
| `src/db/exportImport.test.ts` | Round-trip captures | 8 |
| `src/features/sp-optimizer/useCaptures.ts` | Hand-rolled DB-state hook | 9 |
| `src/features/sp-optimizer/BuildContextForm.tsx` | Manual entry → `CaptureBundle` | 10 |
| `src/features/sp-optimizer/BuildCards.tsx` | The 3 ranked basket cards | 11 |
| `src/features/sp-optimizer/SpOptimizerPage.tsx` | Page: form + buyable table + cards + P3 banner | 11 |
| `src/features/sp-optimizer/sp-optimizer.css` | Feature styles | 11 |
| `src/app/App.tsx` | Enable nav link + route | 12 |
| `docs/mechanics-notes.md` | Record the VFalator validation procedure | 13 |

---

## Task 1: Core types + feasibility helpers

**Files:**
- Create: `src/core/spOptimizer.ts`
- Test: `src/core/spOptimizer.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/core/spOptimizer.test.ts
/**
 * Tests for the Module 2 SP Purchase Optimizer core (pure, sim-free).
 * SP costs are the on-screen effective costs entered by the user (no cost
 * calculation in v1 — see spec §2/§4). Mechanics refs cite
 * docs/mechanics-notes.md where relevant (retrieved 2026-06-15).
 */
import { describe, expect, it } from 'vitest';

import { basketSpCost, prereqClosure, type BuyableSkill } from '@/core/spOptimizer';

// --- test helpers ---
function buy(skillId: string, screenSpCost: number, prereqSkillId?: string): BuyableSkill {
  return { skillId, rarity: prereqSkillId ? 'gold' : 'white', screenSpCost, prereqSkillId };
}

const CANDS: BuyableSkill[] = [
  buy('w1', 100),
  buy('w2', 200),
  buy('g1', 150, 'w1'), // gold needs white w1
];

// --- prereqClosure ---
describe('prereqClosure', () => {
  it('adds a gold skill’s white prereq when present in candidates', () => {
    expect(prereqClosure(['g1'], CANDS).sort()).toEqual(['g1', 'w1']);
  });

  it('is a no-op when there is no prereq', () => {
    expect(prereqClosure(['w2'], CANDS)).toEqual(['w2']);
  });

  it('dedupes when the prereq is already selected', () => {
    expect(prereqClosure(['g1', 'w1'], CANDS).sort()).toEqual(['g1', 'w1']);
  });
});

// --- basketSpCost ---
describe('basketSpCost', () => {
  it('sums the on-screen costs of the given skills', () => {
    // w1 100 + w2 200 = 300
    expect(basketSpCost(['w1', 'w2'], CANDS)).toBe(300);
  });

  it('ignores skill ids not in the candidate list (owned/unknown cost 0)', () => {
    expect(basketSpCost(['w1', 'owned'], CANDS)).toBe(100);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/core/spOptimizer.test.ts`
Expected: FAIL — `Cannot find module '@/core/spOptimizer'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/core/spOptimizer.ts
/**
 * Module 2 core — pure, sim-free SP-basket selection (spec §4, the adaptive
 * hybrid). Operates strictly on the candidates + scores it is given; the
 * Monte-Carlo simulation that actually ranks baskets lives in the sim layer
 * (src/features/sp-optimizer/rankBaskets.ts) and is injected. Costs are the
 * on-screen effective costs (no cost calculation here — spec §2/§4).
 */
import type { HintLevel } from '@/core/coverage';
import type { SkillRarity, Stat } from '@/core/types';
import type { Strategy } from '@/sim';
import type { Grade } from '@/sim/types';

/** One buyable skill row on the post-run screen (M2-local). */
export interface BuyableSkill {
  skillId: string;
  rarity: SkillRarity;
  /** Effective on-screen SP cost (already discounted by hints + Fast Learner). */
  screenSpCost: number;
  /** Informational only in v1. */
  hintLevel?: HintLevel;
  /** Gold skills require their white base; a constraint, not a cost calc. */
  prereqSkillId?: string;
}

/** The post-run build context — the serialized `CaptureBundle.context`. */
export interface BuildContext {
  umaId: string;
  stats: Record<Stat, number>;
  aptitudes: { distance: Grade; surface: Grade; strategy: Grade };
  strategy: Strategy;
  /** master.mdb course id as string (matches SimRaceParams.courseId). */
  courseId: string;
  /** Available SP to spend (the runtime budget — never on CmPlan). */
  spBudget: number;
  /** Skills already learned this run; the sim base loadout (may be empty). */
  ownedSkills: string[];
  /** The buyable skills on screen. */
  candidates: BuyableSkill[];
  /** Must-buy skill ids forced into every basket. */
  pinned: string[];
}

/** The serializable import↔analysis artifact (spec §3). */
export interface CaptureBundle {
  schemaVersion: 1;
  source: 'manual' | 'ocr' | 'video';
  /** ISO timestamp; supplied by the caller (core stays clock-free). */
  capturedAt: string;
  server: string;
  dataVersion: string;
  /** Fixed seed → deterministic sim (reproducible baskets). */
  seed?: number;
  context: BuildContext;
}

/** A selected basket of skill ids (pinned + chosen), with SP accounting. */
export interface Basket {
  skills: string[];
  spUsed: number;
  spLeft: number;
}

// --- feasibility helpers ---

/** Expand a skill-id set to include any gold prereqs found in `candidates`. */
export function prereqClosure(skillIds: string[], candidates: BuyableSkill[]): string[] {
  const byId = new Map(candidates.map((c) => [c.skillId, c]));
  const out = new Set(skillIds);
  for (const id of skillIds) {
    const prereq = byId.get(id)?.prereqSkillId;
    if (prereq) out.add(prereq);
  }
  return [...out];
}

/** Sum the on-screen cost of the given skills (ids not in `candidates` cost 0). */
export function basketSpCost(skillIds: string[], candidates: BuyableSkill[]): number {
  const cost = new Map(candidates.map((c) => [c.skillId, c.screenSpCost]));
  return skillIds.reduce((sum, id) => sum + (cost.get(id) ?? 0), 0);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/core/spOptimizer.test.ts`
Expected: PASS (8 assertions).

- [ ] **Step 5: Typecheck + commit**

```bash
pnpm typecheck
git add src/core/spOptimizer.ts src/core/spOptimizer.test.ts
git commit -m "feat(m2): spOptimizer core types + prereq/cost helpers"
```

---

## Task 2: Core — enumerate feasible baskets

Enumerate every prereq-closed candidate subset that fits the residual budget, with the pinned set forced into each. This is the exact branch's search space.

**Files:**
- Modify: `src/core/spOptimizer.ts`
- Test: `src/core/spOptimizer.test.ts`

- [ ] **Step 1: Write the failing test** (append to `spOptimizer.test.ts`)

```ts
import { enumerateFeasibleBaskets } from '@/core/spOptimizer';

// --- enumerateFeasibleBaskets ---
describe('enumerateFeasibleBaskets', () => {
  const cands: BuyableSkill[] = [buy('a', 100), buy('b', 100), buy('c', 100)];

  it('returns the empty basket plus every affordable subset (budget 200)', () => {
    const baskets = enumerateFeasibleBaskets(cands, 200, []);
    const asSets = baskets.map((b) => b.slice().sort().join(','));
    expect(asSets).toContain(''); // spend nothing
    expect(asSets).toContain('a');
    expect(asSets).toContain('a,b');
    expect(asSets).not.toContain('a,b,c'); // 300 > 200
  });

  it('forces pinned ids into every basket and deducts their cost first', () => {
    const baskets = enumerateFeasibleBaskets(cands, 200, ['a']);
    expect(baskets.every((b) => b.includes('a'))).toBe(true);
    // 'a' is pinned (100), so only one more 100 skill fits
    expect(baskets.some((b) => b.length === 3)).toBe(false);
  });

  it('keeps a gold and its white prereq together as one feasible unit', () => {
    const gold: BuyableSkill[] = [buy('w', 100), buy('g', 100, 'w')];
    const baskets = enumerateFeasibleBaskets(gold, 150, []);
    const asSets = baskets.map((b) => b.slice().sort().join(','));
    expect(asSets).toContain('w'); // white alone fits (100)
    expect(asSets).not.toContain('g'); // gold pulls in w → 200 > 150, infeasible
    expect(asSets).not.toContain('g,w'); // also 200 > 150
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/core/spOptimizer.test.ts`
Expected: FAIL — `enumerateFeasibleBaskets is not a function`.

- [ ] **Step 3: Write minimal implementation** (append to `spOptimizer.ts`)

```ts
// --- enumeration (exact branch) ---

/**
 * Every prereq-closed subset of `candidates` whose total on-screen cost fits
 * `budget`, with `pinned` (+ their prereqs) forced into each. Returned baskets
 * are arrays of skill ids that INCLUDE the pinned set. Pure and total.
 *
 * Cost is bounded by the lock-threshold in practice (spec §4 step 2): the
 * caller only enumerates when the optional skill count is small.
 */
export function enumerateFeasibleBaskets(
  candidates: BuyableSkill[],
  budget: number,
  pinned: string[],
): string[][] {
  const pinnedClosed = prereqClosure(pinned, candidates);
  const pinnedCost = basketSpCost(pinnedClosed, candidates);
  const pinnedSet = new Set(pinnedClosed);
  // Optional skills are the non-pinned candidates; golds carry their prereq.
  const optional = candidates.filter((c) => !pinnedSet.has(c.skillId));

  const out: string[][] = [];
  const n = optional.length;
  for (let mask = 0; mask < 1 << n; mask++) {
    const picked: string[] = [];
    for (let i = 0; i < n; i++) if (mask & (1 << i)) picked.push(optional[i]!.skillId);
    const closed = prereqClosure(picked, candidates);
    // Skip masks whose closure pulled in a prereq not selected by this mask
    // and is itself a separate optional row — it'll be covered by another mask.
    const totalCost = pinnedCost + basketSpCost(closed.filter((id) => !pinnedSet.has(id)), candidates);
    if (totalCost > budget) continue;
    out.push([...new Set([...pinnedClosed, ...closed])]);
  }
  // Dedupe baskets (closures can collapse two masks to the same set).
  const seen = new Set<string>();
  return out.filter((b) => {
    const key = b.slice().sort().join(',');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/core/spOptimizer.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
pnpm typecheck
git add src/core/spOptimizer.ts src/core/spOptimizer.test.ts
git commit -m "feat(m2): enumerate prereq-closed budget-feasible baskets"
```

---

## Task 3: Core — diversity + top-K selection

Given baskets each carrying a simulated score, pick the top-K that are mutually diverse (differ by ≥2 skills) and within a max-bashin-gap band of the best. Ranking is on the **injected simulated score**, never a proxy.

**Files:**
- Modify: `src/core/spOptimizer.ts`
- Test: `src/core/spOptimizer.test.ts`

- [ ] **Step 1: Write the failing test** (append)

```ts
import { type ScoredBasket, selectTopDiverse, skillSetDistance } from '@/core/spOptimizer';

// --- skillSetDistance ---
describe('skillSetDistance', () => {
  it('counts symmetric-difference size', () => {
    expect(skillSetDistance(['a', 'b'], ['a', 'c'])).toBe(2); // b out, c in
    expect(skillSetDistance(['a', 'b'], ['a', 'b'])).toBe(0);
  });
});

// --- selectTopDiverse ---
describe('selectTopDiverse', () => {
  const scored: ScoredBasket[] = [
    { skills: ['a', 'b'], score: 10, spUsed: 0, spLeft: 0 },
    { skills: ['a', 'b', 'c'], score: 9.9, spUsed: 0, spLeft: 0 }, // dist 1 from best → too similar
    { skills: ['d', 'e'], score: 9, spUsed: 0, spLeft: 0 }, // diverse
    { skills: ['f', 'g'], score: 1, spUsed: 0, spLeft: 0 }, // outside band
  ];

  it('ranks by score, enforces ≥2-skill diversity, and applies the bashin band', () => {
    const top = selectTopDiverse(scored, { k: 3, bandBashin: 2, minDistance: 2 });
    expect(top.map((b) => b.skills.join(','))).toEqual(['a,b', 'd,e']);
    // 'a,b,c' dropped (distance 1 from 'a,b'); 'f,g' dropped (score 1 < 10-2 band)
  });

  it('returns fewer than k when diversity/band cannot be satisfied', () => {
    const top = selectTopDiverse(scored, { k: 3, bandBashin: 2, minDistance: 2 });
    expect(top.length).toBeLessThanOrEqual(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/core/spOptimizer.test.ts`
Expected: FAIL — `selectTopDiverse is not a function`.

- [ ] **Step 3: Write minimal implementation** (append)

```ts
// --- diversity + selection ---

/** A basket plus its simulated score (mean Δ-lengths) and SP accounting. */
export interface ScoredBasket extends Basket {
  /** Simulated combined Δ-lengths (higher = better). */
  score: number;
}

export interface SelectOpts {
  k: number;
  /** Drop baskets more than this many bashin below the best. */
  bandBashin: number;
  /** Minimum symmetric-difference between any two chosen baskets. */
  minDistance: number;
}

/** Symmetric-difference size of two skill-id sets. */
export function skillSetDistance(a: string[], b: string[]): number {
  const sa = new Set(a);
  const sb = new Set(b);
  let d = 0;
  for (const x of sa) if (!sb.has(x)) d++;
  for (const x of sb) if (!sa.has(x)) d++;
  return d;
}

/**
 * Greedy top-K by descending score, skipping any basket within `minDistance`
 * of an already-chosen one or more than `bandBashin` below the best score.
 * Stable: equal scores keep input order. Pure and total.
 */
export function selectTopDiverse(scored: ScoredBasket[], opts: SelectOpts): ScoredBasket[] {
  if (scored.length === 0) return [];
  const ranked = [...scored].sort((x, y) => y.score - x.score);
  const best = ranked[0]!.score;
  const chosen: ScoredBasket[] = [];
  for (const cand of ranked) {
    if (cand.score < best - opts.bandBashin) break; // ranked desc → rest are worse
    const tooClose = chosen.some(
      (c) => skillSetDistance(c.skills, cand.skills) < opts.minDistance,
    );
    if (tooClose) continue;
    chosen.push(cand);
    if (chosen.length === opts.k) break;
  }
  return chosen;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/core/spOptimizer.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
pnpm typecheck
git add src/core/spOptimizer.ts src/core/spOptimizer.test.ts
git commit -m "feat(m2): diversity + max-bashin-gap top-K basket selection"
```

---

## Task 4: Core — Δ-L proxy shortlister (large-residual branch)

When too many subsets are feasible to sim them all, build a bounded shortlist of promising, diverse baskets using each candidate's single-skill Δ L (a proxy). Includes the greedy-beating guarantee test.

**Files:**
- Modify: `src/core/spOptimizer.ts`
- Test: `src/core/spOptimizer.test.ts`

- [ ] **Step 1: Write the failing test** (append)

```ts
import { shortlistByProxy } from '@/core/spOptimizer';

// --- shortlistByProxy ---
describe('shortlistByProxy', () => {
  const cands: BuyableSkill[] = [buy('a', 100), buy('b', 100), buy('c', 100), buy('d', 100)];
  // Δ-L per skill (the proxy). a+b individually mediocre; c huge but pricey-equal.
  const deltaL: Record<string, number> = { a: 1, b: 1, c: 5, d: 0.5 };

  it('produces budget-feasible baskets including the proxy-optimal one', () => {
    const lists = shortlistByProxy(cands, 200, [], deltaL, { limit: 10, minDistance: 2 });
    expect(lists.length).toBeGreaterThan(0);
    expect(lists.every((b) => basketSpCost(b, cands) <= 200)).toBe(true);
    // proxy-optimal within budget 200 is {c, a} or {c, b} (5+1)
    const top = lists[0]!.slice().sort().join(',');
    expect(['a,c', 'b,c']).toContain(top);
  });

  it('beats naive greedy-by-cost: a knapsack counterexample', () => {
    // budget 3; items: x(cost2,Δ3) y(cost1,Δ2) z(cost2,Δ2.9).
    // greedy-by-ratio picks y(2.0) then x? x cost2 won't fit after y? 1+2=3 ok → y,x Δ5.
    // but z,y = 2.9+2 over cost3 → Δ4.9. Best is x+y (Δ5). Shortlist must surface x+y.
    const kn: BuyableSkill[] = [buy('x', 2), buy('y', 1), buy('z', 2)];
    const d: Record<string, number> = { x: 3, y: 2, z: 2.9 };
    const lists = shortlistByProxy(kn, 3, [], d, { limit: 10, minDistance: 1 });
    const proxySum = (b: string[]) => b.reduce((s, id) => s + (d[id] ?? 0), 0);
    const best = Math.max(...lists.map(proxySum));
    expect(best).toBe(5); // x+y, not the greedy-ratio trap
  });

  it('respects pins and the shortlist limit', () => {
    const lists = shortlistByProxy(cands, 300, ['a'], deltaL, { limit: 3, minDistance: 1 });
    expect(lists.length).toBeLessThanOrEqual(3);
    expect(lists.every((b) => b.includes('a'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/core/spOptimizer.test.ts`
Expected: FAIL — `shortlistByProxy is not a function`.

- [ ] **Step 3: Write minimal implementation** (append)

```ts
// --- proxy shortlister (large-residual branch) ---

export interface ShortlistOpts {
  /** Max baskets to return for simulation. */
  limit: number;
  /** Minimum diversity between shortlisted baskets. */
  minDistance: number;
}

/**
 * Exact DP-over-SP knapsack on the single-skill Δ-L proxy → the proxy-optimal
 * feasible basket, then a diverse spread around it, capped at `limit`. The
 * proxy ONLY narrows the field (spec §4 step 3); the sim re-ranks the result.
 * Beats greedy-by-ratio (the knapsack is exact). Pure and total.
 *
 * `deltaLById` is the per-candidate single-skill Δ-lengths; missing ⇒ 0.
 */
export function shortlistByProxy(
  candidates: BuyableSkill[],
  budget: number,
  pinned: string[],
  deltaLById: Record<string, number>,
  opts: ShortlistOpts,
): string[][] {
  const pinnedClosed = prereqClosure(pinned, candidates);
  const pinnedCost = basketSpCost(pinnedClosed, candidates);
  const pinnedSet = new Set(pinnedClosed);
  const residual = Math.max(0, budget - pinnedCost);

  // Candidate "items" carry their prereq cost so golds are self-contained.
  const items = candidates
    .filter((c) => !pinnedSet.has(c.skillId))
    .map((c) => {
      const closed = prereqClosure([c.skillId], candidates).filter((id) => !pinnedSet.has(id));
      return {
        id: c.skillId,
        members: closed,
        cost: basketSpCost(closed, candidates),
        value: closed.reduce((s, id) => s + (deltaLById[id] ?? 0), 0),
      };
    })
    .filter((it) => it.cost > 0 && it.cost <= residual);

  // 0/1 knapsack DP over integer SP, tracking the chosen-item set per cell.
  const best: { value: number; picked: number[] }[] = Array.from({ length: residual + 1 }, () => ({
    value: 0,
    picked: [],
  }));
  items.forEach((it, idx) => {
    for (let sp = residual; sp >= it.cost; sp--) {
      const cand = best[sp - it.cost]!;
      if (cand.value + it.value > best[sp]!.value && !cand.picked.includes(idx)) {
        best[sp] = { value: cand.value + it.value, picked: [...cand.picked, idx] };
      }
    }
  });

  // Collect candidate baskets: the optimum at each SP level (diverse spread).
  const raw: string[][] = best
    .map((cell) => [...pinnedClosed, ...cell.picked.flatMap((i) => items[i]!.members)])
    .map((b) => [...new Set(b)]);

  // Dedupe + diversity filter + cap.
  const out: string[][] = [];
  const seen = new Set<string>();
  // Prefer higher proxy value first.
  const valueOf = (b: string[]) => b.reduce((s, id) => s + (deltaLById[id] ?? 0), 0);
  for (const b of raw.sort((x, y) => valueOf(y) - valueOf(x))) {
    const key = b.slice().sort().join(',');
    if (seen.has(key)) continue;
    if (out.some((o) => skillSetDistance(o, b) < opts.minDistance)) continue;
    seen.add(key);
    out.push(b);
    if (out.length === opts.limit) break;
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/core/spOptimizer.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
pnpm typecheck
git add src/core/spOptimizer.ts src/core/spOptimizer.test.ts
git commit -m "feat(m2): Δ-L knapsack proxy shortlister (greedy counterexample tested)"
```

---

## Task 5: Core — the branch chooser (exact vs shortlist)

A sim-free decision: given the build context + per-candidate Δ L, return the set of candidate baskets that the sim layer should score, plus which branch ran. Includes the **exact == brute force** invariant.

**Files:**
- Modify: `src/core/spOptimizer.ts`
- Test: `src/core/spOptimizer.test.ts`

- [ ] **Step 1: Write the failing test** (append)

```ts
import { chooseBasketsToScore } from '@/core/spOptimizer';

// --- chooseBasketsToScore ---
describe('chooseBasketsToScore', () => {
  const cands: BuyableSkill[] = [buy('a', 100), buy('b', 100), buy('c', 100)];

  it('uses the exact branch when feasible subsets are within the threshold', () => {
    const r = chooseBasketsToScore(
      { candidates: cands, spBudget: 200, pinned: [] },
      {},
      { exactThreshold: 100, shortlistLimit: 10, minDistance: 1 },
    );
    expect(r.mode).toBe('exact');
    // exact == brute force enumeration
    expect(r.baskets.length).toBe(enumerateFeasibleBaskets(cands, 200, []).length);
  });

  it('falls back to the shortlist when the feasible count exceeds the threshold', () => {
    const r = chooseBasketsToScore(
      { candidates: cands, spBudget: 300, pinned: [] },
      { a: 1, b: 1, c: 1 },
      { exactThreshold: 3, shortlistLimit: 5, minDistance: 1 },
    );
    expect(r.mode).toBe('shortlist');
    expect(r.baskets.length).toBeLessThanOrEqual(5);
  });

  it('skips the exact branch (no 2^n blowup) when there are many optional candidates', () => {
    const many: BuyableSkill[] = Array.from({ length: 24 }, (_, i) => buy(`s${i}`, 10));
    const dl = Object.fromEntries(many.map((c) => [c.skillId, 1]));
    const r = chooseBasketsToScore(
      { candidates: many, spBudget: 1000, pinned: [] }, // all affordable → 2^24 feasible
      dl,
      { exactThreshold: 256, shortlistLimit: 5, minDistance: 1 },
    );
    expect(r.mode).toBe('shortlist'); // returns fast, never enumerates 2^24
    expect(r.baskets.length).toBeLessThanOrEqual(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/core/spOptimizer.test.ts`
Expected: FAIL — `chooseBasketsToScore is not a function`.

- [ ] **Step 3: Write minimal implementation** (append)

```ts
// --- branch chooser ---

/** Above this many OPTIONAL candidates, never attempt exact (2^n) enumeration. */
const MAX_EXACT_BITS = 20;

export interface ChooseOpts {
  /** Max feasible subsets to allow the exact (sim-everything) branch. */
  exactThreshold: number;
  shortlistLimit: number;
  minDistance: number;
}

export interface ChooseResult {
  mode: 'exact' | 'shortlist';
  /** Candidate baskets (skill-id arrays, incl. pinned) for the sim to score. */
  baskets: string[][];
}

/**
 * Decide the exact vs shortlist branch (spec §4 steps 2–3). The exact branch
 * is gated TWICE so it never explodes: first by the optional-candidate bit
 * count (`MAX_EXACT_BITS`, to avoid even building 2^n masks), then by the
 * feasible-subset count (`exactThreshold`). Otherwise return a Δ-L proxy
 * shortlist. Pure and total — no simulation here.
 */
export function chooseBasketsToScore(
  ctx: Pick<BuildContext, 'candidates' | 'spBudget' | 'pinned'>,
  deltaLById: Record<string, number>,
  opts: ChooseOpts,
): ChooseResult {
  const pinnedClosed = prereqClosure(ctx.pinned, ctx.candidates);
  const optionalCount = ctx.candidates.filter((c) => !pinnedClosed.includes(c.skillId)).length;
  if (optionalCount <= MAX_EXACT_BITS) {
    const feasible = enumerateFeasibleBaskets(ctx.candidates, ctx.spBudget, ctx.pinned);
    if (feasible.length <= opts.exactThreshold) {
      return { mode: 'exact', baskets: feasible };
    }
  }
  return {
    mode: 'shortlist',
    baskets: shortlistByProxy(ctx.candidates, ctx.spBudget, ctx.pinned, deltaLById, {
      limit: opts.shortlistLimit,
      minDistance: opts.minDistance,
    }),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/core/spOptimizer.test.ts`
Expected: PASS. Then run the whole core file to confirm no regressions: `pnpm vitest run src/core/spOptimizer.test.ts`.

- [ ] **Step 5: Commit**

```bash
pnpm typecheck
git add src/core/spOptimizer.ts src/core/spOptimizer.test.ts
git commit -m "feat(m2): exact-vs-shortlist branch chooser (exact==brute-force tested)"
```

---

## Task 6: Sim orchestrator — `rankBaskets` + M2 cache + fixture

Builds the `SimBuild`, computes per-candidate Δ L and per-basket combined Δ L through injectable sim functions (so tests are deterministic with a fixed seed and a fake sim), applies the M2-scoped cache, and returns the ranked top-3.

**Files:**
- Create: `src/features/sp-optimizer/rankBaskets.ts`
- Create: `src/core/__fixtures__/m2/basic-screen.json`
- Test: `src/features/sp-optimizer/rankBaskets.test.ts`

- [ ] **Step 1: Create the fixture bundle**

```json
// src/core/__fixtures__/m2/basic-screen.json
{
  "schemaVersion": 1,
  "source": "manual",
  "capturedAt": "2026-06-15T00:00:00.000Z",
  "server": "global",
  "dataVersion": "global-c1fa2107",
  "seed": 12345,
  "context": {
    "umaId": "",
    "stats": { "spd": 1150, "sta": 800, "pow": 1000, "gut": 500, "wit": 850 },
    "aptitudes": { "distance": "A", "surface": "A", "strategy": "A" },
    "strategy": "pace",
    "courseId": "10101",
    "spBudget": 300,
    "ownedSkills": [],
    "pinned": [],
    "candidates": [
      { "skillId": "200332", "rarity": "white", "screenSpCost": 120 },
      { "skillId": "200331", "rarity": "white", "screenSpCost": 160 },
      { "skillId": "200342", "rarity": "white", "screenSpCost": 180 }
    ]
  }
}
```

- [ ] **Step 2: Write the failing test**

```ts
// src/features/sp-optimizer/rankBaskets.test.ts
/**
 * Tests for the M2 sim orchestrator. The simulator is injected as a fake so
 * the test is deterministic and needs no engine; the real default wires to
 * @/sim (evalSkillDelta / runPlannerCompare). Sim is the arbiter; the proxy
 * only narrows (spec §4).
 */
import { describe, expect, it } from 'vitest';

import type { CaptureBundle } from '@/core/spOptimizer';
import { type SimDeps, rankBaskets, toSimBuild } from '@/features/sp-optimizer/rankBaskets';
import bundle from '@/core/__fixtures__/m2/basic-screen.json';

// Fake sim: each skill's marginal value is its trailing-digit; a basket's
// combined value is the sum minus a fixed "interaction" penalty so the fake is
// non-additive (mirrors real skill interaction).
function fakeDeps(): SimDeps {
  const val = (id: string) => Number(id.slice(-1));
  return {
    skillDelta: (_b, _r, skillId) => stat(val(skillId)),
    planner: (_b, _r, skills) =>
      stat(skills.reduce((s, id) => s + val(id), 0) - (skills.length > 1 ? 0.5 : 0)),
  };
}
function stat(mean: number) {
  return { mean, median: mean, min: mean, max: mean, nsamples: 64, results: [mean] };
}

describe('toSimBuild', () => {
  it('maps a BuildContext + skill set to a SimBuild', () => {
    const sb = toSimBuild((bundle as CaptureBundle).context, ['200332']);
    expect(sb.stats.spd).toBe(1150);
    expect(sb.strategy).toBe('pace');
    expect(sb.skills).toEqual(['200332']);
  });
});

describe('rankBaskets', () => {
  it('returns up to 3 diverse baskets ranked on simulated combined Δ-lengths', () => {
    const result = rankBaskets(bundle as CaptureBundle, { deps: fakeDeps() });
    expect(result.mode).toBe('exact');
    expect(result.baskets.length).toBeGreaterThan(0);
    expect(result.baskets.length).toBeLessThanOrEqual(3);
    // Ranked descending by score.
    const scores = result.baskets.map((b) => b.score);
    expect(scores).toEqual([...scores].sort((a, z) => z - a));
  });

  it('is deterministic for the same bundle + seed', () => {
    const a = rankBaskets(bundle as CaptureBundle, { deps: fakeDeps() });
    const b = rankBaskets(bundle as CaptureBundle, { deps: fakeDeps() });
    expect(a.baskets).toEqual(b.baskets);
  });
});
```

> **Note for the implementer:** importing `.json` in a Vitest/TS test requires `resolveJsonModule` (already on in this repo's `tsconfig`). If the import errors, confirm `"resolveJsonModule": true` in `tsconfig.json` and add it if missing (commit that change in this task).

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm vitest run src/features/sp-optimizer/rankBaskets.test.ts`
Expected: FAIL — `Cannot find module '@/features/sp-optimizer/rankBaskets'`.

- [ ] **Step 4: Write minimal implementation**

```ts
// src/features/sp-optimizer/rankBaskets.ts
/**
 * Module 2 sim orchestrator (spec §4, "rankBaskets is the sim-layer
 * orchestrator"). Pure selection lives in @/core/spOptimizer; this drives the
 * vendored engine through it. Sim functions are injectable for deterministic
 * tests. M2 keeps its OWN per-(owned-skill-set, course) cache — the shared
 * makeDeltaCache is unsafe across differing loadouts.
 */
import {
  type BuildContext,
  type CaptureBundle,
  type ScoredBasket,
  basketSpCost,
  chooseBasketsToScore,
  selectTopDiverse,
} from '@/core/spOptimizer';
import {
  type BashinStats,
  type SimBuild,
  type SimRaceParams,
  evalSkillDelta,
  runPlannerCompare,
} from '@/sim';

/** The two engine calls the orchestrator needs; injectable for tests. */
export interface SimDeps {
  skillDelta: (b: SimBuild, r: SimRaceParams, skillId: string, n: number, seed: number) => BashinStats;
  planner: (b: SimBuild, r: SimRaceParams, skills: string[], n: number, seed: number) => BashinStats;
}

const REAL_DEPS: SimDeps = {
  skillDelta: (b, r, s, n, seed) => evalSkillDelta(b, r, s, n, seed),
  planner: (b, r, s, n, seed) => runPlannerCompare(b, r, s, n, seed),
};

export interface RankOpts {
  deps?: SimDeps;
  nsamples?: number;
  exactThreshold?: number;
  shortlistLimit?: number;
}

export interface RankedBasket extends ScoredBasket {
  /** Short, honest distribution descriptor (NOT a phase profile — see note). */
  descriptor: string;
}

export interface RankResult {
  mode: 'exact' | 'shortlist';
  baskets: RankedBasket[];
}

/** Build a SimBuild from a BuildContext + the basket's skill set. */
export function toSimBuild(ctx: BuildContext, skills: string[]): SimBuild {
  return {
    umaId: ctx.umaId,
    stats: ctx.stats,
    strategy: ctx.strategy,
    aptitudes: ctx.aptitudes,
    skills,
  };
}

/**
 * Honest, measurable descriptor from the bashin distribution (spec §4 / P3:
 * NO early/mid/late phase profile — the adapter doesn't expose phase telemetry
 * yet; that is a deferred enhancement).
 */
function describe(stats: BashinStats): string {
  const spread = stats.max - stats.min;
  const consistency = spread <= 1 ? 'tight' : spread <= 3 ? 'moderate' : 'wide';
  return `+${stats.mean.toFixed(1)} lengths · ${consistency} spread`;
}

/**
 * The adaptive hybrid (spec §4): lock → Δ-L per candidate → exact-or-shortlist
 * → full-build sim each candidate basket → top-3 diverse on simulated Δ-L.
 */
export function rankBaskets(bundle: CaptureBundle, opts: RankOpts = {}): RankResult {
  const deps = opts.deps ?? REAL_DEPS;
  const n = opts.nsamples ?? 200;
  const seed = bundle.seed ?? 0;
  const ctx = bundle.context;
  const race: SimRaceParams = { courseId: ctx.courseId };

  // Locked base = owned (already learned) + pinned (+ their prereqs).
  const lockedSkills = [...new Set([...ctx.ownedSkills, ...ctx.pinned])];
  const lockedBuild = toSimBuild(ctx, lockedSkills);

  // M2-scoped cache key includes the FULL owned-skill set (not just one skill).
  const cache = new Map<string, BashinStats>();
  const cached = (key: string, compute: () => BashinStats): BashinStats => {
    const hit = cache.get(key);
    if (hit) return hit;
    const v = compute();
    cache.set(key, v);
    return v;
  };
  const baseKey = `${ctx.courseId}|${lockedSkills.slice().sort().join(',')}`;

  // Per-candidate single-skill Δ L (the proxy + the L/SP table).
  const deltaLById: Record<string, number> = {};
  for (const c of ctx.candidates) {
    if (lockedSkills.includes(c.skillId)) continue;
    const stats = cached(`${baseKey}|d:${c.skillId}`, () =>
      deps.skillDelta(lockedBuild, race, c.skillId, n, seed),
    );
    // nsamples===0 ⇒ non-simulatable/no signal (NOT zero value); treat as 0 proxy.
    deltaLById[c.skillId] = stats.nsamples === 0 ? 0 : stats.mean;
  }

  // Exact vs shortlist (pure).
  const choice = chooseBasketsToScore(ctx, deltaLById, {
    exactThreshold: opts.exactThreshold ?? 256,
    shortlistLimit: opts.shortlistLimit ?? 20,
    minDistance: 2,
  });

  // Full-build sim each candidate basket → combined Δ L over the locked base.
  const scored: (ScoredBasket & { descriptor: string })[] = choice.baskets.map((skills) => {
    const additions = skills.filter((id) => !lockedSkills.includes(id));
    const stats = cached(`${baseKey}|p:${additions.slice().sort().join(',')}`, () =>
      deps.planner(lockedBuild, race, additions, n, seed),
    );
    const spUsed = basketSpCost(skills.filter((id) => !lockedSkills.includes(id)), ctx.candidates);
    return {
      skills,
      score: stats.nsamples === 0 ? 0 : stats.mean,
      spUsed,
      spLeft: ctx.spBudget - spUsed,
      descriptor: describe(stats),
    };
  });

  const top = selectTopDiverse(scored, { k: 3, bandBashin: 3, minDistance: 2 });
  // Re-attach descriptors (selectTopDiverse returns ScoredBasket, drop extras).
  const byKey = new Map(scored.map((s) => [s.skills.slice().sort().join(','), s.descriptor]));
  return {
    mode: choice.mode,
    baskets: top.map((b) => ({ ...b, descriptor: byKey.get(b.skills.slice().sort().join(',')) ?? '' })),
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run src/features/sp-optimizer/rankBaskets.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck + commit**

```bash
pnpm typecheck
git add src/features/sp-optimizer/rankBaskets.ts src/features/sp-optimizer/rankBaskets.test.ts src/core/__fixtures__/m2/basic-screen.json
git commit -m "feat(m2): rankBaskets sim orchestrator + M2 cache + fixture bundle"
```

---

## Task 7: DB — `captures` store + `capturesApi`

**Files:**
- Modify: `src/db/types.ts`, `src/db/db.ts`, `src/db/index.ts`
- Create: `src/db/capturesApi.ts`, `src/db/capturesApi.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/db/capturesApi.test.ts
import 'fake-indexeddb/auto'; // must precede any dexie import
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { db } from '@/db/db';
import { deleteCapture, listCaptures, saveCapture } from '@/db';
import type { CaptureBundle } from '@/core/spOptimizer';

const CTX: CaptureBundle['context'] = {
  umaId: '', stats: { spd: 1, sta: 1, pow: 1, gut: 1, wit: 1 },
  aptitudes: { distance: 'A', surface: 'A', strategy: 'A' },
  strategy: 'pace', courseId: '10101', spBudget: 300,
  ownedSkills: [], pinned: [], candidates: [],
};
const BUNDLE: CaptureBundle = {
  schemaVersion: 1, source: 'manual', capturedAt: '2026-06-15T00:00:00.000Z',
  server: 'global', dataVersion: 'global-c1fa2107', context: CTX,
};

beforeEach(async () => { await db.delete(); await db.open(); });
afterEach(async () => { await db.delete(); });

describe('capturesApi', () => {
  it('saves a capture with a generated id and a label', async () => {
    const saved = await saveCapture({ label: 'CM14 ace', bundle: BUNDLE });
    expect(saved.id).toMatch(/.+/);
    expect((await listCaptures())[0]?.label).toBe('CM14 ace');
  });

  it('deletes a capture', async () => {
    const saved = await saveCapture({ label: 'x', bundle: BUNDLE });
    await deleteCapture(saved.id);
    expect(await listCaptures()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/db/capturesApi.test.ts`
Expected: FAIL — `saveCapture` not exported from `@/db`.

- [ ] **Step 3: Add the row type** (`src/db/types.ts`, append)

```ts
import type { CaptureBundle } from '@/core/spOptimizer';

/** A persisted M2 capture (the source-of-truth artifact; results are derived). */
export interface StoredCapture {
  id: string;
  label: string;
  bundle: CaptureBundle;
}
```

- [ ] **Step 4: Bump the Dexie schema** (`src/db/db.ts`)

Add the import, the `declare`, and a `version(2)` store (Dexie carries v1 stores forward; only the new store is listed):

```ts
// add to the type imports at the top:
import type { StoredCapture } from '@/db/types';

// add inside the class body, with the other `declare` lines:
  declare captures: Table<StoredCapture, string>;

// add in the constructor, AFTER the existing this.version(1).stores({...}) call:
    this.version(2).stores({
      captures: 'id, label',
    });
```

- [ ] **Step 5: Create the api** (`src/db/capturesApi.ts`)

```ts
// src/db/capturesApi.ts
import { db } from '@/db/db';
import type { CaptureBundle } from '@/core/spOptimizer';
import type { StoredCapture } from '@/db/types';

export interface CaptureDraft {
  id?: string;
  label: string;
  bundle: CaptureBundle;
}

export function listCaptures(): Promise<StoredCapture[]> {
  return db.captures.toArray();
}

export function getCapture(id: string): Promise<StoredCapture | undefined> {
  return db.captures.get(id);
}

/** Upsert by id; generates a `crypto.randomUUID()` id when absent. */
export async function saveCapture(draft: CaptureDraft): Promise<StoredCapture> {
  const record: StoredCapture = {
    id: draft.id || crypto.randomUUID(),
    label: draft.label,
    bundle: draft.bundle,
  };
  await db.captures.put(record);
  return record;
}

export function deleteCapture(id: string): Promise<void> {
  return db.captures.delete(id);
}
```

- [ ] **Step 6: Re-export from the barrel** (`src/db/index.ts`, append to its exports)

```ts
export { listCaptures, getCapture, saveCapture, deleteCapture } from './capturesApi';
export type { CaptureDraft } from './capturesApi';
```

- [ ] **Step 7: Run test to verify it passes**

Run: `pnpm vitest run src/db/capturesApi.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
pnpm typecheck
git add src/db/types.ts src/db/db.ts src/db/capturesApi.ts src/db/capturesApi.test.ts src/db/index.ts
git commit -m "feat(m2): captures Dexie store (v2) + capturesApi CRUD"
```

---

## Task 8: DB — captures in export/import

Add `captures` to the export blob, tolerant of old files that lack the key (the existing parser is strict, so default to `[]`).

**Files:**
- Modify: `src/db/exportImport.ts`
- Test: `src/db/exportImport.test.ts`

- [ ] **Step 1: Write the failing test** (append to `exportImport.test.ts`)

```ts
import { saveCapture } from '@/db';

describe('export/import captures', () => {
  it('round-trips captures and tolerates an absent captures key', async () => {
    await saveCapture({ label: 'roundtrip', bundle: BUNDLE_FIXTURE });
    const blob = await exportBlob();
    expect(blob.captures).toHaveLength(1);

    // Old file without `captures` must still import (defaults to []).
    const { captures, ...legacy } = JSON.parse(JSON.stringify(blob));
    await db.delete(); await db.open();
    const result = await importBlob(legacy, 'replace');
    expect(result.imported.captures ?? 0).toBe(0);
  });
});
```

> Add a `BUNDLE_FIXTURE` const at the top of the test mirroring Task 7's `BUNDLE`. If `exportImport.test.ts` already imports `db`/`exportBlob`/`importBlob`, reuse those imports.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/db/exportImport.test.ts`
Expected: FAIL — `blob.captures` is undefined.

- [ ] **Step 3: Wire captures into the blob** (`src/db/exportImport.ts`)

```ts
// 1) import the api + type at the top:
import { listCaptures } from '@/db/capturesApi';
import type { StoredCapture } from '@/db/types';

// 2) add to the ExportBlobV1 interface:
//      captures: StoredCapture[];

// 3) in exportBlob(), add captures to the returned object:
//      captures: await listCaptures(),

// 4) in parseExportBlobV1(), tolerate an absent key (default []):
//      captures: asArray(root['captures'] ?? [], 'captures') as StoredCapture[],

// 5) in importBlob() string-keyed upsert group, add:
//      db.captures.bulkPut(blob.captures),
//    and count it in the imported record:
//      captures: blob.captures.length,
```

> The exact lines depend on the current `exportImport.ts` shape recon'd in Task 0; follow the existing `parents`/`cmPlans` pattern verbatim for each of the 5 edits. `asArray(x ?? [], name)` is the existing validator; passing `?? []` makes the field optional for backward compatibility.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/db/exportImport.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
pnpm typecheck
git add src/db/exportImport.ts src/db/exportImport.test.ts
git commit -m "feat(m2): captures in export/import (backward-compatible)"
```

---

## Task 9: Feature hook — `useCaptures`

Hand-rolled DB-state hook (the repo's convention; no `useLiveQuery`).

**Files:**
- Create: `src/features/sp-optimizer/useCaptures.ts`, `src/features/sp-optimizer/useCaptures.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/sp-optimizer/useCaptures.test.tsx
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';

import { useCaptures } from '@/features/sp-optimizer/useCaptures';

vi.mock('@/db', () => ({
  listCaptures: vi.fn(async () => []),
  saveCapture: vi.fn(async (d: { label: string; bundle: unknown }) => ({ id: 'id1', ...d })),
  deleteCapture: vi.fn(async () => undefined),
}));

afterEach(cleanup);

describe('useCaptures', () => {
  it('loads captures and exposes save/remove', async () => {
    const { result } = renderHook(() => useCaptures());
    await waitFor(() => expect(result.current.items).not.toBeNull());
    expect(result.current.items).toEqual([]);
    await act(async () => { await result.current.save('CM14', { schemaVersion: 1 } as never); });
    expect(result.current.error).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/sp-optimizer/useCaptures.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the hook**

```tsx
// src/features/sp-optimizer/useCaptures.ts
import { useCallback, useEffect, useState } from 'react';

import type { CaptureBundle } from '@/core/spOptimizer';
import { deleteCapture, listCaptures, saveCapture } from '@/db';
import type { StoredCapture } from '@/db/types';

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export interface CapturesState {
  items: StoredCapture[] | null; // null = initial load in flight
  error: string | null;
  save: (label: string, bundle: CaptureBundle) => Promise<StoredCapture | null>;
  remove: (id: string) => void;
}

export function useCaptures(): CapturesState {
  const [items, setItems] = useState<StoredCapture[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listCaptures()
      .then((rows) => { if (!cancelled) setItems(rows); })
      .catch((err: unknown) => { if (!cancelled) { setError(message(err)); setItems([]); } });
    return () => { cancelled = true; };
  }, []);

  const save = useCallback(async (label: string, bundle: CaptureBundle) => {
    try {
      const saved = await saveCapture({ label, bundle });
      setItems((prev) => [...(prev ?? []), saved]);
      return saved;
    } catch (err) { setError(message(err)); return null; }
  }, []);

  const remove = useCallback((id: string) => {
    deleteCapture(id)
      .then(() => setItems((prev) => (prev ?? []).filter((c) => c.id !== id)))
      .catch((err: unknown) => setError(message(err)));
  }, []);

  return { items, error, save, remove };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/features/sp-optimizer/useCaptures.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
pnpm typecheck
git add src/features/sp-optimizer/useCaptures.ts src/features/sp-optimizer/useCaptures.test.tsx
git commit -m "feat(m2): useCaptures DB-state hook"
```

---

## Task 10: UI — manual entry form (`BuildContextForm`)

Collects the build context + buyable rows + SP, and produces a `CaptureBundle` on submit. Tested in isolation (props in, bundle out).

**Files:**
- Create: `src/features/sp-optimizer/BuildContextForm.tsx`, `src/features/sp-optimizer/BuildContextForm.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/sp-optimizer/BuildContextForm.test.tsx
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { BuildContextForm } from '@/features/sp-optimizer/BuildContextForm';

afterEach(cleanup);

describe('BuildContextForm', () => {
  it('emits a CaptureBundle with the entered SP and one candidate', async () => {
    const user = userEvent.setup();
    const onAnalyze = vi.fn();
    render(<BuildContextForm onAnalyze={onAnalyze} />);

    await user.clear(screen.getByLabelText('Available SP'));
    await user.type(screen.getByLabelText('Available SP'), '500');
    await user.type(screen.getByLabelText('Skill id'), '200332');
    await user.type(screen.getByLabelText('On-screen SP cost'), '120');
    await user.click(screen.getByRole('button', { name: 'Add skill' }));
    await user.click(screen.getByRole('button', { name: 'Analyze' }));

    expect(onAnalyze).toHaveBeenCalledTimes(1);
    const bundle = onAnalyze.mock.calls[0]![0];
    expect(bundle.schemaVersion).toBe(1);
    expect(bundle.source).toBe('manual');
    expect(bundle.context.spBudget).toBe(500);
    expect(bundle.context.candidates).toHaveLength(1);
    expect(bundle.context.candidates[0].skillId).toBe('200332');
    expect(bundle.context.candidates[0].screenSpCost).toBe(120);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/sp-optimizer/BuildContextForm.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the component**

```tsx
// src/features/sp-optimizer/BuildContextForm.tsx
import { useState } from 'react';

import type { BuyableSkill, CaptureBundle } from '@/core/spOptimizer';
import type { Stat } from '@/core/types';
import type { Grade } from '@/sim/types';

const STATS: Stat[] = ['spd', 'sta', 'pow', 'gut', 'wit'];
const DEFAULT_STATS: Record<Stat, number> = { spd: 1000, sta: 800, pow: 800, gut: 400, wit: 600 };

export interface BuildContextFormProps {
  onAnalyze: (bundle: CaptureBundle) => void;
  dataVersion?: string;
  /** Clock injected so the component stays testable/deterministic. */
  now?: () => string;
}

export function BuildContextForm({ onAnalyze, dataVersion = 'global-c1fa2107', now }: BuildContextFormProps) {
  const [spBudget, setSpBudget] = useState(1000);
  const [courseId, setCourseId] = useState('10101');
  const [candidates, setCandidates] = useState<BuyableSkill[]>([]);
  const [draftId, setDraftId] = useState('');
  const [draftCost, setDraftCost] = useState('');

  function addCandidate() {
    if (!draftId.trim()) return;
    setCandidates((prev) => [
      ...prev,
      { skillId: draftId.trim(), rarity: 'white', screenSpCost: Number(draftCost) || 0 },
    ]);
    setDraftId('');
    setDraftCost('');
  }

  function analyze() {
    const bundle: CaptureBundle = {
      schemaVersion: 1,
      source: 'manual',
      capturedAt: now ? now() : new Date().toISOString(),
      server: 'global',
      dataVersion,
      seed: 12345,
      context: {
        umaId: '',
        stats: { ...DEFAULT_STATS },
        aptitudes: { distance: 'A' as Grade, surface: 'A' as Grade, strategy: 'A' as Grade },
        strategy: 'pace',
        courseId,
        spBudget,
        ownedSkills: [],
        pinned: [],
        candidates,
      },
    };
    onAnalyze(bundle);
  }

  return (
    <div className="sp-form">
      <label>
        Available SP
        <input
          type="number"
          value={spBudget}
          onChange={(e) => setSpBudget(Number(e.target.value))}
        />
      </label>
      <label>
        Course id
        <input value={courseId} onChange={(e) => setCourseId(e.target.value)} />
      </label>

      <fieldset>
        <legend>Buyable skill</legend>
        <label>
          Skill id
          <input value={draftId} onChange={(e) => setDraftId(e.target.value)} />
        </label>
        <label>
          On-screen SP cost
          <input type="number" value={draftCost} onChange={(e) => setDraftCost(e.target.value)} />
        </label>
        <button type="button" onClick={addCandidate}>Add skill</button>
      </fieldset>

      <ul className="sp-candidates">
        {candidates.map((c) => (
          <li key={c.skillId}>{c.skillId} — {c.screenSpCost} SP</li>
        ))}
      </ul>

      <button type="button" className="sp-analyze" onClick={analyze}>Analyze</button>
    </div>
  );
}
```

> **YAGNI note:** the MVP form keeps stats/aptitudes/strategy at sensible defaults with only SP + course + candidates editable, which is enough to exercise the optimizer end-to-end. A later iteration (still in Plan #1's UI task if time allows, else F3) can expose stat/aptitude/strategy editing and a `skillById` autocomplete; the `CaptureBundle` shape already carries them.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/features/sp-optimizer/BuildContextForm.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
pnpm typecheck
git add src/features/sp-optimizer/BuildContextForm.tsx src/features/sp-optimizer/BuildContextForm.test.tsx
git commit -m "feat(m2): manual BuildContext entry form → CaptureBundle"
```

---

## Task 11: UI — build cards + page + styles

Renders the ranked baskets and wires the form → `rankBaskets` → cards. Uses `useGameData()` for skill names/icons.

**Files:**
- Create: `src/features/sp-optimizer/BuildCards.tsx`, `src/features/sp-optimizer/BuildCards.test.tsx`
- Create: `src/features/sp-optimizer/SpOptimizerPage.tsx`
- Create: `src/features/sp-optimizer/sp-optimizer.css`

- [ ] **Step 1: Write the failing test (cards)**

```tsx
// src/features/sp-optimizer/BuildCards.test.tsx
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import { BuildCards } from '@/features/sp-optimizer/BuildCards';
import type { RankResult } from '@/features/sp-optimizer/rankBaskets';

vi.mock('@/features/data/gameData', async () => {
  const { fixtureGameData } = await import('@/features/testing/fixtureGameData');
  return { useGameData: () => fixtureGameData() };
});

afterEach(cleanup);

const RESULT: RankResult = {
  mode: 'exact',
  baskets: [
    { skills: ['200332'], score: 2.4, spUsed: 120, spLeft: 380, descriptor: '+2.4 lengths · tight spread' },
    { skills: ['200331'], score: 1.1, spUsed: 160, spLeft: 340, descriptor: '+1.1 lengths · moderate spread' },
  ],
};

describe('BuildCards', () => {
  it('renders one card per basket with SP used/left and the descriptor', () => {
    render(<BuildCards result={RESULT} />);
    expect(screen.getAllByRole('article')).toHaveLength(2);
    expect(screen.getByText('+2.4 lengths · tight spread')).toBeInTheDocument();
    expect(screen.getByText(/120 SP used/)).toBeInTheDocument();
  });

  it('shows the exact/estimate provenance label', () => {
    render(<BuildCards result={RESULT} />);
    expect(screen.getByText(/exact ranking/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/sp-optimizer/BuildCards.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the cards component**

```tsx
// src/features/sp-optimizer/BuildCards.tsx
import { GameIcon, useGameData } from '@/features/data/gameData';
import type { RankResult } from '@/features/sp-optimizer/rankBaskets';

export interface BuildCardsProps {
  result: RankResult;
}

export function BuildCards({ result }: BuildCardsProps) {
  const { skillById } = useGameData();
  if (result.baskets.length === 0) {
    return <p className="muted">No feasible baskets — lower the budget floor or add candidates.</p>;
  }
  return (
    <div className="sp-cards">
      <p className="small muted">
        {result.mode === 'exact'
          ? 'Exact ranking (every feasible basket simulated).'
          : 'Shortlisted estimate (proxy-narrowed, then simulated).'}
      </p>
      {result.baskets.map((b, i) => (
        <article key={b.skills.join(',')} className="sp-card">
          <header>
            <span className="sp-rank">#{i + 1}</span>
            <span className="sp-descriptor">{b.descriptor}</span>
          </header>
          <ul className="sp-card-skills">
            {b.skills.map((id) => {
              const skill = skillById.get(id);
              return (
                <li key={id}>
                  {skill && <GameIcon kind="skill" id={skill.iconId} size={20} alt="" />}
                  {skill?.nameEn ?? `Skill ${id}`}
                </li>
              );
            })}
          </ul>
          <footer className="small">{b.spUsed} SP used · {b.spLeft} SP left</footer>
        </article>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/features/sp-optimizer/BuildCards.test.tsx`
Expected: PASS.

- [ ] **Step 5: Write the page + CSS (no new test — covered by component tests + manual run)**

```tsx
// src/features/sp-optimizer/SpOptimizerPage.tsx
import { useState } from 'react';

import type { CaptureBundle } from '@/core/spOptimizer';
import { useGameData } from '@/features/data/gameData';
import { BuildCards } from '@/features/sp-optimizer/BuildCards';
import { BuildContextForm } from '@/features/sp-optimizer/BuildContextForm';
import { type RankResult, rankBaskets } from '@/features/sp-optimizer/rankBaskets';
import './sp-optimizer.css';

export function SpOptimizerPage() {
  const { status } = useGameData();
  const [result, setResult] = useState<RankResult | null>(null);

  function analyze(bundle: CaptureBundle) {
    setResult(rankBaskets(bundle));
  }

  return (
    <div className="page">
      <section className="panel" aria-labelledby="sp-h">
        <h2 id="sp-h">SP Purchase Optimizer</h2>
        <p className="muted small">
          Post-run, SP-limited. Enter the skills on your purchase screen, their on-screen costs, and
          your available SP. Costs are read from the screen — never calculated.
        </p>
        <p className="sp-caveat small" role="note">
          Estimates, not verdicts — the sim can’t see positional chaos (P3).
        </p>
        {status === 'fixture' && (
          <p className="error" role="alert">Running on placeholder data — results are illustrative.</p>
        )}
        <BuildContextForm onAnalyze={analyze} />
      </section>

      {result && (
        <section className="panel" aria-labelledby="sp-results-h">
          <h2 id="sp-results-h">Suggested baskets</h2>
          <BuildCards result={result} />
        </section>
      )}
    </div>
  );
}
```

```css
/* src/features/sp-optimizer/sp-optimizer.css */
.sp-form { display: grid; gap: 0.5rem; max-width: 32rem; }
.sp-form label { display: grid; gap: 0.15rem; }
.sp-candidates { margin: 0.25rem 0; padding-left: 1rem; }
.sp-analyze { justify-self: start; }
.sp-caveat { color: var(--warn, #b26a00); }
.sp-cards { display: grid; gap: 0.75rem; }
.sp-card { border: 1px solid var(--border, #ccc); border-radius: 0.5rem; padding: 0.6rem; }
.sp-card header { display: flex; justify-content: space-between; align-items: baseline; }
.sp-rank { font-weight: 700; }
.sp-card-skills { list-style: none; padding: 0; margin: 0.4rem 0; display: grid; gap: 0.2rem; }
.sp-card-skills li { display: flex; align-items: center; gap: 0.35rem; }
```

- [ ] **Step 6: Typecheck + commit**

```bash
pnpm typecheck
git add src/features/sp-optimizer/BuildCards.tsx src/features/sp-optimizer/BuildCards.test.tsx src/features/sp-optimizer/SpOptimizerPage.tsx src/features/sp-optimizer/sp-optimizer.css
git commit -m "feat(m2): build cards + SP optimizer page + styles"
```

---

## Task 12: Wire routing + enable the nav

**Files:**
- Modify: `src/app/App.tsx`

- [ ] **Step 1: Edit `src/app/App.tsx`** — four changes:

```tsx
// 1) add the page import near the other feature-page imports:
import { SpOptimizerPage } from '@/features/sp-optimizer/SpOptimizerPage';

// 2) drop 'SP Optimizer' from the stub tuple:
const STUB_MODULES = ['Inheritance', 'Meta Intel'] as const;

// 3) add a NavLink inside <nav aria-label="Modules"> (after the Parents link):
<NavLink to="/sp-optimizer" className={navItemClass}>
  SP Optimizer
</NavLink>

// 4) add a Route inside <Routes>, BEFORE the catch-all "*" route:
<Route path="/sp-optimizer" element={<SpOptimizerPage />} />
```

- [ ] **Step 2: Typecheck + build + manual smoke**

Run: `pnpm typecheck && pnpm build`
Expected: clean. Then `pnpm dev`, open the app, click **SP Optimizer**, add a couple of skills + SP, click **Analyze**, confirm cards render. (Skill names resolve only for ids present in the dataset.)

- [ ] **Step 3: Commit**

```bash
git add src/app/App.tsx
git commit -m "feat(m2): enable SP Optimizer nav + route"
```

---

## Task 13: Validation gate

Lock in determinism + the optimizer invariants in code, and record the VFalator spot-check procedure for the manual half of the gate (spec §6).

**Files:**
- Create: `src/features/sp-optimizer/rankBaskets.validation.test.ts`
- Modify: `docs/mechanics-notes.md`

- [ ] **Step 1: Write the validation test** (real engine, fixed seed)

```ts
// src/features/sp-optimizer/rankBaskets.validation.test.ts
/**
 * Plan #1 exit gate (spec §6). Uses the REAL vendored engine (no injected
 * fake) with the fixture bundle's fixed seed, asserting determinism and the
 * exact-branch invariants. Single-skill Δ-L vs VFalator is a MANUAL check
 * (see docs/mechanics-notes.md §11).
 */
import { describe, expect, it } from 'vitest';

import type { CaptureBundle } from '@/core/spOptimizer';
import { rankBaskets } from '@/features/sp-optimizer/rankBaskets';
import bundle from '@/core/__fixtures__/m2/basic-screen.json';

describe('rankBaskets validation (real engine, fixed seed)', () => {
  it('is deterministic across runs with the same seed', () => {
    const a = rankBaskets(bundle as CaptureBundle, { nsamples: 64 });
    const b = rankBaskets(bundle as CaptureBundle, { nsamples: 64 });
    expect(a.baskets).toEqual(b.baskets);
  });

  it('returns ≤3 baskets, each within budget, ranked descending', () => {
    const r = rankBaskets(bundle as CaptureBundle, { nsamples: 64 });
    expect(r.baskets.length).toBeLessThanOrEqual(3);
    for (const b of r.baskets) expect(b.spUsed).toBeLessThanOrEqual((bundle as CaptureBundle).context.spBudget);
    const scores = r.baskets.map((b) => b.score);
    expect(scores).toEqual([...scores].sort((x, y) => y - x));
  });
});
```

- [ ] **Step 2: Run it**

Run: `pnpm vitest run src/features/sp-optimizer/rankBaskets.validation.test.ts`
Expected: PASS. If the fixture's skill ids aren't simulatable in the vendored data, swap them for ids confirmed simulatable (e.g. `'200332'`) and re-run.

- [ ] **Step 3: Record the manual VFalator procedure** — append a section to `docs/mechanics-notes.md`:

```markdown
## 11. M2 SP-optimizer validation (Plan #1 gate)

- **Automated (`rankBaskets.validation.test.ts`):** deterministic output for a
  fixed seed; ≤3 baskets; each within budget; ranked on simulated combined Δ-L;
  the pure core's exact branch == brute-force enumeration (`spOptimizer.test.ts`).
- **Manual vs VFalator (≥3 skills):** for the fixture build, run VFalator on the
  same course/strategy/stats and compare single-skill Δ-lengths against
  `evalSkillDelta` for ≥3 spot-checked skills; record date + numbers here.
  Within Monte-Carlo noise = pass.
- **Deferred (needs adapter telemetry):** per-basket phase profile (early/mid/late,
  stamina margin) — the adapter currently exposes only BashinStats, so v1 shows a
  distribution descriptor (Δ-lengths + spread), not a phase profile.
```

- [ ] **Step 4: Full suite + commit**

```bash
pnpm test
# Expected: all prior 300 tests + the new M2 tests pass.
git add src/features/sp-optimizer/rankBaskets.validation.test.ts docs/mechanics-notes.md
git commit -m "test(m2): validation gate + record VFalator spot-check procedure"
```

---

## Self-review notes (author)

- **Spec coverage:** §2a MVP units → Tasks 1–13. §4 adaptive hybrid → Tasks 2–6 (exact branch T2/T5, shortlist T4, sim+rank T6). `CaptureBundle` (§3) → T1 type, T6 fixture, T7 store, T8 export. Manual input (§3.1.1) → T10. 3 build cards (§5) → T11. Persistence (§7) → T7/T8/T9. Validation (§6) → T13.
- **Deliberately deferred (recorded, not dropped):** OCR (F1), compare-vs-veteran + RosterEntry (F2), CmPlan/roster pre-fill + canonical-CmPlan transcription (F3), video-sync (F4), full stat/aptitude/strategy form editing + skill autocomplete (T10 note), phase-level emergent profile (needs adapter telemetry — T13 note).
- **Honest scope correction vs spec:** v1 ranks on **simulated combined Δ-lengths** and shows a distribution descriptor; "win-rate" + phase profiles ride on the vacuum-compare / telemetry that belong to F2 / a future adapter change. This is called out in T6/T13 and the spec §4/§5 already gate the profile on "to the extent telemetry supports it" (P3).
- **Type consistency:** `BuildContext`/`BuyableSkill`/`CaptureBundle`/`ScoredBasket` defined in T1/T3 and consumed unchanged in T6–T11; `StoredCapture` in T7 consumed in T8/T9; `RankResult`/`RankedBasket` in T6 consumed in T11.
```
