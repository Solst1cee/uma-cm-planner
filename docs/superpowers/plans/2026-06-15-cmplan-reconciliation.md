# CmPlan Reconciliation + cost.ts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the shipped `CmPlan` to the canonical contract (`docs/superpowers/specs/2026-06-15-shared-data-model.md`) and extract the SP-cost logic into `src/core/cost.ts` (fixing the Fast Learner bug to additive), keeping all 300 tests green.

**Architecture:** Plan 1 of the M1+reshape initiative. Three tasks: (1) extract `cost.ts` (self-contained, also fixes the multiplicative→additive Fast Learner bug); (2) add the canonical primitive tokens + forward types additively (no consumer breaks); (3) the atomic `CmPlan` reshape across types/core/features/db/tests. The flat `Parent` type + `parents` Dexie store are **deliberately untouched** — the nested-`Parent`/`RosterEntry` rewrite opens Plan 2 (M1), where grandparent-resolution + affinity live.

**Tech Stack:** TypeScript strict (`bundler` resolution, `verbatimModuleSyntax`, `noUncheckedIndexedAccess`), Vite + React 19, Vitest (jsdom). Worktree: `.claude/worktrees/feat+shared-types-reconciliation`, branch `worktree-feat+shared-types-reconciliation`. Run a single test file: `pnpm vitest run <path>`; full gate `pnpm typecheck && pnpm test`.

---

## Reconciliation decisions (resolve spec/code drift — baked into this plan)

- **D1 — `Parent` stays flat.** The canonical nested `Parent` + `RosterEntry` *store* + `spark.ts` rewrite are **out of scope** here; they open Plan 2 (M1). We DO add `ParentSparks` + `RosterEntry` *types* (no name collision; forward types for M1). The shipped flat `Parent`/`ParentRef` and the `parents` Dexie store are unchanged.
- **D2 — `WishlistItem` keeps `priority`.** The shared-data-model §4 omitted it, but M4 coverage sorts/weights by `priority` (CLAUDE.md). We add `priority: Priority` to `WishlistItem`. *(Action: update the spec §4 to include `priority`.)*
- **D3 — `CmRef` carries geometry (pragmatic superset).** The spec's minimal `CmRef = {cmId, cmNumber, courseId}` derives surface/distance from `courseId` via M3's `cm_schedule` (not built yet). To bound M4 churn now, **`CmRef` keeps the old `race` geometry fields**: `{ cmId, cmNumber, courseId, surface, distance, condition?, season? }`. `cmId`/`cmNumber` are stubbed (parsed from the preset name, else `0`) until M3's `cm_schedule` lands. *(Action: note this superset in the spec; M3 plan tightens it.)*
- **D4 — Fast Learner is additive.** `cost.ts` implements hint% + FL% as one multiply (`base × (1 − hint − 0.1)`), per `mechanics-notes §7/§10` + the 2026-06-15 screenshot. The two `coverage.test.ts` Fast-Learner cases that assert the old ×0.81 are corrected to ×0.8.
- **D5 — Gold ×2 premium stays a documented TODO.** `bundledSpCost` keeps its current gold+white sum (no ×2) with a TODO citing `mechanics-notes §10 item 8` (bundle-vs-flat-×2 unresolved). No behavior change to gold pricing in this plan.
- **D6 — New required `CmPlan` fields are defaulted, not yet UI-exposed.** `makeDefaultPlan` populates every new required field (`role`, `strategy`, `statProfile`, `umaId`, `uniqueSkillId`, `sparkGoals`, `patch`, `server`, `dataVersion`, `planNumber`). Editors for `role`/`strategy`/`statProfile` are M4 UI work for a later plan; here they just hold valid defaults.
- **D7 — `lockedDeckSlots` kept (canonical `deck` deferred).** The shipped `lockedDeckSlots` (`{slot, cardType?, cardId?}` locks) is RETAINED — the spec's `deck: OwnedCard[]` is a behavior reduction (loses slot/cardType locks), deferred to a later M-plan. So `deck.ts`/`DeckSuggesterPanel`/exportImport are unchanged for that field; M4's deck suggester behaves exactly as today.

---

## File Structure

| File | Change |
|---|---|
| `src/core/cost.ts` | **Create.** Move `HintLevel`, `expectedHintLevel`, `hintDiscountFraction`, `discountedComponent`, `effectiveSpCost`, `bundledSpCost` out of `coverage.ts`; fix Fast Learner additive. |
| `src/core/coverage.ts` | Remove the moved fns; import them from `@/core/cost`; re-export `effectiveSpCost`/`bundledSpCost`/`expectedHintLevel`/`HintLevel` for back-compat. Reshape `CmPlan` reads (`targetSkills`→`wishlist`, `scenario.id`→`scenarioId`). |
| `src/core/types.ts` | Add tokens (`Grade`,`Role`,`Strategy`,`Mood`,`AptKey`,`CmId`,`CmRef`), `ParentSparks`, `RosterEntry`, `WishlistItem`; replace `CmPlan`. Keep flat `Parent`/`ParentRef`. |
| `src/core/deck.ts` | `targetSkills`→`wishlist`, `scenario.id`→`scenarioId`; `lockedDeckSlots` unchanged (D7). |
| `src/core/contingency.ts`, `*.test.ts` | Re-point cost imports to `@/core/cost`. |
| `src/core/fixtures.ts` | New `FIXTURE_PLAN` shape. |
| `src/core/coverage.test.ts`, `deck.test.ts`, `spark.test.ts`, `contingency.test.ts` | `makePlan`/`makeParent` helpers + cost-import split + the two FL assertions. |
| `src/app/ActivePlanContext.tsx` | `makeDefaultPlan` → full new `CmPlan`. |
| `src/features/skill-planner/PlanHeaderPanel.tsx` (+ test) | `race`→`cmRef`, `targetSkills`→`wishlist`, `scenario.id`→`scenarioId`, `month`→`cmRef`/name. |
| `src/features/skill-planner/DeckSuggesterPanel.tsx` (+ test) | `targetSkills`→`wishlist`; `lockedDeckSlots` unchanged (D7). |
| `src/features/coverage/*` (`useChosenParents`, `CoverageMatrixPanel`, `SparkContingencyPanel`, tests) | `chosenParents`→`parents.{a,b}`, `targetSkills`→`wishlist`, cost import. |
| `src/features/parents/ChosenParentsPicker.tsx` (+ test) | `chosenParents`→`parents.{a,b}`. |
| `src/features/data/gameData.ts`, `src/features/testing/fixtureGameData.ts`, `src/features/data/iconRetrofit.test.tsx` | Fixture plan shape. |
| `src/db/db.ts` | `version(2).stores` — drop `month` from `cmPlans` index. |
| `src/db/api.ts` | `listPlans` orderBy `month`→ in-memory sort by `cmRef`/name (month gone). |
| `src/db/exportImport.ts` (+ test) | `parseCmPlan` new shape; bump `ExportBlob` to v2. |

---

## Task 1: Extract `src/core/cost.ts` + fix Fast Learner (additive)

**Files:**
- Create: `src/core/cost.ts`
- Modify: `src/core/coverage.ts` (remove moved fns, import+re-export from cost)
- Modify: `src/core/contingency.ts:10`, `src/core/contingency.test.ts:10`, `src/core/coverage.test.ts:10`, `src/features/coverage/CoverageMatrixPanel.tsx` (cost imports)
- Modify: `src/core/coverage.test.ts` (correct the two Fast-Learner assertions)

- [ ] **Step 1: Create `src/core/cost.ts`**

```ts
// SP-cost + hint-discount model — shared by M4 coverage and (future) M2 spOptimizer
// (shared-data-model §7: "one cost module"). Extracted from coverage.ts.
import type { SkillRecord, SparkRates, SupportCardRecord, CardSkill } from '@/core/types';
import type { CoverageSource } from '@/core/types';

export type HintLevel = 0 | 1 | 2 | 3 | 4 | 5;

/** Hint level for a hinted source: card effect-17 passive (at the owning copy's LB) + base. */
export function expectedHintLevel(
  source: CoverageSource,
  card: SupportCardRecord | undefined,
  skill: CardSkill | undefined,
): HintLevel {
  if (source.kind !== 'hint_strong' && source.kind !== 'hint_weak') return 0;
  const base = skill?.hintLevels ?? 1;
  const perLevel = card?.perLevel.find((p) => p.limitBreak === source.limitBreak);
  const passive = perLevel?.hintLevels ?? 0;
  return Math.min(5, Math.max(0, Math.floor(base + passive))) as HintLevel;
}

/** Cumulative hint discount fraction [10,20,30,35,40]% at Lv1–5; 0 at Lv0. */
export function hintDiscountFraction(level: HintLevel, rates: SparkRates): number {
  if (level === 0) return 0;
  return (rates.hintDiscountCumulativePct[level - 1] ?? 0) / 100;
}

/**
 * Discounted (pre-ceil) cost. Fast Learner (切れ者) stacks **ADDITIVELY** with the hint
 * discount — hint% + 10%, a single multiply (mechanics-notes §7/§10 item 7). Verified by a
 * real Global screenshot (2026-06-15, spikes/ocr/): at Hint Lv1 + FL, base 160→128, 200→160
 * (×0.8), NOT ×0.81. The old multiplicative `× rates.fastLearnerMultiplier` was wrong.
 */
export function discountedComponent(
  skill: SkillRecord,
  level: HintLevel,
  rates: SparkRates,
  opts?: { fastLearner?: boolean },
): number {
  const discount = hintDiscountFraction(level, rates) + (opts?.fastLearner ? 0.1 : 0);
  return skill.baseSpCost * (1 - discount);
}

/** Effective single-skill SP cost (ceil after discount). */
export function effectiveSpCost(
  skill: SkillRecord,
  expectedHintLevelValue: HintLevel,
  rates: SparkRates,
  opts?: { fastLearner?: boolean },
): number {
  return Math.ceil(discountedComponent(skill, expectedHintLevelValue, rates, opts));
}

/** Gold + its white prerequisite, summed before one ceil (gold bundles its white). */
export function bundledSpCost(
  gold: SkillRecord,
  whitePrereq: SkillRecord,
  hintLevelGold: HintLevel,
  hintLevelWhite: HintLevel,
  rates: SparkRates,
  opts?: { fastLearner?: boolean },
): number {
  // TODO (mechanics-notes §10 item 8): gold's on-screen cost is ~2× its white-equivalent base
  // (the 2× lives in derivation, not the stored baseSpCost). bundle-vs-flat-×2 is unresolved —
  // this keeps the current gold+white sum (no ×2) until a disambiguating screenshot settles it.
  return Math.ceil(
    discountedComponent(gold, hintLevelGold, rates, opts) +
      discountedComponent(whitePrereq, hintLevelWhite, rates, opts),
  );
}
```

> NOTE: confirm the import of `CoverageSource`, `CardSkill`, `SupportCardRecord`, `SkillRecord`, `SparkRates` — they live in `@/core/types`. If `verbatimModuleSyntax` flags a value-vs-type issue, all five are types → keep them in `import type`.

- [ ] **Step 2: Remove the moved code from `coverage.ts` and import from cost**

In `src/core/coverage.ts`: delete the local definitions of `HintLevel` (line ~273), `expectedHintLevel` (~300-312), `hintDiscountFraction` (~318-321), `discountedComponent` (~324-333), `effectiveSpCost` (~341-348), `bundledSpCost` (~355-367). Add at the top:

```ts
import { expectedHintLevel, effectiveSpCost, bundledSpCost, hintDiscountFraction, discountedComponent } from '@/core/cost';
import type { HintLevel } from '@/core/cost';
// Back-compat re-exports so existing importers of these from '@/core/coverage' keep working:
export { expectedHintLevel, effectiveSpCost, bundledSpCost } from '@/core/cost';
export type { HintLevel } from '@/core/cost';
```
Keep `hintDiscountFraction`/`discountedComponent` imported only if `coverage.ts` still calls them internally; otherwise drop the unused imports (`noUnusedLocals`).

- [ ] **Step 3: Correct the two Fast Learner test assertions**

In `src/core/coverage.test.ts` (~lines 405-409), the Fast-Learner cases assert the old multiplicative ×0.81. Change them to additive ×0.8. Concretely, for a `baseSpCost: 110` skill at hint Lv4 (35%) + Fast Learner (10%) = 45% → `ceil(110 × 0.55) = 61` (was `65`); at Lv1 (10%) + FL = 20% → `ceil(base × 0.8)`. Update the expected numbers to the additive results and add a comment: `// additive FL: hint% + 10%, one multiply (mechanics-notes §7/§10 item 7; real screenshot 2026-06-15)`. Read the actual cases first and recompute each expected value with the additive formula.

- [ ] **Step 4: Re-point the other cost importers**

- `src/core/contingency.ts:10` and `src/core/contingency.test.ts:10`: split `import { buildCoverageMatrix, bundledSpCost, effectiveSpCost } from '@/core/coverage';` → keep `buildCoverageMatrix` from coverage, move `bundledSpCost, effectiveSpCost` (+ `expectedHintLevel` where used, contingency.ts:74) to `from '@/core/cost'`.
- `src/core/coverage.test.ts:10`: likewise split (it also calls `expectedHintLevel` 32×).
- `src/features/coverage/CoverageMatrixPanel.tsx` (~232-238): the back-compat re-exports mean its existing `from '@/core/coverage'` import still resolves — leave it, OR re-point to `@/core/cost` for cleanliness. Prefer leaving it (back-compat) to minimize churn.

- [ ] **Step 5: Run the gate**

Run: `pnpm typecheck && pnpm vitest run src/core/cost.test.ts src/core/coverage.test.ts src/core/contingency.test.ts`
Expected: typecheck clean; coverage/contingency tests PASS with the corrected FL numbers. (No `cost.test.ts` yet — see Step 6.)

- [ ] **Step 6: Add a focused `cost.ts` test (lock the additive FL + ceil)**

Create `src/core/cost.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { effectiveSpCost, hintDiscountFraction } from './cost';
import { FIXTURE_SPARK_RATES } from './fixtures';
import type { SkillRecord } from './types';

const skill = (baseSpCost: number): SkillRecord => ({
  skillId: 'x', nameEn: 'x', nameJp: 'x', baseSpCost, rarity: 'white', iconId: '0',
  conditions: '', server: 'global', dataVersion: 'test',
});

describe('effectiveSpCost — additive Fast Learner', () => {
  it('Lv1 + FL = 20% off (base×0.8), not ×0.81', () => {
    expect(effectiveSpCost(skill(160), 1, FIXTURE_SPARK_RATES, { fastLearner: true })).toBe(128);
    expect(effectiveSpCost(skill(200), 1, FIXTURE_SPARK_RATES, { fastLearner: true })).toBe(160);
  });
  it('Lv1 without FL = 10% off (ceil)', () => {
    expect(effectiveSpCost(skill(160), 1, FIXTURE_SPARK_RATES)).toBe(144);
  });
  it('hintDiscountFraction is cumulative 10/20/30/35/40', () => {
    expect(hintDiscountFraction(0, FIXTURE_SPARK_RATES)).toBe(0);
    expect(hintDiscountFraction(1, FIXTURE_SPARK_RATES)).toBeCloseTo(0.1);
    expect(hintDiscountFraction(4, FIXTURE_SPARK_RATES)).toBeCloseTo(0.35);
  });
});
```
> Confirm `FIXTURE_SPARK_RATES` is exported from `src/core/fixtures.ts` and that `hintDiscountCumulativePct = [10,20,30,35,40]`. Adjust the `SkillRecord` literal to match the current interface exactly (check `src/core/types.ts`).

Run: `pnpm vitest run src/core/cost.test.ts` → PASS (3).

- [ ] **Step 7: Commit**
```bash
git add src/core/cost.ts src/core/cost.test.ts src/core/coverage.ts src/core/contingency.ts src/core/contingency.test.ts src/core/coverage.test.ts
git commit -m "feat(core): extract src/core/cost.ts; fix Fast Learner to additive (mechanics-notes §7/§10)"
```

---

## Task 2: Add canonical tokens + forward types (additive — nothing breaks)

**Files:** Modify `src/core/types.ts` (additions only; `CmPlan`/`Parent` unchanged this task).

- [ ] **Step 1: Add the primitive tokens + new structures**

In `src/core/types.ts`, near the top (after `Stat`), add:
```ts
export type Grade = 'G' | 'F' | 'E' | 'D' | 'C' | 'B' | 'A' | 'S';
export type Role = 'ace' | 'debuffer' | 'hybrid';
export type Strategy = 'front' | 'pace' | 'late' | 'end';
export type Mood = -2 | -1 | 0 | 1 | 2;
export type AptKey =
  | { kind: 'distance'; key: 'short' | 'mile' | 'medium' | 'long' }
  | { kind: 'surface'; key: 'turf' | 'dirt' }
  | { kind: 'strategy'; key: Strategy };
export type CmId = `CM${number}`;
export interface CmRef {
  cmId: CmId;
  cmNumber: number;
  courseId: string;
  // D3 superset: geometry carried until M3's cm_schedule derives it from courseId.
  surface: 'turf' | 'dirt';
  distance: number;
  condition?: string;
  season?: string;
}
export interface ParentSparks {
  pink: Array<{ aptKey: AptKey; stars: 1 | 2 | 3 }>;
  blue: Array<{ stat: Stat; stars: 1 | 2 | 3 }>;
  green: Array<{ uniqueSkillId: string; stars: 1 | 2 | 3 }>;
  white: Array<{ skillId: string; stars: 1 | 2 | 3 }>;
}
/** UmaExtractor roster target — M1-owned (own Dexie store lands in Plan 2). Forward type. */
export interface RosterEntry {
  id: string;
  umaId: string;
  stats: Record<Stat, number>;
  aptitudes: Array<{ aptKey: AptKey; grade: Grade }>;
  learnedSkills: string[];
  sparks: ParentSparks;
  tags: string[];
  source: 'mine' | 'friend_rental' | 'dummy';
  importSource: 'umaextractor' | 'paste' | 'roster' | 'dummy';
  trainerId?: string;
}
/** M4 wishlist item. `priority` retained (reconciliation D2 — spec §4 omitted it). */
export interface WishlistItem {
  skillId: string;
  priority: Priority;
  source: 'targeted';
  projectedL?: number;
  projectedLStale?: boolean;
  needsInheriting?: boolean;
  doubleUp?: boolean;
  manualAdd?: boolean;
}
```
> `Priority` already exists (`1 | 2 | 3`). `Stat` already exists. Ensure these additions sit before `WishlistItem`/`CmPlan` use them.

- [ ] **Step 2: Gate**

Run: `pnpm typecheck && pnpm test`
Expected: PASS (300) — pure additions, no consumer touched.

- [ ] **Step 3: Commit**
```bash
git add src/core/types.ts
git commit -m "feat(core): canonical tokens + ParentSparks/RosterEntry/WishlistItem (forward types)"
```

---

## Task 3: Reshape `CmPlan` across types, core, features, db, tests (atomic)

This is a coordinated reshape: the type change breaks every consumer until all are updated, so it lands as one task that ends green. Work top-down; run `pnpm typecheck` after each file group to track the shrinking error list; commit once at the end.

**Old → new field map (apply everywhere):**
| Old | New |
|---|---|
| `plan.race` (`{courseId,surface,distance,condition?,season?}`) | `plan.cmRef` (same fields + `cmId`,`cmNumber`) |
| `plan.targetSkills` (`{skillId,priority}[]`) | `plan.wishlist` (`WishlistItem[]`, has `skillId`,`priority`,`source:'targeted'`) |
| `plan.requiredAptitudes` (`{kind,key,target}[]`) | `plan.sparkGoals.pink` (`{aptKey,target:Grade}[]`) + `plan.sparkGoals.blue` (`Partial<Record<Stat,number>>`) |
| `plan.chosenParents` (`[string?,string?]`) | `plan.parents` (`{a?:string; b?:string}`) |
| `plan.scenario` (`{id,isDefault}`) | `plan.scenarioId?` (number) |
| `plan.month` | removed (CM identity is `cmRef.cmId`/`cmNumber`; sort by `name`) |
| `plan.targetUmaId?` (dead) | `plan.umaId` (required) |
| `plan.spBudgetEstimate?` (dead) | removed (SP budget is M2 runtime input) |
| — | NEW required: `planNumber`, `role`, `strategy`, `statProfile`, `uniqueSkillId`, `patch`, `server`, `dataVersion`; optional `remark`, `uniqueIsInherited`, `inheritanceStopgap` |

- [ ] **Step 1: Replace `CmPlan` in `src/core/types.ts`**

Replace the existing `CmPlan` interface with:
```ts
export interface CmPlan {
  id: string;
  name: string;
  planNumber: number;
  remark?: string;
  cmRef: CmRef;
  scenarioId?: number;
  umaId: string;
  uniqueSkillId: string;
  uniqueIsInherited?: boolean;
  role: Role;
  strategy: Strategy;
  statProfile: { stats: Record<Stat, number>; mood: Mood };
  sparkGoals: {
    pink: Array<{ aptKey: AptKey; target: Grade }>;
    blue: Partial<Record<Stat, number>>;
  };
  wishlist: WishlistItem[];
  lockedDeckSlots: Array<{ slot: 0 | 1 | 2 | 3 | 4 | 5; cardType?: CardType; cardId?: string }>;
  parents: { a?: string; b?: string };
  inheritanceStopgap?: { inheritedSkills: string[]; sparks: ParentSparks };
  patch: { version: string; source?: string };
  server: Server;
  dataVersion: string;
}
```
Delete the old `CmPlan` (with `month`/`scenario`/`race`/`targetSkills`/`requiredAptitudes`/`chosenParents`/`targetUmaId`/`spBudgetEstimate`). `CardType`, `Server`, `Stat`, `Priority` already exist. **`lockedDeckSlots` is KEPT** (D7 — preserve M4's slot/cardType/cardId deck locks; the spec's `deck: OwnedCard[]` is deferred), so its consumers (`deck.ts`, `DeckSuggesterPanel`, exportImport) are unchanged for that field.

- [ ] **Step 2: `makeDefaultPlan` in `src/app/ActivePlanContext.tsx`**

Replace `makeDefaultPlan` (lines ~23-51) with:
```ts
const DATA_VERSION = '2026-06-15'; // TODO: source from a generated constant when available

function cmNumberFromName(name: string): number {
  const m = name.match(/CM\s*0*(\d+)/i);
  return m ? Number(m[1]) : 0;
}

export function makeDefaultPlan(presets: CmPreset[]): CmPlan {
  const sorted = [...presets].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const latest = sorted.filter((p) => p.server === 'global').at(-1) ?? sorted.at(-1);
  const cmNumber = latest ? cmNumberFromName(latest.name) : 0;
  return {
    id: crypto.randomUUID(),
    name: latest ? latest.name : 'New CM Plan',
    planNumber: 1,
    cmRef: latest
      ? { cmId: `CM${cmNumber}`, cmNumber, courseId: latest.courseId, surface: latest.surface, distance: latest.distance, season: latest.season, condition: latest.ground }
      : { cmId: 'CM0', cmNumber: 0, courseId: '', surface: 'turf', distance: 1600 },
    scenarioId: 4,
    umaId: '',
    uniqueSkillId: '',
    role: 'ace',
    strategy: 'pace',
    statProfile: { stats: { spd: 0, sta: 0, pow: 0, gut: 0, wit: 0 }, mood: 0 },
    sparkGoals: { pink: [], blue: {} },
    wishlist: [],
    lockedDeckSlots: [],
    parents: {},
    patch: { version: DATA_VERSION },
    server: 'global',
    dataVersion: DATA_VERSION,
  };
}
```
Update the `CmPlan`/`CmPreset` imports as needed; remove the old `scenario`/`race`/`requiredAptitudes`/`targetSkills`/`chosenParents` keys (`lockedDeckSlots` stays, defaulted to `[]`).

- [ ] **Step 3: `coverage.ts`**

- Line ~232: `const targets = [...plan.targetSkills].sort(...)` → `const targets = [...plan.wishlist].sort((a, b) => a.priority - b.priority);` (`WishlistItem` has `priority`).
- Line ~241: `skill.scenarioId === plan.scenario.id` → `skill.scenarioId === plan.scenarioId`.

- [ ] **Step 4: `deck.ts`**

- Line ~132, ~376: `plan.scenario.id` → `plan.scenarioId`.
- Line ~122: `plan.targetSkills` → `plan.wishlist` (it reads `.skillId`/`.priority`).
- Lines ~162-174: the lock loop over `plan.lockedDeckSlots` is **unchanged** (D7 — `lockedDeckSlots` kept). No other edits in `deck.ts`.

- [ ] **Step 5: `PlanHeaderPanel.tsx`** (the heaviest UI file)

Apply, reading each site first:
- `presetMatchesPlan` (~32-39): compare `preset.courseId === plan.cmRef.courseId`, `preset.surface === plan.cmRef.surface`, `preset.distance === plan.cmRef.distance`; drop the `preset.date.slice(0,7) === plan.month` line (use `preset.name === plan.name` or just the geometry match).
- `applyPreset` (~84-88): write `cmRef` (build the full `CmRef` incl `cmId`/`cmNumber` via the same `cmNumberFromName` helper — export it from ActivePlanContext or duplicate a local copy), drop `month`.
- `setRace` (~96): rename to `setCmRef`, patch `plan.cmRef`.
- race input bindings (~134,141,155): bind to `plan.cmRef.courseId/surface/distance`.
- scenario select (~165,169): `plan.scenarioId`; on change `onChange({ ...plan, scenarioId: Number(e.target.value) })` (drop `isDefault`).
- targetSkills (~68-69,181,185,197-201,217-220,235): `plan.wishlist`; when appending a new skill build a full `WishlistItem`: `{ skillId, priority: 3, source: 'targeted', manualAdd: true }`; priority-cycle maps over `plan.wishlist`.
- name binding (~108): unchanged.

- [ ] **Step 6: `DeckSuggesterPanel.tsx`** — `plan.lockedDeckSlots` is **unchanged** (D7); only `plan.targetSkills`→`plan.wishlist` (length checks, deps, the find-by-slot stays).

- [ ] **Step 7: coverage + parents feature files**

- `useChosenParents.ts` (~35): `const { a, b } = plan.parents;` (was `const [id0, id1] = plan.chosenParents`); resolve `[a, b]`.
- `ChosenParentsPicker.tsx` (~47-52): read `plan.parents.a/b`; write `setPlan({ ...plan, parents: { a: next[0], b: next[1] } })`.
- `CoverageMatrixPanel.tsx`/`SparkContingencyPanel.tsx`: `plan.targetSkills`→`plan.wishlist` (length checks, maps), `plan.chosenParents`→`plan.parents`.

- [ ] **Step 8: `db.ts` v2 + `api.ts`**

- `db.ts`: add `this.version(2).stores({ ownedCards: '++id, cardId', parents: 'id, umaId', cmPlans: 'id, name', matchLogs: '++id, cmPlanId, date', settings: 'key' });` (keep `version(1)` declaration above it for migration history; drop `month` from the v2 `cmPlans` index). No `upgrade()` needed (no saved data).
- `api.ts` (~33-35): `listPlans` was `db.cmPlans.orderBy('month')`; `month` is gone → `return (await db.cmPlans.toArray()).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));` (or sort by `planNumber`).

- [ ] **Step 9: `exportImport.ts` v2**

Rewrite `parseCmPlan` (~286-338) to the new shape: require `id`,`name`,`planNumber`,`umaId`,`uniqueSkillId`,`role`(one-of ace/debuffer/hybrid),`strategy`(one-of front/pace/late/end),`statProfile{stats,mood}`,`cmRef{cmId,cmNumber,courseId,surface,distance,...}`,`scenarioId?`,`wishlist[]`(each `{skillId,priority,source}`),`sparkGoals{pink[],blue}`,`lockedDeckSlots[]`(**unchanged** — keep the existing slot/cardId validation),`parents{a?,b?}`,`patch{version}`,`server`,`dataVersion`. Drop `month`,`scenario`,`race`,`targetSkills`,`requiredAptitudes`,`chosenParents`,`targetUmaId`,`spBudgetEstimate`. Bump the export blob version constant 1→2. Read the existing helper fns (`reqString`,`reqNumber`,`reqOneOf`,`asArray`,`asRecord`,`optString`,`optNumber`) and reuse them.

- [ ] **Step 10: Fixtures + tests**

- `src/core/fixtures.ts` `FIXTURE_PLAN`: rebuild to the new shape (a complete valid `CmPlan`):
```ts
export const FIXTURE_PLAN: CmPlan = {
  id: 'fixture-plan', name: 'Fixture Cup', planNumber: 1,
  cmRef: { cmId: 'CM0', cmNumber: 0, courseId: '10606', surface: 'turf', distance: 2400 },
  scenarioId: 4, umaId: '100201', uniqueSkillId: '',
  role: 'ace', strategy: 'late',
  statProfile: { stats: { spd: 0, sta: 0, pow: 0, gut: 0, wit: 0 }, mood: 0 },
  sparkGoals: { pink: [{ aptKey: { kind: 'distance', key: 'long' }, target: 'A' }], blue: {} },
  wishlist: [
    { skillId: '200331', priority: 1, source: 'targeted' },
    { skillId: '200014', priority: 2, source: 'targeted' },
    { skillId: '210061', priority: 3, source: 'targeted' },
  ],
  lockedDeckSlots: [], parents: {},
  patch: { version: 'test' }, server: 'global', dataVersion: 'test',
};
```
- `src/features/data/gameData.ts` (~70-75), `src/features/testing/fixtureGameData.ts` (~21-32): update any inline plan field reads (`.month`,`.race.*`) to the new shape — most just spread `FIXTURE_PLAN`, so they cascade once the fixture is fixed.
- Test files that build plans inline via `{ ...FIXTURE_PLAN, chosenParents: [...] }` (`CoverageMatrixPanel.test.tsx:161`, `SparkContingencyPanel.test.tsx:59`, `useChosenParents.test.tsx:30`) → `{ ...FIXTURE_PLAN, parents: { a: 'p1', b: 'p2' } }`. `iconRetrofit.test.tsx:69` → `wishlist: [{ skillId:'200331', priority:1, source:'targeted' }]`. `DeckSuggesterPanel.test.tsx:99-115` keeps `lockedDeckSlots: [{ slot, cardId/cardType }]` (unchanged, D7). `api.test.ts:57-63` → drop `month`, sort by `name`. `PlanHeaderPanel.test.tsx` → update any `month`/`race`/`targetSkills`/`scenario` assertions to `cmRef`/`wishlist`/`scenarioId`.
- `coverage.test.ts` `makePlan` (~40-42) is `{ ...FIXTURE_PLAN, ...overrides }` — cascades; only fix overrides that reference old field names.

- [ ] **Step 11: Full gate**

Run: `pnpm typecheck && pnpm test`
Expected: typecheck clean; **all 300 tests pass** (the count is unchanged — same tests, new shapes). Iterate file-by-file on any remaining type errors until the list is empty.

- [ ] **Step 12: Commit**
```bash
git add -A
git commit -m "feat(core): reshape CmPlan to the canonical contract (race→cmRef, targetSkills→wishlist, chosenParents→parents, scenario→scenarioId); db v2; export v2"
```

---

## Self-Review

**1. Spec coverage (shared-data-model §1–§4):** tokens (§1) → Task 2. Sparks `ParentSparks` (§2) → Task 2. `CmPlan` (§3) → Task 3 (all fields; `parents`/`inheritanceStopgap`/`patch`/`scenarioId`/`statProfile`/`sparkGoals` present). `WishlistItem` (§4) → Task 2 (+`priority`, D2). `RosterEntry` (§5) → Task 2 (type only; store is Plan 2). cost module (§7) → Task 1. **Deferred (documented):** nested `Parent` + `parents`→roster store + `spark.ts` rewrite → Plan 2 (M1); minimal `CmRef`/geometry-from-courseId → M3 (D3); gold ×2 → mechanics-notes TODO (D5).

**2. Placeholder scan:** `DATA_VERSION='2026-06-15'` has a TODO to source from a generated constant — acceptable interim. The `bundledSpCost` gold-×2 TODO is a documented decision (D5), not an omission. No "TBD"/empty steps.

**3. Type consistency:** `CmRef`, `WishlistItem`, `ParentSparks` defined in Task 2 and consumed by `CmPlan`/consumers in Task 3 with matching shapes. `effectiveSpCost`/`bundledSpCost`/`expectedHintLevel`/`HintLevel` signatures identical between `cost.ts` (Task 1) and every call site. `plan.parents` is `{a?,b?}` everywhere (useChosenParents, ChosenParentsPicker, fixtures). `plan.wishlist` items always carry `priority`+`source`.

**Executor risk note:** Task 3 is atomic — expect a long `tsc` error list mid-task; that's normal. Drive it to zero before committing. `lockedDeckSlots` is KEPT as-is (D7), so the deck suggester is unchanged; the reshape is otherwise pure field renames + new defaulted fields.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-15-cmplan-reconciliation.md`. Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks.
2. **Inline Execution** — execute here via executing-plans with checkpoints.

Which approach?
