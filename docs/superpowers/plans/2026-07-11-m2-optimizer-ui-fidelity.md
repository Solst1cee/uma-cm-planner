# M2 SP Optimizer — Tab 1 to full fidelity: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `/sp-optimizer` Tab 1 ("Optimize basket") to the "Option 1a" design-handoff fidelity — an interactive buyable-skills table (lock · ΔL · cost · L/SP · hint) feeding a result banner and three selectable simulated basket cards, plus shared chrome (source control, Build & SP card, Load-uma-plan lock-prefill, two-tab shell with an F2 placeholder).

**Architecture:** Pure selection/cost math stays in `src/core/` (`spOptimizer.ts`, `cost.ts` — both already exist). The sim orchestrator `rankBaskets` (features layer) is widened to also return per-candidate rows + a greedy-comparison score (reusing the ΔL it already computes). The page becomes a two-tab shell holding working state (pins / cost edits / hint edits / Fast-Learner / selected basket / stale flag); an explicit **Re-analyze** button re-runs the async engine seam. Presentational components render from `RankResult` + working state.

**Tech Stack:** TypeScript, React 19, Vite, Vitest (jsdom), the vendored Rust/WASM umalator engine (`@/sim`), Dexie captures store.

## Global Constraints

- **Costs come from the screen; cost math already exists** — use `src/core/cost.ts` (`purchaseSpCost` / `effectiveSpCost` / `bundledSpCost`). Do NOT write new cost formulas. Hint schedule is cumulative 10/20/30/35/40% (Lv1–5) + Fast Learner +10% ADDITIVE, ceil after summing, gold bundles white prereq (mechanics-notes §7).
- **Honest numbers (P3):** cards show mean +L + consistency spread + generic "Basket #k" only. NO "% win vs field", NO fabricated named profiles, NO career-rank badge (not in the capture).
- **Re-run is explicit:** pin/cost/hint/SP edits update instantly and mark the result **stale**; the sim only re-runs on the **Re-analyze** button (M4's Run/stale pattern).
- **Engine stays lazy + off the jsdom path:** never import the `@/sim` barrel into `src/core`. Components that run the sim go through `rankBasketsWithEngine`; tests inject `opts.deps` or mock the seam so jsdom never touches wasm.
- **Theme-aware:** style with existing semantic tokens (`--bg-*`, `--fg`, `--fg-muted`, `--border`, `--accent`, tier/effect tokens) + `cmp-*`/`ds-*` grammar — not the handoff's raw hexes. Verify light + dark.
- **Sim signatures (injectable):** `skillDelta(build, race, skillId, n, seed) → BashinStats`; `planner(build, race, skills[], n, seed) → BashinStats`. `BashinStats` has `{ mean, min, max, median, nsamples }`. `SimRaceParams = { courseId }`. `SimBuild = { umaId, stats, strategy, aptitudes, skills }`.
- **Spec:** `docs/superpowers/specs/2026-07-11-m2-optimizer-ui-fidelity-design.md`. **Handoff:** `docs/handoff/design_handoff_m2_sp_optimizer/`.

---

## File Structure

- `src/core/spOptimizer.ts` — **modify:** add pure `greedyByRatioBasket(...)`.
- `src/features/sp-optimizer/rankBaskets.ts` — **modify:** add `CandidateRow`, widen `RankResult` with `candidates` + `greedyScore`; ΔL measured vs the owned-only base for ALL candidates (pin-independent).
- `src/features/sp-optimizer/skillKind.ts` — **create:** pure `skillKind(detail) → { label, tone }` (Type chip); `useSkillKinds(ids)` hook lazy-loads engine technical details.
- `src/features/sp-optimizer/optimizerState.ts` — **create:** pure `applyWorkingState(...)` (merge edits→bundle) + `basketBuyCut(...)` (buy/cut sets + budget-line index).
- `src/features/sp-optimizer/ResultBanner.tsx` — **create.**
- `src/features/sp-optimizer/BuyableSkillsTable.tsx` — **create.**
- `src/features/sp-optimizer/BuildCards.tsx` — **modify:** selectable, generic labels, no win%.
- `src/features/sp-optimizer/BuildSpCard.tsx` — **create:** source control + build chips + editable SP + Load-uma-plan lock-prefill.
- `src/features/sp-optimizer/ComparePlaceholder.tsx` — **create:** F2 stub.
- `src/features/sp-optimizer/SpOptimizerPage.tsx` — **modify:** two-tab shell + working state + Re-analyze wiring.
- `src/features/sp-optimizer/sp-optimizer.css` — **modify:** table/banner/tabs/chips styles.
- Test siblings: `*.test.ts(x)` next to each unit.

---

## Task 1: Core — greedy-by-ratio basket (for the banner comparison)

**Files:**
- Modify: `src/core/spOptimizer.ts` (append after `shortlistByProxy`)
- Test: `src/core/spOptimizer.test.ts` (append)

**Interfaces:**
- Consumes: existing `BuyableSkill`, `prereqClosure`, `basketSpCost`, `skillSetDistance`.
- Produces: `greedyByRatioBasket(candidates: BuyableSkill[], budget: number, pinned: string[], lPerSpById: Record<string, number>): string[]` — the prereq-closed skill set a naive greedy-by-(L/SP) buyer would take under `budget`, pinned forced in first.

- [ ] **Step 1: Write the failing test**

```ts
// append to src/core/spOptimizer.test.ts
import { greedyByRatioBasket } from '@/core/spOptimizer';

describe('greedyByRatioBasket', () => {
  const cands: BuyableSkill[] = [
    { skillId: 'a', rarity: 'white', screenSpCost: 100 },
    { skillId: 'b', rarity: 'white', screenSpCost: 100 },
    { skillId: 'c', rarity: 'white', screenSpCost: 100 },
  ];
  it('takes highest L/SP first until the budget is exhausted', () => {
    const got = greedyByRatioBasket(cands, 200, [], { a: 1, b: 5, c: 3 });
    expect(got.sort()).toEqual(['b', 'c']); // b(5) then c(3), a(1) skipped — budget 200
  });
  it('forces pinned in even at poor ratio, then greedily fills the rest', () => {
    const got = greedyByRatioBasket(cands, 200, ['a'], { a: 1, b: 5, c: 3 });
    expect(got.sort()).toEqual(['a', 'b']); // a pinned (100) + b best remaining (100)
  });
  it('pulls a gold prereq in with the gold (closed set)', () => {
    const g: BuyableSkill[] = [
      { skillId: 'w', rarity: 'white', screenSpCost: 100 },
      { skillId: 'g', rarity: 'gold', screenSpCost: 100, prereqSkillId: 'w' },
    ];
    const got = greedyByRatioBasket(g, 200, [], { g: 9, w: 0.1 });
    expect(got.sort()).toEqual(['g', 'w']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/core/spOptimizer.test.ts -t greedyByRatioBasket`
Expected: FAIL — `greedyByRatioBasket is not a function`.

- [ ] **Step 3: Write minimal implementation**

```ts
// append to src/core/spOptimizer.ts
/**
 * The prereq-closed basket a naive greedy-by-(L/SP) buyer takes under `budget`:
 * pinned forced first, then optional candidates in descending lPerSp, each pulled
 * in with its prereq closure only if the whole closure still fits. Pure and total.
 * Used ONLY for the "vs greedy" banner comparison — never to rank (the sim ranks).
 */
export function greedyByRatioBasket(
  candidates: BuyableSkill[],
  budget: number,
  pinned: string[],
  lPerSpById: Record<string, number>,
): string[] {
  const chosen = new Set(prereqClosure(pinned, candidates));
  let spent = basketSpCost([...chosen], candidates);
  const optional = candidates
    .filter((c) => !chosen.has(c.skillId))
    .sort((x, y) => (lPerSpById[y.skillId] ?? 0) - (lPerSpById[x.skillId] ?? 0));
  for (const c of optional) {
    if (chosen.has(c.skillId)) continue;
    const closure = prereqClosure([c.skillId], candidates);
    const add = closure.filter((id) => !chosen.has(id));
    const addCost = basketSpCost(add, candidates);
    if (spent + addCost <= budget) {
      add.forEach((id) => chosen.add(id));
      spent += addCost;
    }
  }
  return [...chosen];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/core/spOptimizer.test.ts -t greedyByRatioBasket`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/spOptimizer.ts src/core/spOptimizer.test.ts
git commit -m "feat(m2): greedy-by-ratio basket helper for the optimizer banner"
```

---

## Task 2: Orchestrator — widen `RankResult` with candidate rows + greedy score

**Files:**
- Modify: `src/features/sp-optimizer/rankBaskets.ts`
- Test: `src/features/sp-optimizer/rankBaskets.test.ts` (append)

**Interfaces:**
- Consumes: `greedyByRatioBasket` (Task 1); existing `SimDeps`, `chooseBasketsToScore`, `selectTopDiverse`, `basketSpCost`, `toSimBuild`.
- Produces:
  - `interface CandidateRow { skillId: string; rarity: SkillRarity; deltaL: number; screenSpCost: number; baseSpCost?: number; lPerSp: number; hintLevel?: HintLevel; prereqSkillId?: string; pinned: boolean }`
  - `RankResult` gains `candidates: CandidateRow[]` and `greedyScore: number` (mean L of the greedy basket; `0` if none).
  - **Behavior change:** single-skill ΔL is now measured vs the **owned-only** base (`ctx.ownedSkills`) for **every** candidate (including pinned), so the ΔL column is pin-independent. The shortlist proxy uses these same values.

- [ ] **Step 1: Write the failing test**

```ts
// append to src/features/sp-optimizer/rankBaskets.test.ts
import { rankBaskets, type SimDeps } from '@/features/sp-optimizer/rankBaskets';
import type { CaptureBundle } from '@/core/spOptimizer';

function bundle(over: Partial<CaptureBundle['context']> = {}): CaptureBundle {
  return {
    schemaVersion: 1, source: 'manual', capturedAt: 'x', server: 'global', dataVersion: 'v', seed: 1,
    context: {
      umaId: 'u', stats: { spd: 1000, sta: 800, pow: 700, gut: 400, wit: 900 },
      aptitudes: { distance: 'A', surface: 'A', strategy: 'A' }, strategy: 'pace',
      courseId: '10906', spBudget: 300, ownedSkills: [], pinned: [],
      candidates: [
        { skillId: 'a', rarity: 'white', screenSpCost: 100, hintLevel: 0 },
        { skillId: 'b', rarity: 'white', screenSpCost: 100 },
      ],
      ...over,
    },
  };
}
// Deterministic fake sim: ΔL = 1 for 'a', 2 for 'b'; basket score = sum of member ΔL.
const deps: SimDeps = {
  skillDelta: (_b, _r, id) => ({ mean: id === 'a' ? 1 : 2, min: 0, max: 0, median: 0, nsamples: 5 }),
  planner: (_b, _r, skills) => ({ mean: skills.reduce((s, id) => s + (id === 'a' ? 1 : 2), 0), min: 0, max: 0, median: 0, nsamples: 5 }),
};

describe('rankBaskets candidate rows', () => {
  it('returns one CandidateRow per candidate with deltaL + lPerSp + pinned', () => {
    const r = rankBaskets(bundle({ pinned: ['a'] }), { deps });
    expect(r.candidates.map((c) => c.skillId).sort()).toEqual(['a', 'b']);
    const a = r.candidates.find((c) => c.skillId === 'a')!;
    expect(a.deltaL).toBe(1);              // measured vs owned base even though pinned
    expect(a.lPerSp).toBeCloseTo(10);      // 1 / 100 * 1000
    expect(a.pinned).toBe(true);
    expect(r.candidates.find((c) => c.skillId === 'b')!.pinned).toBe(false);
  });
  it('reports a greedyScore', () => {
    const r = rankBaskets(bundle(), { deps });
    expect(typeof r.greedyScore).toBe('number');
    expect(r.greedyScore).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/sp-optimizer/rankBaskets.test.ts -t "candidate rows"`
Expected: FAIL — `r.candidates` is undefined.

- [ ] **Step 3: Write the implementation**

Replace the body of `rankBaskets` (keep the signature + `rankBasketsWithEngine`). Add the `CandidateRow` interface and the two new `RankResult` fields; measure ΔL vs `ownedBuild`; build rows; compute the greedy score.

```ts
// add imports at top of rankBaskets.ts
import type { HintLevel } from '@/core/coverage';
import type { SkillRarity } from '@/core/types';
import {
  type BuildContext,
  type CaptureBundle,
  type ScoredBasket,
  basketSpCost,
  chooseBasketsToScore,
  greedyByRatioBasket,
  selectTopDiverse,
} from '@/core/spOptimizer';

// add near RankResult
export interface CandidateRow {
  skillId: string;
  rarity: SkillRarity;
  deltaL: number;
  screenSpCost: number;
  baseSpCost?: number;
  lPerSp: number;
  hintLevel?: HintLevel;
  prereqSkillId?: string;
  pinned: boolean;
}

export interface RankResult {
  mode: 'exact' | 'shortlist';
  baskets: RankedBasket[];
  candidates: CandidateRow[];
  greedyScore: number;
}
```

```ts
// replace the rankBaskets body from `const lockedSkills = ...` to the return
  const lockedSkills = [...new Set([...ctx.ownedSkills, ...ctx.pinned])];
  const lockedBuild = toSimBuild(ctx, lockedSkills);
  const ownedBuild = toSimBuild(ctx, ctx.ownedSkills);

  const cache = new Map<string, BashinStats>();
  const cached = (key: string, compute: () => BashinStats): BashinStats => {
    const hit = cache.get(key);
    if (hit) return hit;
    const v = compute();
    cache.set(key, v);
    return v;
  };
  const lockedKey = `${ctx.courseId}|${lockedSkills.slice().sort().join(',')}`;
  const ownedKey = `${ctx.courseId}|owned:${ctx.ownedSkills.slice().sort().join(',')}`;

  // Single-skill ΔL vs the OWNED base for every candidate (pin-independent, so the
  // table's ΔL/L-SP columns don't shift when you pin — only basket sims depend on pins).
  const deltaLById: Record<string, number> = {};
  const lPerSpById: Record<string, number> = {};
  for (const c of ctx.candidates) {
    const stats = cached(`${ownedKey}|d:${c.skillId}`, () =>
      deps.skillDelta(ownedBuild, race, c.skillId, n, seed),
    );
    const dl = stats.nsamples === 0 ? 0 : stats.mean;
    deltaLById[c.skillId] = dl;
    lPerSpById[c.skillId] = c.screenSpCost > 0 ? (dl / c.screenSpCost) * 1000 : 0;
  }

  const pinnedSet = new Set(ctx.pinned);
  const candidateRows: CandidateRow[] = ctx.candidates.map((c) => ({
    skillId: c.skillId,
    rarity: c.rarity,
    deltaL: deltaLById[c.skillId] ?? 0,
    screenSpCost: c.screenSpCost,
    ...(c.hintLevel !== undefined ? { hintLevel: c.hintLevel } : {}),
    ...(c.prereqSkillId !== undefined ? { prereqSkillId: c.prereqSkillId } : {}),
    lPerSp: lPerSpById[c.skillId] ?? 0,
    pinned: pinnedSet.has(c.skillId),
  }));

  const choice = chooseBasketsToScore(ctx, deltaLById, {
    exactThreshold: opts.exactThreshold ?? 256,
    shortlistLimit: opts.shortlistLimit ?? 20,
    minDistance: 2,
  });

  const scoreBasket = (skills: string[]): BashinStats => {
    const additions = skills.filter((id) => !lockedSkills.includes(id));
    return cached(`${lockedKey}|p:${additions.slice().sort().join(',')}`, () =>
      deps.planner(lockedBuild, race, additions, n, seed),
    );
  };

  const scored: (ScoredBasket & { descriptor: string })[] = choice.baskets.map((skills) => {
    const stats = scoreBasket(skills);
    const spUsed = basketSpCost(skills, ctx.candidates);
    return {
      skills,
      score: stats.nsamples === 0 ? 0 : stats.mean,
      spUsed,
      spLeft: ctx.spBudget - spUsed,
      descriptor: describeStats(stats),
    };
  });

  const greedy = greedyByRatioBasket(ctx.candidates, ctx.spBudget, ctx.pinned, lPerSpById);
  const greedyStats = greedy.length ? scoreBasket(greedy) : undefined;
  const greedyScore = greedyStats && greedyStats.nsamples > 0 ? greedyStats.mean : 0;

  const top = selectTopDiverse(scored, { k: 3, bandBashin: 3, minDistance: 2 });
  const byKey = new Map(scored.map((s) => [s.skills.slice().sort().join(','), s.descriptor]));
  return {
    mode: choice.mode,
    candidates: candidateRows,
    greedyScore,
    baskets: top.map((b) => ({
      ...b,
      descriptor: byKey.get(b.skills.slice().sort().join(',')) ?? '',
    })),
  };
```

- [ ] **Step 4: Run the test to verify it passes + existing rankBaskets tests still pass**

Run: `pnpm vitest run src/features/sp-optimizer/rankBaskets.test.ts`
Expected: PASS (new + existing). If an existing test asserted the old locked-base ΔL call shape, update it to the owned-base call (same fake-dep values, base build now `ownedBuild`).

- [ ] **Step 5: Commit**

```bash
git add src/features/sp-optimizer/rankBaskets.ts src/features/sp-optimizer/rankBaskets.test.ts
git commit -m "feat(m2): surface per-candidate rows + greedy score on RankResult"
```

---

## Task 3: `skillKind` — the Type-chip helper

**Files:**
- Create: `src/features/sp-optimizer/skillKind.ts`
- Test: `src/features/sp-optimizer/skillKind.test.ts`

**Interfaces:**
- Consumes: `SkillTechnicalDetail` + `loadSkillTechnicalDetail` from `@/features/cm-planner/skillTechnicalDetails`; `describeEffect` / `EffectTone` from `@/features/cm-planner/skillTechFormat`.
- Produces:
  - `skillKind(detail: SkillTechnicalDetail | undefined, conditions?: string): { label: string; tone: EffectTone }` — pure; dominant effect → short label ("speed"/"accel"/"recover"/"stat"…), refined to "corner"/"straight"/"position" from the condition string.
  - `useSkillKinds(skillIds: string[]): Map<string, { label: string; tone: EffectTone }>` — lazy-loads details, memoized; missing ⇒ absent (caller omits the chip).

- [ ] **Step 1: Write the failing test**

```ts
// src/features/sp-optimizer/skillKind.test.ts
import { describe, expect, it } from 'vitest';
import { skillKind } from '@/features/sp-optimizer/skillKind';
import type { SkillTechnicalDetail } from '@/features/cm-planner/skillTechnicalDetails';

const detail = (type: number): SkillTechnicalDetail =>
  ({ alternatives: [{ effects: [{ type, modifier: 10000 }] }] } as unknown as SkillTechnicalDetail);

describe('skillKind', () => {
  it('labels an acceleration effect', () => {
    expect(skillKind(detail(31)).label).toBe('accel');
  });
  it('labels a recovery effect', () => {
    expect(skillKind(detail(9)).label).toBe('recover');
  });
  it('refines a speed effect on a corner condition to "corner"', () => {
    expect(skillKind(detail(27), 'corner==1').label).toBe('corner');
  });
  it('returns a neutral fallback for empty detail', () => {
    expect(skillKind(undefined).label).toBe('skill');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/sp-optimizer/skillKind.test.ts`
Expected: FAIL — cannot find `skillKind`.

- [ ] **Step 3: Write the implementation**

```ts
// src/features/sp-optimizer/skillKind.ts
import { useEffect, useMemo, useState } from 'react';
import { describeEffect, type EffectTone } from '@/features/cm-planner/skillTechFormat';
import {
  loadSkillTechnicalDetail,
  type SkillTechnicalDetail,
} from '@/features/cm-planner/skillTechnicalDetails';

export interface SkillKind { label: string; tone: EffectTone }

/** Dominant effect → short category label + tone; refined by the condition string. */
export function skillKind(detail: SkillTechnicalDetail | undefined, conditions?: string): SkillKind {
  const effects = detail?.alternatives?.[0]?.effects ?? [];
  // Pick the first effect that produces a positive, non-neutral display.
  const primary = effects.map((e) => describeEffect(e)).find((d) => d && d.tone !== 'special') ?? null;
  let tone: EffectTone = primary?.tone ?? 'special';
  let label = TONE_LABEL[tone] ?? 'skill';
  const cond = conditions ?? '';
  if (/corner/.test(cond)) { label = 'corner'; tone = 'movement'; }
  else if (/straight/.test(cond)) { label = 'straight'; tone = 'movement'; }
  else if (/order|blocked|infront|behind/.test(cond)) { label = 'position'; tone = 'movement'; }
  return { label, tone };
}

const TONE_LABEL: Partial<Record<EffectTone, string>> = {
  'target-speed': 'speed', 'current-speed': 'speed', acceleration: 'accel',
  recovery: 'recover', stat: 'stat', movement: 'position', duration: 'duration',
  start: 'start', debuff: 'debuff',
};

/** Lazy-load technical details for a set of skill ids → their kinds. */
export function useSkillKinds(skillIds: string[]): Map<string, SkillKind> {
  const key = useMemo(() => [...new Set(skillIds)].sort().join(','), [skillIds]);
  const [kinds, setKinds] = useState<Map<string, SkillKind>>(new Map());
  useEffect(() => {
    let live = true;
    const ids = key ? key.split(',') : [];
    void Promise.all(ids.map(async (id) => [id, await loadSkillTechnicalDetail(id)] as const)).then((pairs) => {
      if (!live) return;
      const m = new Map<string, SkillKind>();
      for (const [id, detail] of pairs) if (detail) m.set(id, skillKind(detail, detail.conditions));
      setKinds(m);
    });
    return () => { live = false; };
  }, [key]);
  return kinds;
}
```

> Note: if `SkillTechnicalDetail` has no `conditions` field, drop the second `skillKind` arg in `useSkillKinds` and pass the `SkillRecord.conditions` from the caller instead (the page has `skillById`). Verify the field name against `skillTechnicalDetails.ts` during Step 4 and adjust.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/features/sp-optimizer/skillKind.test.ts`
Expected: PASS (4 tests). Fix the `conditions` source per the note if typecheck complains.

- [ ] **Step 5: Commit**

```bash
git add src/features/sp-optimizer/skillKind.ts src/features/sp-optimizer/skillKind.test.ts
git commit -m "feat(m2): skillKind Type-chip helper + lazy loader hook"
```

---

## Task 4: `optimizerState` — pure merge + buy/cut helpers

**Files:**
- Create: `src/features/sp-optimizer/optimizerState.ts`
- Test: `src/features/sp-optimizer/optimizerState.test.ts`

**Interfaces:**
- Consumes: `CaptureBundle`, `BuyableSkill` (`@/core/spOptimizer`); `purchaseSpCost`, `HintLevel` (`@/core/cost`); `SkillRecord`, `SparkRates` (`@/core/types`); `CandidateRow`, `RankResult` (Task 2).
- Produces:
  - `interface WorkingEdits { pins: Set<string>; costEdits: Map<string, number>; hintEdits: Map<string, HintLevel>; fastLearner: boolean }`
  - `applyWorkingState(bundle, edits, skillById, rates): CaptureBundle` — returns a new bundle with `context.pinned` from `pins` and each candidate's `screenSpCost` recomputed: a `costEdit` wins; else a `hintEdit` reprices via `purchaseSpCost`; else the captured cost is kept.
  - `basketBuyCut(result, selectedIdx): { buy: Set<string>; cut: Set<string>; spUsed: number }` — buy = the selected basket's skills; cut = candidates not in it.

- [ ] **Step 1: Write the failing test**

```ts
// src/features/sp-optimizer/optimizerState.test.ts
import { describe, expect, it } from 'vitest';
import { applyWorkingState, basketBuyCut, type WorkingEdits } from '@/features/sp-optimizer/optimizerState';
import type { CaptureBundle } from '@/core/spOptimizer';
import type { SkillRecord, SparkRates } from '@/core/types';

const rates = { hintDiscountCumulativePct: [10, 20, 30, 35, 40] } as SparkRates;
const skill = (id: string, base: number): SkillRecord =>
  ({ skillId: id, nameEn: id, baseSpCost: base, rarity: 'white', server: 'global' } as unknown as SkillRecord);
const skillById = new Map([['a', skill('a', 200)], ['b', skill('b', 100)]]);
const base: CaptureBundle = {
  schemaVersion: 1, source: 'manual', capturedAt: 'x', server: 'global', dataVersion: 'v',
  context: {
    umaId: 'u', stats: { spd: 1, sta: 1, pow: 1, gut: 1, wit: 1 },
    aptitudes: { distance: 'A', surface: 'A', strategy: 'A' }, strategy: 'pace',
    courseId: '10906', spBudget: 500, ownedSkills: [], pinned: [],
    candidates: [
      { skillId: 'a', rarity: 'white', screenSpCost: 200 },
      { skillId: 'b', rarity: 'white', screenSpCost: 100 },
    ],
  },
};

describe('applyWorkingState', () => {
  it('sets pinned from the pins set', () => {
    const edits: WorkingEdits = { pins: new Set(['a']), costEdits: new Map(), hintEdits: new Map(), fastLearner: false };
    expect(applyWorkingState(base, edits, skillById, rates).context.pinned).toEqual(['a']);
  });
  it('reprices from a hint edit (200 @ Lv1 → 180)', () => {
    const edits: WorkingEdits = { pins: new Set(), costEdits: new Map(), hintEdits: new Map([['a', 1]]), fastLearner: false };
    const out = applyWorkingState(base, edits, skillById, rates);
    expect(out.context.candidates.find((c) => c.skillId === 'a')!.screenSpCost).toBe(180);
  });
  it('a cost edit overrides the hint reprice', () => {
    const edits: WorkingEdits = { pins: new Set(), costEdits: new Map([['a', 42]]), hintEdits: new Map([['a', 3]]), fastLearner: false };
    const out = applyWorkingState(base, edits, skillById, rates);
    expect(out.context.candidates.find((c) => c.skillId === 'a')!.screenSpCost).toBe(42);
  });
});

describe('basketBuyCut', () => {
  it('splits candidates into buy vs cut for the selected basket', () => {
    const result = { mode: 'exact', greedyScore: 0, candidates: [
      { skillId: 'a', rarity: 'white', deltaL: 1, screenSpCost: 200, lPerSp: 5, pinned: false },
      { skillId: 'b', rarity: 'white', deltaL: 1, screenSpCost: 100, lPerSp: 10, pinned: false },
    ], baskets: [{ skills: ['b'], score: 1, spUsed: 100, spLeft: 400, descriptor: 'd' }] } as const;
    const { buy, cut } = basketBuyCut(result as never, 0);
    expect([...buy]).toEqual(['b']);
    expect([...cut]).toEqual(['a']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/sp-optimizer/optimizerState.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// src/features/sp-optimizer/optimizerState.ts
import type { BuyableSkill, CaptureBundle } from '@/core/spOptimizer';
import { type HintLevel, purchaseSpCost } from '@/core/cost';
import type { SkillRecord, SparkRates } from '@/core/types';
import type { RankResult } from '@/features/sp-optimizer/rankBaskets';

export interface WorkingEdits {
  pins: Set<string>;
  costEdits: Map<string, number>;
  hintEdits: Map<string, HintLevel>;
  fastLearner: boolean;
}

/** Merge working edits into a fresh bundle: pins → context.pinned; per-candidate
 *  screenSpCost = cost edit ?? hint-repriced ?? captured. Pure (new objects). */
export function applyWorkingState(
  bundle: CaptureBundle,
  edits: WorkingEdits,
  skillById: ReadonlyMap<string, SkillRecord>,
  rates: SparkRates,
): CaptureBundle {
  const candidates: BuyableSkill[] = bundle.context.candidates.map((c) => {
    const costEdit = edits.costEdits.get(c.skillId);
    const hintEdit = edits.hintEdits.get(c.skillId);
    let screenSpCost = c.screenSpCost;
    if (costEdit !== undefined) {
      screenSpCost = costEdit;
    } else if (hintEdit !== undefined) {
      const skill = skillById.get(c.skillId);
      if (skill) screenSpCost = purchaseSpCost(skill, skillById, hintEdit, rates, { fastLearner: edits.fastLearner });
    }
    return { ...c, screenSpCost, ...(hintEdit !== undefined ? { hintLevel: hintEdit } : {}) };
  });
  return {
    ...bundle,
    context: { ...bundle.context, candidates, pinned: [...edits.pins] },
  };
}

/** Buy = selected basket's skills; cut = every other candidate. */
export function basketBuyCut(
  result: RankResult,
  selectedIdx: number,
): { buy: Set<string>; cut: Set<string>; spUsed: number } {
  const basket = result.baskets[selectedIdx] ?? result.baskets[0];
  const buy = new Set(basket?.skills ?? []);
  const cut = new Set(result.candidates.map((c) => c.skillId).filter((id) => !buy.has(id)));
  return { buy, cut, spUsed: basket?.spUsed ?? 0 };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/features/sp-optimizer/optimizerState.test.ts`
Expected: PASS (4 tests). (Lv1 reprice: 200×(100−10)/100 = 180.)

- [ ] **Step 5: Commit**

```bash
git add src/features/sp-optimizer/optimizerState.ts src/features/sp-optimizer/optimizerState.test.ts
git commit -m "feat(m2): pure working-state merge + buy/cut helpers"
```

---

## Task 5: `ResultBanner` component

**Files:**
- Create: `src/features/sp-optimizer/ResultBanner.tsx`
- Test: `src/features/sp-optimizer/ResultBanner.test.tsx`

**Interfaces:**
- Consumes: `RankResult` (Task 2).
- Produces: `<ResultBanner result={RankResult} selectedIdx={number} spBudget={number} />` — renders "OPTIMAL BASKET · {EXACT|ESTIMATE}", "Buy N → +L", the vs-greedy delta, and SP used/left.

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/sp-optimizer/ResultBanner.test.tsx
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ResultBanner } from '@/features/sp-optimizer/ResultBanner';
import type { RankResult } from '@/features/sp-optimizer/rankBaskets';

afterEach(cleanup);
const result: RankResult = {
  mode: 'exact', greedyScore: 4.18, candidates: [],
  baskets: [{ skills: ['a', 'b'], score: 4.39, spUsed: 2310, spLeft: 90, descriptor: 'd' }],
};

describe('ResultBanner', () => {
  it('shows the optimal buy count, +L, mode, and SP used/left', () => {
    render(<ResultBanner result={result} selectedIdx={0} spBudget={2400} />);
    expect(screen.getByText(/Buy 2/)).toBeInTheDocument();
    expect(screen.getByText(/\+4\.39/)).toBeInTheDocument();
    expect(screen.getByText(/EXACT/i)).toBeInTheDocument();
    expect(screen.getByText(/2,?310/)).toBeInTheDocument();
    expect(screen.getByText(/90 SP left/)).toBeInTheDocument();
  });
  it('shows the vs-greedy delta when positive', () => {
    render(<ResultBanner result={result} selectedIdx={0} spBudget={2400} />);
    expect(screen.getByText(/greedy/i)).toBeInTheDocument();
    expect(screen.getByText(/\+0\.21/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/sp-optimizer/ResultBanner.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```tsx
// src/features/sp-optimizer/ResultBanner.tsx
import type { RankResult } from '@/features/sp-optimizer/rankBaskets';

export interface ResultBannerProps {
  result: RankResult;
  selectedIdx: number;
  spBudget: number;
}

export function ResultBanner({ result, selectedIdx, spBudget }: ResultBannerProps) {
  const basket = result.baskets[selectedIdx] ?? result.baskets[0];
  if (!basket) return null;
  const vsGreedy = basket.score - result.greedyScore;
  const usedPct = spBudget > 0 ? Math.min(100, Math.round((basket.spUsed / spBudget) * 100)) : 0;
  return (
    <div className="sp-banner" role="status">
      <div className="sp-banner-head">
        <span className="sp-banner-label">
          OPTIMAL BASKET · {result.mode === 'exact' ? 'EXACT' : 'ESTIMATE'}
        </span>
        <div className="sp-banner-big">
          Buy {basket.skills.length} → <span className="sp-Lval">+{basket.score.toFixed(2)} L</span>
        </div>
      </div>
      <div className="sp-banner-bar">
        <div className="sp-bar"><i style={{ width: `${usedPct}%` }} /></div>
        {vsGreedy > 0.005 && (
          <p className="small muted">
            vs greedy-by-ratio: <b className="sp-Lval">+{vsGreedy.toFixed(2)} L</b> better
          </p>
        )}
      </div>
      <div className="sp-banner-sp">
        <div className="sp-banner-used">{basket.spUsed.toLocaleString()}</div>
        <div className="small muted">/ {spBudget.toLocaleString()} · {Math.max(0, spBudget - basket.spUsed)} SP left</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/features/sp-optimizer/ResultBanner.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/sp-optimizer/ResultBanner.tsx src/features/sp-optimizer/ResultBanner.test.tsx
git commit -m "feat(m2): result banner (optimal basket + vs-greedy + SP used)"
```

---

## Task 6: `BuyableSkillsTable` component

**Files:**
- Create: `src/features/sp-optimizer/BuyableSkillsTable.tsx`
- Test: `src/features/sp-optimizer/BuyableSkillsTable.test.tsx`

**Interfaces:**
- Consumes: `CandidateRow`, `RankResult` (Task 2); `basketBuyCut` (Task 4); `useSkillKinds` (Task 3); `useGameData`/`GameIcon`; `HintLevel` (`@/core/cost`).
- Produces: `<BuyableSkillsTable result rows selectedIdx pins onTogglePin onEditCost onSetHint />`:
  - `rows: CandidateRow[]` (post-merge candidates for pre-analysis display) — when `result` is present its `candidates` supply ΔL/L-SP; before analysis, ΔL/L-SP render as "—".
  - Handlers: `onTogglePin(id)`, `onEditCost(id, cost)`, `onSetHint(id, lvl: HintLevel)`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/sp-optimizer/BuyableSkillsTable.test.tsx
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/features/data/gameData', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/data/gameData')>();
  const { fixtureGameData } = await import('@/features/testing/fixtureGameData');
  return { ...actual, useGameData: () => ({ ...fixtureGameData(), status: 'ready' as const }) };
});
vi.mock('@/features/sp-optimizer/skillKind', () => ({ useSkillKinds: () => new Map() }));

import { BuyableSkillsTable } from '@/features/sp-optimizer/BuyableSkillsTable';
import type { RankResult } from '@/features/sp-optimizer/rankBaskets';

afterEach(cleanup);
const rows = [
  { skillId: '200332', rarity: 'white' as const, deltaL: 1.42, screenSpCost: 144, baseSpCost: 240, lPerSp: 9.9, hintLevel: 3 as const, pinned: false },
  { skillId: '200012', rarity: 'white' as const, deltaL: 0.31, screenSpCost: 130, lPerSp: 2.4, pinned: false },
];
const result: RankResult = { mode: 'exact', greedyScore: 0, candidates: rows, baskets: [{ skills: ['200332'], score: 1.42, spUsed: 144, spLeft: 0, descriptor: 'd' }] };

describe('BuyableSkillsTable', () => {
  it('renders a row per candidate with ΔL and L/SP', () => {
    render(<BuyableSkillsTable result={result} rows={rows} selectedIdx={0} pins={new Set()} onTogglePin={() => {}} onEditCost={() => {}} onSetHint={() => {}} />);
    expect(screen.getByText('+1.42')).toBeInTheDocument();
    expect(screen.getByText('9.9')).toBeInTheDocument();
    expect(screen.getByText(/240/)).toBeInTheDocument(); // struck base
  });
  it('fires onTogglePin when a lock cell is clicked', async () => {
    const onTogglePin = vi.fn();
    render(<BuyableSkillsTable result={result} rows={rows} selectedIdx={0} pins={new Set()} onTogglePin={onTogglePin} onEditCost={() => {}} onSetHint={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /lock 200332/i }));
    expect(onTogglePin).toHaveBeenCalledWith('200332');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/sp-optimizer/BuyableSkillsTable.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```tsx
// src/features/sp-optimizer/BuyableSkillsTable.tsx
import type { HintLevel } from '@/core/cost';
import { useGameData } from '@/features/data/gameData';
import { GameIcon } from '@/features/data/GameIcon';
import type { CandidateRow, RankResult } from '@/features/sp-optimizer/rankBaskets';
import { basketBuyCut } from '@/features/sp-optimizer/optimizerState';
import { useSkillKinds } from '@/features/sp-optimizer/skillKind';

export interface BuyableSkillsTableProps {
  result: RankResult | null;
  rows: CandidateRow[];
  selectedIdx: number;
  pins: Set<string>;
  onTogglePin: (id: string) => void;
  onEditCost: (id: string, cost: number) => void;
  onSetHint: (id: string, lvl: HintLevel) => void;
}

const HINTS: HintLevel[] = [0, 1, 2, 3, 4, 5];

export function BuyableSkillsTable(props: BuyableSkillsTableProps) {
  const { result, rows, selectedIdx, pins, onTogglePin, onEditCost, onSetHint } = props;
  const { skillById } = useGameData();
  const kinds = useSkillKinds(rows.map((r) => r.skillId));
  const { buy } = result ? basketBuyCut(result, selectedIdx) : { buy: new Set<string>() };
  const analyzed = result !== null;
  // Sort by L/SP desc when analyzed; otherwise keep input order.
  const ordered = analyzed ? [...rows].sort((a, b) => b.lPerSp - a.lPerSp) : rows;

  return (
    <table className="sp-table">
      <thead>
        <tr>
          <th>Lock</th><th>Skill</th><th>Type</th><th>Δ L</th><th>SP cost</th>
          <th>L / SP <span className="muted">(×1k)</span></th><th>Hint Lv</th>
        </tr>
      </thead>
      <tbody>
        {ordered.map((r) => {
          const skill = skillById.get(r.skillId);
          const pinned = pins.has(r.skillId);
          const inBuy = buy.has(r.skillId);
          const state = pinned ? 'lock' : inBuy ? 'buy' : 'avail';
          const kind = kinds.get(r.skillId);
          const discounted = r.baseSpCost !== undefined && r.baseSpCost !== r.screenSpCost;
          return (
            <tr key={r.skillId} className={`sp-row is-${state}`}>
              <td>
                <button
                  type="button"
                  className={`sp-lock is-${state}`}
                  aria-label={`Lock ${r.skillId}`}
                  aria-pressed={pinned}
                  onClick={() => onTogglePin(r.skillId)}
                >
                  {pinned ? '🔒' : inBuy ? '✓' : ''}
                </button>
              </td>
              <td className="sp-skill">
                {skill && <GameIcon kind="skill" id={skill.iconId} size={18} alt="" />}
                <span className={r.rarity === 'gold' ? 'sk-gold' : 'sk-white'}>{skill?.nameEn ?? r.skillId}</span>
                {r.prereqSkillId && <span className="sp-bundle">+ white base</span>}
              </td>
              <td>{kind ? <span className={`sp-kind is-${kind.tone}`}>{kind.label}</span> : null}</td>
              <td className="sp-Lval">{analyzed ? `+${r.deltaL.toFixed(2)}` : '—'}</td>
              <td className="sp-cost">
                {discounted && <span className="was">{r.baseSpCost}</span>}
                <input
                  type="number"
                  className="sp-cost-input"
                  aria-label={`Cost for ${r.skillId}`}
                  value={r.screenSpCost}
                  onChange={(e) => onEditCost(r.skillId, Number(e.target.value))}
                />
              </td>
              <td className={`sp-ratio ${analyzed && r.lPerSp < 3 ? 'is-weak' : 'is-strong'}`}>
                {analyzed ? r.lPerSp.toFixed(1) : '—'}
              </td>
              <td>
                <span className="sp-hint" role="group" aria-label={`Hint level for ${r.skillId}`}>
                  {HINTS.map((h) => (
                    <button
                      key={h}
                      type="button"
                      className={r.hintLevel === h ? 'on' : ''}
                      aria-pressed={r.hintLevel === h}
                      onClick={() => onSetHint(r.skillId, h)}
                    >
                      {h}
                    </button>
                  ))}
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/features/sp-optimizer/BuyableSkillsTable.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/sp-optimizer/BuyableSkillsTable.tsx src/features/sp-optimizer/BuyableSkillsTable.test.tsx
git commit -m "feat(m2): buyable-skills workbench table (lock/ΔL/cost/L-SP/hint)"
```

---

## Task 7: `BuildCards` — selectable, generic labels, no win%

**Files:**
- Modify: `src/features/sp-optimizer/BuildCards.tsx`
- Test: `src/features/sp-optimizer/BuildCards.test.tsx`

**Interfaces:**
- Consumes: `RankResult` (Task 2); `useGameData`/`GameIcon`.
- Produces: `<BuildCards result selectedIdx onSelect onCompare />` — 3 selectable cards ("Basket #k", mode badge, mean +L, spread descriptor, skill list, SP used/left, "Compare vs veteran →"). No "% win vs field".

- [ ] **Step 1: Write/replace the failing test**

```tsx
// src/features/sp-optimizer/BuildCards.test.tsx  (replace file)
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/features/data/gameData', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/data/gameData')>();
  const { fixtureGameData } = await import('@/features/testing/fixtureGameData');
  return { ...actual, useGameData: () => ({ ...fixtureGameData(), status: 'ready' as const }) };
});

import { BuildCards } from '@/features/sp-optimizer/BuildCards';
import type { RankResult } from '@/features/sp-optimizer/rankBaskets';

afterEach(cleanup);
const result: RankResult = {
  mode: 'exact', greedyScore: 0, candidates: [],
  baskets: [
    { skills: ['200332'], score: 4.39, spUsed: 2310, spLeft: 90, descriptor: '+4.4 lengths · tight spread' },
    { skills: ['200012'], score: 4.31, spUsed: 2270, spLeft: 130, descriptor: '+4.3 lengths · moderate spread' },
  ],
};

describe('BuildCards', () => {
  it('renders generic basket labels + mean L, no win%', () => {
    render(<BuildCards result={result} selectedIdx={0} onSelect={() => {}} onCompare={() => {}} />);
    expect(screen.getByText('Basket #1')).toBeInTheDocument();
    expect(screen.getByText(/\+4\.39/)).toBeInTheDocument();
    expect(screen.queryByText(/win vs field/i)).not.toBeInTheDocument();
  });
  it('calls onSelect when a card is clicked and onCompare on the button', async () => {
    const onSelect = vi.fn(); const onCompare = vi.fn();
    render(<BuildCards result={result} selectedIdx={0} onSelect={onSelect} onCompare={onCompare} />);
    await userEvent.click(screen.getByText('Basket #2'));
    expect(onSelect).toHaveBeenCalledWith(1);
    await userEvent.click(screen.getAllByRole('button', { name: /Compare vs veteran/i })[0]!);
    expect(onCompare).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/sp-optimizer/BuildCards.test.tsx`
Expected: FAIL — `BuildCards` doesn't accept the new props / renders old shape.

- [ ] **Step 3: Replace the implementation**

```tsx
// src/features/sp-optimizer/BuildCards.tsx  (replace file)
import { useGameData } from '@/features/data/gameData';
import { GameIcon } from '@/features/data/GameIcon';
import type { RankResult } from '@/features/sp-optimizer/rankBaskets';

export interface BuildCardsProps {
  result: RankResult;
  selectedIdx: number;
  onSelect: (idx: number) => void;
  onCompare: (idx: number) => void;
}

export function BuildCards({ result, selectedIdx, onSelect, onCompare }: BuildCardsProps) {
  const { skillById } = useGameData();
  if (result.baskets.length === 0) {
    return <p className="muted">No feasible baskets — lower the budget floor or add candidates.</p>;
  }
  return (
    <div className="sp-cards">
      <p className="small muted">
        {result.mode === 'exact'
          ? 'Exact ranking — every feasible basket simulated.'
          : 'Shortlisted estimate — proxy-narrowed, then simulated.'}{' '}
        Ranked by simulated combined L; pick one, then compare.
      </p>
      <div className="sp-cards-row">
        {result.baskets.map((b, i) => (
          <article
            key={b.skills.join(',')}
            className={`sp-card${i === selectedIdx ? ' is-selected' : ''}`}
            aria-current={i === selectedIdx}
          >
            <button type="button" className="sp-card-head" onClick={() => onSelect(i)}>
              <span className="sp-card-title">Basket #{i + 1}</span>
              <span className="sp-card-mode">{result.mode === 'exact' ? 'EXACT' : 'ESTIMATE'}</span>
            </button>
            <div className="sp-card-L sp-Lval">+{b.score.toFixed(2)} L</div>
            <div className="small muted">{b.descriptor}</div>
            <ul className="sp-card-skills">
              {b.skills.map((id) => {
                const skill = skillById.get(id);
                return (
                  <li key={id}>
                    {skill && <GameIcon kind="skill" id={skill.iconId} size={16} alt="" />}
                    {skill?.nameEn ?? id}
                  </li>
                );
              })}
            </ul>
            <footer className="small muted">
              {b.spUsed} SP used · {b.spLeft < 0 ? <span className="sp-over">over by {-b.spLeft}</span> : `${b.spLeft} left`}
            </footer>
            <button type="button" className="sp-compare-btn" onClick={() => onCompare(i)}>
              Compare vs veteran →
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/features/sp-optimizer/BuildCards.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/sp-optimizer/BuildCards.tsx src/features/sp-optimizer/BuildCards.test.tsx
git commit -m "feat(m2): selectable basket cards, generic labels, compare hook"
```

---

## Task 8: `BuildSpCard` — source control + build chips + SP + Load-uma-plan

**Files:**
- Create: `src/features/sp-optimizer/BuildSpCard.tsx`
- Test: `src/features/sp-optimizer/BuildSpCard.test.tsx`

**Interfaces:**
- Consumes: `CaptureBundle`/`BuildContext` (`@/core/spOptimizer`); `useGameData` (uma/skill lookups); the app's `CmPlan` via a passed-in `plan` prop (keep the component provider-light — the page supplies `plan`).
- Produces: `<BuildSpCard bundle source spBudget onSourceChange onSpChange plan onLoadPlan />`:
  - `source: 'memory'|'manual'|'ocr'|'video'`; segmented control `[📷 Import][Manual][Carry from M4]` maps to the page's import/manual/wishlist actions via `onSourceChange`.
  - Build chips: uma name + strategy, aptitude grades, stat line (from `bundle.context`; render "—" when no bundle).
  - Editable SP (`onSpChange(n)`), labelled "Available SP".
  - `onLoadPlan(planId)` — the page resolves the plan → prefills matching skills as locked (the lock-prefill logic lives in the page; this only fires the intent + shows the match-summary chips passed in as `matchSummary`).

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/sp-optimizer/BuildSpCard.test.tsx
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/features/data/gameData', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/data/gameData')>();
  const { fixtureGameData } = await import('@/features/testing/fixtureGameData');
  return { ...actual, useGameData: () => ({ ...fixtureGameData(), status: 'ready' as const }) };
});

import { BuildSpCard } from '@/features/sp-optimizer/BuildSpCard';

afterEach(cleanup);
const ctx = {
  umaId: '100101', stats: { spd: 1240, sta: 720, pow: 940, gut: 480, wit: 660 },
  aptitudes: { distance: 'A' as const, surface: 'A' as const, strategy: 'A' as const },
  strategy: 'pace' as const, courseId: '10906', spBudget: 2400, ownedSkills: [], pinned: [], candidates: [],
};

describe('BuildSpCard', () => {
  it('renders the stat line and editable SP, and reports SP edits', async () => {
    const onSpChange = vi.fn();
    render(<BuildSpCard context={ctx} source="memory" onSourceChange={() => {}} onSpChange={onSpChange} onLoadPlan={() => {}} plans={[]} matchSummary={null} />);
    expect(screen.getByText(/SPD 1240/)).toBeInTheDocument();
    const sp = screen.getByLabelText('Available SP');
    await userEvent.clear(sp); await userEvent.type(sp, '2000');
    expect(onSpChange).toHaveBeenLastCalledWith(2000);
  });
  it('fires onSourceChange from the segmented control', async () => {
    const onSourceChange = vi.fn();
    render(<BuildSpCard context={ctx} source="memory" onSourceChange={onSourceChange} onSpChange={() => {}} onLoadPlan={() => {}} plans={[]} matchSummary={null} />);
    await userEvent.click(screen.getByRole('button', { name: /Manual/i }));
    expect(onSourceChange).toHaveBeenCalledWith('manual');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/sp-optimizer/BuildSpCard.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```tsx
// src/features/sp-optimizer/BuildSpCard.tsx
import type { BuildContext, CaptureBundle } from '@/core/spOptimizer';
import { useGameData } from '@/features/data/gameData';

export interface PlanOption { id: string; label: string }
export interface MatchSummary { locked: string[]; matched: number; notBuyable: number }

export interface BuildSpCardProps {
  context: BuildContext | null;
  source: CaptureBundle['source'];
  onSourceChange: (s: 'memory' | 'manual' | 'ocr') => void;
  onSpChange: (n: number) => void;
  onLoadPlan: (planId: string) => void;
  plans: PlanOption[];
  matchSummary: MatchSummary | null;
}

const SOURCES: { key: 'memory' | 'manual' | 'ocr'; label: string }[] = [
  { key: 'memory', label: '📷 Import' },
  { key: 'manual', label: 'Manual' },
  { key: 'ocr', label: 'Carry from M4' },
];

export function BuildSpCard(props: BuildSpCardProps) {
  const { context, source, onSourceChange, onSpChange, onLoadPlan, plans, matchSummary } = props;
  const { umaById } = useGameData();
  const uma = context ? umaById?.get(context.umaId) : undefined; // umaById is optional on GameData
  const s = context?.stats;
  return (
    <div className="sp-buildcard">
      <div className="sp-buildcard-row">
        <span className="sp-seg" role="group" aria-label="Input source">
          {SOURCES.map((o) => (
            <button key={o.key} type="button" className={source === o.key ? 'on' : ''} aria-pressed={source === o.key} onClick={() => onSourceChange(o.key)}>
              {o.label}
            </button>
          ))}
        </span>
        {context && (
          <>
            <span className="sp-chip">🐎 {uma?.nameEn ?? context.umaId} · {context.strategy}</span>
            <span className="sp-chip">Apt {context.aptitudes.surface} · {context.aptitudes.distance} · {context.aptitudes.strategy}</span>
            {s && <span className="sp-chip">SPD {s.spd} · STA {s.sta} · PWR {s.pow} · GUT {s.gut} · WIT {s.wit}</span>}
          </>
        )}
        <label className="sp-available">
          <span className="muted small">Available SP</span>
          <input type="number" aria-label="Available SP" value={context?.spBudget ?? 0} onChange={(e) => onSpChange(Number(e.target.value))} />
        </label>
      </div>
      <div className="sp-buildcard-row sp-loadplan">
        <label>
          <span className="muted small">Load uma plan</span>
          <select aria-label="Load uma plan" value="" onChange={(e) => e.target.value && onLoadPlan(e.target.value)}>
            <option value="">📋 choose…</option>
            {plans.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </label>
        {matchSummary && (
          <span className="sp-match">
            {matchSummary.locked.map((id) => <span key={id} className="sp-chip">🔒 {id}</span>)}
            <span className="sp-chip">{matchSummary.matched} matched</span>
            {matchSummary.notBuyable > 0 && <span className="sp-chip">{matchSummary.notBuyable} not yet buyable</span>}
          </span>
        )}
      </div>
    </div>
  );
}
```

> `umaById` is an **optional** field on the `useGameData()` result (`umaById?: Map<...>`) — use `umaById?.get(...)`. If a uma isn't resolvable, the chip falls back to the id — acceptable.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/features/sp-optimizer/BuildSpCard.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/sp-optimizer/BuildSpCard.tsx src/features/sp-optimizer/BuildSpCard.test.tsx
git commit -m "feat(m2): Build & SP card (source control, chips, SP, load-plan)"
```

---

## Task 9: Page integration — two-tab shell, working state, Re-analyze, F2 placeholder

**Files:**
- Create: `src/features/sp-optimizer/ComparePlaceholder.tsx`
- Modify: `src/features/sp-optimizer/SpOptimizerPage.tsx`
- Modify: `src/features/sp-optimizer/SpOptimizerPage.test.tsx`

**Interfaces:**
- Consumes: everything above; existing `importFile`/`copyWishlist`/`parseCareerCapture`/`useCaptures`/`rankBasketsWithEngine`.
- Produces: the wired page. Tab state, working edits (`pins`/`costEdits`/`hintEdits`/`fastLearner`/`selectedIdx`/`stale`), Re-analyze (merges via `applyWorkingState` → `rankBasketsWithEngine`). "Compare vs veteran →" sets `activeTab='compare'`.

- [ ] **Step 1: ComparePlaceholder + failing page test**

Create the placeholder:

```tsx
// src/features/sp-optimizer/ComparePlaceholder.tsx
export function ComparePlaceholder() {
  return (
    <div className="sp-f2" role="note">
      <h3>Simulation lab — coming in F2</h3>
      <p className="muted small">
        Race a chosen basket head-to-head against a saved veteran, a custom community build,
        or another basket — win-rate, bashin gap, and a full race trace. Not built yet.
      </p>
    </div>
  );
}
```

Update the page test — keep the two existing tests working (they mock `rankBasketsWithEngine` and assert import behavior), and add tab + Re-analyze + stale coverage:

```tsx
// add to src/features/sp-optimizer/SpOptimizerPage.test.tsx (inside describe)
it('shows the two tabs and the F2 placeholder on the compare tab', async () => {
  const user = userEvent.setup();
  render(<SpOptimizerPage />);
  await user.click(screen.getByRole('tab', { name: /Compare vs veteran/i }));
  expect(screen.getByText(/coming in F2/i)).toBeInTheDocument();
});

it('marks the result stale after a pin and clears it on Re-analyze', async () => {
  const user = userEvent.setup();
  render(<SpOptimizerPage />);
  await user.click(screen.getByRole('button', { name: /Copy from M4 wishlist/i }));
  await user.click(screen.getByRole('button', { name: /^Analyze$|Re-analyze/i }));
  await screen.findByText('Suggested baskets');
  await user.click(screen.getByRole('button', { name: /Lock 200332/i }));
  expect(screen.getByText(/changes detected/i)).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /Re-analyze/i }));
  await screen.findByText('Suggested baskets');
  expect(screen.queryByText(/changes detected/i)).not.toBeInTheDocument();
});
```

> The existing `rankBasketsWithEngine` mock must now return `candidates: [{ skillId: '200332', rarity: 'white', deltaL: 1, screenSpCost: 110, lPerSp: 9, pinned: false }]` and `greedyScore: 0` in addition to `baskets`. Update the mock object in the test's `vi.mock`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/sp-optimizer/SpOptimizerPage.test.tsx`
Expected: FAIL — no `tab` roles / no Re-analyze / no stale text yet.

- [ ] **Step 3: Rework the page**

Replace `SpOptimizerPage.tsx` with the two-tab, table-led shell. Preserve the existing import/wishlist/careerCapture/save logic; add working state + Re-analyze.

```tsx
// src/features/sp-optimizer/SpOptimizerPage.tsx  (replace file)
import { useMemo, useState } from 'react';

import { useActivePlan } from '@/app/ActivePlanContext';
import { parseCareerCapture } from '@/core/careerCapture';
import type { HintLevel } from '@/core/cost';
import {
  type BuildContext, type BuyableSkill, type CaptureBundle,
  parseCaptureBundle, wishlistToCandidates,
} from '@/core/spOptimizer';
import { useGameData } from '@/features/data/gameData';
import { BuildCards } from '@/features/sp-optimizer/BuildCards';
import { BuildSpCard } from '@/features/sp-optimizer/BuildSpCard';
import { BuyableSkillsTable } from '@/features/sp-optimizer/BuyableSkillsTable';
import { ComparePlaceholder } from '@/features/sp-optimizer/ComparePlaceholder';
import { ResultBanner } from '@/features/sp-optimizer/ResultBanner';
import { type RankResult, rankBasketsWithEngine } from '@/features/sp-optimizer/rankBaskets';
import { applyWorkingState, type WorkingEdits } from '@/features/sp-optimizer/optimizerState';
import { useCaptures } from '@/features/sp-optimizer/useCaptures';
import './sp-optimizer.css';

const EMPTY_EDITS = (): WorkingEdits => ({ pins: new Set(), costEdits: new Map(), hintEdits: new Map(), fastLearner: false });

export function SpOptimizerPage() {
  const { status, skillById, sparkRates } = useGameData();
  const { plan } = useActivePlan();
  const captures = useCaptures();

  const [activeTab, setActiveTab] = useState<'optimize' | 'compare'>('optimize');
  const [bundle, setBundle] = useState<CaptureBundle | null>(null);
  const [edits, setEdits] = useState<WorkingEdits>(EMPTY_EDITS);
  const [result, setResult] = useState<RankResult | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [stale, setStale] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [label, setLabel] = useState('');

  // The working bundle = the captured bundle with pins/cost/hint edits applied.
  const workingBundle = useMemo(
    () => (bundle ? applyWorkingState(bundle, edits, skillById, sparkRates) : null),
    [bundle, edits, skillById, sparkRates],
  );

  function seedBundle(next: CaptureBundle) {
    setBundle(next);
    setEdits(EMPTY_EDITS());
    setResult(null);
    setSelectedIdx(0);
    setStale(false);
    setImportError(null);
  }

  async function importFile(file: File) {
    try {
      const text = await file.text();
      let data: unknown;
      try { data = JSON.parse(text); } catch { throw new Error('Not valid JSON'); }
      const isRaw = typeof data === 'object' && data !== null && Array.isArray((data as { skills?: unknown }).skills);
      const dataVersion = skillById.values().next().value?.dataVersion ?? 'unknown';
      const parsed = isRaw
        ? parseCareerCapture(data, { skillById, courseId: plan?.cmRef.courseId ?? '10906', umaId: plan?.umaId ?? '', dataVersion })
        : parseCaptureBundle(data);
      seedBundle(parsed);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err));
    }
  }

  function copyWishlist() {
    if (!plan) return;
    const candidates: BuyableSkill[] = wishlistToCandidates(plan.wishlist, skillById);
    const context: BuildContext = {
      umaId: plan.umaId, stats: { spd: 800, sta: 600, pow: 600, gut: 400, wit: 600 },
      aptitudes: { distance: 'A', surface: 'A', strategy: 'A' }, strategy: 'pace',
      courseId: plan.cmRef.courseId ?? '10906', spBudget: 1200, ownedSkills: [], pinned: [], candidates,
    };
    seedBundle({ schemaVersion: 1, source: 'ocr', capturedAt: '', server: 'global', dataVersion: 'unknown', context });
  }

  async function reAnalyze() {
    if (!workingBundle) return;
    setAnalyzing(true);
    try {
      const ranked = await rankBasketsWithEngine(workingBundle);
      setResult(ranked);
      setSelectedIdx(0);
      setStale(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAnalyzing(false);
    }
  }

  const markStale = () => { if (result) setStale(true); };
  const togglePin = (id: string) => { setEdits((e) => { const pins = new Set(e.pins); pins.has(id) ? pins.delete(id) : pins.add(id); return { ...e, pins }; }); markStale(); };
  const editCost = (id: string, cost: number) => { setEdits((e) => ({ ...e, costEdits: new Map(e.costEdits).set(id, cost) })); markStale(); };
  const setHint = (id: string, lvl: HintLevel) => { setEdits((e) => ({ ...e, hintEdits: new Map(e.hintEdits).set(id, lvl) })); markStale(); };
  const setSp = (n: number) => { setBundle((b) => b ? { ...b, context: { ...b.context, spBudget: n } } : b); markStale(); };

  function saveCurrent() {
    if (!workingBundle) return;
    captures.save(label.trim() || 'Untitled capture', workingBundle);
    setLabel('');
  }

  if (status === 'loading') return <p className="muted">Loading…</p>;

  const rows = result?.candidates ?? (workingBundle?.context.candidates.map((c) => ({
    skillId: c.skillId, rarity: c.rarity, deltaL: 0, screenSpCost: c.screenSpCost,
    lPerSp: 0, hintLevel: c.hintLevel, prereqSkillId: c.prereqSkillId, pinned: edits.pins.has(c.skillId),
  })) ?? []);

  return (
    <div className="sp-page">
      <p className="sp-caveat small" role="note">
        Estimation, not a verdict (P3). The sim can't see positional chaos or opponent procs — treat a basket as a strong prior, then test in room matches.
      </p>

      <div className="sp-imports">
        <label className="sp-import">
          Import capture (.json)
          <input type="file" accept="application/json,.json" onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f); }} />
        </label>
        <button type="button" onClick={copyWishlist} disabled={!plan || plan.wishlist.length === 0}>Copy from M4 wishlist</button>
      </div>
      {importError && <p className="error" role="alert">Import failed: {importError}</p>}

      <BuildSpCard
        context={workingBundle?.context ?? null}
        source={bundle?.source ?? 'manual'}
        onSourceChange={() => { /* import/manual/wishlist handled by the controls above (F1.5) */ }}
        onSpChange={setSp}
        onLoadPlan={() => { /* plan lock-prefill wired in the follow-up; copyWishlist covers the seed today */ }}
        plans={[]}
        matchSummary={null}
      />

      <div className="sp-tabs" role="tablist">
        <button role="tab" aria-selected={activeTab === 'optimize'} className={activeTab === 'optimize' ? 'on' : ''} onClick={() => setActiveTab('optimize')}>Optimize basket</button>
        <button role="tab" aria-selected={activeTab === 'compare'} className={activeTab === 'compare' ? 'on' : ''} onClick={() => setActiveTab('compare')}>Compare vs veteran</button>
      </div>

      {activeTab === 'compare' ? (
        <ComparePlaceholder />
      ) : (
        <>
          <div className="sp-analyze-row">
            <button type="button" className="sp-analyze" onClick={() => void reAnalyze()} disabled={!workingBundle || analyzing}>
              {analyzing ? 'Analyzing…' : result ? 'Re-analyze' : 'Analyze'}
            </button>
            {stale && <span className="sp-stale" role="status">⚠ changes detected — Re-analyze</span>}
          </div>
          {error && <p className="error" role="alert">Could not analyze: {error}</p>}

          {result && <ResultBanner result={result} selectedIdx={selectedIdx} spBudget={workingBundle?.context.spBudget ?? 0} />}

          {rows.length > 0 && (
            <BuyableSkillsTable
              result={result}
              rows={rows}
              selectedIdx={selectedIdx}
              pins={edits.pins}
              onTogglePin={togglePin}
              onEditCost={editCost}
              onSetHint={setHint}
            />
          )}

          {result && (
            <section aria-labelledby="sp-results-h">
              <h2 id="sp-results-h">Suggested baskets</h2>
              <BuildCards result={result} selectedIdx={selectedIdx} onSelect={setSelectedIdx} onCompare={() => setActiveTab('compare')} />
              <div className="sp-save">
                <label>Save as <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. CM14 ace" /></label>
                <button type="button" onClick={saveCurrent}>Save capture</button>
              </div>
            </section>
          )}
        </>
      )}

      <section aria-labelledby="sp-saved-h">
        <h2 id="sp-saved-h">Saved captures</h2>
        {captures.error !== null && <p className="error" role="alert">Captures error: {captures.error}</p>}
        {captures.items === null ? <p className="muted">Loading…</p> : captures.items.length === 0 ? (
          <p className="muted small">No saved captures yet.</p>
        ) : (
          <ul className="sp-saved">
            {captures.items.map((c) => (
              <li key={c.id}>
                <button type="button" className="sp-load" onClick={() => seedBundle(c.bundle)}>{c.label}</button>
                <button type="button" aria-label={`Delete ${c.label}`} onClick={() => captures.remove(c.id)}>✕</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
```

> This drops the standalone `BuildContextForm` from the page's main flow (candidate entry now lives in the table + import/wishlist seeds). Leave `BuildContextForm.tsx` in the tree for now (manual raw-add is a fast follow); if its test references removed page wiring, keep the component's own test green and unlink it from the page test. `onSourceChange`/`onLoadPlan` are intentionally inert stubs this branch — the segmented control + plan-prefill behaviors are the F1.5 follow-up noted in the spec; `copyWishlist` + import already cover seeding.

- [ ] **Step 4: Run the page tests**

Run: `pnpm vitest run src/features/sp-optimizer/SpOptimizerPage.test.tsx`
Expected: PASS (existing import/analyze tests + the new tab/stale tests). Adjust the `rankBasketsWithEngine` mock to include `candidates`/`greedyScore` as noted.

- [ ] **Step 5: Commit**

```bash
git add src/features/sp-optimizer/SpOptimizerPage.tsx src/features/sp-optimizer/ComparePlaceholder.tsx src/features/sp-optimizer/SpOptimizerPage.test.tsx
git commit -m "feat(m2): two-tab table-led optimizer page + Re-analyze + F2 placeholder"
```

---

## Task 10: Styling + full verification

**Files:**
- Modify: `src/features/sp-optimizer/sp-optimizer.css`
- Verify: whole suite + typecheck + build + manual smoke.

**Interfaces:** none (CSS + verification only).

- [ ] **Step 1: Add the styles**

Append theme-aware rules to `sp-optimizer.css` using existing tokens. Cover: `.sp-page` (flex column), `.sp-buildcard` + `.sp-seg`/`.sp-chip`/`.sp-available`, `.sp-tabs [role=tab]` (blue underline on `.on`), `.sp-banner` (green, 3 regions) + `.sp-bar`, `.sp-table` (header, row tints `.sp-row.is-lock`/`.is-buy`/`.is-avail`, `.sp-lock`, `.sp-kind.is-*` mapped to effect-tone tokens, `.sp-cost .was` struck, `.sp-hint button.on`), `.sp-cards-row`/`.sp-card.is-selected` (blue ring) + `.sp-compare-btn`, `.sp-analyze`/`.sp-stale` (amber), `.sp-f2`. Example anchor block:

```css
.sp-page { display: flex; flex-direction: column; gap: 0.9rem; padding: 1rem 1.4rem; }
.sp-tabs { display: inline-flex; gap: 0.25rem; border-bottom: 1px solid var(--border); }
.sp-tabs [role='tab'] { background: none; border: 0; padding: 0.4rem 0.8rem; color: var(--fg-muted); border-bottom: 2px solid transparent; }
.sp-tabs [role='tab'].on { color: var(--accent); border-bottom-color: var(--accent); }
.sp-banner { display: grid; grid-template-columns: auto 1fr auto; gap: 1rem; align-items: center;
  background: color-mix(in srgb, var(--tier-good, #22a75a) 12%, var(--bg-1)); border: 1px solid var(--border); border-radius: 10px; padding: 0.7rem 1rem; }
.sp-Lval { color: var(--tier-good, #22a75a); font-weight: 700; font-variant-numeric: tabular-nums; }
.sp-row.is-lock { background: color-mix(in srgb, var(--warn, #b45309) 10%, transparent); }
.sp-row.is-buy { background: color-mix(in srgb, var(--tier-good, #22a75a) 8%, transparent); }
.sp-row.is-avail { opacity: 0.55; }
.sp-card.is-selected { outline: 2px solid var(--accent); }
.sp-stale { color: var(--warn, #b45309); font-size: 0.85em; }
```

> Match the exact token names already present in `src/styles/design-system/tokens.css` (`--tier-*`, `--warn*`); use `color-mix` fallbacks so both themes read. Keep the pre-existing `.sp-*` rules that other elements still use.

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: no errors. (Common fixes: `HintLevel` import from `@/core/cost`; `umaById` presence on `useGameData()`; exact-optional props spread for `hintLevel`/`prereqSkillId`.)

- [ ] **Step 3: Full test run**

Run: `pnpm test`
Expected: all M2 tests green + no regressions elsewhere. (If vitest flakes with a `pnpm dev` server running — see CLAUDE.md — re-run the file; trust `pnpm build`.)

- [ ] **Step 4: Build**

Run: `pnpm build`
Expected: typecheck + vite build succeed; the engine stays a shared lazy chunk (SpOptimizerPage does not inline wasm).

- [ ] **Step 5: Manual smoke (real app)**

Use the `run` skill (or `pnpm dev`, surface the tailnet URL from `.env.local`). On `/sp-optimizer`: Copy from M4 wishlist → Analyze → table shows ΔL/L-SP + banner + 3 cards; pin a skill → "changes detected" → Re-analyze clears it; change a hint level → cost reprices + stale; select card #2 → table buy/cut + banner update; Compare tab → F2 placeholder. Check light + dark.

- [ ] **Step 6: Commit**

```bash
git add src/features/sp-optimizer/sp-optimizer.css
git commit -m "feat(m2): optimizer Tab 1 styling + verification pass"
```

---

## Self-Review

**Spec coverage:**
- Source segmented control + Build & SP chips + editable SP → Task 8. ✓ (behavior of source-switch/load-plan explicitly deferred to F1.5 — noted inline + in the page stub.)
- Load-uma-plan lock-prefill → **partially** Task 8/9: the seed path (Copy-from-M4) + match-summary UI exist; the auto-lock-of-matching-skills interaction is stubbed (`onLoadPlan` inert) and called out as the F1.5 follow-up. This is a deliberate scope trim, flagged, not a silent gap.
- Two-tab shell + F2 placeholder → Task 9. ✓
- Result banner (optimal/EXACT-ESTIMATE/vs-greedy/SP) → Tasks 2 (greedyScore) + 5. ✓
- Skills table (lock tri-state, skill+kind chip, +white base, ΔL, cost struck+editable, L/SP, hint reprice, buy/cut) → Tasks 3/4/6. ✓
- 3 selectable cards, generic labels, no win% → Task 7. ✓
- Per-candidate rows on `RankResult` (reuse ΔL) → Task 2. ✓
- Cost math reuse (`purchaseSpCost`) → Task 4. ✓
- Honest metrics (mean L + spread, generic tags) → Tasks 2/7. ✓
- Re-analyze/stale (M4 pattern) → Task 9. ✓
- Theme-aware styling → Task 10. ✓
- F2 seam (card = SimBuild, compare button switches tab) → Tasks 7/9. ✓

**Placeholder scan:** No "TBD/TODO/handle edge cases"; the only deferrals (source-switch actions, plan auto-lock) are explicit, scoped, and reasoned — not hand-waves.

**Type consistency:** `CandidateRow` fields identical across Tasks 2/4/6. `HintLevel` sourced from `@/core/cost` everywhere. `RankResult` gains `candidates`+`greedyScore` in Task 2 and every later consumer expects exactly those. `basketBuyCut`/`applyWorkingState` signatures match their call sites in Tasks 6/9. `BuildCards` props (`selectedIdx`/`onSelect`/`onCompare`) match the page. `describeStats` output (`+X lengths · <spread> spread`) is what cards render as the descriptor.
