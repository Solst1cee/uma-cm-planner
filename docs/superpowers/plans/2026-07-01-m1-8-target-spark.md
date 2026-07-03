# M1.8 — "Target spark" card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the right-rail "Target spark" read-off card to `/inheritance` — BLUE/PINK spark goals from the plan (verbatim) plus a WHITE (uncovered skills) section behind a clean M1.7 coverage seam.

**Architecture:** A pure `buildTargetSpark()` builder (in `targetSpark.ts`) reuses M1.3's `blueSparkRows`/`pinkSparkRows` and folds in an `uncoveredSkillIds` argument to produce `{ blue, pink, white, coverage }`. A provider-free `TargetSparkCard` renders it. `InheritancePage` resolves the uma + `skillById` (both already in scope for M1.3/M1.6), calls the builder with `undefined` uncovered ids (the seam), and renders the card in place of the current placeholder.

**Tech Stack:** TypeScript, React 19, Vitest (jsdom), existing `cmp-plan-card` grammar + `.badge.spark-*` classes (app.css).

**Spec:** [docs/superpowers/specs/2026-07-01-m1-8-target-spark-design.md](../specs/2026-07-01-m1-8-target-spark-design.md)

## Global Constraints

- **Pure-core (P6):** all logic in `targetSpark.ts`, unit-tested; `TargetSparkCard` is a thin presentational layer taking plain props (no provider hooks). Page owns provider access.
- **Windows case-FS gotcha:** component file `TargetSparkCard.tsx`, helper `targetSpark.ts` — distinct names, no case clash. Do NOT name the helper `TargetSpark.ts`.
- **Reuse first (P1):** BLUE/PINK reuse `blueSparkRows`/`pinkSparkRows` from `planTargets.ts` — do NOT recompute goals. Chips reuse `.badge.spark-blue|pink|green` (global, app.css).
- **Chip CSS scope:** `.spark-chips` gets `display:flex` only under `.inh-parent`/`.inh-uma-modal` today; the card needs its own scoped `.inh-target-spark .spark-chips` rule (mirror inheritance.css:1428).
- **Verbatim BLUE/PINK:** no net-of-parents subtraction — plan goals as-is (matches the handoff `targetBlue`/`targetPink`).
- **M1 edits auto-save** is not relevant here (this card is read-only; it never mutates the plan).
- **Test command:** `pnpm vitest run <file>` for a single file; `pnpm typecheck` and `pnpm build` are the race-free full checks (vitest can flake if `pnpm dev` is running — re-run before trusting a failure).

## File Structure

| File | Responsibility |
|---|---|
| `src/features/inheritance/targetSpark.ts` | new — `buildTargetSpark()` + `TargetSpark`/`WhiteSparkRow`/`TargetSparkCoverage` types |
| `src/features/inheritance/targetSpark.test.ts` | new — unit tests for the builder |
| `src/features/inheritance/TargetSparkCard.tsx` | new — presentational card |
| `src/features/inheritance/TargetSparkCard.test.tsx` | new — component render tests |
| `src/features/inheritance/inheritance.css` | modify — add `.inh-target-spark` scope + `.spark-chips` rule |
| `src/features/inheritance/InheritancePage.tsx` | modify — replace the `Target spark` placeholder, wire the card |
| `docs/modules/module-1-inheritance.md` | modify — M1.8 note |

---

### Task 1: Pure `buildTargetSpark` builder + types

**Files:**
- Create: `src/features/inheritance/targetSpark.ts`
- Test: `src/features/inheritance/targetSpark.test.ts`

**Interfaces:**
- Consumes: `blueSparkRows(plan): BlueSparkRow[]`, `pinkSparkRows(plan, uma): PinkSparkRow[]`, and the exported `BlueSparkRow`/`PinkSparkRow` interfaces from `./planTargets`. `CmPlan`, `UmaRecord`, `SkillRecord` from `@/core/types`.
- Produces:
  - `interface WhiteSparkRow { id: string; name: string }`
  - `type TargetSparkCoverage = 'pending' | 'covered' | 'gaps'`
  - `interface TargetSpark { blue: BlueSparkRow[]; pink: PinkSparkRow[]; white: WhiteSparkRow[]; coverage: TargetSparkCoverage }`
  - `function buildTargetSpark(plan: CmPlan, uma: UmaRecord | null, skillById: Map<string, SkillRecord>, uncoveredSkillIds: string[] | undefined): TargetSpark`

- [ ] **Step 1: Write the failing test**

Create `src/features/inheritance/targetSpark.test.ts`:

Match the local-factory precedent in the sibling `planTargets.test.ts` (provider-free CmPlan
builder — no `makeDefaultPlan`, which lives in `ActivePlanContext` and drags in React/Dexie):

```ts
import { describe, expect, it } from 'vitest';
import type { CmPlan, SkillRecord } from '@/core/types';
import { buildTargetSpark } from './targetSpark';

const plan = (over: Partial<CmPlan> = {}): CmPlan =>
  ({
    id: 'p1', name: 'x', planNumber: 1,
    cmRef: { kind: 'cm', cmId: 'CM15', cmNumber: 15, courseId: '10906', surface: 'turf', distance: 2200 },
    scenarioId: 4, umaId: '106801', uniqueSkillId: '', role: 'ace', strategy: 'late',
    statProfile: { stats: { spd: 1, sta: 1, pow: 1, gut: 1, wit: 1 }, mood: 2 },
    sparkGoals: { pink: [], blue: {} }, wishlist: [], parents: {},
    patch: { version: 'x' }, server: 'global', dataVersion: 'x', ...over,
  }) as CmPlan;

// Minimal skill-map helper — only the field the builder reads (nameEn).
function skillMap(entries: Array<[string, string]>): Map<string, SkillRecord> {
  const m = new Map<string, SkillRecord>();
  for (const [id, nameEn] of entries) m.set(id, { nameEn } as SkillRecord);
  return m;
}

const withBlue = plan({ sparkGoals: { pink: [], blue: { pow: 3, sta: 6 } } });

describe('buildTargetSpark', () => {
  it('passes blue goals through from blueSparkRows (verbatim, canonical order)', () => {
    const out = buildTargetSpark(withBlue, null, skillMap([]), undefined);
    expect(out.blue).toEqual([
      { stat: 'sta', label: 'Stamina', stars: 6 },
      { stat: 'pow', label: 'Power', stars: 3 },
    ]);
  });

  it('coverage is "pending" when uncoveredSkillIds is undefined', () => {
    const out = buildTargetSpark(plan(), null, skillMap([]), undefined);
    expect(out.coverage).toBe('pending');
    expect(out.white).toEqual([]);
  });

  it('coverage is "covered" when uncoveredSkillIds is empty', () => {
    const out = buildTargetSpark(plan(), null, skillMap([]), []);
    expect(out.coverage).toBe('covered');
    expect(out.white).toEqual([]);
  });

  it('coverage is "gaps" with resolved white rows; unknown ids are skipped', () => {
    const out = buildTargetSpark(plan(), null, skillMap([['s1', 'Slick Surge']]), ['s1', 'unknown-id']);
    expect(out.coverage).toBe('gaps');
    expect(out.white).toEqual([{ id: 's1', name: 'Slick Surge' }]);
  });

  it('pink is empty when no uma resolves', () => {
    const out = buildTargetSpark(plan(), null, skillMap([]), undefined);
    expect(out.pink).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/inheritance/targetSpark.test.ts`
Expected: FAIL — `buildTargetSpark` is not exported / module not found.

- [ ] **Step 3: Write minimal implementation**

Create `src/features/inheritance/targetSpark.ts`:

```ts
/** M1.8 — "Target spark" read-off (handoff §7). Consolidates the sparks to hunt
 *  for on a parent / rental to complete the plan: BLUE + PINK goals verbatim
 *  (reusing the M1.3 plan-target helpers) + WHITE = uncovered wishlist skills.
 *  WHITE is fed by the M1.7 coverage matrix; until that lands, callers pass
 *  `undefined` and the panel shows a "coverage pending" note. This builder is
 *  also the reusable seeding contract for M1.4b's rental "Load from Target
 *  spark". Pure — no providers, no side effects. */
import type { CmPlan, SkillRecord, UmaRecord } from '@/core/types';
import { blueSparkRows, pinkSparkRows, type BlueSparkRow, type PinkSparkRow } from './planTargets';

export interface WhiteSparkRow {
  id: string;
  name: string;
}

/** 'pending' = coverage not computed yet (M1.7 absent); 'covered' = nothing
 *  uncovered; 'gaps' = some wishlist skills still need a spark source. */
export type TargetSparkCoverage = 'pending' | 'covered' | 'gaps';

export interface TargetSpark {
  blue: BlueSparkRow[];
  pink: PinkSparkRow[];
  white: WhiteSparkRow[];
  coverage: TargetSparkCoverage;
}

export function buildTargetSpark(
  plan: CmPlan,
  uma: UmaRecord | null,
  skillById: Map<string, SkillRecord>,
  uncoveredSkillIds: string[] | undefined,
): TargetSpark {
  const blue = blueSparkRows(plan);
  const pink = pinkSparkRows(plan, uma);

  if (uncoveredSkillIds === undefined) {
    return { blue, pink, white: [], coverage: 'pending' };
  }
  if (uncoveredSkillIds.length === 0) {
    return { blue, pink, white: [], coverage: 'covered' };
  }
  const white: WhiteSparkRow[] = [];
  for (const id of uncoveredSkillIds) {
    const name = skillById.get(id)?.nameEn;
    if (name !== undefined) white.push({ id, name });
  }
  return { blue, pink, white, coverage: 'gaps' };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/features/inheritance/targetSpark.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/inheritance/targetSpark.ts src/features/inheritance/targetSpark.test.ts
git commit -m "feat(m1.8): pure buildTargetSpark() builder + coverage seam

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `TargetSparkCard` presentational component

**Files:**
- Create: `src/features/inheritance/TargetSparkCard.tsx`
- Test: `src/features/inheritance/TargetSparkCard.test.tsx`
- Modify: `src/features/inheritance/inheritance.css` (append the `.inh-target-spark` scope)

**Interfaces:**
- Consumes: `TargetSpark`, `WhiteSparkRow` from `./targetSpark`; `BlueSparkRow`/`PinkSparkRow` (via `TargetSpark`).
- Produces: `function TargetSparkCard({ spark }: { spark: TargetSpark }): JSX.Element`.

- [ ] **Step 1: Write the failing test**

Create `src/features/inheritance/TargetSparkCard.test.tsx`:

```tsx
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { TargetSpark } from './targetSpark';
import { TargetSparkCard } from './TargetSparkCard';

afterEach(cleanup);

const base: TargetSpark = {
  blue: [{ stat: 'sta', label: 'Stamina', stars: 6 }],
  pink: [{ label: 'Long', stars: 5 }],
  white: [],
  coverage: 'pending',
};

describe('TargetSparkCard', () => {
  it('renders the panel head + blue and pink chips', () => {
    render(<TargetSparkCard spark={base} />);
    expect(screen.getByText('Target spark')).toBeInTheDocument();
    expect(screen.getByText(/Stamina 6/)).toBeInTheDocument();
    expect(screen.getByText(/Long 5/)).toBeInTheDocument();
  });

  it('shows the coverage-pending note for coverage "pending"', () => {
    render(<TargetSparkCard spark={base} />);
    expect(screen.getByText(/Coverage pending/i)).toBeInTheDocument();
  });

  it('shows the all-obtainable note for coverage "covered"', () => {
    render(<TargetSparkCard spark={{ ...base, coverage: 'covered' }} />);
    expect(screen.getByText(/All wishlist skills obtainable/i)).toBeInTheDocument();
  });

  it('renders green white-skill chips for coverage "gaps"', () => {
    render(
      <TargetSparkCard
        spark={{ ...base, coverage: 'gaps', white: [{ id: 's1', name: 'Slick Surge' }] }}
      />,
    );
    expect(screen.getByText('Slick Surge')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/inheritance/TargetSparkCard.test.tsx`
Expected: FAIL — `TargetSparkCard` not found.

- [ ] **Step 3: Write minimal implementation**

Create `src/features/inheritance/TargetSparkCard.tsx`:

```tsx
/** M1.8 — "Target spark" card (handoff §7). Provider-free: takes a computed
 *  `TargetSpark` (see targetSpark.ts) and renders BLUE / PINK / WHITE sections.
 *  Reuses the `cmp-plan-card` grammar + global `.badge.spark-*` chips. Not
 *  collapsible (matches the handoff). */
import type { TargetSpark } from './targetSpark';

export function TargetSparkCard({ spark }: { spark: TargetSpark }) {
  return (
    <div className="cmp-plan-card inh-target-spark">
      <div className="cmp-plan-card-head">Target spark</div>
      <div className="cmp-plan-card-body">
        <p className="inh-target-spark-intro">
          Sparks to hunt for on a parent / rental to complete this plan.
        </p>

        <div className="cmp-mini-label">Blue</div>
        <span className="spark-chips">
          {spark.blue.map((b) => (
            <span key={b.stat} className="badge spark-blue">
              {b.label} {b.stars}★
            </span>
          ))}
        </span>

        <div className="cmp-mini-label">Pink</div>
        <span className="spark-chips">
          {spark.pink.map((p, i) => (
            <span key={`${p.label}-${i}`} className="badge spark-pink">
              {p.label} {p.stars}★
            </span>
          ))}
        </span>

        <div className="cmp-mini-label">
          White <span className="inh-target-spark-sub">(uncovered skills)</span>
        </div>
        {spark.coverage === 'gaps' && (
          <span className="spark-chips">
            {spark.white.map((w) => (
              <span key={w.id} className="badge spark-green">
                {w.name}
              </span>
            ))}
          </span>
        )}
        {spark.coverage === 'covered' && (
          <p className="inh-target-spark-ok">✓ All wishlist skills obtainable from your setup.</p>
        )}
        {spark.coverage === 'pending' && (
          <p className="inh-target-spark-pending muted small">
            Coverage pending — needs the obtainable-vs-wishlist matrix (M1.7).
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Append the CSS scope**

Append to `src/features/inheritance/inheritance.css`:

```css
/* M1.8 — Target spark card. `.spark-chips` display:flex is otherwise scoped to
   `.inh-parent`/`.inh-uma-modal` (see above); re-scope it for this card. Chip
   pill styles (`.badge.spark-*`) are global (app.css). */
.inh-target-spark .spark-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  align-items: center;
  margin-bottom: 0.2rem;
}
.inh-target-spark-intro { margin: 0 0 0.5rem; color: var(--fg-muted); font-size: 0.78rem; }
.inh-target-spark-sub { text-transform: none; letter-spacing: 0; color: var(--fg-muted); font-weight: 400; }
.inh-target-spark-ok { margin: 0.2rem 0 0; color: var(--tier-chain); font-weight: 700; font-size: 0.78rem; }
.inh-target-spark-pending { margin: 0.2rem 0 0; }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run src/features/inheritance/TargetSparkCard.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/features/inheritance/TargetSparkCard.tsx src/features/inheritance/TargetSparkCard.test.tsx src/features/inheritance/inheritance.css
git commit -m "feat(m1.8): TargetSparkCard presentational component + CSS

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Wire the card into `InheritancePage` (replace placeholder)

**Files:**
- Modify: `src/features/inheritance/InheritancePage.tsx`
- Modify: `docs/modules/module-1-inheritance.md`

**Interfaces:**
- Consumes: `buildTargetSpark` (Task 1), `TargetSparkCard` (Task 2). In-scope page values: `uma1Plan: CmPlan | null` (the active plan), `uma = uma1Plan ? umaById.get(uma1Plan.umaId) ?? null : null` (line ~323), `skillById` from `useGameData()` (line 122).
- Produces: nothing new (page-internal wiring).

Context — the right column currently renders (lines ~508–509):
```tsx
        <div className="inh-col inh-col-right">
          <Placeholder title="Target spark" phase="M1.8" />
```

- [ ] **Step 1: Add imports**

In `src/features/inheritance/InheritancePage.tsx`, after the existing `./PlanTargetsCard` import group (near line 27), add:

```tsx
import { TargetSparkCard } from './TargetSparkCard';
import { buildTargetSpark } from './targetSpark';
```

- [ ] **Step 2: Compute the target spark**

Immediately before the `return (` (near line 432), add:

```tsx
  // M1.8 — Target spark. WHITE is fed by the M1.7 coverage matrix, which is not
  // yet on main; pass `undefined` so the panel shows "coverage pending". When
  // M1.7 lands, swap this for its uncovered-skill id list.
  const targetSpark = uma1Plan
    ? buildTargetSpark(uma1Plan, uma, skillById, undefined)
    : null;
```

- [ ] **Step 3: Replace the placeholder**

Change the right-column placeholder (line ~509) from:

```tsx
          <Placeholder title="Target spark" phase="M1.8" />
```

to:

```tsx
          {targetSpark && <TargetSparkCard spark={targetSpark} />}
```

- [ ] **Step 4: Typecheck + build (race-free)**

Run: `pnpm build`
Expected: typecheck passes, vite build succeeds (the pre-existing chunk-size + static/dynamic-import warnings are fine).

- [ ] **Step 5: Run the inheritance page tests**

Run: `pnpm vitest run src/features/inheritance/InheritancePage.test.tsx`
Expected: PASS. If a test asserted the "Target spark" placeholder text existed, update it to expect the real card head (`Target spark`) or the coverage-pending note. If a page test stubs `useGameData`/`useUmas` with empty maps, the card still renders (blue/pink empty, coverage pending) — no new stub needed.

- [ ] **Step 6: Update the module doc**

In `docs/modules/module-1-inheritance.md`, under the M1 status/section, add a short M1.8 line:

```markdown
**M1.8 "Target spark" card (2026-07-01):** right-column read-off panel — BLUE
(`blueSparkRows`) + PINK (`pinkSparkRows`) plan goals verbatim, plus WHITE
(uncovered wishlist skills) behind an M1.7 coverage seam. Pure `buildTargetSpark`
(`targetSpark.ts`) returns `{ blue, pink, white, coverage }` and is the reusable
seeding contract for M1.4b's rental "Load from Target spark". Until M1.7 merges,
callers pass `uncoveredSkillIds: undefined` → the panel shows "coverage pending";
wiring it live is a one-line change in `InheritancePage`.
```

- [ ] **Step 7: Commit**

```bash
git add src/features/inheritance/InheritancePage.tsx docs/modules/module-1-inheritance.md
git commit -m "feat(m1.8): wire TargetSparkCard into the inheritance right column

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Full test suite**

Run: `pnpm test`
Expected: all tests pass (prior count + the ~9 new M1.8 tests). If any UI test file flakes with a React-null error, confirm no `pnpm dev` is running and re-run that file once (known vitest/HMR race).

- [ ] **Step 2: Typecheck + build**

Run: `pnpm build`
Expected: green.

- [ ] **Step 3: Manual smoke (optional but recommended)**

Run `pnpm dev`, open `/inheritance`, confirm: the right column shows the "Target spark" card with the plan's blue + pink goal chips and a muted "Coverage pending — needs the obtainable-vs-wishlist matrix (M1.7)." note under White. Switching the active plan (via the uma-plan inventory) updates the chips.

## Self-Review

**Spec coverage:**
- Pure `buildTargetSpark` + types → Task 1. ✓
- Provider-free `TargetSparkCard` (3 WHITE states, not collapsible, cmp-plan-card grammar) → Task 2. ✓
- Page wiring replacing the placeholder, `undefined` seam → Task 3. ✓
- BLUE/PINK reuse `blueSparkRows`/`pinkSparkRows` verbatim → Task 1. ✓
- The `'pending'`/`'covered'`/`'gaps'` states + notes → Tasks 1 (data) + 2 (render). ✓
- Reusable seeding contract for M1.4b → `buildTargetSpark` return shape, Task 1 + doc note Task 3. ✓
- Tests (unit + component) → Tasks 1, 2. ✓
- `.spark-chips` route-scope CSS fix → Task 2 Step 4. ✓

**Placeholder scan:** none — all steps carry real code/commands.

**Type consistency:** `TargetSpark`/`WhiteSparkRow`/`TargetSparkCoverage`/`buildTargetSpark` names and the `{ blue, pink, white, coverage }` shape are identical across Tasks 1→2→3. `BlueSparkRow`(`{stat,label,stars}`)/`PinkSparkRow`(`{label,stars}`) match `planTargets.ts` exactly (used in the Task 2 test fixture).
