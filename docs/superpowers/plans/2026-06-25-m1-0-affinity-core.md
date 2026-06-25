# M1.0 — Affinity core (2.0 win-bonus + per-member spark wiring) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pure M1 affinity-core math — the 2.0 G1-only win-bonus, wire computed per-member affinity into spark.ts (de-approximating proc chances), add `Parent.wonRaces`, and a rental target-tier helper.

**Architecture:** All pure `src/core/` functions, unit-tested (P6). `winBonus.ts` computes the 2.0 race bonus into the `winBonus` object `affinity.ts`'s `computeLineageAffinity` already accepts; a `lineageAffinity.ts` adapter maps planner `Parent`s → that pipeline; `spark.ts` gains an optional per-member affinity resolver so the workbench feeds real scores instead of the approximate `affinityHint` total.

**Tech Stack:** TypeScript, Vitest. Path alias `@/*` → `src/*`. No new dependencies.

## Global Constraints

- **Pure core only** — no UI, no new deps (spec §3–§4).
- **2.0 rule (mechanics-notes §3):** only shared **G1** wins count, **+3 each** (`sg(X,Y) = 3 × |g1(X) ∩ g1(Y)|`); no G2/G3, no titles. `wonRaces` holds **G1** race ids (the importer filters to G1 — follow-on §6).
- **Honest numbers (P3):** absent `wonRaces` ⇒ win-bonus contributes **0** (floor); a spark contribution is `approximate:false` **only** when a real per-member score is supplied (else the `affinityHint` fallback stays `approximate:true`); rental affinity is a **target**, never computed.
- **Tier thresholds (unchanged by 2.0):** ○ ≥ 51, ◎ ≥ 151 (`affinity.ts` `affinityTier`).
- **Verification:** `pnpm typecheck` + `pnpm test` + `pnpm build` green. Run vitest with **no `pnpm dev` server running** (CLAUDE.md flake). A dev server is currently up — stop it before the full-suite gate.

---

## File Structure

- **Create** `src/core/winBonus.ts` — `sharedG1`, `computeWinBonus`, the `WinBonus*` types. Pure 2.0 race bonus.
- **Create** `src/core/winBonus.test.ts`.
- **Create** `src/core/lineageAffinity.ts` — `planLineageAffinity(idx, traineeUmaId, parentA, parentB)`: maps planner `Parent`s → `computeLineageAffinity` with the 2.0 `winBonus`.
- **Create** `src/core/lineageAffinity.test.ts`.
- **Modify** `src/core/types.ts` — add `wonRaces?: string[]` to `Parent` and `ParentRef`.
- **Modify** `src/core/spark.ts` (+ `src/core/spark.test.ts`) — optional `opts.memberAffinity` resolver.
- **Modify** `src/core/affinity.ts` (+ `src/core/affinity.test.ts`) — `tierThreshold` + `affinityNeededForTier`.
- **Modify** `docs/modules/module-1-inheritance.md`, `docs/roadmap.md` — record M1.0.

---

### Task 1: `winBonus.ts` — pure 2.0 win-bonus

**Files:**
- Create: `src/core/winBonus.ts`
- Test: `src/core/winBonus.test.ts`

**Interfaces:**
- Produces: `sharedG1(a?: string[], b?: string[]): number`; `computeWinBonus(lin: WinBonusLineage): WinBonus`; types `WinBonusMember = { wonRaces?: string[] }`, `WinBonusLineage = { parentA, parentB, gA1?, gA2?, gB1?, gB2?: WinBonusMember }`, `WinBonus = { parentA, parentB, gA1, gA2, gB1, gB2: number }`. The `WinBonus` shape is assignable to `affinity.ts` `Lineage['winBonus']` (Task 2 consumes it).

- [ ] **Step 1: Write the failing test** `src/core/winBonus.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { computeWinBonus, sharedG1 } from './winBonus';

describe('sharedG1 (2.0: +3 per shared G1 race)', () => {
  it('is 0 for disjoint or missing sets', () => {
    expect(sharedG1(['1001'], ['1002'])).toBe(0);
    expect(sharedG1(undefined, ['1001'])).toBe(0);
    expect(sharedG1(['1001'], [])).toBe(0);
  });
  it('grants +3 per shared id (deduped)', () => {
    expect(sharedG1(['1001'], ['1001'])).toBe(3);
    expect(sharedG1(['1001', '1002', '1003'], ['1002', '1003'])).toBe(6);
    expect(sharedG1(['1001', '1001'], ['1001'])).toBe(3); // dedupe
  });
});

describe('computeWinBonus (full 6-member assembly)', () => {
  it('routes shared G1 wins to each member per mechanics-notes §3', () => {
    // P1 shares race 'A' with P2, 'B' with its gA1; P2 shares 'C' with its gB2.
    const wb = computeWinBonus({
      parentA: { wonRaces: ['A', 'B'] },
      parentB: { wonRaces: ['A', 'C'] },
      gA1: { wonRaces: ['B'] },
      gA2: { wonRaces: [] },
      gB1: { wonRaces: [] },
      gB2: { wonRaces: ['C'] },
    });
    // sg(P1,P2)=3 (A); sg(P1,gA1)=3 (B); sg(P2,gB2)=3 (C); others 0
    expect(wb).toEqual({
      parentA: 6, // sg(P1,P2)=3 + sg(P1,gA1)=3 + sg(P1,gA2)=0
      parentB: 6, // sg(P2,P1)=3 + sg(P2,gB1)=0 + sg(P2,gB2)=3
      gA1: 3,
      gA2: 0,
      gB1: 0,
      gB2: 3,
    });
  });
  it('is all-zero when no wonRaces are present', () => {
    expect(computeWinBonus({ parentA: {}, parentB: {} })).toEqual({
      parentA: 0, parentB: 0, gA1: 0, gA2: 0, gB1: 0, gB2: 0,
    });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run src/core/winBonus.test.ts`
Expected: FAIL — cannot resolve `./winBonus`.

- [ ] **Step 3: Write `src/core/winBonus.ts`**:

```ts
/**
 * 2.0 compatibility overhaul (docs/mechanics-notes.md §3): only shared
 * Grade-1 (G1) wins grant a compatibility bonus, at +3 each — G2/G3 races and
 * Triple Crown/Tiara titles give 0. `wonRaces` holds G1 race ids (the
 * UmaExtractor importer filters to G1; see the M1.0 spec §6). Pure: the
 * resulting `WinBonus` feeds affinity.ts's already-injected `Lineage.winBonus`.
 */
export interface WinBonusMember {
  /** G1 race ids this member won (absent ⇒ contributes 0). */
  wonRaces?: string[];
}

export interface WinBonusLineage {
  parentA: WinBonusMember;
  parentB: WinBonusMember;
  gA1?: WinBonusMember;
  gA2?: WinBonusMember;
  gB1?: WinBonusMember;
  gB2?: WinBonusMember;
}

export interface WinBonus {
  parentA: number;
  parentB: number;
  gA1: number;
  gA2: number;
  gB1: number;
  gB2: number;
}

/** +3 per shared (deduped) G1 race id; 0 for missing/empty/disjoint sets. */
export function sharedG1(a: string[] | undefined, b: string[] | undefined): number {
  if (!a || !b || a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  let shared = 0;
  for (const id of new Set(a)) if (setB.has(id)) shared += 1;
  return shared * 3;
}

export function computeWinBonus(lin: WinBonusLineage): WinBonus {
  const { parentA, parentB, gA1, gA2, gB1, gB2 } = lin;
  const aToB = sharedG1(parentA.wonRaces, parentB.wonRaces);
  const aTo1 = sharedG1(parentA.wonRaces, gA1?.wonRaces);
  const aTo2 = sharedG1(parentA.wonRaces, gA2?.wonRaces);
  const bTo1 = sharedG1(parentB.wonRaces, gB1?.wonRaces);
  const bTo2 = sharedG1(parentB.wonRaces, gB2?.wonRaces);
  return {
    parentA: aToB + aTo1 + aTo2,
    parentB: aToB + bTo1 + bTo2,
    gA1: aTo1,
    gA2: aTo2,
    gB1: bTo1,
    gB2: bTo2,
  };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm vitest run src/core/winBonus.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/winBonus.ts src/core/winBonus.test.ts
git commit -m "feat(m1): 2.0 G1-only win-bonus core (winBonus.ts)"
```

---

### Task 2: `Parent.wonRaces` field + `lineageAffinity` adapter

**Files:**
- Modify: `src/core/types.ts` (the `Parent` and `ParentRef` interfaces)
- Create: `src/core/lineageAffinity.ts`
- Test: `src/core/lineageAffinity.test.ts`

**Interfaces:**
- Consumes: `computeWinBonus`/`WinBonus` (Task 1); `affinity.ts` `charaIdOf`, `computeLineageAffinity`, `AffinityIndex`; `types.ts` `Parent`, `LineageAffinity`.
- Produces: `planLineageAffinity(idx: AffinityIndex, traineeUmaId: string, parentA: Parent, parentB: Parent): LineageAffinity`.

- [ ] **Step 1: Add `wonRaces` to the model.** In `src/core/types.ts`, add to the `ParentRef` interface (after `whiteSparks?`):

```ts
  /** G1 race ids this grandparent won (UmaExtractor; powers the 2.0 win-bonus). */
  wonRaces?: string[];
```

and to the `Parent` interface (after `affinityHint?`):

```ts
  /** G1 race ids this parent won (UmaExtractor; powers the 2.0 win-bonus). */
  wonRaces?: string[];
```

- [ ] **Step 2: Write the failing test** `src/core/lineageAffinity.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildAffinityIndex } from './affinity';
import { planLineageAffinity } from './lineageAffinity';
import type { Parent } from './types';

// Two relation groups so aff2/aff3 are non-zero; charaId = floor(umaId/100).
const idx = buildAffinityIndex([
  { relationType: 1, point: 10, members: [10, 20, 30] }, // charas 10,20,30 share type 1
  { relationType: 2, point: 5, members: [10, 20] },      // charas 10,20 share type 2
]);

function parent(umaId: string, wonRaces: string[], gpUmaId?: string, gpWon: string[] = []): Parent {
  return {
    id: `p-${umaId}`,
    umaId,
    blueSpark: { stat: 'speed', stars: 1 },
    pinkSpark: { aptitude: 'turf', stars: 1 },
    whiteSparks: [],
    wonRaces,
    grandparents: gpUmaId ? [{ umaId: gpUmaId, wonRaces: gpWon }, undefined] : undefined,
    source: 'mine',
  };
}

describe('planLineageAffinity', () => {
  it('folds the 2.0 win-bonus into each member score', () => {
    // trainee chara 10 (uma "1000"); parentA chara 20 (uma "2000") shares race 'X' with parentB.
    const A = parent('2000', ['X']);
    const B = parent('3000', ['X']);
    const res = planLineageAffinity(idx, '1000', A, B);
    // aff2(10,20) over shared types: type1(10)+type2(5)=15; aff2(20,30)=type1=10.
    // parentA score = aff2(T,A)=15 + aff2(A,B)=10 + 0 gp + winBonus.parentA(=sg(A,B)=3) = 28
    expect(res.memberScores.parentA).toBe(28);
  });
  it('win-bonus is 0 when wonRaces are absent', () => {
    const A = parent('2000', []);
    const B = parent('3000', []);
    const res = planLineageAffinity(idx, '1000', A, B);
    // parentA = aff2(T,A)15 + aff2(A,B)10 + 0 = 25
    expect(res.memberScores.parentA).toBe(25);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `pnpm vitest run src/core/lineageAffinity.test.ts`
Expected: FAIL — cannot resolve `./lineageAffinity`.

- [ ] **Step 4: Write `src/core/lineageAffinity.ts`**:

```ts
/**
 * Adapter: planner `Parent`s → the affinity pipeline, computing the 2.0 win
 * bonus (winBonus.ts) and folding it into `computeLineageAffinity`. The
 * per-member scores it returns feed spark.ts (de-approximated proc chances).
 */
import { type AffinityIndex, charaIdOf, computeLineageAffinity } from '@/core/affinity';
import { computeWinBonus } from '@/core/winBonus';
import type { LineageAffinity, Parent } from '@/core/types';

export function planLineageAffinity(
  idx: AffinityIndex,
  traineeUmaId: string,
  parentA: Parent,
  parentB: Parent,
): LineageAffinity {
  const gpChara = (p: Parent, i: 0 | 1): number | undefined => {
    const gp = p.grandparents?.[i];
    return gp ? charaIdOf(gp.umaId) : undefined;
  };
  const winBonus = computeWinBonus({
    parentA: { wonRaces: parentA.wonRaces },
    parentB: { wonRaces: parentB.wonRaces },
    gA1: { wonRaces: parentA.grandparents?.[0]?.wonRaces },
    gA2: { wonRaces: parentA.grandparents?.[1]?.wonRaces },
    gB1: { wonRaces: parentB.grandparents?.[0]?.wonRaces },
    gB2: { wonRaces: parentB.grandparents?.[1]?.wonRaces },
  });
  return computeLineageAffinity(idx, {
    trainee: charaIdOf(traineeUmaId),
    parentA: charaIdOf(parentA.umaId),
    parentB: charaIdOf(parentB.umaId),
    gA1: gpChara(parentA, 0),
    gA2: gpChara(parentA, 1),
    gB1: gpChara(parentB, 0),
    gB2: gpChara(parentB, 1),
    winBonus,
  });
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `pnpm vitest run src/core/lineageAffinity.test.ts && pnpm typecheck`
Expected: PASS (2 tests) + typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add src/core/types.ts src/core/lineageAffinity.ts src/core/lineageAffinity.test.ts
git commit -m "feat(m1): Parent.wonRaces + planLineageAffinity (2.0 win-bonus wired into affinity)"
```

---

### Task 3: `spark.ts` per-member affinity resolver (de-approximate)

**Files:**
- Modify: `src/core/spark.ts` (the `sparkChance` `opts` + the two scaling sites)
- Test: `src/core/spark.test.ts` (add cases)

**Interfaces:**
- Consumes: nothing new (the workbench supplies the resolver from `planLineageAffinity().memberScores` at the M1.4 call site).
- Produces: `sparkChance` accepts `opts.memberAffinity?: (ctx: { parentId: string; grandparent: boolean; gpIndex: number }) => number | undefined`. When it returns a number, that score is used and the contribution is `approximate:false`; otherwise the existing `affinityHint`/`grandparentAffinity` fallback applies (unchanged).

- [ ] **Step 1: Write the failing test.** Append to `src/core/spark.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { sparkChance } from './spark';
import type { Parent, SparkRates } from './types';

// Minimal rates: base white-skill 3/6/9, 2 inspiration events (mechanics-notes §1–§2).
const RATES = {
  inspirationEvents: 2,
  baseProcPctByStars: { whiteSkill: [3, 6, 9], green: [5, 10, 15] },
} as unknown as SparkRates;

function whiteParent(affinityHint: number | undefined): Parent {
  return {
    id: 'pX', umaId: '2000',
    blueSpark: { stat: 'speed', stars: 1 }, pinkSpark: { aptitude: 'turf', stars: 1 },
    whiteSparks: [{ skillId: '200001', stars: 3 }],
    affinityHint, source: 'mine',
  };
}

describe('sparkChance memberAffinity resolver', () => {
  it('uses the resolver score and drops the approximate flag', () => {
    const withResolver = sparkChance({
      parents: [whiteParent(100)], skillId: '200001', rates: RATES,
      opts: { memberAffinity: () => 30 },
    });
    const fallback = sparkChance({
      parents: [whiteParent(100)], skillId: '200001', rates: RATES,
    });
    expect(withResolver.approximate).toBe(false);
    expect(fallback.approximate).toBe(true);
    // affinity 30 ≠ 100 ⇒ a strictly smaller per-event chance ⇒ smaller pct
    expect(withResolver.pct).toBeLessThan(fallback.pct);
  });
  it('falls back to affinityHint when the resolver returns undefined', () => {
    const res = sparkChance({
      parents: [whiteParent(0)], skillId: '200001', rates: RATES,
      opts: { memberAffinity: () => undefined },
    });
    expect(res.approximate).toBe(false); // affinityHint===0 is the honest floor (existing rule)
    expect(res.contributions[0]!.affinityUsed).toBe(0);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run src/core/spark.test.ts -t "memberAffinity"`
Expected: FAIL — `opts.memberAffinity` not honored (the resolver result is ignored; first assertion fails).

- [ ] **Step 3: Implement the resolver in `src/core/spark.ts`.** Add the field to the `opts` type on `sparkChance` (and mirror it on `combinedSparkChance`'s `opts`):

```ts
    grandparentAffinity?: number;
    /** Resolve a contribution's computed per-member affinity (M1 affinity).
     *  When it returns a number, that score is used and the contribution is
     *  NOT approximate; undefined ⇒ fall back to affinityHint/grandparentAffinity. */
    memberAffinity?: (ctx: { parentId: string; grandparent: boolean; gpIndex: number }) => number | undefined;
    skillRarity?: ReadonlyMap<string, SkillRarity> | ((skillId: string) => SkillRarity | undefined);
```

In the **parent-held** loop, replace the affinity/approx selection before `for (const spark of matching)`:

```ts
    // Computed per-member affinity (M1) de-approximates; else the affinityHint fallback.
    const computedParent = opts?.memberAffinity?.({ parentId: parent.id, grandparent: false, gpIndex: -1 });
    const useAffinity = computedParent ?? parentAffinity;
    const useApprox = computedParent !== undefined ? false : parentApprox;
    for (const spark of matching) {
      const pEvent = perEventChance(baseProcPct(rates, spark.family, spark.stars), useAffinity);
      contributions.push({
        parentId: parent.id,
        grandparent: false,
        stars: spark.stars,
        affinityUsed: useAffinity,
        pct: perCareerChance(pEvent, rates) * 100,
        approximate: useApprox,
      });
      if (useApprox) approximate = true;
    }
```

In the **grandparent** loop, add an index and resolve per gp:

```ts
    const gpAffinity = opts?.grandparentAffinity ?? 0;
    const gps = parent.grandparents ?? [];
    for (let gpIndex = 0; gpIndex < gps.length; gpIndex++) {
      const gp = gps[gpIndex];
      const computedGp = opts?.memberAffinity?.({ parentId: parent.id, grandparent: true, gpIndex });
      const gpUseAffinity = computedGp ?? gpAffinity;
      const gpApprox = computedGp === undefined; // computed ⇒ exact; fallback floor ⇒ approximate
      for (const spark of gp?.whiteSparks ?? []) {
        if (spark.skillId !== skillId) continue;
        if (!isWhiteSparkTarget(spark.skillId)) continue;
        const pEvent = perEventChance(baseProcPct(rates, 'whiteSkill', spark.stars), gpUseAffinity);
        contributions.push({
          parentId: parent.id,
          grandparent: true,
          stars: spark.stars,
          affinityUsed: gpUseAffinity,
          pct: perCareerChance(pEvent, rates) * 100,
          approximate: gpApprox,
        });
        if (gpApprox) approximate = true;
      }
    }
```

(Remove the old `for (const gp of parent.grandparents ?? [])` block and the unconditional `approximate = true` it set.)

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm vitest run src/core/spark.test.ts`
Expected: PASS (the existing spark tests + the two new `memberAffinity` cases).

- [ ] **Step 5: Commit**

```bash
git add src/core/spark.ts src/core/spark.test.ts
git commit -m "feat(m1): spark.ts per-member affinity resolver (de-approximate proc chances)"
```

---

### Task 4: Rental target-tier helper

**Files:**
- Modify: `src/core/affinity.ts` (append two functions)
- Test: `src/core/affinity.test.ts` (add cases)

**Interfaces:**
- Produces: `tierThreshold(tier: '○' | '◎'): number`; `affinityNeededForTier(computablePart: number, tier: '○' | '◎'): number`.

- [ ] **Step 1: Write the failing test.** Append to `src/core/affinity.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { affinityNeededForTier, tierThreshold } from './affinity';

describe('rental target-tier helper', () => {
  it('thresholds match the tier breakpoints', () => {
    expect(tierThreshold('○')).toBe(51);
    expect(tierThreshold('◎')).toBe(151);
  });
  it('affinity needed = max(0, threshold − computable part)', () => {
    expect(affinityNeededForTier(40, '○')).toBe(11);
    expect(affinityNeededForTier(60, '○')).toBe(0);
    expect(affinityNeededForTier(100, '◎')).toBe(51);
    expect(affinityNeededForTier(151, '◎')).toBe(0);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run src/core/affinity.test.ts -t "rental target-tier"`
Expected: FAIL — `tierThreshold`/`affinityNeededForTier` not exported.

- [ ] **Step 3: Append to `src/core/affinity.ts`**:

```ts
/** Affinity score a member must reach for a compatibility tier (matches
 *  affinityTier: ○ ≥ 51, ◎ ≥ 151). Used for rental Parent-2 target mode. */
export function tierThreshold(tier: '○' | '◎'): number {
  return tier === '◎' ? 151 : 51;
}

/** Affinity a rental Parent 2 must still supply to reach `tier`, given the
 *  computable part of the lineage's score. Never negative. */
export function affinityNeededForTier(computablePart: number, tier: '○' | '◎'): number {
  return Math.max(0, tierThreshold(tier) - computablePart);
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm vitest run src/core/affinity.test.ts`
Expected: PASS (existing affinity tests + the 2 new cases).

- [ ] **Step 5: Commit**

```bash
git add src/core/affinity.ts src/core/affinity.test.ts
git commit -m "feat(m1): rental target-tier helper (affinityNeededForTier)"
```

---

### Task 5: Record M1.0 (docs) + full gate

**Files:**
- Modify: `docs/modules/module-1-inheritance.md`, `docs/roadmap.md`

- [ ] **Step 1: Run the full gate.** Stop any running `pnpm dev` first, then:

Run: `pnpm typecheck && pnpm test && pnpm build`
Expected: all PASS. Record the new total test count.

- [ ] **Step 2: Update `docs/roadmap.md`.** In the M1 build-order list, change the M1.0 line's box and append a status note:

```md
- 🟧 **M1.0 — Core math.** *Landed (logic) 2026-06-25:* `winBonus.ts` (2.0 G1-only +3), `lineageAffinity.ts` adapter, `spark.ts` per-member affinity resolver (de-approximates), `Parent.wonRaces`, rental target-tier helper. **Live pending** the UmaExtractor `wonRaces` import (follow-on) + the S1 base-relation refresh. Spec/plan 2026-06-25.
```

- [ ] **Step 2b: Update the status-tracker row** for the M1 workbench with `M1.0 logic done; importer/data follow-on`.

- [ ] **Step 3: Update `docs/modules/module-1-inheritance.md`.** Add a short "M1.0 affinity core (2026-06-25)" note: the four pure additions (`winBonus.ts`, `lineageAffinity.ts`, `spark.ts` resolver, rental tier helper), that the 2.0 model is logic-complete and data-gated on the importer, and a pointer to mechanics-notes §3 + the M1.0 spec.

- [ ] **Step 4: Commit**

```bash
git add docs/modules/module-1-inheritance.md docs/roadmap.md
git commit -m "docs(m1): record M1.0 affinity core landing"
```

---

## Self-Review

**Spec coverage** (spec §→task):
- §3.1 `Parent.wonRaces` → Task 2. ✓
- §3.2 `winBonus.ts` (`sharedG1`, `computeWinBonus`) → Task 1. ✓
- §3.3 `spark.ts` per-member wiring (+ the adapter that surfaces `memberScores`) → Task 3 (resolver) + Task 2 (`planLineageAffinity`). ✓
- §3.4 rental target-tier helper → Task 4. ✓
- §5 validation (winBonus synthetic fixtures, spark de-approx, rental-tier) → Tasks 1/3/4 tests. ✓
- §6 follow-on (UmaExtractor `wonRaces`, S1 refresh) → out of scope, recorded in Task 5 docs. ✓

**Placeholder scan:** no TBD/TODO; every step has concrete code + commands. ✓

**Type consistency:** `WinBonus` (Task 1) is consumed by `computeWinBonus`→`Lineage.winBonus` in Task 2 (`affinity.ts` reads `w.parentA ?? 0` etc. — all six fields present, assignable). `planLineageAffinity` (Task 2) returns `LineageAffinity` whose `memberScores` feed the M1.4 call site that builds the Task-3 `memberAffinity` resolver. `tierThreshold`/`affinityNeededForTier` names match between Task 4 code and test. `sparkChance` `opts.memberAffinity` signature identical in the Task-3 type, implementation, and test. ✓
