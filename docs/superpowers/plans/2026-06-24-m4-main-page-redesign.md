# M4 Main-Page Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the dense 4-column `/` planner into a 3-column shell with a collapsible inventory, a dual-build (uma1/uma2) flip-card editor, a tabbed working panel, two engine-derived checkers, and an on-demand Mini-sim tab.

**Architecture:** Generalize the single active plan into a **dual-slot focused model** (`uma1Plan` + `uma2Plan` + `focused`) in `ActivePlanContext`; uma1 keeps today's persist/auto-load, uma2 is a session-scratch slot that autosaves-but-never-auto-loads. The main column pins the track + race-setup and tabs everything else. Checkers + Mini-sim derive entirely from existing engine entrypoints — **no `pnpm sim:build` rebuild**.

**Tech Stack:** TypeScript, React 19, Vite, Vitest (jsdom), Dexie, the vendored umalator engine (`src/sim/`).

**Spec:** [docs/superpowers/specs/2026-06-24-m4-main-page-redesign-design.md](../specs/2026-06-24-m4-main-page-redesign-design.md)

## Global Constraints

- **No `pnpm sim:build` rebuild.** Stamina checker uses `runSkillTrace(...).runs[choice].without` (a full per-frame `SkillFrame[]` with `hp`); accel checker uses activation positions from `skillImpact`/`runSkillTrace`. Both already exported in `src/sim/run.ts`.
- **No-trace track must stay byte-identical** — `RaceTrackView` viewBox invariant; the pinned track with no compare renders exactly as today.
- **jsdom Worker limit:** any test that mounts a component constructing `SimClient` / opening `SkillDetailDisclosure` with `traceContext` must `vi.mock('./useSkillTrace')` (and mock the checker hooks likewise).
- **Trust `pnpm build` + `pnpm typecheck`, not a single Vitest run** while a dev server is up (HMR race → spurious `useState` null). Re-run a failing UI test file before treating it as real.
- **Engine throws on all-zero / unknown-skill builds** — every entrypoint already wraps in `simulatableBase`; never feed an all-zero build.
- **Accent convention:** uma1 = blue `#5aa0ff`, uma2 = red `#e0564f` (matches `RaceOverlay`).
- **Path alias** `@/*` → `src/*`. Verify with `pnpm typecheck` after every task.

---

## File structure

**Created**
- `src/features/cm-planner/useFocusedBuild.ts` — thin selector helpers over the dual-plan context (keeps consumers tidy).
- `src/features/cm-planner/WorkingTabs.tsx` — the tab strip + active-tab container in `.cmp-main`.
- `src/features/cm-planner/StaminaCheckerTab.tsx` + `staminaCheck.ts` (pure logic) + tests.
- `src/features/cm-planner/AccelCheckerTab.tsx` + `accelCheck.ts` (pure logic) + tests.
- `src/core/cmPlanCopy.ts` — pure deep-copy/duplicate helpers for the copy buttons + tests.

**Modified**
- `src/app/ActivePlanContext.tsx` (1–389) — dual-slot + focus.
- `src/features/cm-planner/CmPlannerPage.tsx` (whole) — 3-column shell, focused wiring, tabs.
- `src/features/cm-planner/PlannerSidebar.tsx` (props + header, ~130–356) — flip faces, accent, copy/save buttons.
- `src/features/cm-planner/PlanInventoryCard.tsx` (+ sliver mode) — collapse + load-into-focused + mark both slots.
- `src/features/cm-planner/useRaceCompareController.tsx` (26–46) — consume `uma2Plan`.
- `src/features/cm-planner/cm-planner.css` (557–681, 1940–1952) — 3-col grid, sliver, flip, accent vars, tab strip.
- `src/features/cm-planner/RaceSimCard.tsx` — retired (logic folded into the Mini-sim tab).

---

# Milestone A — Foundation & shell (app works, new 3-col layout, uma1 only)

## Task 1: Dual-plan state in `ActivePlanContext`

**Files:**
- Modify: `src/app/ActivePlanContext.tsx:86-389`
- Test: `src/app/ActivePlanContext.dualplan.test.tsx` (new)

**Interfaces:**
- Consumes: existing `savePlan`, `getPlan`, `getSetting`/`setSetting`, `generatePlanName`, `nextPlanNumberForContent`, `makeDefaultPlan`, `uniquePlanName`.
- Produces (added to `ActivePlanValue`):
  ```typescript
  uma1Plan: CmPlan;                 // alias of today's `plan` (never null once loaded)
  uma2Plan: CmPlan | null;          // session-scratch; null = empty slot; NOT restored on load
  focused: 'uma1' | 'uma2';
  setFocused: (slot: 'uma1' | 'uma2') => void;
  focusedPlan: CmPlan | null;       // uma1Plan when focused==='uma1', else uma2Plan
  setFocusedPlan: (next: CmPlan) => void;   // routes to the focused slot's setter
  setUma2Plan: (next: CmPlan | null) => void; // autosaves+autonames when non-null; never writes activePlanId
  ```
  Keep existing `plan` as a deprecated alias === `uma1Plan` so no consumer breaks mid-refactor.

- [ ] **Step 1: Write the failing test**

```tsx
// src/app/ActivePlanContext.dualplan.test.tsx
import { act, render, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { ActivePlanProvider, useActivePlan } from './ActivePlanContext';

afterEach(cleanup);

function harness(onValue: (v: ReturnType<typeof useActivePlan>) => void) {
  function Probe() { onValue(useActivePlan()); return null; }
  return <ActivePlanProvider><Probe /></ActivePlanProvider>;
}

test('uma2 slot starts empty and does not auto-load', async () => {
  let value!: ReturnType<typeof useActivePlan>;
  render(harness((v) => { value = v; }));
  await waitFor(() => expect(value.uma1Plan).toBeTruthy());
  expect(value.uma2Plan).toBeNull();
  expect(value.focused).toBe('uma1');
  expect(value.focusedPlan).toBe(value.uma1Plan);
});

test('setUma2Plan fills the slot and setFocused routes focusedPlan', async () => {
  let value!: ReturnType<typeof useActivePlan>;
  render(harness((v) => { value = v; }));
  await waitFor(() => expect(value.uma1Plan).toBeTruthy());
  const draft = { ...value.uma1Plan, id: 'uma2-test', name: 'U2' };
  await act(async () => { value.setUma2Plan(draft); });
  await waitFor(() => expect(value.uma2Plan?.id).toBe('uma2-test'));
  await act(async () => { value.setFocused('uma2'); });
  await waitFor(() => expect(value.focusedPlan?.id).toBe('uma2-test'));
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run src/app/ActivePlanContext.dualplan.test.tsx`
Expected: FAIL — `uma2Plan`/`focused`/`focusedPlan` undefined.

- [ ] **Step 3: Implement the dual-slot additions**

In `ActivePlanContext.tsx`:
1. Add state: `const [uma2Plan, setUma2PlanState] = useState<CmPlan | null>(null);` and `const [focused, setFocused] = useState<'uma1' | 'uma2'>('uma1');`
2. Add a uma2 debounced-save pipeline mirroring the uma1 one (reuse the existing `SAVE_DEBOUNCE_MS`, a second `pendingSave2`/`saveTimer2` ref pair). `setUma2Plan(next)`:
   - if `next === null`: clear timer2, `setUma2PlanState(null)`; return.
   - else: ensure a name via `generatePlanName` if blank; `setUma2PlanState(next)`; schedule a debounced `savePlan(next)` + `setSavedPlans(await listPlans())`. **Never call `setSetting(ACTIVE_PLAN_KEY, …)` for uma2.**
3. Do **not** add any `getSetting` restore for uma2 in the init effect — it intentionally starts `null` each load.
4. Derived: `const focusedPlan = focused === 'uma1' ? plan : uma2Plan;` and `setFocusedPlan = (next) => focused === 'uma1' ? setPlan(next) : setUma2Plan(next);`
5. Add all new fields to the `value` object and to the `ActivePlanValue` interface (lines 86–115). Keep `plan` as alias of uma1.

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run src/app/ActivePlanContext.dualplan.test.tsx`
Expected: PASS. Then `pnpm typecheck` (existing `useActivePlan` consumers still compile via the `plan` alias).

- [ ] **Step 5: Commit**

```bash
git add src/app/ActivePlanContext.tsx src/app/ActivePlanContext.dualplan.test.tsx
git commit -m "feat(m4): dual-plan slots (uma1/uma2 + focused) in ActivePlanContext"
```

## Task 2: 3-column grid (drop the race-sim rail column)

**Files:**
- Modify: `src/features/cm-planner/cm-planner.css:557-573, 1940-1952`
- Modify: `src/features/cm-planner/CmPlannerPage.tsx:164-241`
- Test: `src/features/cm-planner/CmPlannerPage.test.tsx` (extend)

**Interfaces:**
- Consumes: Task 1's `focusedPlan` (not yet — Task 2 keeps using `plan`; pure layout change).
- Produces: a 3-column `.cmp-page` (`inventory · sidebar · main`); the `.cmp-right` rail + its `<aside>` are removed (Mini-sim moves into tabs in Task 8 — until then the compare controls move into a temporary slot at the bottom of `.cmp-main` so nothing is lost).

- [ ] **Step 1: Write the failing test** (assert the right rail is gone)

```tsx
// add to CmPlannerPage.test.tsx
test('main page no longer renders the standalone race-sim rail', async () => {
  renderPage(); // existing helper
  await screen.findByText(/Plan Inventory/i);
  expect(screen.queryByLabelText('Race simulation')).toBeNull();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run src/features/cm-planner/CmPlannerPage.test.tsx -t "race-sim rail"`
Expected: FAIL — the `aside[aria-label="Race simulation"]` still exists.

- [ ] **Step 3: Implement**

- CSS: change `.cmp-page` grid to `grid-template-columns: minmax(360px, 26rem) minmax(360px, 26rem) minmax(0, 1fr);` (inventory · sidebar · main). Remove the trailing 4th column. Delete the `@media(max-width:1500px) .cmp-right{grid-column:1/-1}` rule; keep the `@media(max-width:980px){grid-template-columns:1fr}` rule.
- `CmPlannerPage.tsx`: remove the `<aside className="cmp-right">…<RaceSimCard/></aside>` block (236–238). Temporarily render `<RaceSimCard ctl={raceSim} />` at the end of `.cmp-main` (it relocates to a tab in Task 8). The overlay-on-track wiring (203–221) stays unchanged.

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run src/features/cm-planner/CmPlannerPage.test.tsx` then `pnpm build`
Expected: PASS + green build; page renders 3 columns, compare still works (controls now under main).

- [ ] **Step 5: Commit**

```bash
git add src/features/cm-planner/cm-planner.css src/features/cm-planner/CmPlannerPage.tsx src/features/cm-planner/CmPlannerPage.test.tsx
git commit -m "feat(m4): collapse main page to a 3-column grid (race-sim rail removed)"
```

## Task 3: Collapsible inventory (sliver mode)

**Files:**
- Modify: `src/features/cm-planner/PlanInventoryCard.tsx:146-335`
- Modify: `src/features/cm-planner/cm-planner.css` (add `.cmp-inventory-sliver` rules)
- Test: `src/features/cm-planner/PlanInventoryCard.test.tsx` (new or extend)

**Interfaces:**
- Consumes: `getSetting`/`setSetting`.
- Produces: a new prop `collapsed?: boolean` + `onCollapsedChange?: (v: boolean) => void`; when collapsed renders a sliver (`.cmp-inventory-sliver`: vertical glyph + plan count + expand button) instead of the full card. Persistence key `cmPlannerInventoryCollapsed`, default `false` (expanded).

- [ ] **Step 1: Write the failing test**

```tsx
test('inventory renders a sliver with the plan count when collapsed', () => {
  render(<PlanInventoryCard {...baseProps} plans={[planA, planB, planC]} collapsed onCollapsedChange={() => {}} />);
  expect(screen.getByRole('button', { name: /expand inventory/i })).toBeInTheDocument();
  expect(screen.getByText('3')).toBeInTheDocument();             // plan count
  expect(screen.queryByText('Plan Inventory')).toBeNull();        // full header hidden
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run src/features/cm-planner/PlanInventoryCard.test.tsx -t "sliver"`
Expected: FAIL — no `collapsed` branch.

- [ ] **Step 3: Implement**

- Add `collapsed`/`onCollapsedChange` to the props interface (146–164).
- At the top of the render (268), early-return the sliver when `collapsed`:
  ```tsx
  if (collapsed) {
    return (
      <aside className="cmp-plan-inventory cmp-inventory-sliver">
        <button type="button" className="cmp-sliver-btn" aria-label="Expand inventory"
                onClick={() => onCollapsedChange?.(false)}>
          <span className="cmp-sliver-glyph">▤</span>
          <span className="cmp-sliver-count">{plans.length}</span>
        </button>
      </aside>
    );
  }
  ```
- Add a collapse button (▤/✕) to `.cmp-plan-card-head` (271) that calls `onCollapsedChange?.(true)`.
- CSS: `.cmp-inventory-sliver{width:2.4rem;min-width:2.4rem}` + `.cmp-sliver-btn` (vertical flex, writing-mode for the label is optional). In `.cmp-page`, when collapsed the first grid column shrinks — drive this from `CmPlannerPage` (Step: pass a `data-inv-collapsed` to `.cmp-page` and add `.cmp-page[data-inv-collapsed="true"]{grid-template-columns:2.4rem minmax(360px,26rem) minmax(0,1fr)}`).

- [ ] **Step 4: Wire `CmPlannerPage` + persistence**

In `CmPlannerPage.tsx`: add `const [invCollapsed, setInvCollapsed]` loaded from `getSetting<boolean>('cmPlannerInventoryCollapsed')` (default false), persist on change, pass to `PlanInventoryCard`, and set `data-inv-collapsed={String(invCollapsed)}` on `.cmp-page`.

- [ ] **Step 5: Run + commit**

Run: `pnpm vitest run src/features/cm-planner/PlanInventoryCard.test.tsx` + `pnpm build`
Expected: PASS + green.

```bash
git add src/features/cm-planner/PlanInventoryCard.tsx src/features/cm-planner/cm-planner.css src/features/cm-planner/CmPlannerPage.tsx src/features/cm-planner/PlanInventoryCard.test.tsx
git commit -m "feat(m4): collapsible inventory sliver (expanded = today's look)"
```

---

# Milestone B — Dual-build flip card

## Task 4: Copy/duplicate helpers (pure)

**Files:**
- Create: `src/core/cmPlanCopy.ts`
- Test: `src/core/cmPlanCopy.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  // deep clone with a fresh id + planNumber=1 + optional rename; used by both copy buttons + "duplicate uma1→uma2"
  export function copyPlanInto(source: CmPlan, opts?: { keepName?: boolean }): CmPlan;
  ```

- [ ] **Step 1: Write the failing test**

```ts
import { expect, test } from 'vitest';
import { copyPlanInto } from './cmPlanCopy';
import { makeDefaultPlan } from '@/app/ActivePlanContext';

test('copyPlanInto deep-clones with a fresh id and resets planNumber', () => {
  const src = makeDefaultPlan();
  const copy = copyPlanInto(src);
  expect(copy.id).not.toBe(src.id);
  expect(copy.planNumber).toBe(1);
  expect(copy.wishlist).toEqual(src.wishlist);
  expect(copy.wishlist).not.toBe(src.wishlist);          // deep, not shared ref
  copy.statProfile.stats.spd = 9999;
  expect(src.statProfile.stats.spd).not.toBe(9999);      // no aliasing
});
```

- [ ] **Step 2: Run to verify it fails** — `pnpm vitest run src/core/cmPlanCopy.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement**

```ts
import type { CmPlan } from './types';

export function copyPlanInto(source: CmPlan, opts?: { keepName?: boolean }): CmPlan {
  const clone = structuredClone(source);
  clone.id = crypto.randomUUID();
  clone.planNumber = 1;
  if (!opts?.keepName) clone.name = '';   // caller re-names via generatePlanName
  return clone;
}
```

- [ ] **Step 4: Run to verify it passes** — `pnpm vitest run src/core/cmPlanCopy.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/cmPlanCopy.ts src/core/cmPlanCopy.test.ts
git commit -m "feat(m4): pure copyPlanInto helper for uma1<->uma2 copy"
```

## Task 5: Flip-card sidebar (faces + accent + focus)

**Files:**
- Modify: `src/features/cm-planner/PlannerSidebar.tsx:130-356`
- Modify: `src/features/cm-planner/cm-planner.css` (accent var + flip transition)
- Modify: `src/features/cm-planner/CmPlannerPage.tsx` (pass focused state)
- Test: `src/features/cm-planner/PlannerSidebar.flip.test.tsx` (new; `vi.mock('./useSkillTrace')`)

**Interfaces:**
- Consumes: Task 1 `focused`, `setFocused`, `focusedPlan`, `setFocusedPlan`, `uma2Plan`.
- Produces: `PlannerSidebar` gains props `focused: 'uma1'|'uma2'`, `onFocusChange: (s)=>void`, `uma2Empty: boolean`. The card header shows a **UMA1 / UMA2 segmented toggle**; the card root sets `data-uma={focused}` and `style={{'--uma-accent': focused==='uma1' ? '#5aa0ff' : '#e0564f'}}`. Body operates on `plan` (which the page now feeds as `focusedPlan`). When `focused==='uma2' && uma2Empty`, render the empty-uma2 face (Task 6 adds the buttons).

- [ ] **Step 1: Write the failing test**

```tsx
// vi.mock('./useSkillTrace') at top
test('sidebar shows UMA1/UMA2 toggle and recolors on focus', () => {
  const onFocusChange = vi.fn();
  const { rerender } = render(<PlannerSidebar {...sidebarProps} focused="uma1" onFocusChange={onFocusChange} uma2Empty />);
  const card = screen.getByTestId('cmp-flip-card');
  expect(card).toHaveAttribute('data-uma', 'uma1');
  fireEvent.click(screen.getByRole('button', { name: 'UMA2' }));
  expect(onFocusChange).toHaveBeenCalledWith('uma2');
  rerender(<PlannerSidebar {...sidebarProps} focused="uma2" onFocusChange={onFocusChange} uma2Empty />);
  expect(screen.getByTestId('cmp-flip-card')).toHaveAttribute('data-uma', 'uma2');
});
```

- [ ] **Step 2: Run to verify it fails** — FAIL (no toggle / `data-uma`).

- [ ] **Step 3: Implement**

- Extend props (130–152) with `focused`, `onFocusChange`, `uma2Empty`.
- On the `<section className="cmp-plan-card">` (353) add `data-testid="cmp-flip-card" data-uma={focused}` and the `--uma-accent` inline style; add class `cmp-flip-card`.
- Replace the static "Current Uma Plan" head (354–356) with a segmented toggle:
  ```tsx
  <header className="cmp-plan-card-head cmp-flip-head">
    <span className="cmp-flip-seg">
      <button type="button" className={focused==='uma1'?'on':''} onClick={() => onFocusChange('uma1')}>UMA1</button>
      <button type="button" className={focused==='uma2'?'on':''} onClick={() => onFocusChange('uma2')}>UMA2</button>
    </span>
  </header>
  ```
- If `focused==='uma2' && uma2Empty`, render `<div className="cmp-uma2-empty">No uma2 yet.</div>` instead of the body (buttons added in Task 6).
- CSS: `.cmp-flip-card{transition:box-shadow 120ms} .cmp-flip-card{box-shadow:0 0 0 2px var(--uma-accent, transparent) inset, …}` + a brief content fade via `@keyframes cmp-flip` applied on `data-uma` change; the segmented `.cmp-flip-seg button.on{background:var(--uma-accent);color:#fff}`.
- `CmPlannerPage.tsx`: feed `plan={focusedPlan}` `onChange={setFocusedPlan}` `focused={focused}` `onFocusChange={setFocused}` `uma2Empty={uma2Plan===null}` to `PlannerSidebar`. (uma1's save/saveAs/new handlers stay wired to the uma1 path; when focused uma2, route them to the uma2 setters — small conditional.)

- [ ] **Step 4: Run + typecheck** — `pnpm vitest run src/features/cm-planner/PlannerSidebar.flip.test.tsx` + `pnpm typecheck` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/cm-planner/PlannerSidebar.tsx src/features/cm-planner/cm-planner.css src/features/cm-planner/CmPlannerPage.tsx src/features/cm-planner/PlannerSidebar.flip.test.tsx
git commit -m "feat(m4): flip-card sidebar with UMA1/UMA2 focus + accent recolor"
```

## Task 6: Copy buttons + empty-uma2 actions

**Files:**
- Modify: `src/features/cm-planner/PlannerSidebar.tsx` (header actions)
- Modify: `src/features/cm-planner/CmPlannerPage.tsx` (handlers)
- Test: `src/features/cm-planner/PlannerSidebar.flip.test.tsx` (extend)

**Interfaces:**
- Consumes: Task 4 `copyPlanInto`, Task 1 setters.
- Produces: `PlannerSidebar` props `onDuplicateUma1ToUma2: () => void`, `onReplicateUma2ToUma1: () => void`. Red face shows **"⤓ Duplicate uma1 → uma2"**; blue face shows **"⤓ Replicate uma2 → uma1"** (disabled when `uma2Empty`); empty-uma2 face shows **"Duplicate uma1 →"** + a hint to load from inventory.

- [ ] **Step 1: Write the failing test**

```tsx
test('duplicate uma1 -> uma2 calls handler from the empty uma2 face', () => {
  const onDup = vi.fn();
  render(<PlannerSidebar {...sidebarProps} focused="uma2" uma2Empty onDuplicateUma1ToUma2={onDup} onReplicateUma2ToUma1={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /duplicate uma1/i }));
  expect(onDup).toHaveBeenCalled();
});

test('replicate uma2 -> uma1 is disabled when uma2 is empty', () => {
  render(<PlannerSidebar {...sidebarProps} focused="uma1" uma2Empty onReplicateUma2ToUma1={vi.fn()} onDuplicateUma1ToUma2={vi.fn()} />);
  expect(screen.getByRole('button', { name: /replicate uma2/i })).toBeDisabled();
});
```

- [ ] **Step 2: Run to verify it fails** — FAIL.

- [ ] **Step 3: Implement**

- Add the two props; render the buttons (red face / blue face / empty face) as described, `disabled={uma2Empty}` on the replicate button.
- `CmPlannerPage.tsx` handlers:
  ```tsx
  const onDuplicateUma1ToUma2 = () => {
    const draft = copyPlanInto(uma1Plan);
    draft.name = generatePlanName(draft, umaById?.get(draft.umaId)?.nameEn, raceNameLabel);
    setUma2Plan(draft); setFocused('uma2');
  };
  const onReplicateUma2ToUma1 = () => {
    if (!uma2Plan) return;
    if (!window.confirm('Overwrite uma1 with uma2’s build?')) return;
    const draft = copyPlanInto(uma2Plan, { keepName: false });
    draft.name = generatePlanName(draft, umaById?.get(draft.umaId)?.nameEn, raceNameLabel);
    setPlan({ ...draft, id: uma1Plan.id, planNumber: uma1Plan.planNumber }); // overwrite the active uma1
  };
  ```

- [ ] **Step 4: Run + build** — PASS + green.

- [ ] **Step 5: Commit**

```bash
git add src/features/cm-planner/PlannerSidebar.tsx src/features/cm-planner/CmPlannerPage.tsx src/features/cm-planner/PlannerSidebar.flip.test.tsx
git commit -m "feat(m4): uma1<->uma2 copy buttons (confirm before overwriting uma1)"
```

## Task 7: Track auto-apply on flip / uma2-load

**Files:**
- Modify: `src/features/cm-planner/CmPlannerPage.tsx` (track derives from focusedPlan; auto-apply rules)
- Test: `src/features/cm-planner/CmPlannerPage.test.tsx` (extend)

**Interfaces:**
- Consumes: existing `autoApplyInventoryTrack`, `cmRefToSelection`, `focusedPlan`.
- Produces: the pinned track's `selection` derives from **`focusedPlan.cmRef`**; rules: flip with toggle ON → track follows focused build; load into uma2 with toggle ON → track switches to uma2; **uma2 blank → never change track**; toggle OFF → never change (keep uma1's race).

- [ ] **Step 1: Write the failing test**

```tsx
test('flipping to uma2 with auto-apply ON switches the track to uma2 race', async () => {
  renderPage(); // seed uma2 with a different course via test helper
  // ...load a uma2 plan whose cmRef.courseId !== uma1's...
  fireEvent.click(screen.getByRole('button', { name: 'UMA2' }));
  await waitFor(() => expect(screen.getByText(/uma2 course label/i)).toBeInTheDocument());
});
test('flipping to an empty uma2 leaves the track unchanged', async () => { /* assert track title stays uma1's */ });
```

- [ ] **Step 2: Run to verify it fails** — FAIL (selection still derives from `plan`, not `focusedPlan`).

- [ ] **Step 3: Implement**

- Change `selection` memo (59–62) to derive from `focusedPlan` when `autoApplyInventoryTrack` is ON **and** `focusedPlan` is non-null; otherwise keep `uma1Plan.cmRef`. Guard: if `focused==='uma2' && uma2Plan===null`, use `uma1Plan.cmRef` (never change track).
- `handleRaceChange` writes back to the focused build's `cmRef` via `setFocusedPlan`.

- [ ] **Step 4: Run + build** — PASS + green.

- [ ] **Step 5: Commit**

```bash
git add src/features/cm-planner/CmPlannerPage.tsx src/features/cm-planner/CmPlannerPage.test.tsx
git commit -m "feat(m4): track follows focused build under auto-apply (uma2-blank guarded)"
```

---

# Milestone C — Tabs + Mini-sim

## Task 8: WorkingTabs container; move Unique + Skills into tabs

**Files:**
- Create: `src/features/cm-planner/WorkingTabs.tsx`
- Modify: `src/features/cm-planner/CmPlannerPage.tsx:202-235`
- Modify: `cm-planner.css` (tab strip)
- Test: `src/features/cm-planner/WorkingTabs.test.tsx` (`vi.mock('./useSkillTrace')`)

**Interfaces:**
- Produces:
  ```typescript
  type TabKey = 'unique' | 'stamina' | 'accel' | 'skills' | 'minisim';
  interface WorkingTabsProps { tabs: { key: TabKey; label: string; node: ReactNode }[]; initial?: TabKey; }
  ```
  Renders a `.cmp-tabstrip` of buttons + the active tab's `node`. Only the active node is mounted (lazy — keeps the engine work scoped).

- [ ] **Step 1: Write the failing test**

```tsx
test('WorkingTabs shows the initial tab and switches on click', () => {
  render(<WorkingTabs initial="unique" tabs={[
    { key: 'unique', label: 'Unique', node: <div>UNIQUE</div> },
    { key: 'skills', label: 'Skills', node: <div>SKILLS</div> },
  ]} />);
  expect(screen.getByText('UNIQUE')).toBeInTheDocument();
  expect(screen.queryByText('SKILLS')).toBeNull();
  fireEvent.click(screen.getByRole('tab', { name: 'Skills' }));
  expect(screen.getByText('SKILLS')).toBeInTheDocument();
  expect(screen.queryByText('UNIQUE')).toBeNull();
});
```

- [ ] **Step 2: Run to verify it fails** — FAIL (module missing).

- [ ] **Step 3: Implement `WorkingTabs.tsx`**

```tsx
import { useState, type ReactNode } from 'react';
export type TabKey = 'unique' | 'stamina' | 'accel' | 'skills' | 'minisim';
export function WorkingTabs({ tabs, initial }: { tabs: { key: TabKey; label: string; node: ReactNode }[]; initial?: TabKey }) {
  const [active, setActive] = useState<TabKey>(initial ?? tabs[0]!.key);
  const current = tabs.find((t) => t.key === active) ?? tabs[0]!;
  return (
    <section className="cmp-plan-card cmp-tabs-card">
      <div className="cmp-tabstrip" role="tablist">
        {tabs.map((t) => (
          <button key={t.key} role="tab" type="button" aria-selected={t.key === active}
                  className={t.key === active ? 'on' : ''} onClick={() => setActive(t.key)}>{t.label}</button>
        ))}
      </div>
      <div className="cmp-tab-body" role="tabpanel">{current.node}</div>
    </section>
  );
}
```

- [ ] **Step 4: Wire into the page**

In `CmPlannerPage.tsx`, replace the stacked `<UmaChartPanel/>` + `<SkillChartPanel/>` (223–234) with:
```tsx
<WorkingTabs initial="unique" tabs={[
  { key: 'unique', label: 'Unique', node: <UmaChartPanel courseId={selection.courseId} plan={focusedPlan!} collapseSkillSignal={collapseSkillSignal} onSelectRunner={(umaId, uniqueSkillId) => setFocusedPlan({ ...focusedPlan!, umaId, uniqueSkillId })} /> },
  { key: 'skills', label: 'Skills', node: <SkillChartPanel courseId={selection.courseId} plan={focusedPlan!} collapseSkillSignal={collapseSkillSignal} onChange={setFocusedPlan} /> },
  // stamina/accel/minisim added in Tasks 9–11
]} />
```
- CSS `.cmp-tabstrip{display:flex;gap:.25rem;border-bottom:1px solid var(--border);padding:.4rem .5rem} .cmp-tabstrip button.on{background:var(--bg-2);font-weight:700}`.

- [ ] **Step 5: Run + build + commit**

Run: `pnpm vitest run src/features/cm-planner/WorkingTabs.test.tsx` + `pnpm build` → PASS + green.
```bash
git add src/features/cm-planner/WorkingTabs.tsx src/features/cm-planner/CmPlannerPage.tsx src/features/cm-planner/cm-planner.css src/features/cm-planner/WorkingTabs.test.tsx
git commit -m "feat(m4): tabbed working panel; move Unique + Skills charts into tabs"
```

## Task 9: Mini-sim tab; refactor compare controller; retire RaceSimCard

**Files:**
- Modify: `src/features/cm-planner/useRaceCompareController.tsx:26-46`
- Modify: `src/features/cm-planner/CmPlannerPage.tsx`
- Delete: `src/features/cm-planner/RaceSimCard.tsx` (+ its test) — fold its controls into a `MiniSimTab`
- Create: `src/features/cm-planner/MiniSimTab.tsx`
- Test: `src/features/cm-planner/MiniSimTab.test.tsx`

**Interfaces:**
- Consumes: Task 1 `uma1Plan`, `uma2Plan`; engine via the existing controller.
- Produces: `useRaceCompareController(uma1Plan, uma2Plan, courseId, deps?)` — uma2 now comes from the passed `uma2Plan` (build it via `planToOverlayBuild`), not a saved-plan id. `comparing = uma1 && uma2Plan !== null`. `MiniSimTab` renders Run/Stop + Show-HP + RunChoice + status (the body of today's `RaceSimCard`, minus the uma2 picker), and an empty-state prompt when `uma2Plan===null`.

- [ ] **Step 1: Write the failing test**

```tsx
// vi.mock the controller's engine hook as today's tests do
test('MiniSimTab prompts to fill uma2 when empty', () => {
  render(<MiniSimTab ctl={{ ...ctlStub, comparing: false, uma2Empty: true }} />);
  expect(screen.getByText(/load or duplicate a uma2/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify it fails** — FAIL.

- [ ] **Step 3: Implement**

- Refactor `useRaceCompareController` to take `(uma1Plan, uma2Plan, courseId, deps?)`; drop `uma2Id`/`setUma2Id`/`others`; resolve uma2 directly from `uma2Plan` (return `uma2Empty: uma2Plan === null`). Keep `showHp`/`setShowHp`/`state`/`comparing`.
- Move the non-picker JSX of `RaceSimCard` into `MiniSimTab.tsx`; add the empty prompt. Delete `RaceSimCard.tsx`, `Uma2PickerPopover.tsx` usage, and `RaceSimCard.test.tsx`.
- In `CmPlannerPage.tsx`: call `useRaceCompareController(uma1Plan, uma2Plan, selection.courseId)`; add the Mini-sim tab `{ key: 'minisim', label: 'Mini-sim', node: <MiniSimTab ctl={raceSim} /> }`. The track overlay wiring (203–212) is unchanged.

- [ ] **Step 4: Run + build** — PASS + green; overlay still draws on the track when comparing.

- [ ] **Step 5: Commit**

```bash
git add -A src/features/cm-planner
git commit -m "feat(m4): Mini-sim tab; uma2 = the uma2 slot; retire RaceSimCard picker"
```

---

# Milestone D — Engine-derived checkers

## Task 10: Stamina checker

**Files:**
- Create: `src/features/cm-planner/staminaCheck.ts` (pure) + `staminaCheck.test.ts`
- Create: `src/features/cm-planner/StaminaCheckerTab.tsx`
- Modify: `CmPlannerPage.tsx` (add the tab)
- Test: `StaminaCheckerTab.test.tsx` (`vi.mock` the trace hook)

**Interfaces:**
- Consumes: a per-frame `SkillFrame[]` (`{ t, v, pos, hp }`) — obtained from `runSkillTrace(build, race, anchorSkillId, nsamples).runs.mean.without` (the build's baseline trace; pick any wishlist/unique skill id as the throwaway anchor, or the first deck skill).
- Produces:
  ```typescript
  interface StaminaVerdict { finishes: boolean; minHp: number; minHpPos: number; distance: number; }
  export function staminaVerdict(without: SkillFrame[], distance: number): StaminaVerdict;
  ```

- [ ] **Step 1: Write the failing test**

```ts
import { expect, test } from 'vitest';
import { staminaVerdict } from './staminaCheck';
test('staminaVerdict flags a build that bottoms out at 0 HP before the line', () => {
  const frames = [
    { t: 0, v: 20, pos: 0, hp: 100 },
    { t: 5, v: 20, pos: 800, hp: 40 },
    { t: 9, v: 18, pos: 1500, hp: 0 },
    { t: 11, v: 15, pos: 1600, hp: 0 },
  ];
  const v = staminaVerdict(frames, 1600);
  expect(v.finishes).toBe(false);
  expect(v.minHp).toBe(0);
  expect(v.minHpPos).toBe(1500);
});
test('staminaVerdict passes a build that keeps HP > 0 to the line', () => {
  const frames = [{ t: 0, v: 20, pos: 0, hp: 100 }, { t: 10, v: 20, pos: 1600, hp: 12 }];
  expect(staminaVerdict(frames, 1600).finishes).toBe(true);
});
```

- [ ] **Step 2: Run to verify it fails** — FAIL.

- [ ] **Step 3: Implement**

```ts
import type { SkillFrame } from '@/sim/types';
export interface StaminaVerdict { finishes: boolean; minHp: number; minHpPos: number; distance: number; }
export function staminaVerdict(without: SkillFrame[], distance: number): StaminaVerdict {
  let minHp = Infinity, minHpPos = 0;
  for (const f of without) { if (f.hp < minHp) { minHp = f.hp; minHpPos = f.pos; } }
  // "runs out" = HP bottoms out at ~0 anywhere in the race.
  return { finishes: minHp > 0.0001, minHp, minHpPos, distance };
}
```

- [ ] **Step 4: Build `StaminaCheckerTab.tsx`** — a `useSkillTrace`-style hook call (LRU-memoized) that runs the trace for `focusedPlan` on the current race, computes `staminaVerdict(run.without, distance)`, and renders a green **Finishes** / red **Runs out** badge + min-HP + position. Guard `spd > 0`. Add `{ key: 'stamina', label: 'Stamina', node: <StaminaCheckerTab ... /> }` to the tabs.

- [ ] **Step 5: Run + build + commit**

```bash
git add src/features/cm-planner/staminaCheck.ts src/features/cm-planner/staminaCheck.test.ts src/features/cm-planner/StaminaCheckerTab.tsx src/features/cm-planner/StaminaCheckerTab.test.tsx src/features/cm-planner/CmPlannerPage.tsx
git commit -m "feat(m4): engine-derived stamina checker tab (HP-trace verdict)"
```

## Task 11: Accel checker

**Files:**
- Create: `src/features/cm-planner/accelCheck.ts` (pure) + `accelCheck.test.ts`
- Create: `src/features/cm-planner/AccelCheckerTab.tsx`
- Modify: `CmPlannerPage.tsx` (add the tab)
- Test: `AccelCheckerTab.test.tsx`

**Interfaces:**
- Consumes: per-skill activation positions (`skillImpact(build, race, skillId, n).samples[].positions` or `runSkillTrace(...).runs.mean.activation` start metres) + course `distance` + the final-straight start (`fs`) from course geometry (already available via `courseData`).
- Produces:
  ```typescript
  type AccelTiming = 'optimal' | 'mid' | 'early' | 'none';
  export function classifyAccelTiming(activationPos: number | null, finalStraightStart: number, distance: number): AccelTiming;
  ```

- [ ] **Step 1: Write the failing test**

```ts
import { expect, test } from 'vitest';
import { classifyAccelTiming } from './accelCheck';
test('classifyAccelTiming buckets by where the skill fires', () => {
  // course: distance 1600, final straight starts at 1300
  expect(classifyAccelTiming(1350, 1300, 1600)).toBe('optimal'); // in final straight
  expect(classifyAccelTiming(800, 1300, 1600)).toBe('mid');      // mid race
  expect(classifyAccelTiming(150, 1300, 1600)).toBe('early');    // too early
  expect(classifyAccelTiming(null, 1300, 1600)).toBe('none');    // never fires
});
```

- [ ] **Step 2: Run to verify it fails** — FAIL.

- [ ] **Step 3: Implement**

```ts
export type AccelTiming = 'optimal' | 'mid' | 'early' | 'none';
export function classifyAccelTiming(pos: number | null, fs: number, distance: number): AccelTiming {
  if (pos === null) return 'none';
  if (pos >= fs) return 'optimal';
  if (pos >= distance * 0.5) return 'mid';
  return 'early';
}
```

- [ ] **Step 4: Build `AccelCheckerTab.tsx`** — for each speed/accel skill in `focusedPlan`'s wishlist+unique, run `skillImpact` (LRU-memoized), take the median activation position (or `null` if `samples` empty), classify, and render a table (skill · timing label · position). Add `{ key: 'accel', label: 'Accel', node: <AccelCheckerTab ... /> }` to the tabs **between Stamina and Skills** (final order: Unique · Stamina · Accel · Skills · Mini-sim).

- [ ] **Step 5: Run + build + commit**

```bash
git add src/features/cm-planner/accelCheck.ts src/features/cm-planner/accelCheck.test.ts src/features/cm-planner/AccelCheckerTab.tsx src/features/cm-planner/AccelCheckerTab.test.tsx src/features/cm-planner/CmPlannerPage.tsx
git commit -m "feat(m4): engine-derived accel-timing checker tab"
```

## Task 12: Final polish + token extraction + full regression

**Files:**
- Modify: `cm-planner.css` (accent vars → named tokens; tab/flip polish)
- Test: full suite

- [ ] **Step 1:** Extract `--uma-accent` blue/red + the new card/tab tokens into a clearly-named block at the top of `cm-planner.css` (comment: "candidates for design-system.css, Phase 1").
- [ ] **Step 2:** Run the full suite: `pnpm typecheck && pnpm test && pnpm build`. Expected: all green.
- [ ] **Step 3:** Manual smoke (or `pnpm dev`): flip uma1↔uma2 recolors + switches context; duplicate/replicate works with confirm; inventory collapses to sliver and back; tabs switch; Mini-sim overlay draws on the track; stamina + accel verdicts render; refresh clears uma2 but uma1 persists.
- [ ] **Step 4: Commit**

```bash
git add src/features/cm-planner/cm-planner.css
git commit -m "chore(m4): extract uma-accent/tab tokens; full main-page redesign green"
```

---

## Self-review notes (coverage vs spec)

- §3 shell → Tasks 2, 3, 8. §4.1 inventory → Task 3 (mark-both-slots: add in Task 9 when uma2 exists — fold the blue/red row marker into `PlanInventoryCard` there). §4.2 flip card → Tasks 5, 6. §4.3 track rules → Task 7. §4.4 tabs → Task 8. §4.5 stamina → Task 10. §4.6 accel → Task 11. §4.7 Mini-sim → Task 9. §5 dual-plan state → Task 1. §6 tokens → Task 12.
- **Deferred to follow-up (flagged):** inventory rows visually marking the uma1/uma2 slot (blue/red) — add in Task 9 once `uma2Plan` exists; if skipped, note it. The dedicated **full race-sim page** is a separate spec (not in this plan).
- **Engine open question resolved:** single-build HP trace = `runSkillTrace(...).runs[choice].without` — no rebuild.
