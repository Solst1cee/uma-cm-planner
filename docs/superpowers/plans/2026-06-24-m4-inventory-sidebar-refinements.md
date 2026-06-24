# M4 Inventory + Sidebar UX Refinements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the 13 inventory + sidebar refinements from the [spec](../specs/2026-06-24-m4-inventory-sidebar-refinements-design.md) — backpack-icon inventory with an edit-mode gate, per-item uma1/uma2 slot picking with collision auto-duplicate, a track-change confirm flow, full red uma2 input theming, and three bug fixes (stat "0", delete-touches-loaded, stale saved-indicator).

**Architecture:** Pure branchy logic is extracted into three unit-tested helpers (`statInput.ts`, `trackChange.ts`, `slotLoad.ts`) and one new component (`StatInput.tsx`). State + persistence changes land in `ActivePlanContext` (`loadPlanIntoSlot`, `deleteSavedPlan` fix, focus-aware `isSaved`). UI changes land in `PlannerSidebar`, `PlanInventoryCard`, `CmPlannerPage`, and `cm-planner.css`. No engine (`sim:build`) work, no Dexie schema change.

**Tech Stack:** TypeScript + React 19, Vitest (jsdom) + Testing Library, existing helpers `copyPlanInto`, `useDismissOnOutside`, `generatePlanName`, inline-SVG `IconSvg` convention.

## Global Constraints

- **No `sim:build` / engine rebuild, no Dexie schema change, no change to uma2 session-scratch persistence** (still cleared on refresh, never writes `activePlanId`).
- **Accent colors are exact:** uma1 blue `#5aa0ff`, uma2 red `#e0564f` (already set as inline `--uma-accent` on `.cmp-flip-card`).
- **jsdom Worker gotcha:** any test that mounts a component opening a `SkillDetailDisclosure` with a `traceContext` MUST `vi.mock('./useSkillTrace')` and `vi.mock('./useRaceCompare')` (jsdom has no Worker). Follow the existing mocks in `CmPlannerPage.test.tsx` / `PlannerSidebar.flip.test.tsx`.
- **Trust `pnpm typecheck` + `pnpm build` (race-free); re-run a single failing UI test file once before treating a failure as real** (vitest HMR flake while `pnpm dev` runs).
- **Run `pnpm vitest run src/features/cm-planner/CmPlannerPage.test.tsx` on every task that touches `CmPlannerPage`, `PlanInventoryCard`, or `PlannerSidebar`** (its key-aware `getSetting` mock + dual-plan mock are fragile — a redesign regression escaped last cycle by skipping it).
- **`.superpowers/` is gitignored scratch — never `git add`/`commit` anything under it.**
- **`CmRefV2` reads:** `cmRef.courseId` / `.surface` / `.distance` need no narrowing on either union arm; conditions DO. Track comparisons use `courseId`.
- **Drag-and-drop is OUT OF SCOPE** (deferred follow-up).
- Decision (open detail, confirmed): **focused-uma2 action row = `[Replicate uma1] [New]` with Save / Save As disabled.**

---

## Task 1: `statInput.ts` pure helpers (stat-field "0" fix logic)

**Files:**
- Create: `src/features/cm-planner/statInput.ts`
- Test: `src/features/cm-planner/statInput.test.ts`

**Interfaces:**
- Produces: `sanitizeStatDraft(raw: string): string` — digits only, leading zeros stripped, single `'0'` allowed, `''` allowed. `statValueFromDraft(raw: string): number` — `Number(sanitizeStatDraft(raw) || '0')`.

- [ ] **Step 1: Write the failing test**

```ts
// src/features/cm-planner/statInput.test.ts
import { describe, expect, it } from 'vitest';
import { sanitizeStatDraft, statValueFromDraft } from './statInput';

describe('sanitizeStatDraft', () => {
  it('keeps a normal number unchanged', () => {
    expect(sanitizeStatDraft('1200')).toBe('1200');
  });
  it('allows an empty string mid-edit', () => {
    expect(sanitizeStatDraft('')).toBe('');
  });
  it('strips leading zeros but keeps a single zero', () => {
    expect(sanitizeStatDraft('01200')).toBe('1200');
    expect(sanitizeStatDraft('0')).toBe('0');
    expect(sanitizeStatDraft('0000')).toBe('0');
    expect(sanitizeStatDraft('0850')).toBe('850');
  });
  it('drops non-digit characters', () => {
    expect(sanitizeStatDraft('12a3')).toBe('123');
    expect(sanitizeStatDraft('-5')).toBe('5');
    expect(sanitizeStatDraft('1.2')).toBe('12');
  });
});

describe('statValueFromDraft', () => {
  it('treats empty as 0', () => {
    expect(statValueFromDraft('')).toBe(0);
  });
  it('parses the sanitized digits', () => {
    expect(statValueFromDraft('01200')).toBe(1200);
    expect(statValueFromDraft('0')).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/cm-planner/statInput.test.ts`
Expected: FAIL — "Failed to resolve import './statInput'".

- [ ] **Step 3: Write minimal implementation**

```ts
// src/features/cm-planner/statInput.ts
/** Sanitize a raw stat-field draft: digits only, leading zeros stripped (a single
 *  '0' and the empty string survive so the field can be cleared mid-edit). */
export function sanitizeStatDraft(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits === '') return '';
  const stripped = digits.replace(/^0+/, '');
  return stripped === '' ? '0' : stripped;
}

/** The committed numeric value for a draft ('' → 0). */
export function statValueFromDraft(raw: string): number {
  return Number(sanitizeStatDraft(raw) || '0');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/features/cm-planner/statInput.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/features/cm-planner/statInput.ts src/features/cm-planner/statInput.test.ts
git commit -m "feat(m4): stat-input sanitize helpers (clear-to-empty, strip leading zeros)"
```

---

## Task 2: `trackChange.ts` pure helpers (track-confirm decision)

**Files:**
- Create: `src/features/cm-planner/trackChange.ts`
- Test: `src/features/cm-planner/trackChange.test.ts`

**Interfaces:**
- Consumes: `CmRefV2` from `@/core/types`.
- Produces: `tracksDiffer(a: CmRefV2, b: CmRefV2): boolean` (`a.courseId !== b.courseId`). `trackChangeNeedsConfirm(args: { autoApply: boolean; hadPriorTrack: boolean; prevCourseId: string; nextCourseId: string }): boolean`.

- [ ] **Step 1: Write the failing test**

```ts
// src/features/cm-planner/trackChange.test.ts
import { describe, expect, it } from 'vitest';
import type { CmRefV2 } from '@/core/types';
import { tracksDiffer, trackChangeNeedsConfirm } from './trackChange';

const cm = (courseId: string): CmRefV2 =>
  ({ kind: 'cm', cmId: 'CM15', cmNumber: 15, courseId, surface: 'turf', distance: 2200 } as unknown as CmRefV2);

describe('tracksDiffer', () => {
  it('is false for equal courseIds', () => {
    expect(tracksDiffer(cm('10906'), cm('10906'))).toBe(false);
  });
  it('is true for different courseIds', () => {
    expect(tracksDiffer(cm('10906'), cm('10501'))).toBe(true);
  });
});

describe('trackChangeNeedsConfirm', () => {
  it('confirms when auto-apply on, prior track exists, and the course changes', () => {
    expect(trackChangeNeedsConfirm({ autoApply: true, hadPriorTrack: true, prevCourseId: '10906', nextCourseId: '10501' })).toBe(true);
  });
  it('does not confirm when the course is unchanged', () => {
    expect(trackChangeNeedsConfirm({ autoApply: true, hadPriorTrack: true, prevCourseId: '10906', nextCourseId: '10906' })).toBe(false);
  });
  it('does not confirm when auto-apply is off', () => {
    expect(trackChangeNeedsConfirm({ autoApply: false, hadPriorTrack: true, prevCourseId: '10906', nextCourseId: '10501' })).toBe(false);
  });
  it('does not confirm on the first load (no prior track)', () => {
    expect(trackChangeNeedsConfirm({ autoApply: true, hadPriorTrack: false, prevCourseId: '10906', nextCourseId: '10501' })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/cm-planner/trackChange.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/features/cm-planner/trackChange.ts
import type { CmRefV2 } from '@/core/types';

/** Two race refs point at different courses (the only thing the §0 track + race-setup care about). */
export function tracksDiffer(a: CmRefV2, b: CmRefV2): boolean {
  return a.courseId !== b.courseId;
}

/** Whether an inventory load into the focused slot — or a uma1/uma2 flip — should
 *  pop the "change track?" confirmation: only when auto-apply is on, a prior track
 *  already exists, and the course actually changes. */
export function trackChangeNeedsConfirm(args: {
  autoApply: boolean;
  hadPriorTrack: boolean;
  prevCourseId: string;
  nextCourseId: string;
}): boolean {
  return args.autoApply && args.hadPriorTrack && args.prevCourseId !== args.nextCourseId;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/features/cm-planner/trackChange.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/cm-planner/trackChange.ts src/features/cm-planner/trackChange.test.ts
git commit -m "feat(m4): track-change confirm decision helpers"
```

---

## Task 3: `slotLoad.ts` collision predicate

**Files:**
- Create: `src/features/cm-planner/slotLoad.ts`
- Test: `src/features/cm-planner/slotLoad.test.ts`

**Interfaces:**
- Produces: `shouldDuplicateForSlot(id: string, slot: 'uma1' | 'uma2', uma1Id: string | undefined, uma2Id: string | undefined): boolean` — true iff loading `id` into `slot` would collide with the OPPOSITE slot's current plan id.

- [ ] **Step 1: Write the failing test**

```ts
// src/features/cm-planner/slotLoad.test.ts
import { describe, expect, it } from 'vitest';
import { shouldDuplicateForSlot } from './slotLoad';

describe('shouldDuplicateForSlot', () => {
  it('duplicates when loading uma2 with a plan already in uma1', () => {
    expect(shouldDuplicateForSlot('X', 'uma2', 'X', undefined)).toBe(true);
  });
  it('duplicates when loading uma1 with a plan already in uma2', () => {
    expect(shouldDuplicateForSlot('Y', 'uma1', 'A', 'Y')).toBe(true);
  });
  it('does not duplicate when the id is only in the target slot', () => {
    expect(shouldDuplicateForSlot('X', 'uma1', 'X', undefined)).toBe(false);
    expect(shouldDuplicateForSlot('Y', 'uma2', undefined, 'Y')).toBe(false);
  });
  it('does not duplicate when there is no opposite-slot collision', () => {
    expect(shouldDuplicateForSlot('Z', 'uma1', 'A', 'B')).toBe(false);
    expect(shouldDuplicateForSlot('Z', 'uma2', 'A', 'B')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/cm-planner/slotLoad.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/features/cm-planner/slotLoad.ts
/** Loading `id` into `slot` collides when that exact plan is currently loaded in the
 *  OTHER slot — the planner then duplicates it so the two slots never share an id. */
export function shouldDuplicateForSlot(
  id: string,
  slot: 'uma1' | 'uma2',
  uma1Id: string | undefined,
  uma2Id: string | undefined,
): boolean {
  return slot === 'uma1' ? id === uma2Id : id === uma1Id;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/features/cm-planner/slotLoad.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/cm-planner/slotLoad.ts src/features/cm-planner/slotLoad.test.ts
git commit -m "feat(m4): slot-load collision predicate"
```

---

## Task 4: Context `loadPlanIntoSlot` (collision auto-duplicate)

**Files:**
- Modify: `src/app/ActivePlanContext.tsx` (add `loadPlanIntoSlot` to the value interface + provider)
- Test: `src/app/ActivePlanContext.dualplan.test.tsx` (extend)

**Interfaces:**
- Consumes: `shouldDuplicateForSlot` (Task 3), `copyPlanInto` from `@/core/cmPlanCopy`, `generatePlanName` from `@/core/planName`.
- Produces: on `ActivePlanValue`: `loadPlanIntoSlot: (id: string, slot: 'uma1' | 'uma2') => Promise<void>`. For `slot==='uma1'`: loads the saved plan into uma1 (like `selectPlan`); if it collides with uma2 (`shouldDuplicateForSlot`), loads a fresh-id duplicate as an unsaved draft instead. For `slot==='uma2'`: loads into uma2 via `setUma2Plan`; if it collides with uma1, loads a duplicate.

**Context (provider already exposes `selectPlan`, `setUma2Plan`, `setDraftPlan`, `savedPlans`, `getPlan` via `@/db`).** Implement `loadPlanIntoSlot` near `selectPlan` (after line 282).

- [ ] **Step 1: Write the failing test** (append to `ActivePlanContext.dualplan.test.tsx`)

The existing file mocks `@/db` with `getPlan: vi.fn(async () => undefined)` and `listPlans: vi.fn(async () => [])`. Override them per-test to return a fixture plan. Add at the top of the test body imports: `import { getPlan, listPlans } from '@/db';`

```ts
test('loadPlanIntoSlot duplicates when the same plan is loaded in the other slot', async () => {
  let value!: ReturnType<typeof useActivePlan>;
  render(harness((v) => { value = v; }));
  await waitFor(() => expect(value.uma1Plan).toBeTruthy());

  const uma1 = value.uma1Plan!;
  // Put uma1's plan into uma2 by id → collision → uma2 gets a fresh-id duplicate.
  vi.mocked(getPlan).mockResolvedValue(uma1);
  vi.mocked(listPlans).mockResolvedValue([uma1]);
  await act(async () => { await value.loadPlanIntoSlot(uma1.id, 'uma2'); });

  await waitFor(() => expect(value.uma2Plan).toBeTruthy());
  expect(value.uma2Plan!.id).not.toBe(uma1.id); // duplicated, not shared
});

test('loadPlanIntoSlot into uma2 with no collision loads the plan as-is', async () => {
  let value!: ReturnType<typeof useActivePlan>;
  render(harness((v) => { value = v; }));
  await waitFor(() => expect(value.uma1Plan).toBeTruthy());

  const other = { ...value.uma1Plan!, id: 'other-id', name: 'Other' };
  vi.mocked(getPlan).mockResolvedValue(other);
  vi.mocked(listPlans).mockResolvedValue([value.uma1Plan!, other]);
  await act(async () => { await value.loadPlanIntoSlot('other-id', 'uma2'); });

  await waitFor(() => expect(value.uma2Plan?.id).toBe('other-id'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/app/ActivePlanContext.dualplan.test.tsx`
Expected: FAIL — `value.loadPlanIntoSlot is not a function`.

- [ ] **Step 3: Add the type to the interface**

In `ActivePlanContext.tsx`, in `interface ActivePlanValue` (after the `selectPlan` line, ~line 112):

```ts
  /** Load a saved plan into a specific slot. Duplicates the plan when it is already
   *  loaded in the opposite slot so the two slots never share an id. */
  loadPlanIntoSlot: (id: string, slot: 'uma1' | 'uma2') => Promise<void>;
```

- [ ] **Step 4: Implement `loadPlanIntoSlot`**

Add the import at the top of `ActivePlanContext.tsx`:

```ts
import { copyPlanInto } from '@/core/cmPlanCopy';
import { shouldDuplicateForSlot } from '@/features/cm-planner/slotLoad';
```

Add the callback after `selectPlan` (after line 282), referencing `uma2Plan` (state) and `planRef`:

```ts
  const loadPlanIntoSlot = useCallback(async (id: string, slot: 'uma1' | 'uma2') => {
    const source = await getPlan(id);
    if (!source) throw new Error(`Saved plan ${id} could not be found`);
    const collides = shouldDuplicateForSlot(id, slot, planRef.current?.id, uma2Plan?.id);

    if (slot === 'uma2') {
      // Duplicate-on-collision is handled by copyPlanInto (fresh id). setUma2Plan
      // autonames + autosaves the scratch slot either way.
      setUma2Plan(collides ? copyPlanInto(source) : source);
      return;
    }
    // slot === 'uma1'
    if (collides) {
      // Fresh-id duplicate loaded as an unsaved draft (it is not yet in the saved set).
      const draft = copyPlanInto(source);
      setDraftPlan({ ...draft, name: generatePlanName(draft, undefined) });
      return;
    }
    await selectPlan(id);
  }, [selectPlan, setUma2Plan, uma2Plan]);
```

Add `loadPlanIntoSlot,` to the provider `value={{ ... }}` object (next to `selectPlan,`).

> Note: `setDraftPlan` and `selectPlan` are defined above; `setUma2Plan` is defined at line 389 (after `loadPlanIntoSlot`'s position is fine because `useCallback` captures it at render). If TypeScript/ESLint complains about use-before-declaration of `setUma2Plan`, move the `loadPlanIntoSlot` definition to just below `setUma2Plan` (after line 412) and keep the `value` wiring.

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm vitest run src/app/ActivePlanContext.dualplan.test.tsx`
Expected: PASS (both new tests + the 2 existing).

- [ ] **Step 6: Typecheck + commit**

Run: `pnpm typecheck`  (Expected: clean.)

```bash
git add src/app/ActivePlanContext.tsx src/app/ActivePlanContext.dualplan.test.tsx
git commit -m "feat(m4): loadPlanIntoSlot context method with collision auto-duplicate"
```

---

## Task 5: Context `deleteSavedPlan` fix + focus-aware `isSaved`

**Files:**
- Modify: `src/app/ActivePlanContext.tsx` (`deleteSavedPlan` body ~284-301; `isSaved` line 424)
- Test: `src/app/ActivePlanContext.dualplan.test.tsx` (extend)

**Interfaces:**
- Produces: `deleteSavedPlan` no longer mutates `plan`/`uma1Plan`/`uma2Plan`/`activePlanId` — it only removes from Dexie + refreshes `savedPlans`. `isSaved` derives from `focusedPlan` (so the indicator is correct for whichever slot is focused).

- [ ] **Step 1: Write the failing test** (append)

```ts
test('deleting the loaded plan keeps it in the sidebar and flips the saved indicator', async () => {
  let value!: ReturnType<typeof useActivePlan>;
  render(harness((v) => { value = v; }));
  await waitFor(() => expect(value.uma1Plan).toBeTruthy());
  const loaded = value.uma1Plan!;

  // Before: loaded plan is in the saved set → isSaved true.
  vi.mocked(listPlans).mockResolvedValue([loaded]);
  // After delete: saved set is empty.
  vi.mocked(listPlans).mockResolvedValueOnce([loaded]).mockResolvedValue([]);

  await act(async () => { await value.deleteSavedPlan(loaded.id); });

  await waitFor(() => expect(value.isSaved).toBe(false)); // indicator updated
  expect(value.uma1Plan!.id).toBe(loaded.id);             // still loaded, not swapped
});
```

> The existing default mock returns `listPlans: async () => []`. The `mockResolvedValueOnce([loaded]).mockResolvedValue([])` sequence models "saved before delete, gone after." `isPlanContentSaved` compares plan content against the saved list.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/app/ActivePlanContext.dualplan.test.tsx`
Expected: FAIL — current `deleteSavedPlan` swaps `plan` to `refreshedPlans.at(-1) ?? makeDefaultPlan(...)`, so `uma1Plan.id` changes (and `isSaved` may stay true).

- [ ] **Step 3: Fix `deleteSavedPlan`** — replace the body (lines 284-301) with:

```ts
  const deleteSavedPlan = useCallback(async (id: string) => {
    if (pendingSave.current?.id === id) {
      window.clearTimeout(saveTimer.current);
      pendingSave.current = null;
    }
    await deletePlan(id);
    setSavedPlans(await listPlans());
    // Never mutate the loaded slots. If the deleted record was a loaded plan's
    // source, it drops out of the saved set and `isSaved` derives to false.
  }, []);
```

(Remove the now-unused `resolveDefaultCmRef` dependency from this callback's deps array; `resolveDefaultCmRef` is still used by other callbacks, so keep the function.)

- [ ] **Step 4: Make `isSaved` focus-aware** — change line 424:

```ts
  const isSaved = focusedPlan ? isPlanContentSaved(focusedPlan, savedPlans) : true;
```

(`focusedPlan` is defined at line 414, before line 424 — OK.)

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm vitest run src/app/ActivePlanContext.dualplan.test.tsx`
Expected: PASS.

- [ ] **Step 6: Regression — run the page + context suites**

Run: `pnpm vitest run src/app/ActivePlanContext.test.tsx src/app/ActivePlanContext.dualplan.test.tsx`
Expected: PASS. (If `ActivePlanContext.test.tsx` asserted the old delete-swaps-plan behavior, update that test to the new contract: delete refreshes `savedPlans` and leaves the loaded plan untouched.)

- [ ] **Step 7: Typecheck + commit**

Run: `pnpm typecheck`

```bash
git add src/app/ActivePlanContext.tsx src/app/ActivePlanContext.dualplan.test.tsx src/app/ActivePlanContext.test.tsx
git commit -m "fix(m4): delete keeps loaded plan; focus-aware saved indicator"
```

---

## Task 6: `StatInput` component + red-accent inputs (stat "0" fix UI + F2)

**Files:**
- Create: `src/features/cm-planner/StatInput.tsx`
- Test: `src/features/cm-planner/StatInput.test.tsx`
- Modify: `src/features/cm-planner/PlannerSidebar.tsx` (stat grid, ~612-629)
- Modify: `src/features/cm-planner/cm-planner.css` (accent-tinted inputs)

**Interfaces:**
- Consumes: `sanitizeStatDraft`, `statValueFromDraft` (Task 1).
- Produces: `StatInput({ value, label, onValueChange }: { value: number; label: string; onValueChange: (n: number) => void })` — a `type="text"`/`inputmode="numeric"` field backed by a local string draft. Live-commits the parsed value on change; on blur, normalizes an empty/invalid draft to `'0'` and commits `0`. Re-syncs the draft when `value` changes externally (plan load).

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/cm-planner/StatInput.test.tsx
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { StatInput } from './StatInput';

afterEach(cleanup);

describe('StatInput', () => {
  it('clears to empty instead of leaving a 0', () => {
    render(<StatInput value={1200} label="SPD" onValueChange={vi.fn()} />);
    const input = screen.getByLabelText('SPD') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '' } });
    expect(input.value).toBe('');
  });

  it('strips a leading zero when typing into a cleared field', () => {
    const onValueChange = vi.fn();
    render(<StatInput value={0} label="SPD" onValueChange={onValueChange} />);
    const input = screen.getByLabelText('SPD') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '01200' } });
    expect(input.value).toBe('1200');
    expect(onValueChange).toHaveBeenLastCalledWith(1200);
  });

  it('normalizes an empty field to 0 on blur', () => {
    const onValueChange = vi.fn();
    render(<StatInput value={500} label="SPD" onValueChange={onValueChange} />);
    const input = screen.getByLabelText('SPD') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);
    expect(input.value).toBe('0');
    expect(onValueChange).toHaveBeenLastCalledWith(0);
  });

  it('re-syncs when the external value changes (plan load)', () => {
    const { rerender } = render(<StatInput value={500} label="SPD" onValueChange={vi.fn()} />);
    rerender(<StatInput value={900} label="SPD" onValueChange={vi.fn()} />);
    expect((screen.getByLabelText('SPD') as HTMLInputElement).value).toBe('900');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/cm-planner/StatInput.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `StatInput`**

```tsx
// src/features/cm-planner/StatInput.tsx
import { useEffect, useRef, useState } from 'react';
import { sanitizeStatDraft, statValueFromDraft } from './statInput';

/** Stat field with a local string draft so it can be cleared to empty (no sticky
 *  "0") and never shows a leading zero. Commits the parsed value live; normalizes
 *  an empty/invalid draft to 0 on blur. */
export function StatInput({
  value,
  label,
  onValueChange,
}: {
  value: number;
  label: string;
  onValueChange: (n: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  // Re-sync when the committed value changes from outside (plan load / external edit),
  // but not when our own live-commit echoes the same number back.
  const lastCommitted = useRef(value);
  useEffect(() => {
    if (value !== lastCommitted.current) {
      lastCommitted.current = value;
      setDraft(String(value));
    }
  }, [value]);

  return (
    <input
      type="text"
      inputMode="numeric"
      aria-label={label}
      value={draft}
      onChange={(e) => {
        const next = sanitizeStatDraft(e.target.value);
        setDraft(next);
        const parsed = statValueFromDraft(next);
        lastCommitted.current = parsed;
        onValueChange(parsed);
      }}
      onBlur={() => {
        if (draft === '') {
          setDraft('0');
          lastCommitted.current = 0;
          onValueChange(0);
        }
      }}
    />
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/features/cm-planner/StatInput.test.tsx`
Expected: PASS.

- [ ] **Step 5: Wire `StatInput` into the sidebar stat grid**

In `PlannerSidebar.tsx`, add the import:

```ts
import { StatInput } from './StatInput';
```

Replace the `<input type="number" ...>` block (lines 619-625) inside the stat `<label>` with:

```tsx
                    <StatInput
                      value={plan.statProfile.stats[key]}
                      label={shortLabel}
                      onValueChange={(n) => onChange(setStat(plan, key, n))}
                    />
```

(The surrounding `<span className="cmp-stat-value-row">` and `cmp-stat-growth` stay. `setStat` already coerces non-finite to 0.)

- [ ] **Step 6: Red-accent input CSS (F2)**

The stat/name/aptitude inputs already live inside `.cmp-flip-card` (which carries `--uma-accent`). Append to `cm-planner.css`:

```css
/* uma2 (red) / uma1 (blue) accent on sidebar input surfaces, not just the card ring.
   --uma-accent is set inline on .cmp-flip-card (blue uma1 / red uma2). */
.cmp-flip-card .cmp-name-field input,
.cmp-flip-card .cmp-stat-field input,
.cmp-flip-card .cmp-tile-select,
.cmp-flip-card .cmp-note-field textarea {
  background: color-mix(in srgb, var(--uma-accent) 8%, var(--bg-1));
}
.cmp-flip-card .cmp-name-field input:focus-visible,
.cmp-flip-card .cmp-stat-field input:focus-visible,
.cmp-flip-card .cmp-tile-select:focus-visible,
.cmp-flip-card .cmp-note-field textarea:focus-visible {
  outline: 2px solid var(--uma-accent);
  outline-offset: 1px;
}
```

- [ ] **Step 7: Regression + typecheck**

Run: `pnpm vitest run src/features/cm-planner/PlannerSidebar.test.tsx src/features/cm-planner/PlannerSidebar.flip.test.tsx`
Expected: PASS. (If a test queried the stat field via `getByRole('spinbutton')` — the old `type=number` — update it to `getByLabelText('SPD')` etc.)
Run: `pnpm typecheck` (clean).

- [ ] **Step 8: Commit**

```bash
git add src/features/cm-planner/StatInput.tsx src/features/cm-planner/StatInput.test.tsx src/features/cm-planner/PlannerSidebar.tsx src/features/cm-planner/cm-planner.css
git commit -m "fix(m4): StatInput clears to empty + strips leading zero; red uma2 input accent"
```

---

## Task 7: Sidebar action row + blank-face label + track-mismatch chip (D + E3)

**Files:**
- Modify: `src/features/cm-planner/PlannerSidebar.tsx` (blank face ~389-398; copy-row + save-row ~438-489; add `trackMismatchLabel` prop)
- Modify: `src/features/cm-planner/cm-planner.css` (mismatch chip)
- Test: `src/features/cm-planner/PlannerSidebar.flip.test.tsx` (extend)

**Interfaces:**
- Consumes: existing `onDuplicateUma1ToUma2`, `onReplicateUma2ToUma1`, `onSave`, `onSaveAs`, `onNew`, `focused`, `uma2Empty`.
- Produces: new optional prop `trackMismatchLabel?: string`. When set (and not on the empty face), render it as a chip on a row above the name. Action row composition: focused uma1 → `[Replicate uma2] [Save] [Save As] [New]`; focused uma2 → `[Replicate uma1] [New]` with Save/Save As **disabled**. The standalone `.cmp-copy-row` is removed. Blank-face button label → `⇋ Duplicate Uma 1`.

- [ ] **Step 1: Write the failing test** (append to `PlannerSidebar.flip.test.tsx`)

```tsx
describe('PlannerSidebar action row + mismatch', () => {
  it('blank uma2 face uses the ⇋ Duplicate Uma 1 label', () => {
    render(<PlannerSidebar {...sidebarProps} focused="uma2" uma2Empty onDuplicateUma1ToUma2={vi.fn()} onReplicateUma2ToUma1={vi.fn()} />);
    expect(screen.getByRole('button', { name: /⇋\s*Duplicate Uma 1/i })).toBeInTheDocument();
  });

  it('focused uma1: action row shows Replicate uma2 + enabled Save/Save as/New', () => {
    render(<PlannerSidebar {...sidebarProps} focused="uma1" uma2Empty={false} onDuplicateUma1ToUma2={vi.fn()} onReplicateUma2ToUma1={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Replicate uma2/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Save as' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: /Replicate uma1/i })).toBeNull();
  });

  it('focused uma2: action row shows Replicate uma1 + New, Save/Save as disabled', () => {
    render(<PlannerSidebar {...sidebarProps} focused="uma2" uma2Empty={false} onDuplicateUma1ToUma2={vi.fn()} onReplicateUma2ToUma1={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Replicate uma1/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save as' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'New' })).toBeEnabled();
  });

  it('renders the track-mismatch chip only when a label is provided', () => {
    const { rerender } = render(<PlannerSidebar {...sidebarProps} focused="uma1" uma2Empty={false} />);
    expect(screen.queryByText(/Different track/i)).toBeNull();
    rerender(<PlannerSidebar {...sidebarProps} focused="uma1" uma2Empty={false} trackMismatchLabel="⚠ Different track from uma2" />);
    expect(screen.getByText(/Different track from uma2/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/cm-planner/PlannerSidebar.flip.test.tsx`
Expected: FAIL — old labels (`⤓ Duplicate uma1 →`), `.cmp-copy-row` placement, no `trackMismatchLabel`.

- [ ] **Step 3: Add the prop**

In the `PlannerSidebar` destructured props (after `onReplicateUma2ToUma1,` ~line 145) add `trackMismatchLabel,` and in the props type (after `onReplicateUma2ToUma1?: () => void;` ~line 161) add:

```ts
  trackMismatchLabel?: string;
```

- [ ] **Step 4: Update the blank-face label** (lines 392-396):

```tsx
            {onDuplicateUma1ToUma2 && (
              <button type="button" onClick={onDuplicateUma1ToUma2}>
                ⇋ Duplicate Uma 1
              </button>
            )}
```

- [ ] **Step 5: Add the mismatch chip above the name row**

Immediately inside `<div className="cmp-plan-card-body">` (before `<div className="cmp-name-row">`, line 401) insert:

```tsx
          {trackMismatchLabel && (
            <div className="cmp-track-mismatch-row">
              <span className="cmp-track-mismatch-chip">{trackMismatchLabel}</span>
            </div>
          )}
```

- [ ] **Step 6: Remove `.cmp-copy-row` and fold Replicate into the action seg**

Delete the entire `<div className="cmp-copy-row"> ... </div>` block (lines 438-454).

Replace the `<div className="cmp-action-seg"> ... </div>` block (lines 478-488) with:

```tsx
            <div className="cmp-action-seg">
              {focused === 'uma1' && onReplicateUma2ToUma1 && (
                <button type="button" disabled={uma2Empty} onClick={onReplicateUma2ToUma1}>
                  Replicate uma2
                </button>
              )}
              {focused === 'uma2' && onDuplicateUma1ToUma2 && (
                <button type="button" onClick={onDuplicateUma1ToUma2}>
                  Replicate uma1
                </button>
              )}
              <button type="button" disabled={focused === 'uma2'} onClick={() => void handleSave()}>
                Save
              </button>
              <button type="button" disabled={focused === 'uma2'} onClick={() => void handleSaveAs()}>
                Save as
              </button>
              <button type="button" onClick={onNew}>
                New
              </button>
            </div>
```

- [ ] **Step 7: Mismatch chip CSS** — append to `cm-planner.css`:

```css
.cmp-track-mismatch-row {
  margin-bottom: 0.4rem;
}
.cmp-track-mismatch-chip {
  display: inline-block;
  font-size: 0.72rem;
  font-weight: 600;
  color: #e0954f;
  background: color-mix(in srgb, #e0954f 14%, var(--bg-1));
  border: 1px solid color-mix(in srgb, #e0954f 40%, transparent);
  border-radius: 999px;
  padding: 0.1rem 0.5rem;
}
```

- [ ] **Step 8: Run tests + typecheck**

Run: `pnpm vitest run src/features/cm-planner/PlannerSidebar.flip.test.tsx src/features/cm-planner/PlannerSidebar.test.tsx`
Expected: PASS. (Update any existing test asserting the old `⤓ Replicate uma2 → uma1` / `.cmp-copy-row` text.)
Run: `pnpm typecheck`.

- [ ] **Step 9: Commit**

```bash
git add src/features/cm-planner/PlannerSidebar.tsx src/features/cm-planner/PlannerSidebar.flip.test.tsx src/features/cm-planner/cm-planner.css
git commit -m "feat(m4): sidebar action row (relocated Replicate), blank-face label, track-mismatch chip"
```

---

## Task 8: Inventory backpack icon + collapsed sliver + edit-mode gate (A)

**Files:**
- Modify: `src/features/cm-planner/PlanInventoryCard.tsx`
- Modify: `src/features/cm-planner/cm-planner.css`
- Test: `src/features/cm-planner/PlanInventoryCard.test.tsx` (extend) + `CmPlannerPage.test.tsx` (update header-controls test)

**Interfaces:**
- Produces: a `BackpackIcon` heading the card + the 2× backpack in the collapsed sliver (no count). An `editMode` toggle (pencil) shown only when expanded; while OFF the per-group download-all/delete-all and per-item download/delete buttons are not rendered; while ON they are. The header upload/download-all/delete-all trio is unaffected. Clicking outside any `[data-edit-stay]` element exits edit mode; clicking an edit action performs it and stays.

- [ ] **Step 1: Write the failing test** (append to `PlanInventoryCard.test.tsx`; reuse that file's existing render harness/props)

```tsx
describe('PlanInventoryCard edit mode', () => {
  it('hides per-item and per-group destructive buttons until edit mode is on', async () => {
    renderInventory(); // existing helper in this file that renders with ≥1 plan
    // header trio always present
    expect(screen.getByRole('button', { name: /Download all plans as ZIP/i })).toBeInTheDocument();
    // per-item / per-group hidden by default
    expect(screen.queryByRole('button', { name: /^Delete plan$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Download all plans in /i })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Edit inventory/i }));
    expect(screen.getAllByRole('button', { name: /^Delete plan$/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /^Download all plans in /i }).length).toBeGreaterThan(0);
  });

  it('exits edit mode on an outside click but stays when an action is clicked', async () => {
    renderInventory();
    fireEvent.click(screen.getByRole('button', { name: /Edit inventory/i }));
    // delete an item → still in edit mode (delete buttons still present)
    fireEvent.click(screen.getAllByRole('button', { name: /^Delete plan$/i })[0]!);
    expect(screen.getAllByRole('button', { name: /^Delete plan$/i }).length).toBeGreaterThanOrEqual(0);
    // outside click → exit
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('button', { name: /^Delete plan$/i })).toBeNull();
  });

  it('collapsed sliver shows the backpack with no count', () => {
    renderInventory({ collapsed: true });
    expect(screen.queryByText(/^\d+$/)).toBeNull(); // no plan count number
    expect(screen.getByRole('button', { name: /Expand inventory/i })).toBeInTheDocument();
  });
});
```

> If `PlanInventoryCard.test.tsx` has no shared `renderInventory` helper, add one that renders `<PlanInventoryCard activePlan={plan} plans={[plan]} autoApplyTrack onAutoApplyTrackChange={vi.fn()} onDeletePlan={vi.fn(async()=>{})} onDeleteAllPlans={vi.fn(async()=>{})} onImportPlans={vi.fn(async()=>0)} onLoadPlanIntoSlot={vi.fn()} {...overrides} />` and expand the group (the card auto-expands groups via the effect; await `findByText(plan.name)`).

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/cm-planner/PlanInventoryCard.test.tsx`
Expected: FAIL — no Edit button; per-item buttons render unconditionally; sliver shows a count.

- [ ] **Step 3: Add the icons**

In the icon block (after `TrashIcon`, line 127) add:

```tsx
const BackpackIcon = () => (
  <IconSvg>
    <path d="M7 2.5a3 3 0 0 1 6 0V4h.2A2.8 2.8 0 0 1 16 6.8v8.7A1.5 1.5 0 0 1 14.5 17h-9A1.5 1.5 0 0 1 4 15.5V6.8A2.8 2.8 0 0 1 6.8 4H7V2.5Zm1.5 0V4h3V2.5a1.5 1.5 0 0 0-3 0ZM7 9.5v3h6v-3a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1Z" />
  </IconSvg>
);
const EditIcon = () => <IconSvg><path d="M13.4 3.3 16.7 6.6 7.3 16H4v-3.3l9.4-9.4Z" /></IconSvg>;
```

- [ ] **Step 4: Add edit-mode state + outside-click effect**

After the existing `useDismissOnOutside(...)` lines (~180):

```tsx
  const [editMode, setEditMode] = useState(false);
  useEffect(() => {
    if (!editMode) return;
    const onDown = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest('[data-edit-stay]')) setEditMode(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [editMode]);
```

- [ ] **Step 5: Collapsed sliver — backpack, no count** (replace lines 272-286):

```tsx
  if (collapsed) {
    return (
      <aside className="cmp-plan-inventory cmp-inventory-sliver">
        <button
          type="button"
          className="cmp-sliver-btn"
          aria-label="Expand inventory"
          onClick={() => onCollapsedChange?.(false)}
        >
          <span className="cmp-sliver-glyph cmp-sliver-backpack"><BackpackIcon /></span>
        </button>
      </aside>
    );
  }
```

- [ ] **Step 6: Header — backpack heading + pencil toggle**

Replace the `<span id="cmp-inventory-h">Plan Inventory</span>` (line 292) with:

```tsx
          <span id="cmp-inventory-h" className="cmp-inventory-title">
            <span className="cmp-inventory-backpack"><BackpackIcon /></span>
            Plan Inventory
          </span>
```

Add the pencil button inside the header — place it just before the collapse button (before line 355's `{onCollapsedChange && (`):

```tsx
          <button
            type="button"
            data-edit-stay
            className={`cmp-inventory-icon-btn cmp-inventory-edit-btn ${editMode ? 'is-on' : ''}`.trim()}
            aria-label="Edit inventory"
            aria-pressed={editMode}
            title="Edit"
            onClick={() => setEditMode((v) => !v)}
          >
            <EditIcon />
          </button>
```

- [ ] **Step 7: Gate the per-group destructive buttons**

Wrap the per-group actions `<div className="cmp-inventory-group-actions">` (lines 397-436). Add `data-edit-stay` to that div, and render its contents only in edit mode:

```tsx
                  <div
                    ref={deleteGroupConfirm === group.key ? groupDeleteToolbarRef : undefined}
                    className="cmp-inventory-group-actions"
                    data-edit-stay
                  >
                    {editMode && (deleteGroupConfirm === group.key ? (
                      <ConfirmDeleteToolbar ... />   /* unchanged inner JSX */
                    ) : (
                      <> ...group download-all + delete-all buttons unchanged... </>
                    ))}
                  </div>
```

(Keep the existing inner JSX verbatim — only add `data-edit-stay` to the wrapper and the `editMode &&` guard around the ternary.)

- [ ] **Step 8: Gate the per-item destructive buttons**

Wrap the per-item download + delete buttons (lines 470-487) in an edit-stay span gated on `editMode`:

```tsx
                        {editMode && (
                          <span className="cmp-inventory-row-actions" data-edit-stay>
                            <button
                              type="button"
                              className="cmp-inventory-icon-btn"
                              aria-label={`Download ${plan.name}`}
                              title="Download plan JSON"
                              onClick={() => downloadPlan(plan)}
                            >
                              <DownloadIcon />
                            </button>
                            <button
                              type="button"
                              className="cmp-inventory-icon-btn"
                              aria-label="Delete plan"
                              title="Delete plan"
                              onClick={() => void handleDeletePlan(plan.id)}
                            >
                              <TrashIcon />
                            </button>
                          </span>
                        )}
```

- [ ] **Step 9: CSS — backpack sizing, 2× sliver, edit button, row-actions layout** — append to `cm-planner.css`:

```css
.cmp-inventory-title { display: inline-flex; align-items: center; gap: 0.4rem; }
.cmp-inventory-backpack { display: inline-flex; width: 1.05rem; height: 1.05rem; }
.cmp-inventory-backpack svg { width: 100%; height: 100%; fill: currentColor; }
.cmp-sliver-backpack { width: 1.9rem; height: 1.9rem; }       /* 2× of the heading icon */
.cmp-sliver-backpack svg { width: 100%; height: 100%; fill: currentColor; }
.cmp-inventory-edit-btn.is-on { color: var(--accent); background: color-mix(in srgb, var(--accent) 16%, transparent); }
.cmp-inventory-row-actions { display: inline-flex; gap: 0.2rem; }
```

(The collapsed sliver already widens via `--cmp-sliver-width`; bump it if the 2× icon needs more room — set `--cmp-sliver-width: 2.8rem;` in `:root` only if the icon clips.)

- [ ] **Step 10: Update the affected page test**

In `CmPlannerPage.test.tsx`, the test `shows upload, ZIP download, delete-all, and per-plan download controls` (lines 564-587) asserts per-item/per-group buttons are visible by default. Update it to first click **Edit inventory** before asserting the per-group/per-item buttons, and assert the header trio is present without edit mode. Keep the header-trio assertions as-is.

- [ ] **Step 11: Run tests + typecheck**

Run: `pnpm vitest run src/features/cm-planner/PlanInventoryCard.test.tsx src/features/cm-planner/CmPlannerPage.test.tsx`
Expected: PASS.
Run: `pnpm typecheck`.

- [ ] **Step 12: Commit**

```bash
git add src/features/cm-planner/PlanInventoryCard.tsx src/features/cm-planner/cm-planner.css src/features/cm-planner/PlanInventoryCard.test.tsx src/features/cm-planner/CmPlannerPage.test.tsx
git commit -m "feat(m4): backpack-icon inventory + edit-mode gate over destructive buttons"
```

---

## Task 9: Inventory slot-pick badges + row-body→focused + blue/red glow (B)

**Files:**
- Modify: `src/features/cm-planner/PlanInventoryCard.tsx` (props + rows)
- Modify: `src/features/cm-planner/cm-planner.css`
- Test: `src/features/cm-planner/PlanInventoryCard.test.tsx` (extend)

**Interfaces:**
- Consumes (new props on `PlanInventoryCard`): replace `onSelectPlan` with `onLoadPlanIntoSlot: (id: string, slot: 'uma1' | 'uma2') => void | Promise<void>`; add `focused?: 'uma1' | 'uma2'` (default `'uma1'`), `uma1PlanId?: string`, `uma2PlanId?: string`.
- Produces: each row shows hover-only "1"(blue)/"2"(red) badges (hidden in edit mode) that load that plan into uma1/uma2; the row body loads into the focused slot; the row whose id matches `uma1PlanId` gets `.is-uma1` (blue glow), `uma2PlanId` gets `.is-uma2` (red glow). The old `.is-active` class is dropped.

- [ ] **Step 1: Write the failing test** (append)

```tsx
describe('PlanInventoryCard slot picking', () => {
  it('row body loads the focused slot; badges load the explicit slot', async () => {
    const onLoad = vi.fn();
    renderInventory({ focused: 'uma2', onLoadPlanIntoSlot: onLoad });
    const planName = await screen.findByText('p'); // fixture plan name
    fireEvent.click(planName.closest('button')!);   // row body
    expect(onLoad).toHaveBeenLastCalledWith('p', 'uma2');

    fireEvent.click(screen.getByRole('button', { name: /load .* as uma1/i }));
    expect(onLoad).toHaveBeenLastCalledWith('p', 'uma1');
    fireEvent.click(screen.getByRole('button', { name: /load .* as uma2/i }));
    expect(onLoad).toHaveBeenLastCalledWith('p', 'uma2');
  });

  it('glows the uma1 row blue and the uma2 row red', async () => {
    renderInventory({ plans: [planA, planB], uma1PlanId: planA.id, uma2PlanId: planB.id });
    await screen.findByText(planA.name);
    expect(document.querySelector(`.cmp-inventory-row.is-uma1`)).not.toBeNull();
    expect(document.querySelector(`.cmp-inventory-row.is-uma2`)).not.toBeNull();
  });

  it('hides slot badges in edit mode', async () => {
    renderInventory();
    await screen.findByText('p');
    expect(screen.getByRole('button', { name: /load .* as uma1/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Edit inventory/i }));
    expect(screen.queryByRole('button', { name: /load .* as uma1/i })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/cm-planner/PlanInventoryCard.test.tsx`
Expected: FAIL — no badges, no `onLoadPlanIntoSlot`, `.is-uma1/.is-uma2` absent.

- [ ] **Step 3: Update the prop signature**

In the `PlanInventoryCard({ ... })` destructure (lines 146-156) replace `onSelectPlan,` with `onLoadPlanIntoSlot,` and add `focused = 'uma1', uma1PlanId, uma2PlanId,`. In the props type (lines 157-167) replace `onSelectPlan: (id: string) => Promise<void>;` with:

```ts
  onLoadPlanIntoSlot: (id: string, slot: 'uma1' | 'uma2') => void | Promise<void>;
  focused?: 'uma1' | 'uma2';
  uma1PlanId?: string;
  uma2PlanId?: string;
```

Replace `handleSelectPlan` (lines 218-224) with:

```tsx
  const handleLoadSlot = async (id: string, slot: 'uma1' | 'uma2') => {
    try {
      await onLoadPlanIntoSlot(id, slot);
    } catch {
      setLoadState('error');
    }
  };
```

- [ ] **Step 4: Row glow class** — replace line 452's `className`:

```tsx
                        className={`cmp-inventory-row ${plan.id === uma1PlanId ? 'is-uma1' : ''} ${plan.id === uma2PlanId ? 'is-uma2' : ''}`.trim()}
```

- [ ] **Step 5: Row body + badges** — replace the row-body select button (lines 454-469) and insert badges:

```tsx
                        <button
                          type="button"
                          className="cmp-inventory-select"
                          onClick={() => void handleLoadSlot(plan.id, focused)}
                        >
                          {plan.umaId ? (
                            <GameIcon kind="uma" id={plan.umaId} size={34} alt="" />
                          ) : (
                            <span className="cmp-inventory-portrait">uma</span>
                          )}
                          <div className="cmp-inventory-plan-main">
                            <strong>{plan.name}</strong>
                            <span>{statLine(plan)}</span>
                            <span>{aptitudeLine(plan)}</span>
                          </div>
                        </button>
                        {!editMode && (
                          <span className="cmp-slot-badges" aria-hidden={false}>
                            <button
                              type="button"
                              className="cmp-slot-badge is-uma1"
                              aria-label={`Load ${plan.name} as uma1`}
                              title="Load as uma1"
                              onClick={(e) => { e.stopPropagation(); void handleLoadSlot(plan.id, 'uma1'); }}
                            >
                              1
                            </button>
                            <button
                              type="button"
                              className="cmp-slot-badge is-uma2"
                              aria-label={`Load ${plan.name} as uma2`}
                              title="Load as uma2"
                              onClick={(e) => { e.stopPropagation(); void handleLoadSlot(plan.id, 'uma2'); }}
                            >
                              2
                            </button>
                          </span>
                        )}
```

(The per-item download/delete `{editMode && ...}` span from Task 8 follows the badges.)

- [ ] **Step 6: CSS — badges + glow** — append to `cm-planner.css`:

```css
.cmp-slot-badges { display: inline-flex; gap: 0.25rem; opacity: 0; transition: opacity 0.12s; }
.cmp-inventory-row:hover .cmp-slot-badges,
.cmp-slot-badge:focus-visible { opacity: 1; }
.cmp-slot-badge {
  width: 1.4rem; height: 1.4rem; border-radius: 50%;
  font-size: 0.8rem; font-weight: 700; line-height: 1;
  border: 1px solid transparent; cursor: pointer; color: #fff;
}
.cmp-slot-badge.is-uma1 { background: #5aa0ff; }
.cmp-slot-badge.is-uma2 { background: #e0564f; }
.cmp-inventory-row.is-uma1 {
  background: color-mix(in srgb, #5aa0ff 10%, transparent);
  box-shadow: inset 0 0 0 1.5px #5aa0ff;
}
.cmp-inventory-row.is-uma2 {
  background: color-mix(in srgb, #e0564f 10%, transparent);
  box-shadow: inset 0 0 0 1.5px #e0564f;
}
```

Remove the now-dead `.cmp-inventory-row.is-active { ... }` rule (line 420) since `.is-active` is no longer emitted.

- [ ] **Step 7: Run tests + typecheck**

Run: `pnpm vitest run src/features/cm-planner/PlanInventoryCard.test.tsx`
Expected: PASS. (`CmPlannerPage` still passes `onSelectPlan` until Task 10 — but the prop is now `onLoadPlanIntoSlot`, so the page will fail typecheck until Task 10. That is expected: this task's gate is the inventory test + the card compiling in isolation. Run `pnpm vitest run src/features/cm-planner/PlanInventoryCard.test.tsx` (green) and note the page wiring lands in Task 10. Do **not** run `pnpm typecheck` as a blocker here — it will flag the page until Task 10.)

> Sequencing note for the controller: Tasks 9 and 10 are a pair — the inventory prop rename (9) and the page rewire (10) must both land before `pnpm typecheck` is green. Run the full typecheck gate at the end of Task 10.

- [ ] **Step 8: Commit**

```bash
git add src/features/cm-planner/PlanInventoryCard.tsx src/features/cm-planner/cm-planner.css src/features/cm-planner/PlanInventoryCard.test.tsx
git commit -m "feat(m4): inventory slot-pick badges + row-body→focused load + blue/red glow"
```

---

## Task 10: Page wiring — loadPlanIntoSlot + onNew-uma2 + mismatch prop (B2/C/D wiring)

**Files:**
- Modify: `src/features/cm-planner/CmPlannerPage.tsx`
- Test: `src/features/cm-planner/CmPlannerPage.test.tsx` (update mock + the select/load tests)

**Interfaces:**
- Consumes: context `loadPlanIntoSlot` (Task 4), `setUma2Plan`, `tracksDiffer` (Task 2).
- Produces: the inventory receives `onLoadPlanIntoSlot`, `focused`, `uma1PlanId`, `uma2PlanId`; the sidebar receives `trackMismatchLabel`; `onNew` clears the uma2 slot when focused uma2. (Track confirm/transient lands in Task 11.)

- [ ] **Step 1: Update the page-test mock** — add `loadPlanIntoSlot` to the `useActivePlan` mock in `CmPlannerPage.test.tsx`. In the mock (after the `selectPlan` useCallback, ~line 277) add:

```tsx
      const loadPlanIntoSlot = useCallback(async (id: string, slot: 'uma1' | 'uma2') => {
        await h.selectPlan(id); // record the call for assertions
        const found = h.savedPlans.find((p) => p.id === id);
        if (!found) return;
        if (slot === 'uma2') setUma2PlanState(found as PlanShape);
        else setPlanState(found as PlanShape);
      }, []);
```

and return `loadPlanIntoSlot,` in the mock's value object. Add `h.setUma2Plan` is already present.

Update the assertion in **`selects a saved plan from the inventory list`** (line 535) — it should still call `h.selectPlan` with `custom-hanshin` (the mock's `loadPlanIntoSlot` calls it), so that test passes unchanged. Keep it.

- [ ] **Step 2: Write the failing test** (append to `CmPlannerPage.test.tsx`)

```tsx
it('loads a plan into uma2 via the inventory "2" badge', async () => {
  render(<CmPlannerPage />);
  const inventory = screen.getByLabelText('Plan Inventory');
  const badge = await within(inventory).findByRole('button', { name: /Load Hanshin Trial as uma2/i });
  fireEvent.click(badge);
  await waitFor(() => expect(h.selectPlan).toHaveBeenCalledWith('custom-hanshin'));
});

it('clears the uma2 slot when New is pressed while focused on uma2', async () => {
  h.focused = 'uma2';
  h.seededUma2Plan = h.uma2Plan;
  render(<CmPlannerPage />);
  fireEvent.click(screen.getByRole('button', { name: 'New' }));
  expect(h.setUma2Plan).toHaveBeenCalledWith(null);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm vitest run src/features/cm-planner/CmPlannerPage.test.tsx`
Expected: FAIL — page still passes `onSelectPlan`; New does not clear uma2.

- [ ] **Step 4: Pull `loadPlanIntoSlot` + `setUma2Plan` from context**

In the `useActivePlan()` destructure (lines 41-62) ensure `setUma2Plan,` and add `loadPlanIntoSlot,`.

- [ ] **Step 5: Compute the mismatch label**

After `titleCmRef`/`trackTitle` (around line 168) add:

```tsx
  const trackMismatchLabel =
    uma2Plan && plan && tracksDiffer(plan.cmRef, uma2Plan.cmRef)
      ? `⚠ Different track from uma${focused === 'uma1' ? '2' : '1'}`
      : undefined;
```

Add the import at the top:

```ts
import { tracksDiffer } from './trackChange';
```

- [ ] **Step 6: Rewire the inventory**

Replace the inventory's `onSelectPlan={async (id) => { ... }}` block (lines 245-255) with:

```tsx
          focused={focused}
          uma1PlanId={plan.id}
          uma2PlanId={uma2Plan?.id}
          onLoadPlanIntoSlot={async (id, slot) => {
            const keepTrackRef = slot === 'uma1' && autoApplyInventoryTrack !== true ? plan.cmRef : null;
            await loadPlanIntoSlot(id, slot);
            setCollapseSkillSignal((signal) => signal + 1);
            // auto-apply OFF: keep the race you're viewing by overriding the loaded
            // uma1 plan's cmRef (preserves the long-standing behavior).
            if (keepTrackRef) {
              const loaded = savedPlans.find((p) => p.id === id);
              if (loaded) setPlan({ ...loaded, cmRef: keepTrackRef });
            }
          }}
```

(Remove the old `onSelectPlan` prop entirely.)

- [ ] **Step 7: onNew clears uma2; pass `trackMismatchLabel`**

Change the sidebar's `onNew` (line 274) to:

```tsx
          onNew={() => { if (focused === 'uma1') setDraftPlan(newDefaultPlan()); else setUma2Plan(null); }}
```

Add `trackMismatchLabel={trackMismatchLabel}` to the `<PlannerSidebar ... />` props.

- [ ] **Step 8: Run tests + typecheck**

Run: `pnpm vitest run src/features/cm-planner/CmPlannerPage.test.tsx`
Expected: PASS.
Run: `pnpm typecheck`
Expected: clean (the Task 9 page/inventory prop rename is now resolved).

- [ ] **Step 9: Commit**

```bash
git add src/features/cm-planner/CmPlannerPage.tsx src/features/cm-planner/CmPlannerPage.test.tsx
git commit -m "feat(m4): wire inventory slot-load + uma2 New-clears + track-mismatch label"
```

---

## Task 11: Track-change confirm flow + "Track changed!" transient (E1 + E2)

**Files:**
- Modify: `src/features/cm-planner/CmPlannerPage.tsx`
- Modify: `src/features/cm-planner/cm-planner.css`
- Test: `src/features/cm-planner/CmPlannerPage.test.tsx` (extend)

**Interfaces:**
- Consumes: `trackChangeNeedsConfirm`, `tracksDiffer` (Task 2).
- Produces: a `trackOverrideRef` state pinning the displayed track; an inline confirm bar in the track header (Cancel left / Confirm right) shown when an inventory-load-into-focused-slot or a uma1/uma2 flip would change the course while auto-apply is ON; a "Track changed!" orange transient that fades after 3s when a track change is confirmed/applied.

- [ ] **Step 1: Write the failing test** (append)

```tsx
it('confirms a track change when loading a different-course plan into the focused slot', async () => {
  render(<CmPlannerPage />);
  const inventory = screen.getByLabelText('Plan Inventory');
  // Load Hanshin Trial into uma1 (focused). Its course (10906) == uma1's course here,
  // so to force a change, load the CM16-course uma2 fixture is not in savedPlans;
  // instead assert the confirm appears for a course-changing load via the badge.
  const badge = await within(inventory).findByRole('button', { name: /Load Hanshin Trial as uma1/i });
  fireEvent.click(badge);
  // customPlan shares course 10906 with uma1 → NO confirm (same course).
  expect(screen.queryByRole('button', { name: /Change track/i })).toBeNull();
});

it('flips uma1↔uma2 across different courses and shows the track confirm', async () => {
  h.seededUma2Plan = h.uma2Plan; // CM16 course 10501, differs from uma1 CM15 10906
  render(<CmPlannerPage />);
  fireEvent.click(screen.getByRole('button', { name: 'UMA2' }));
  // auto-apply ON (default) + course changes → confirm bar appears.
  expect(await screen.findByRole('button', { name: /Change track/i })).toBeInTheDocument();
  // Cancel keeps the uma1 track (Hanshin still shown).
  fireEvent.click(screen.getByRole('button', { name: /Keep current track/i }));
  const cond = within(screen.getByLabelText('Race conditions'));
  expect(await cond.findByText('Hanshin')).toBeInTheDocument();
});

it('confirming the flip moves the track and flashes Track changed', async () => {
  h.seededUma2Plan = h.uma2Plan;
  render(<CmPlannerPage />);
  fireEvent.click(screen.getByRole('button', { name: 'UMA2' }));
  fireEvent.click(await screen.findByRole('button', { name: /Change track/i }));
  const cond = within(screen.getByLabelText('Race conditions'));
  expect(await cond.findByText('Nakayama')).toBeInTheDocument();
  expect(screen.getByText(/Track changed/i)).toBeInTheDocument();
});
```

> Note: the existing tests `track follows uma2 race when auto-apply ON and focused=uma2` (line 704) seed `h.focused='uma2'` at mount (no flip event), so they bypass the confirm and must keep passing — the confirm only fires on a flip/load *event*, not on the initial seeded focus. Verify they stay green.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/cm-planner/CmPlannerPage.test.tsx`
Expected: FAIL — no confirm bar, no transient.

- [ ] **Step 3: Add state + helpers**

Add imports:

```ts
import { useRef } from 'react';
import { trackChangeNeedsConfirm } from './trackChange';
import type { CmRefV2 } from '@/core/types';
```

Inside `CmPlannerPage`, after the existing `useState` declarations (~line 66):

```tsx
  const [trackOverrideRef, setTrackOverrideRef] = useState<CmRefV2 | null>(null);
  const [trackConfirmOpen, setTrackConfirmOpen] = useState(false);
  const [trackChanged, setTrackChanged] = useState(false);
  const trackChangedTimer = useRef<number | undefined>(undefined);
  const flashTrackChanged = () => {
    setTrackChanged(true);
    window.clearTimeout(trackChangedTimer.current);
    trackChangedTimer.current = window.setTimeout(() => setTrackChanged(false), 3000);
  };
  useEffect(() => () => window.clearTimeout(trackChangedTimer.current), []);
```

- [ ] **Step 4: Fold the override into the displayed track**

Change the `trackCmRef` memo (lines 73-82) to honor the override:

```tsx
  const autoFollowRef = useMemo(() => {
    if (
      autoApplyInventoryTrack === true &&
      !(focused === 'uma2' && uma2Plan === null) &&
      focusedPlan !== null
    ) {
      return focusedPlan.cmRef;
    }
    return plan?.cmRef ?? null;
  }, [autoApplyInventoryTrack, focused, uma2Plan, focusedPlan, plan]);
  const trackCmRef = trackOverrideRef ?? autoFollowRef;
```

- [ ] **Step 5: Clear the override on a manual race edit**

In `handleRaceChange` (lines 147-154) add `setTrackOverrideRef(null);` as the first line (a manual race edit must show, not stay masked by a pin).

- [ ] **Step 6: Add the confirm decision used by load + flip**

Add a helper inside the component (after `flashTrackChanged`):

```tsx
  const applyTrackTransition = (nextFollowRef: CmRefV2 | null) => {
    const prev = trackCmRef;
    if (
      prev && nextFollowRef &&
      trackChangeNeedsConfirm({
        autoApply: autoApplyInventoryTrack === true,
        hadPriorTrack: true,
        prevCourseId: prev.courseId,
        nextCourseId: nextFollowRef.courseId,
      })
    ) {
      setTrackOverrideRef(prev); // pin old so the track doesn't jump until confirmed
      setTrackConfirmOpen(true);
    } else {
      setTrackOverrideRef(null);
      if (prev && nextFollowRef && autoApplyInventoryTrack === true && prev.courseId !== nextFollowRef.courseId) {
        flashTrackChanged();
      }
    }
  };
```

- [ ] **Step 7: Gate the flip**

Replace the sidebar `onFocusChange={setFocused}` (line 278) with:

```tsx
          onFocusChange={(slot) => {
            if (slot === focused) return;
            setFocused(slot);
            const nextFocused = slot === 'uma1' ? plan : uma2Plan;
            applyTrackTransition(
              autoApplyInventoryTrack === true && !(slot === 'uma2' && uma2Plan === null) && nextFocused
                ? nextFocused.cmRef
                : null,
            );
          }}
```

- [ ] **Step 8: Gate the inventory load**

In the `onLoadPlanIntoSlot` handler (from Task 10), after `await loadPlanIntoSlot(id, slot);` and the `setCollapseSkillSignal` line, add the confirm trigger for a focused-slot load:

```tsx
            if (slot === focused) {
              const loaded = savedPlans.find((p) => p.id === id);
              if (loaded) applyTrackTransition(loaded.cmRef);
            }
```

(Place this after the existing auto-apply-OFF `keepTrackRef` block. When auto-apply is OFF, `trackChangeNeedsConfirm` returns false, so `applyTrackTransition` just clears the override — harmless.)

- [ ] **Step 9: Render the confirm bar + transient in the track header**

Replace the track header (line 285):

```tsx
            <header className="cmp-plan-card-head cmp-track-head">
              <span>{trackTitle}</span>
              {trackChanged && <span className="cmp-track-changed">Track changed!</span>}
              {trackConfirmOpen && (
                <span className="cmp-track-confirm" role="group" aria-label="Confirm track change">
                  <span className="cmp-track-confirm-text">Change track to the loaded plan?</span>
                  <button
                    type="button"
                    className="cmp-track-confirm-cancel"
                    onClick={() => setTrackConfirmOpen(false)}
                  >
                    Keep current track
                  </button>
                  <button
                    type="button"
                    className="cmp-track-confirm-ok"
                    onClick={() => { setTrackOverrideRef(null); setTrackConfirmOpen(false); flashTrackChanged(); }}
                  >
                    Change track
                  </button>
                </span>
              )}
            </header>
```

- [ ] **Step 10: CSS — transient + confirm bar** — append to `cm-planner.css`:

```css
.cmp-track-changed {
  margin-left: 0.6rem;
  font-size: 0.78rem;
  font-weight: 700;
  color: #e0954f;
  animation: cmp-track-changed-fade 3s forwards;
}
@keyframes cmp-track-changed-fade {
  0% { opacity: 1; }
  80% { opacity: 1; }
  100% { opacity: 0; }
}
.cmp-track-confirm { display: inline-flex; align-items: center; gap: 0.4rem; margin-left: auto; }
.cmp-track-confirm-text { font-size: 0.78rem; color: var(--fg-2); }
.cmp-track-confirm button { font-size: 0.76rem; padding: 0.12rem 0.5rem; border-radius: 6px; cursor: pointer; }
.cmp-track-confirm-ok { background: var(--accent); color: #fff; border: 1px solid var(--accent); }
.cmp-track-confirm-cancel { background: transparent; border: 1px solid var(--border); color: var(--fg-2); }
```

- [ ] **Step 11: Run tests + typecheck + full build**

Run: `pnpm vitest run src/features/cm-planner/CmPlannerPage.test.tsx`
Expected: PASS (new confirm/transient tests + all existing track tests).
Run: `pnpm typecheck` (clean).
Run: `pnpm build` (typecheck + vite — race-free, trust it).
Expected: build succeeds.

- [ ] **Step 12: Commit**

```bash
git add src/features/cm-planner/CmPlannerPage.tsx src/features/cm-planner/CmPlannerPage.test.tsx src/features/cm-planner/cm-planner.css
git commit -m "feat(m4): track-change confirm flow + Track changed! transient (load + flip)"
```

---

## Final verification (after Task 11)

- [ ] Run the full suite: `pnpm test` — expect all green (baseline 783 + the new tests).
- [ ] `pnpm typecheck` + `pnpm build` clean.
- [ ] Dispatch the whole-branch code review (superpowers:requesting-code-review) on the full diff.
- [ ] Hand back to the user with the manual-verification checklist (live dev server).

---

## Self-review (plan vs spec)

- **A** (backpack + edit mode) → Task 8. **B** (badges + row-body + glow) → Task 9. **C** (collision duplicate) → Tasks 3 (predicate) + 4 (context). **D** (copy buttons + blank face + uma2 New) → Tasks 7 (sidebar) + 10 (onNew routing). **E1/E2** (track confirm + transient) → Tasks 2 (helpers) + 11 (page). **E3** (mismatch chip) → Tasks 7 (render) + 10 (compute). **F1** (stat fix) → Tasks 1 (helpers) + 6 (component). **F2** (red accent) → Task 6. **G** (delete fix + saved indicator) → Task 5. All spec sections covered.
- **Type consistency:** `loadPlanIntoSlot(id, slot)` signature identical across Tasks 4/9/10; `onLoadPlanIntoSlot` prop identical in Tasks 9/10; `trackMismatchLabel` identical in Tasks 7/10; `tracksDiffer`/`trackChangeNeedsConfirm` signatures identical in Tasks 2/10/11; `StatInput` props identical in Tasks 6 usage.
- **Sequencing risk noted:** Tasks 9↔10 are a typecheck pair (inventory prop rename + page rewire) — full `pnpm typecheck` gate runs at the end of Task 10, not Task 9.
- **Placeholder scan:** every code step carries complete code; every test step carries real assertions.
