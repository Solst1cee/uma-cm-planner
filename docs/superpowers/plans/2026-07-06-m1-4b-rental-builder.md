# M1.4b — Parent-2 Rental Builder + Search-Link — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Parent-2 slot of the M1 Inheritance card into a 3-mode slot (Owned / Draft / Rental): a forced-tier spark-search **draft** that generates deep-links to uma.moe / pure-db / ChronoGenesis, plus a manual veteran-shape **real-rental** editor — both feeding the plan's affinity + coverage.

**Architecture:** Additive, plan-scoped, optional `CmPlan` fields (`parent2Mode` / `rentalDraft` / `rentalRecorded`) — no Dexie version bump. A pure `resolveParent2(plan, rosterById)` seam turns the mode into a concrete Parent-2 for every consumer. The draft reuses the existing M1.4 `SparkFilter` UI (via an extracted `useSparkFilterState` hook) and folds into coverage as a synthetic `Parent` whose `affinityHint` is the forced tier's score — so it rides the existing `activeParents`/`spark.ts` path with no special-casing.

**Tech Stack:** TypeScript, React 19, Vitest (jsdom), Dexie. Path alias `@/*` → `src/*`. Pure logic in `src/core/`; UI in `src/features/inheritance/`.

**Spec:** [docs/superpowers/specs/2026-07-06-m1-4b-rental-builder-design.md](../specs/2026-07-06-m1-4b-rental-builder-design.md).

## Global Constraints

- **P3 honest numbers:** draft coverage/affinity is a labelled *hypothetical* at a *forced* tier — never presented as measured. `forcedTierScore` values are a documented estimate.
- **P6 pure-function core:** all mechanics in `src/core/` as pure, unit-tested functions; UI is a thin layer.
- **Deep-links only** — no scraping/API. Cite encodings to provenance §6. ChronoGenesis stays deep-link-only.
- **Layering:** `src/core/` must not import from `src/features/`.
- **Windows case-insensitive FS:** a component `Foo.tsx` and a helper `foo.ts` in the same dir collide. Keep component files and helper files distinctly named (e.g. `RentalDraftPanel.tsx` + `rentalDraft.ts` are fine — different base names).
- **M1 provider-free pattern:** presentational cards take wired nodes as props; tests stub `useGameData`/`useUmas` with `{ skills: [], skillById, umaById }`. Any component calling `useAvailability()` must mock `@/app/useAvailability`.
- **M1 auto-save:** plan edits persist via `editPlan` (= `setPlan` + `saveCurrentPlan`) regardless of the global auto-save toggle.
- **Run a single test:** `pnpm vitest run <path>`. Typecheck: `pnpm typecheck`. Never trust vitest while `pnpm dev` runs (HMR race) — re-run or use `pnpm build`.

## File Structure

**Create (core, pure):**
- `src/core/sparkFilter.ts` — the `SparkFilter` type union, moved here from features (core-clean: depends only on `Stat`). Runtime matchers stay in features and import the type from here.
- `src/core/rentalDraft.ts` — `forcedTierScore`, `seedFromTargetSpark`, `draftToSyntheticParent`.
- `src/core/rentalSearch.ts` — `umaMoeUrl` / `pureDbUrl` / `chronoGenesisUrl`.
- `src/core/resolveParent2.ts` — `resolveParent2` discriminated resolver.

**Create (UI):**
- `src/features/inheritance/useSparkFilterState.ts` — hook extracted from `UmaPickerModal` glue.
- `src/features/inheritance/RentalDraftPanel.tsx` — draft mode panel.
- `src/features/inheritance/RentalParentEditor.tsx` — real-rental manual editor.

**Modify:**
- `src/core/types.ts` — `ForcedTier`, `RentalDraft`, `CmPlan` fields; re-export `SparkFilter`.
- `src/features/inheritance/sparkFilter.ts` — import+re-export the type from core.
- `src/db/exportImport.ts` — parse/validate the new fields.
- `src/features/inheritance/UmaPickerModal.tsx` — adopt `useSparkFilterState` (behavior identical).
- `src/features/inheritance/InheritanceCard.tsx` — 3-mode selector + branch render.
- `src/features/inheritance/InheritancePage.tsx` — resolve Parent 2 into the affinity/coverage build.
- `src/features/inheritance/parents.css` — mode selector + panel styles.

---

## Task 1: Data model + persistence

**Files:**
- Modify: `src/core/types.ts`, `src/features/inheritance/sparkFilter.ts`, `src/db/exportImport.ts`
- Create: `src/core/sparkFilter.ts`
- Test: `src/db/exportImport.test.ts`

**Interfaces:**
- Produces: `type ForcedTier = 'double'|'single'|'triangle'`; `interface RentalDraft { filters: SparkFilter[]; forcedTier: ForcedTier }`; `CmPlan.parent2Mode?: 'owned'|'draft'|'rental'`; `CmPlan.rentalDraft?: RentalDraft`; `CmPlan.rentalRecorded?: Parent`. `SparkFilter` importable from `@/core/sparkFilter` and (re-exported) `@/features/inheritance/sparkFilter`.

- [ ] **Step 1: Move the `SparkFilter` type to core.** Create `src/core/sparkFilter.ts`:

```ts
// src/core/sparkFilter.ts
/** The AND-clause spark filter shape (M1.4 picker + M1.4b rental draft). Pure
 *  type — the runtime matchers live in features/inheritance/sparkFilter.ts. */
import type { Stat } from '@/core/types';

export type SparkFilter =
  | { id: string; kind: 'blue'; stat: Stat; legacyMin: number; totalMin: number }
  | { id: string; kind: 'pink'; aptitude: string; legacyMin: number; totalMin: number }
  | { id: string; kind: 'white'; skillId: string; legacyMin: number; totalMin: number }
  | { id: string; kind: 'green'; skillId: string; legacyMin: number; totalMin: number }
  | { id: string; kind: 'anyBlue'; totalMin: number };
```

- [ ] **Step 2: Re-export from the feature module.** In `src/features/inheritance/sparkFilter.ts`, replace the local `SparkFilter` type declaration with a re-export and keep the matchers:

```ts
// src/features/inheritance/sparkFilter.ts
import type { SparkAgg } from './sparkAggregate';
export type { SparkFilter } from '@/core/sparkFilter';
import type { SparkFilter } from '@/core/sparkFilter';
// …clauseMatches / matchesFilters unchanged below…
```

- [ ] **Step 3: Run the existing filter tests to confirm the move is inert.**

Run: `pnpm vitest run src/features/inheritance/sparkFilter.test.ts src/features/inheritance/UmaPickerModal.test.ts`
Expected: PASS (type-only move; no behavior change).

- [ ] **Step 4: Add the plan fields.** In `src/core/types.ts`, add above `interface CmPlan` (and inside it):

```ts
export type ForcedTier = 'double' | 'single' | 'triangle';   // ◎ / ○ / △

export interface RentalDraft {
  filters: import('@/core/sparkFilter').SparkFilter[];
  forcedTier: ForcedTier;
}
```
Inside `interface CmPlan`, after `parents: { a?: string; b?: string };`:
```ts
  /** Parent-2 slot mode (M1.4b). Absent ⇒ 'owned' (back-compat). */
  parent2Mode?: 'owned' | 'draft' | 'rental';
  /** Rental search draft (mode 'draft'): forced-tier spark spec. */
  rentalDraft?: RentalDraft;
  /** Recorded real rental (mode 'rental'): a full veteran-shape Parent. */
  rentalRecorded?: Parent;
```

- [ ] **Step 5: Write the failing persistence round-trip test.** In `src/db/exportImport.test.ts`, add:

```ts
it('round-trips M1.4b Parent-2 rental fields', () => {
  const plan = { ...BASE_PLAN, parent2Mode: 'draft' as const,
    rentalDraft: { forcedTier: 'double' as const,
      filters: [{ id: 'g1', kind: 'green' as const, skillId: '100011', legacyMin: 1, totalMin: 1 }] },
    rentalRecorded: { ...PARENT, source: 'friend_rental' as const } };
  const blob = { ...emptyBlob(), cmPlans: [plan] };
  expect(() => parseBlob(blob)).not.toThrow();
  expect(parseBlob(blob).cmPlans[0]).toEqual(plan);
});
```
(Use the file's existing `BASE_PLAN`/`PARENT`/`emptyBlob`/`parseBlob` fixtures; adapt names to what the file already defines.)

- [ ] **Step 6: Run it — expect FAIL** (validator rejects unknown keys or drops them).

Run: `pnpm vitest run src/db/exportImport.test.ts -t "rental fields"`
Expected: FAIL.

- [ ] **Step 7: Add validation in `parseCmPlan`.** In `src/db/exportImport.ts`, after the `parents` block (`optString(parents, 'b', …)`):

```ts
const p2m = row['parent2Mode'];
if (p2m !== undefined && p2m !== 'owned' && p2m !== 'draft' && p2m !== 'rental') {
  fail(`${path}.parent2Mode`, "'owned' | 'draft' | 'rental' | absent", p2m);
}
if (row['rentalDraft'] !== undefined) {
  const rd = asRecord(row['rentalDraft'], `${path}.rentalDraft`);
  reqOneOf(rd, 'forcedTier', ['double', 'single', 'triangle'] as const, `${path}.rentalDraft`);
  asArray(rd['filters'], `${path}.rentalDraft.filters`); // clause shape trusted (produced by our UI)
}
if (row['rentalRecorded'] !== undefined) {
  parseParent(row['rentalRecorded'], `${path}.rentalRecorded`);
}
```
Ensure the parsed object carries the three fields through (spread `...row`-derived values or explicitly copy `parent2Mode`, `rentalDraft`, `rentalRecorded` onto the returned plan, matching how the function builds its result).

- [ ] **Step 8: Run the test — expect PASS.**

Run: `pnpm vitest run src/db/exportImport.test.ts`
Expected: PASS.

- [ ] **Step 9: Typecheck + commit.**

Run: `pnpm typecheck`
```bash
git add src/core/sparkFilter.ts src/core/types.ts src/features/inheritance/sparkFilter.ts src/db/exportImport.ts src/db/exportImport.test.ts
git commit -m "feat(m1.4b): plan data model + persistence for Parent-2 rental modes"
```

---

## Task 2: `rentalDraft.ts` — forced tier, seed, synthetic parent

**Files:**
- Create: `src/core/rentalDraft.ts`, `src/core/rentalDraft.test.ts`

**Interfaces:**
- Consumes: `SparkFilter` (`@/core/sparkFilter`), `TargetSpark` (`@/features/inheritance/targetSpark` — but to keep core layering clean, accept the plain `{ blue: {stat,stars}[]; white: {id}[] }` subset instead of importing the feature type).
- Produces: `forcedTierScore(t: ForcedTier): number`; `seedFromTargetSpark(seed: { blue: Array<{stat: Stat; stars: number}>; white: Array<{id: string}> }): SparkFilter[]`; `draftToSyntheticParent(draft: RentalDraft): Parent`.

- [ ] **Step 1: Write failing tests.** `src/core/rentalDraft.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { forcedTierScore, seedFromTargetSpark, draftToSyntheticParent } from './rentalDraft';

describe('forcedTierScore', () => {
  it('maps tiers to representative affinity scores', () => {
    expect(forcedTierScore('triangle')).toBe(25);
    expect(forcedTierScore('single')).toBe(100);
    expect(forcedTierScore('double')).toBe(175);
  });
});

describe('seedFromTargetSpark', () => {
  it('seeds blue (totalMin=stars) and white (totalMin=1) clauses; pink/green stay manual', () => {
    const out = seedFromTargetSpark({ blue: [{ stat: 'pow', stars: 6 }], white: [{ id: '200201' }] });
    expect(out).toEqual([
      { id: 'seed-blue-pow', kind: 'blue', stat: 'pow', legacyMin: 0, totalMin: 6 },
      { id: 'seed-white-200201', kind: 'white', skillId: '200201', legacyMin: 0, totalMin: 1 },
    ]);
  });
});

describe('draftToSyntheticParent', () => {
  it('carries white clauses + first green as sparks and sets affinityHint to the forced score', () => {
    const p = draftToSyntheticParent({ forcedTier: 'double', filters: [
      { id: 'w1', kind: 'white', skillId: '200201', legacyMin: 0, totalMin: 2 },
      { id: 'w2', kind: 'white', skillId: '200301', legacyMin: 0, totalMin: 1 },
      { id: 'g1', kind: 'green', skillId: '100011', legacyMin: 1, totalMin: 1 },
    ] });
    expect(p.affinityHint).toBe(175);
    expect(p.source).toBe('friend_rental');
    expect(p.whiteSparks.map((w) => w.skillId)).toEqual(['200201', '200301']);
    expect(p.greenSpark?.skillId).toBe('100011');
    expect(p.id).toBe('__rental_draft__');
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (module missing).

Run: `pnpm vitest run src/core/rentalDraft.test.ts`
Expected: FAIL ("Cannot find module './rentalDraft'").

- [ ] **Step 3: Implement `src/core/rentalDraft.ts`.**

```ts
/** M1.4b — pure helpers for the Parent-2 rental DRAFT (a forced-tier spark
 *  search-spec). See docs/superpowers/specs/2026-07-06-m1-4b-rental-builder-design.md. */
import type { ForcedTier, Parent, RentalDraft, Stat } from '@/core/types';
import type { SparkFilter } from '@/core/sparkFilter';

/** Forced inheritance-affinity tier → representative affinity score (P3 estimate,
 *  aligned to the △0–50 / ○51–150 / ◎151+ bands, mechanics-notes §3). */
export function forcedTierScore(t: ForcedTier): number {
  return t === 'double' ? 175 : t === 'single' ? 100 : 25;
}

/** Seed draft filters from M1.8 Target spark. Only blue + white carry structured
 *  keys (PinkSparkRow is label-only → pink is added manually; green too). */
export function seedFromTargetSpark(
  seed: { blue: Array<{ stat: Stat; stars: number }>; white: Array<{ id: string }> },
): SparkFilter[] {
  const out: SparkFilter[] = [];
  for (const b of seed.blue) out.push({ id: `seed-blue-${b.stat}`, kind: 'blue', stat: b.stat, legacyMin: 0, totalMin: b.stars });
  for (const w of seed.white) out.push({ id: `seed-white-${w.id}`, kind: 'white', skillId: w.id, legacyMin: 0, totalMin: 1 });
  return out;
}

const STARS = (n: number): 1 | 2 | 3 => (n >= 3 ? 3 : n >= 2 ? 2 : 1);

/** Synthesize a Parent from a draft so it rides the existing coverage/affinity
 *  path. Parent holds ONE green + N whites, so multi-green drafts keep the first
 *  green (documented limitation). affinityHint = the forced score → spark.ts
 *  prices the draft's inherit-% at the chosen tier with no memberAffinity hook. */
export function draftToSyntheticParent(draft: RentalDraft): Parent {
  const white = draft.filters.filter((f): f is Extract<SparkFilter, { kind: 'white' }> => f.kind === 'white');
  const green = draft.filters.find((f): f is Extract<SparkFilter, { kind: 'green' }> => f.kind === 'green');
  const blue = draft.filters.find((f): f is Extract<SparkFilter, { kind: 'blue' }> => f.kind === 'blue');
  const pink = draft.filters.find((f): f is Extract<SparkFilter, { kind: 'pink' }> => f.kind === 'pink');
  const p: Parent = {
    id: '__rental_draft__',
    umaId: '',
    blueSpark: blue ? { stat: blue.stat, stars: STARS(blue.totalMin) } : { stat: 'spd', stars: 1 },
    pinkSpark: pink ? { aptitude: pink.aptitude, stars: STARS(pink.totalMin) } : { aptitude: 'turf', stars: 1 },
    whiteSparks: white.map((w) => ({ skillId: w.skillId, stars: STARS(w.totalMin) })),
    affinityHint: forcedTierScore(draft.forcedTier),
    source: 'friend_rental',
  };
  if (green) p.greenSpark = { skillId: green.skillId, stars: STARS(green.totalMin) };
  return p;
}
```

- [ ] **Step 4: Run — expect PASS.**

Run: `pnpm vitest run src/core/rentalDraft.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/core/rentalDraft.ts src/core/rentalDraft.test.ts
git commit -m "feat(m1.4b): rentalDraft core — forced tier, seed, synthetic parent"
```

---

## Task 3: `resolveParent2.ts` — the resolver seam

**Files:**
- Create: `src/core/resolveParent2.ts`, `src/core/resolveParent2.test.ts`

**Interfaces:**
- Consumes: `draftToSyntheticParent` (Task 2), `CmPlan`, `Parent`.
- Produces:
  `type ResolvedParent2 = { kind: 'owned'; parent: Parent } | { kind: 'draft'; synthetic: Parent } | { kind: 'rental'; parent: Parent } | { kind: 'none' }`;
  `resolveParent2(plan: CmPlan, rosterById: Map<string, Parent>): ResolvedParent2`.

- [ ] **Step 1: Write failing tests.** `src/core/resolveParent2.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { resolveParent2 } from './resolveParent2';
import type { CmPlan, Parent } from '@/core/types';

const OWNED: Parent = { id: 'o1', umaId: '100101', blueSpark: { stat: 'spd', stars: 1 },
  pinkSpark: { aptitude: 'turf', stars: 1 }, whiteSparks: [], source: 'mine' };
const base = (over: Partial<CmPlan>): CmPlan => ({ parents: { b: undefined }, ...over } as CmPlan);
const roster = new Map([[OWNED.id, OWNED]]);

it('owned mode resolves the roster parent from parents.b', () => {
  const r = resolveParent2(base({ parents: { b: 'o1' } }), roster);
  expect(r).toEqual({ kind: 'owned', parent: OWNED });
});
it('absent mode defaults to owned; no parents.b ⇒ none', () => {
  expect(resolveParent2(base({ parents: {} }), roster)).toEqual({ kind: 'none' });
});
it('draft mode returns a synthetic parent with the forced-score affinityHint', () => {
  const r = resolveParent2(base({ parent2Mode: 'draft',
    rentalDraft: { forcedTier: 'single', filters: [] } }), roster);
  expect(r.kind).toBe('draft');
  if (r.kind === 'draft') expect(r.synthetic.affinityHint).toBe(100);
});
it('rental mode returns the recorded parent', () => {
  const rec: Parent = { ...OWNED, id: 'r1', source: 'friend_rental' };
  const r = resolveParent2(base({ parent2Mode: 'rental', rentalRecorded: rec }), roster);
  expect(r).toEqual({ kind: 'rental', parent: rec });
});
```

- [ ] **Step 2: Run — expect FAIL.**

Run: `pnpm vitest run src/core/resolveParent2.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/core/resolveParent2.ts`.**

```ts
/** M1.4b — resolve the Parent-2 slot (owned roster id / rental draft / recorded
 *  rental) into a concrete Parent for the affinity + coverage consumers. */
import type { CmPlan, Parent } from '@/core/types';
import { draftToSyntheticParent } from '@/core/rentalDraft';

export type ResolvedParent2 =
  | { kind: 'owned'; parent: Parent }
  | { kind: 'draft'; synthetic: Parent }
  | { kind: 'rental'; parent: Parent }
  | { kind: 'none' };

export function resolveParent2(plan: CmPlan, rosterById: Map<string, Parent>): ResolvedParent2 {
  const mode = plan.parent2Mode ?? 'owned';
  if (mode === 'draft' && plan.rentalDraft) return { kind: 'draft', synthetic: draftToSyntheticParent(plan.rentalDraft) };
  if (mode === 'rental' && plan.rentalRecorded) return { kind: 'rental', parent: plan.rentalRecorded };
  const owned = plan.parents.b ? rosterById.get(plan.parents.b) : undefined;
  return owned ? { kind: 'owned', parent: owned } : { kind: 'none' };
}
```

- [ ] **Step 4: Run — expect PASS.**

Run: `pnpm vitest run src/core/resolveParent2.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/core/resolveParent2.ts src/core/resolveParent2.test.ts
git commit -m "feat(m1.4b): resolveParent2 — owned/draft/rental resolver seam"
```

---

## Task 4: `rentalSearch.ts` — per-site deep-link builders

**Files:**
- Create: `src/core/rentalSearch.ts`, `src/core/rentalSearch.test.ts`

**Interfaces:**
- Consumes: `SparkFilter` (`@/core/sparkFilter`).
- Produces: `umaMoeUrl(a: SearchArgs): string`, `pureDbUrl(a: SearchArgs): string`, `chronoGenesisUrl(a: SearchArgs): { url: string; dropped: SparkFilter[] }` where
  `interface SearchArgs { filters: SparkFilter[]; traineeCardId: string; partnerCardId?: string }`.

- [ ] **Step 1: CONFIRM the site payload encodings before coding.** Read the verified templates in `docs/provenance.md` §6 (all three), and confirm the **white/green factor-key** format from uma.moe's open-source serialization (`umamoe-frontend`, fetch/read its filter-serialization module) + one real captured deep-link per site. Record the confirmed white/green keys as a comment block at the top of `rentalSearch.ts`. **Acceptance:** a hand-built URL for a known filter opens each site with the filter rehydrated (manual browser check). The `factorId` for a spark = the inverse of `factorDecode.ts` (blue `stat*100`, pink group `*100`, per §6 the site "factorId" is that ÷10: Speed=10, Long=340). This step has no code diff — it de-risks Steps 3–4.

- [ ] **Step 2: Write failing tests** against the confirmed encodings. `src/core/rentalSearch.test.ts` (fill expected strings from Step 1's captures):

```ts
import { describe, expect, it } from 'vitest';
import { umaMoeUrl, chronoGenesisUrl } from './rentalSearch';
import type { SparkFilter } from '@/core/sparkFilter';

const blueSpd2: SparkFilter = { id: 'b', kind: 'blue', stat: 'spd', legacyMin: 0, totalMin: 2 };
const greenU: SparkFilter = { id: 'g', kind: 'green', skillId: '100011', legacyMin: 1, totalMin: 1 };

describe('umaMoeUrl', () => {
  it('encodes blue/green triplets + trainer id into the filters param', () => {
    const url = umaMoeUrl({ filters: [blueSpd2, greenU], traineeCardId: '100101' });
    // decode the b64(json) and assert the compact shape, not the raw string:
    const json = JSON.parse(atob(decodeURIComponent(new URL(url).searchParams.get('filters')!)));
    expect(json.b).toContainEqual([10, 2, 9]);      // Speed, min 2, max 9
    expect(json.g).toContainEqual([expect.any(Number), 1, 9]);
    expect(url.startsWith('https://uma.moe/database?filters=')).toBe(true);
  });
});

describe('chronoGenesisUrl', () => {
  it('reports anyBlue as dropped when the site cannot express a clause', () => {
    const { dropped } = chronoGenesisUrl({ filters: [{ id: 'a', kind: 'anyBlue', totalMin: 6 }], traineeCardId: '100101' });
    // anyBlue maps to blue_count on ChronoGenesis → NOT dropped; adjust per Step 1 finding:
    expect(dropped).toEqual([]);
  });
});
```

- [ ] **Step 3: Run — expect FAIL.**

Run: `pnpm vitest run src/core/rentalSearch.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implement `src/core/rentalSearch.ts`** using the Step-1 encodings. Structure (fill the site-key maps from Step 1):

```ts
/** M1.4b — build rental-search deep-links (provenance §6). Deep-links only; no
 *  scraping/API. Each clause's legacyMin→"own/legacy" bucket, totalMin→"total". */
import type { SparkFilter } from '@/core/sparkFilter';

export interface SearchArgs { filters: SparkFilter[]; traineeCardId: string; partnerCardId?: string }

// site factorId = inverse of factorDecode.ts, ÷10 (§6): Speed=10 … Long=340.
const blueFactorId = (stat: string): number => ({ spd: 10, sta: 20, pow: 30, gut: 40, wit: 50 }[stat] ?? 0);
const pinkFactorId = (apt: string): number => ({ /* turf:110, dirt:120, front:210…, sprint:310… long:340 — from §6 */ } as Record<string, number>)[apt] ?? 0;
// white/green factorId derivation — from Step 1 confirmation.
const whiteFactorId = (skillId: string): number => Number(skillId); // CONFIRM in Step 1
const greenFactorId = (skillId: string): number => Number(skillId); // CONFIRM in Step 1

function b64(json: unknown): string { return encodeURIComponent(btoa(JSON.stringify(json))); }

export function umaMoeUrl({ filters, traineeCardId }: SearchArgs): string {
  const b: number[][] = [], p: number[][] = [], g: number[][] = [], w: number[][] = [];
  for (const f of filters) {
    if (f.kind === 'blue') b.push([blueFactorId(f.stat), f.totalMin || 1, 9]);
    else if (f.kind === 'pink') p.push([pinkFactorId(f.aptitude), f.totalMin || 1, 9]);
    else if (f.kind === 'green') g.push([greenFactorId(f.skillId), f.totalMin || 1, 9]);
    else if (f.kind === 'white') w.push([whiteFactorId(f.skillId), f.totalMin || 1, 9]);
  }
  const payload: Record<string, unknown> = { lb: 4 };
  if (b.length) payload.b = b; if (p.length) payload.p = p; if (g.length) payload.g = g; if (w.length) payload.w = w;
  return `https://uma.moe/database?filters=${b64(payload)}&trainer_id=${encodeURIComponent(traineeCardId)}`;
}

export function pureDbUrl(args: SearchArgs): string { /* build {blue/red/greenFactors, partnerCardIds} per §6 */ return ''; }

export function chronoGenesisUrl(args: SearchArgs): { url: string; dropped: SparkFilter[] } {
  /* leg_/tot_ buckets + blue_count + card_id per §6; collect clauses a site can't express into `dropped` */
  return { url: '', dropped: [] };
}
```
Replace the stub bodies with the real §6 encodings; every clause a site cannot express goes into the returned `dropped` (surfaced in the UI as "N not encoded on this site").

- [ ] **Step 5: Run — expect PASS.**

Run: `pnpm vitest run src/core/rentalSearch.test.ts`
Expected: PASS.

- [ ] **Step 6: Update provenance §6** with the confirmed white/green keys (append a "M1.4b encoding confirmation 2026-07-06" note). Commit.

```bash
git add src/core/rentalSearch.ts src/core/rentalSearch.test.ts docs/provenance.md
git commit -m "feat(m1.4b): rentalSearch — uma.moe/pure-db/chronoGenesis deep-links"
```

---

## Task 5: Extract `useSparkFilterState` from the picker

**Files:**
- Create: `src/features/inheritance/useSparkFilterState.ts`
- Modify: `src/features/inheritance/UmaPickerModal.tsx`
- Test: `src/features/inheritance/UmaPickerModal.test.ts` (must stay green — behavior unchanged)

**Interfaces:**
- Produces: `useSparkFilterState(filters: SparkFilter[], setFilters: (u: (xs: SparkFilter[]) => SparkFilter[]) => void)` → `{ sparkValue, setSpark, sparkMaxTotal, legacyLocked, membersUsed, activeGreen, activeWhite }` — i.e. the exact props `SparkFilterCards` needs (except the option lists/icons, which stay page-wired).

- [ ] **Step 1: Extract the glue verbatim.** Move the derived helpers currently inline in `UmaPickerModal.tsx` (`sameTile`, `inCategory`, `bpValue`/`sparkValue`, `setBp`/`setSpark`, `bpMaxTotal`/`sparkMaxTotal`, `bpLegacyLocked`, `makeSearchClauseState` for green+white, `membersUsed`, `newId`) into `useSparkFilterState.ts`, parameterised on `(filters, setFilters)`. Return the callback bag. Do not change any logic.

- [ ] **Step 2: Adopt the hook in the picker.** In `UmaPickerModal.tsx`, replace the inline glue with:

```ts
const [filters, setFilters] = useState<SparkFilter[]>([]);
const sf = useSparkFilterState(filters, setFilters);
// …pass sf.sparkValue / sf.setSpark / sf.sparkMaxTotal / sf.legacyLocked / sf.membersUsed to <SparkFilterCards/>
```
Keep the picker's own `activeGreen`/`activeWhite`/summary/`matchesFilters` usage pointing at `filters`.

- [ ] **Step 3: Run the picker tests — expect PASS (unchanged behavior).**

Run: `pnpm vitest run src/features/inheritance/UmaPickerModal.test.ts`
Expected: PASS.

- [ ] **Step 4: Typecheck + commit.**

Run: `pnpm typecheck`
```bash
git add src/features/inheritance/useSparkFilterState.ts src/features/inheritance/UmaPickerModal.tsx
git commit -m "refactor(m1.4b): extract useSparkFilterState hook (picker unchanged)"
```

---

## Task 6: `RentalDraftPanel` — draft mode UI

**Files:**
- Create: `src/features/inheritance/RentalDraftPanel.tsx`, `src/features/inheritance/RentalDraftPanel.test.tsx`
- Modify: `src/features/inheritance/parents.css`

**Interfaces:**
- Consumes: `useSparkFilterState` (Task 5), `SparkFilterCards`, `forcedTierScore`/`seedFromTargetSpark` (Task 2), `umaMoeUrl`/`pureDbUrl`/`chronoGenesisUrl` (Task 4), `ForcedTier`, `RentalDraft`.
- Produces: presentational `RentalDraftPanel` (props: `draft`, `onChange(draft)`, `seed` = `{blue,white}` from Target spark, `traineeCardId`, `partnerCardId?`, plus the page-wired green/white option lists + icons for `SparkFilterCards`).

- [ ] **Step 1: Write a failing component test.** `RentalDraftPanel.test.tsx` — render with a draft holding one green clause; assert (a) the forced-tier control shows ◎ selected for `'double'`, (b) an "Load from Target spark" button, (c) three search-link anchors whose `href` starts with each site origin, (d) the honesty banner text. Stub option lists as `[]`.

- [ ] **Step 2: Run — expect FAIL.**

Run: `pnpm vitest run src/features/inheritance/RentalDraftPanel.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement `RentalDraftPanel.tsx`.** Structure:

```tsx
export function RentalDraftPanel(p: RentalDraftPanelProps) {
  const setFilters = (u: (xs: SparkFilter[]) => SparkFilter[]) =>
    p.onChange({ ...p.draft, filters: u(p.draft.filters) });
  const sf = useSparkFilterState(p.draft.filters, setFilters);
  const args = { filters: p.draft.filters, traineeCardId: p.traineeCardId, partnerCardId: p.partnerCardId };
  const chrono = chronoGenesisUrl(args);
  return (
    <div className="inh-rental-draft">
      <div className="inh-forced-tier" role="radiogroup" aria-label="Assumed affinity">
        {(['double','single','triangle'] as ForcedTier[]).map((t) => (
          <button key={t} role="radio" aria-checked={p.draft.forcedTier === t}
            className={p.draft.forcedTier === t ? 'is-on' : undefined}
            onClick={() => p.onChange({ ...p.draft, forcedTier: t })}>
            {t === 'double' ? '◎' : t === 'single' ? '○' : '△'}
          </button>
        ))}
      </div>
      <button type="button" onClick={() => p.onChange({ ...p.draft, filters: seedFromTargetSpark(p.seed) })}>
        Load from Target spark
      </button>
      <SparkFilterCards value={sf.sparkValue} onSet={sf.setSpark} maxTotal={sf.sparkMaxTotal}
        legacyLocked={sf.legacyLocked} membersUsed={sf.membersUsed}
        activeGreen={sf.activeGreen} greenOptions={p.greenOptions} greenIcon={p.greenIcon}
        activeWhite={sf.activeWhite} whiteOptions={p.whiteOptions} whiteIcon={p.whiteIcon} />
      <div className="inh-rental-links">
        <a href={umaMoeUrl(args)} target="_blank" rel="noreferrer noopener">Search uma.moe →</a>
        <a href={pureDbUrl(args)} target="_blank" rel="noreferrer noopener">pure-db →</a>
        <a href={chrono.url} target="_blank" rel="noreferrer noopener">ChronoGenesis →</a>
        {chrono.dropped.length > 0 && <span className="muted small">{chrono.dropped.length} filter(s) not encodable on ChronoGenesis</span>}
      </div>
      <p className="inh-rental-caveat muted small">
        A matching record isn't a guaranteed borrowable rental — follow-then-borrow (3/day),
        DB lag, private/slot-full profiles. This scores fit, not availability.
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Run — expect PASS.** Add CSS for `.inh-forced-tier`, `.inh-rental-links`, `.inh-rental-caveat` in `parents.css`.

Run: `pnpm vitest run src/features/inheritance/RentalDraftPanel.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/features/inheritance/RentalDraftPanel.tsx src/features/inheritance/RentalDraftPanel.test.tsx src/features/inheritance/parents.css
git commit -m "feat(m1.4b): RentalDraftPanel — forced tier + filter + search-links"
```

---

## Task 7: `RentalParentEditor` — real-rental manual editor

**Files:**
- Create: `src/features/inheritance/RentalParentEditor.tsx`, `src/features/inheritance/RentalParentEditor.test.tsx`

**Interfaces:**
- Produces: presentational `RentalParentEditor` (props: `value?: Parent`, `onSave(parent: Parent)`, `onCancel`, page-wired uma-picker + spark pickers + icons). Emits a `Parent` with `source: 'friend_rental'`, `importSource: 'manual'`, optional grandparents/stats/wonRaces.

- [ ] **Step 1: Write a failing test.** Render the editor; pick a parent uma + one white spark + one green; click Save; assert `onSave` receives a `Parent` with `source: 'friend_rental'`, the chosen `umaId`, `whiteSparks`, and `greenSpark`.

- [ ] **Step 2: Run — expect FAIL.**

Run: `pnpm vitest run src/features/inheritance/RentalParentEditor.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement `RentalParentEditor.tsx`.** A controlled form building a `Parent`:
  - Parent uma select (reuse the uma picker used elsewhere; page passes options).
  - Blue (stat select + 1–3 stars), pink (aptitude select + stars) — required by the `Parent` type; default to the first if omitted.
  - Green (unique search, single) + white (skill search, multiple) — reuse `SparkFilterCards`-style pickers or the existing `SkillSearch`.
  - Optional 2 grandparents: each a collapsible sub-form (uma + sparks) → `ParentRef`.
  - Save assembles `{ id: value?.id ?? '__rental__', umaId, blueSpark, pinkSpark, whiteSparks, greenSpark?, grandparents?, source: 'friend_rental', importSource: 'manual' }` and calls `onSave`.
  - Seed the form from `props.value` when editing, else from an optional `seedFilters` prop (pre-check searched sparks when promoting Draft→Rental).

- [ ] **Step 4: Run — expect PASS.**

Run: `pnpm vitest run src/features/inheritance/RentalParentEditor.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/features/inheritance/RentalParentEditor.tsx src/features/inheritance/RentalParentEditor.test.tsx
git commit -m "feat(m1.4b): RentalParentEditor — manual veteran-shape rental entry"
```

---

## Task 8: 3-mode selector wired into `InheritanceCard`

**Files:**
- Modify: `src/features/inheritance/InheritanceCard.tsx`, `src/features/inheritance/parents.css`
- Test: `src/features/inheritance/InheritanceCard.test.tsx` (add mode-switch cases)

**Interfaces:**
- Consumes: `resolveParent2` (Task 3), `RentalDraftPanel` (Task 6), `RentalParentEditor` (Task 7), `useActivePlan().editPlan`.

- [ ] **Step 1: Write a failing test.** Render the card; switch Parent 2 to Draft → the draft panel appears + `editPlan` called with `parent2Mode: 'draft'` and a default `rentalDraft`. Switch to Rental → the editor appears. Switch to Owned → the roster picker returns. Mock `@/app/useAvailability`, `useGameData`, `useUmas` per the M1 pattern.

- [ ] **Step 2: Run — expect FAIL.**

Run: `pnpm vitest run src/features/inheritance/InheritanceCard.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement the 3-mode slot.** Replace the binary `p2rental` toggle with a persisted mode read from `uma1Plan.parent2Mode ?? 'owned'`. Render a segmented `Owned · Draft · Rental` control on the Parent-2 card; on change call `editPlan` to set `parent2Mode` (seeding `rentalDraft` = `{ filters: [], forcedTier: 'double' }` on first entry to Draft). Branch the Parent-2 body:
  - `owned` → existing `card('b', 'Parent 2')`.
  - `draft` → `<RentalDraftPanel draft={uma1Plan.rentalDraft!} onChange={(d) => editPlan({ ...uma1Plan, rentalDraft: d })} seed={{ blue: targetSpark.blue.map(...), white: targetSpark.white.map((w) => ({ id: w.id })) }} traineeCardId={uma1Plan.umaId} partnerCardId={parentAUmaId} …option lists… />`.
  - `rental` → show the recorded card (via `ParentCardView`) or `<RentalParentEditor .../>` when editing; Save → `editPlan({ ...uma1Plan, rentalRecorded })`.
  The header `selectionAffinity` uses `resolveParent2` for Parent 2: draft → show the forced tier glyph instead of a number; owned/rental → numeric as today.
  The same-character guard (`itemsFor`) is unaffected — it only runs in owned mode.

- [ ] **Step 4: Run — expect PASS.**

Run: `pnpm vitest run src/features/inheritance/InheritanceCard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/features/inheritance/InheritanceCard.tsx src/features/inheritance/InheritanceCard.test.tsx src/features/inheritance/parents.css
git commit -m "feat(m1.4b): 3-mode Parent-2 slot (Owned/Draft/Rental) in InheritanceCard"
```

---

## Task 9: `InheritancePage` affinity + coverage wiring + full verify

**Files:**
- Modify: `src/features/inheritance/InheritancePage.tsx`
- Test: `src/features/inheritance/InheritancePage.test.tsx` (extend)

**Interfaces:**
- Consumes: `resolveParent2` (Task 3).

- [ ] **Step 1: Write a failing test.** With a plan in draft mode holding a green clause matching a wishlist skill, assert the coverage result marks that skill covered (via the synthetic parent) and that the build does NOT throw (no `planLineageAffinity` on a synthetic umaId). With rental mode + a recorded parent, assert its white spark covers a wishlist skill.

- [ ] **Step 2: Run — expect FAIL.**

Run: `pnpm vitest run src/features/inheritance/InheritancePage.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Wire the resolver into the coverage `useMemo`.** In `InheritancePage.tsx` (~line 386): after building `rosterById`, resolve Parent 2:

```ts
const rosterById = new Map(roster.map((p) => [p.id, p]));
const pA = parentARef ? rosterById.get(parentARef) : undefined;
const p2 = resolveParent2(uma1Plan!, rosterById);   // uma1Plan guarded upstream
const pB = p2.kind === 'owned' ? p2.parent : p2.kind === 'rental' ? p2.parent
        : p2.kind === 'draft' ? p2.synthetic : undefined;
const p2IsReal = p2.kind === 'owned' || p2.kind === 'rental';
```
Update the `memberAffinity` guard so `planLineageAffinity` runs only for a **real** Parent 2:
```ts
if (affinityIdx && planUmaId && pA && pB && p2IsReal) {
  const la = planLineageAffinity(affinityIdx, planUmaId, pA, pB, g1Set);
  memberAffinity = /* unchanged */;
}
```
Draft mode: `memberAffinity` stays undefined → `pB` (the synthetic) prices via its `affinityHint = forcedScore`, `pA` via its existing approximation — consistent with today's single-parent path. `activeParents` is unchanged (it already includes `nB` when present). Add `uma1Plan?.parent2Mode`, `uma1Plan?.rentalDraft`, `uma1Plan?.rentalRecorded` to the `useMemo` dependency array (replacing the bare `parentBRef` reliance).

- [ ] **Step 4: Run the test — expect PASS.**

Run: `pnpm vitest run src/features/inheritance/InheritancePage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Full verification.**

Run: `pnpm typecheck && pnpm vitest run src/core/ src/features/inheritance/ src/db/exportImport.test.ts`
Expected: all PASS. Then `pnpm build` (race-free) to confirm a clean production build.

- [ ] **Step 6: Manual smoke (drive the app).** `pnpm dev`; on `/inheritance`, switch Parent 2 through Owned → Draft (seed from Target spark, add a green, click each search-link, confirm the site opens filtered) → Rental (enter a parent, confirm it appears with affinity + shrinks Target spark's uncovered whites). Confirm export/import preserves the mode + draft + recorded rental.

- [ ] **Step 7: Commit + docs.** Update `docs/modules/module-1-inheritance.md` (M1.4b done) and the M1 line in `CLAUDE.md` + `docs/roadmap.md`.

```bash
git add -A
git commit -m "feat(m1.4b): wire Parent-2 resolver into affinity + coverage; docs"
```

---

## Self-Review notes (author)

- **Spec coverage:** 3-mode slot (T8), data model (T1), draft spec+tier+links (T2/T4/T6), synthetic-parent coverage (T2/T9), real-rental editor (T7), resolver (T3), reuse of `SparkFilterCards`/hook (T5), persistence (T1), honesty banner (T6), UmaExtractor note (docs, T9) — all mapped. `forcedTierScore`/multi-clause-hypothetical (T2) match spec §4.2.
- **Deferred-by-spec:** exact white/green site keys (T4 Step 1 confirmation) and final `forcedTierScore` values (T2, adjustable) are the spec §11 open items — each has an explicit action, not a silent placeholder.
- **Type consistency:** `ResolvedParent2` kinds (`owned`/`draft`/`rental`/`none`), `draftToSyntheticParent`/`forcedTierScore`/`seedFromTargetSpark` signatures, and `SearchArgs` are used identically across T2/T3/T4/T6/T8/T9.
