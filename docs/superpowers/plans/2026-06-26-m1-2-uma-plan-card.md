# M1.2 — "Your uma plan" card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the M1.2 placeholder in the Inheritance workbench's left column with the **"Your uma plan"** card — portrait, name + epithet, the plan-relevant pink aptitude chips (Turf A / Medium A / Late A), and a **Change** button that reveals a `SearchPicker` to swap the plan uma.

**Architecture:** A pure helper `umaPlanApt.ts` derives the three aptitude chips (surface/distance/strategy keys for the plan, graded by the uma's `baseAptitudes`). A **provider-free** presentational `UmaPlanCard` renders portrait + meta + chips + the swap picker, receiving the portrait node and picker-item icons as props (so it never calls `useGameData`, which throws without a provider). `InheritancePage` resolves the uma via the existing `useUmas()` hook, builds the `GameIcon` nodes, and wires the pick to `setPlan({ ...uma1Plan, umaId })`.

**Tech Stack:** TypeScript + React 19, Vitest (jsdom) + @testing-library/react. Reuses `SearchPicker` (`@/features/parents/SearchPicker`), `useUmas` (`@/features/parents/useUmas`), `GameIcon` (`@/features/data/GameIcon`), `currentAptitudeKeys` (`@/core/simBuild`), and the existing global classes `.spark-chips`/`.spark-pink` (parents.css), `.cmp-portrait-ph`/`.cmp-small-btn`/`.picker-*` (cm-planner.css / app.css — all bundled app-wide via statically-imported pages).

## Global Constraints

- Handoff design source: `docs/modules/design_handoff_support_card_builder/` README §"LEFT SIDEBAR → 1. Your uma plan panel" + screenshot `01-overview.png`. The card is a bordered (accent) tinted card: 50px portrait, name (700) + muted epithet (truncate), a row of pink aptitude chips, a Change/Close button; Change reveals a `SearchPicker` ("Swap plan uma") over the trained-uma list.
- **Windows case-FS:** the pure helper is `umaPlanApt.ts`; the component is `UmaPlanCard.tsx`. These names differ by more than case — safe. Do NOT name the helper `umaPlanCard.ts` (would collide with `UmaPlanCard.tsx`).
- **`useGameData` throws without `<GameDataProvider>`** — `GameIcon` calls it. Keep `UmaPlanCard` provider-free: it takes the portrait + each picker item's `icon` as already-built `ReactNode`s. Only the page (rendered under the providers) constructs `GameIcon`s.
- `Stat` = `'spd'|…`; `Strategy` = `'front'|'pace'|'late'|'end'`; `Grade` = `'G'|'F'|'E'|'D'|'C'|'B'|'A'|'S'`.
- M1 reads/writes the **uma1** slot: `const { uma1Plan, setPlan } = useActivePlan()`.
- Test files with ≥2 render-and-query tests must `afterEach(cleanup)`.
- Do NOT start `pnpm dev` before vitest (HMR flake). Final gate: `pnpm typecheck` + `pnpm build` + `pnpm test`, all green.
- Commit messages end with: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

## File Structure

- Create: `src/features/inheritance/labels.ts` — shared `STRATEGY_LABEL` + `cap`.
- Create: `src/features/inheritance/umaPlanApt.ts` — `AptChip`, `umaPlanAptChips(plan, uma)`.
- Create: `src/features/inheritance/umaPlanApt.test.ts`.
- Create: `src/features/inheritance/UmaPlanCard.tsx` — presentational card.
- Create: `src/features/inheritance/UmaPlanCard.test.tsx`.
- Modify: `src/features/inheritance/planContextHeader.ts` — import `STRATEGY_LABEL`/`cap` from `./labels` (drop the local copies; no behavior change).
- Modify: `src/features/inheritance/InheritancePage.tsx` — resolve uma via `useUmas`, build icons, render `UmaPlanCard` in place of the M1.2 placeholder.
- Modify: `src/features/inheritance/InheritancePage.test.tsx` — add `setPlan` to the `useActivePlan` mock + mock `useUmas`.
- Modify: `src/features/inheritance/inheritance.css` — card styles.

---

### Task 1: Shared labels module (DRY the duplication before it spreads)

**Files:**
- Create: `src/features/inheritance/labels.ts`
- Modify: `src/features/inheritance/planContextHeader.ts`

**Interfaces:**
- Produces: `export const STRATEGY_LABEL: Record<Strategy, string>` and `export const cap: (v: string) => string`.

- [ ] **Step 1: Create `labels.ts`**

```ts
// src/features/inheritance/labels.ts
/** Shared display labels for the M1 inheritance workbench (strategy names +
 *  capitalize). Kept in one place so the header, the uma-plan card, and later
 *  M1 cards format aptitude/strategy labels identically. */
import type { Strategy } from '@/core/types';

export const STRATEGY_LABEL: Record<Strategy, string> = {
  front: 'Front',
  pace: 'Pace',
  late: 'Late',
  end: 'End',
};

export const cap = (v: string): string => v.charAt(0).toUpperCase() + v.slice(1);
```

- [ ] **Step 2: Refactor `planContextHeader.ts` to use it**

Replace the local `STRATEGY_LABEL` + `cap` definitions with an import. The file's top becomes:

```ts
// src/features/inheritance/planContextHeader.ts
/** Pure view-model for the M1 workbench plan-context header (handoff README
 *  §"Top: Plan context header"). Derives display strings from the active CmPlan
 *  plus an already-resolved racetrack name (resolution itself is async + lives
 *  in the page, so this stays pure + unit-testable). */
import { distanceClass } from '@/core/simBuild';
import type { CmPlan } from '@/core/types';
import { STRATEGY_LABEL, cap } from './labels';
```

Then DELETE the now-duplicated local lines from `planContextHeader.ts`:
```ts
const STRATEGY_LABEL: Record<Strategy, string> = { front: 'Front', pace: 'Pace', late: 'Late', end: 'End' };
const cap = (v: string): string => v.charAt(0).toUpperCase() + v.slice(1);
```
(and the now-unused `Strategy` import — `import type { CmPlan } from '@/core/types';` no longer needs `Strategy`.) The body (`planContextView`) is unchanged.

- [ ] **Step 3: Run the header tests — still green (no behavior change)**

Run: `pnpm vitest run src/features/inheritance/planContextHeader.test.ts`
Expected: PASS (4 tests, unchanged).

- [ ] **Step 4: Commit**

```bash
git add src/features/inheritance/labels.ts src/features/inheritance/planContextHeader.ts
git commit -m "refactor(m1): extract shared STRATEGY_LABEL/cap into labels.ts

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Pure aptitude-chip helper

**Files:**
- Create: `src/features/inheritance/umaPlanApt.ts`
- Test: `src/features/inheritance/umaPlanApt.test.ts`

**Interfaces:**
- Consumes: `currentAptitudeKeys` (`@/core/simBuild`), `STRATEGY_LABEL`/`cap` (`./labels`), `CmPlan`/`UmaRecord`/`Grade`/`Strategy` (`@/core/types`).
- Produces: `interface AptChip { label: string; grade: Grade }` and `function umaPlanAptChips(plan: CmPlan, uma: UmaRecord | null): AptChip[]` — three chips (surface, distance, strategy) for the plan's current aptitude keys, graded by the uma's `baseAptitudes`. Returns `[]` when the uma is null or has no `baseAptitudes`.

- [ ] **Step 1: Write the failing test**

```ts
// src/features/inheritance/umaPlanApt.test.ts
import { describe, expect, it } from 'vitest';
import type { CmPlan, UmaRecord } from '@/core/types';
import { umaPlanAptChips } from './umaPlanApt';

const plan = (over: Partial<CmPlan> = {}): CmPlan =>
  ({
    id: 'p1', name: 'x', planNumber: 1,
    cmRef: { kind: 'cm', cmId: 'CM15', cmNumber: 15, courseId: '10906', surface: 'turf', distance: 2200 },
    scenarioId: 4, umaId: '106801', uniqueSkillId: '', role: 'ace', strategy: 'late',
    statProfile: { stats: { spd: 1, sta: 1, pow: 1, gut: 1, wit: 1 }, mood: 2 },
    sparkGoals: { pink: [], blue: {} }, wishlist: [], lockedDeckSlots: [], parents: {},
    patch: { version: 'x' }, server: 'global', dataVersion: 'x', ...over,
  }) as CmPlan;

const uma: UmaRecord = {
  umaId: '106801', charaId: '1068', nameEn: 'Mejiro McQueen', epithet: 'Patrician Maiden',
  baseAptitudes: {
    surface: { turf: 'A', dirt: 'G' },
    distance: { short: 'C', mile: 'B', medium: 'A', long: 'A' },
    strategy: { front: 'C', pace: 'B', late: 'A', end: 'B' },
  },
  server: 'global', dataVersion: 'x',
};

describe('umaPlanAptChips', () => {
  it('grades the plan-relevant surface/distance/strategy keys from the uma aptitudes', () => {
    // turf · 2200m (→ medium) · late
    expect(umaPlanAptChips(plan(), uma)).toEqual([
      { label: 'Turf', grade: 'A' },
      { label: 'Medium', grade: 'A' },
      { label: 'Late', grade: 'A' },
    ]);
  });

  it('reflects a different race + strategy (dirt · 1600 mile · front)', () => {
    const p = plan({
      cmRef: { kind: 'cm', cmId: 'CM16', cmNumber: 16, courseId: '10609', surface: 'dirt', distance: 1600 },
      strategy: 'front',
    });
    expect(umaPlanAptChips(p, uma)).toEqual([
      { label: 'Dirt', grade: 'G' },
      { label: 'Mile', grade: 'B' },
      { label: 'Front', grade: 'C' },
    ]);
  });

  it('returns [] when the uma is null or lacks base aptitudes', () => {
    expect(umaPlanAptChips(plan(), null)).toEqual([]);
    expect(umaPlanAptChips(plan(), { ...uma, baseAptitudes: undefined })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/inheritance/umaPlanApt.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Write the implementation**

```ts
// src/features/inheritance/umaPlanApt.ts
/** The three pink aptitude chips shown on the M1 "Your uma plan" card
 *  (handoff README §"1. Your uma plan panel"): the plan's current surface /
 *  distance / strategy keys, graded by the selected uma's base aptitudes. */
import { currentAptitudeKeys } from '@/core/simBuild';
import type { CmPlan, Grade, Strategy, UmaRecord } from '@/core/types';
import { STRATEGY_LABEL, cap } from './labels';

export interface AptChip {
  label: string;
  grade: Grade;
}

export function umaPlanAptChips(plan: CmPlan, uma: UmaRecord | null): AptChip[] {
  const apt = uma?.baseAptitudes;
  if (!apt) return [];
  const keys = currentAptitudeKeys(plan);
  // currentAptitudeKeys guarantees each AptKey's discriminant, so the narrowing
  // casts below are safe (surface→turf/dirt, distance→short/…/long, strategy→Strategy).
  const surface = keys.surface.key as 'turf' | 'dirt';
  const distance = keys.distance.key as 'short' | 'mile' | 'medium' | 'long';
  const strategy = keys.strategy.key as Strategy;
  return [
    { label: cap(surface), grade: apt.surface[surface] },
    { label: cap(distance), grade: apt.distance[distance] },
    { label: STRATEGY_LABEL[strategy], grade: apt.strategy[strategy] },
  ];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/features/inheritance/umaPlanApt.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/inheritance/umaPlanApt.ts src/features/inheritance/umaPlanApt.test.ts
git commit -m "feat(m1): uma-plan aptitude-chip helper

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Presentational UmaPlanCard

**Files:**
- Create: `src/features/inheritance/UmaPlanCard.tsx`
- Test: `src/features/inheritance/UmaPlanCard.test.tsx`

**Interfaces:**
- Consumes: `SearchPicker` + `SearchItem` (`@/features/parents/SearchPicker`), `AptChip` (`./umaPlanApt`).
- Produces:
  ```ts
  interface UmaPlanCardProps {
    name: string;            // "Mejiro McQueen" or "No uma selected"
    epithet?: string;        // muted sub-line
    portrait: ReactNode;     // <GameIcon …> or placeholder, built by the page
    aptChips: AptChip[];
    umaItems: SearchItem[];  // trained-uma universe for the swap picker
    onPickUma: (umaId: string) => void;
  }
  function UmaPlanCard(props: UmaPlanCardProps): JSX.Element
  ```
  Renders `.panel.inh-uma-card`: a `.inh-uma-main` row (portrait + name/epithet + Change/Close button), the `.spark-chips` aptitude row, and — when Change is toggled — a `SearchPicker` labelled "Swap plan uma" (picking calls `onPickUma` and closes).

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/inheritance/UmaPlanCard.test.tsx
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { UmaPlanCard } from './UmaPlanCard';

afterEach(cleanup);

const baseProps = {
  name: 'Mejiro McQueen',
  epithet: 'Patrician Maiden',
  portrait: <span data-testid="portrait" />,
  aptChips: [
    { label: 'Turf', grade: 'A' as const },
    { label: 'Medium', grade: 'A' as const },
    { label: 'Late', grade: 'A' as const },
  ],
  umaItems: [{ id: '900', name: 'Gold Ship' }],
  onPickUma: () => {},
};

describe('UmaPlanCard', () => {
  it('renders portrait, name, epithet, and aptitude chips', () => {
    render(<UmaPlanCard {...baseProps} />);
    expect(screen.getByTestId('portrait')).toBeInTheDocument();
    expect(screen.getByText('Mejiro McQueen')).toBeInTheDocument();
    expect(screen.getByText('Patrician Maiden')).toBeInTheDocument();
    expect(screen.getByText('Turf A')).toBeInTheDocument();
    expect(screen.getByText('Medium A')).toBeInTheDocument();
    expect(screen.getByText('Late A')).toBeInTheDocument();
  });

  it('toggles the swap picker and emits the picked uma id', () => {
    const onPickUma = vi.fn();
    render(<UmaPlanCard {...baseProps} onPickUma={onPickUma} />);
    // Picker hidden until Change is clicked.
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Change' }));
    const box = screen.getByRole('searchbox');
    fireEvent.change(box, { target: { value: 'Gold' } });
    fireEvent.click(screen.getByRole('button', { name: /Gold Ship/ }));
    expect(onPickUma).toHaveBeenCalledWith('900');
    // Picker closes after a pick.
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/inheritance/UmaPlanCard.test.tsx`
Expected: FAIL — module missing.

- [ ] **Step 3: Write the component**

```tsx
// src/features/inheritance/UmaPlanCard.tsx
/** M1 "Your uma plan" card (handoff README §"1. Your uma plan panel").
 *  Provider-free: the portrait + each picker item's icon are passed in as
 *  ReactNodes by the page (GameIcon needs the GameData provider, which this
 *  component must not require so it stays unit-testable). */
import { useState, type ReactNode } from 'react';
import { SearchPicker, type SearchItem } from '@/features/parents/SearchPicker';
import type { AptChip } from './umaPlanApt';

export interface UmaPlanCardProps {
  name: string;
  epithet?: string;
  portrait: ReactNode;
  aptChips: AptChip[];
  umaItems: SearchItem[];
  onPickUma: (umaId: string) => void;
}

export function UmaPlanCard({ name, epithet, portrait, aptChips, umaItems, onPickUma }: UmaPlanCardProps) {
  const [picking, setPicking] = useState(false);
  return (
    <div className="panel inh-uma-card">
      <div className="inh-uma-main">
        <span className="inh-uma-portrait">{portrait}</span>
        <div className="inh-uma-meta">
          <span className="inh-uma-name">{name}</span>
          {epithet && <span className="inh-uma-epithet">{epithet}</span>}
        </div>
        <button type="button" className="cmp-small-btn inh-uma-change" onClick={() => setPicking((p) => !p)}>
          {picking ? 'Close' : 'Change'}
        </button>
      </div>
      {aptChips.length > 0 && (
        <div className="spark-chips inh-uma-apts">
          {aptChips.map((c) => (
            <span key={c.label} className="badge spark-pink">
              {c.label} {c.grade}
            </span>
          ))}
        </div>
      )}
      {picking && (
        <div className="inh-uma-picker">
          <SearchPicker
            label="Swap plan uma"
            placeholder="Search uma…"
            items={umaItems}
            onPick={(id) => {
              onPickUma(id);
              setPicking(false);
            }}
          />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/features/inheritance/UmaPlanCard.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/inheritance/UmaPlanCard.tsx src/features/inheritance/UmaPlanCard.test.tsx
git commit -m "feat(m1): presentational Your-uma-plan card

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Wire UmaPlanCard into the page + CSS

**Files:**
- Modify: `src/features/inheritance/InheritancePage.tsx`
- Modify: `src/features/inheritance/InheritancePage.test.tsx`
- Modify: `src/features/inheritance/inheritance.css`

**Interfaces:**
- Consumes: `useUmas` (`@/features/parents/useUmas`), `GameIcon` (`@/features/data/GameIcon`), `umaPlanAptChips` (`./umaPlanApt`), `UmaPlanCard` + `SearchItem` (Task 3), `setPlan` from `useActivePlan`.

- [ ] **Step 1: Update the page test FIRST (it will fail until the page wires the card)**

Edit `src/features/inheritance/InheritancePage.test.tsx`:

Replace the `useActivePlan` mock to include `setPlan`, and add a `useUmas` mock (so the page resolves no uma → the card shows "No uma selected", keeping the test provider-free / GameIcon-free):

```tsx
// add alongside the existing imports/mocks, BEFORE `import { InheritancePage }`
vi.mock('@/app/ActivePlanContext', () => ({
  useActivePlan: () => ({ uma1Plan: plan, plan, setPlan: vi.fn() }),
}));
vi.mock('@/features/parents/useUmas', () => ({
  useUmas: () => ({ umas: [], umaById: new Map() }),
  umaName: (_m: unknown, id: string) => `Uma ${id}`,
}));
```

(Replace the existing `vi.mock('@/app/ActivePlanContext', …)` block with the one above — do not duplicate it.)

Then ADD a new assertion to the existing "renders … shell" test (the card now occupies the left column; with no resolved uma it shows the empty state + a Change button):

```tsx
    // "Your uma plan" card is wired into the left column.
    expect(screen.getByText('No uma selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change' })).toBeInTheDocument();
```

Keep the existing assertions (PLAN #1, heading, 3 `.inh-col`, the awaited Tokyo source line).

- [ ] **Step 2: Run the page test to verify it fails**

Run: `pnpm vitest run src/features/inheritance/InheritancePage.test.tsx`
Expected: FAIL — "No uma selected" not found (card not wired yet).

- [ ] **Step 3: Wire the card into `InheritancePage.tsx`**

Add imports:
```tsx
import { useMemo } from 'react';  // merge with the existing `import { useEffect, useState } from 'react'`
import { GameIcon } from '@/features/data/GameIcon';
import { useUmas } from '@/features/parents/useUmas';
import type { SearchItem } from '@/features/parents/SearchPicker';
import { UmaPlanCard } from './UmaPlanCard';
import { umaPlanAptChips } from './umaPlanApt';
```
(Net: the React import becomes `import { useEffect, useMemo, useState } from 'react';`.)

Change the context read:
```tsx
  const { uma1Plan, setPlan } = useActivePlan();
```

Inside the component body (after the existing `track` effect), resolve the uma + build the card inputs:
```tsx
  const { umas, umaById } = useUmas();
  const uma = uma1Plan ? umaById.get(uma1Plan.umaId) ?? null : null;
  const aptChips = uma1Plan ? umaPlanAptChips(uma1Plan, uma) : [];
  const umaItems = useMemo<SearchItem[]>(
    () =>
      umas.map((u) => ({
        id: u.umaId,
        name: u.nameEn,
        sub: u.epithet,
        icon: <GameIcon kind="uma" id={u.umaId} size={24} alt="" />,
      })),
    [umas],
  );
  const portrait = uma ? (
    <GameIcon kind="uma" id={uma.umaId} size={50} alt="" />
  ) : (
    <span className="cmp-portrait-ph">uma</span>
  );
  const handlePickUma = (umaId: string) => {
    if (uma1Plan) setPlan({ ...uma1Plan, umaId });
  };
```

Replace the left-column M1.2 placeholder:
```tsx
        <div className="inh-col inh-col-left">
          <Placeholder title="Your uma plan" phase="M1.2" />
          <Placeholder title="Plan targets" phase="M1.3" />
        </div>
```
with:
```tsx
        <div className="inh-col inh-col-left">
          <UmaPlanCard
            name={uma?.nameEn ?? 'No uma selected'}
            epithet={uma?.epithet}
            portrait={portrait}
            aptChips={aptChips}
            umaItems={umaItems}
            onPickUma={handlePickUma}
          />
          <Placeholder title="Plan targets" phase="M1.3" />
        </div>
```

- [ ] **Step 4: Add the card CSS to `inheritance.css`**

Append:
```css
/* "Your uma plan" card (M1.2) */
.inh-uma-card {
  border-color: color-mix(in srgb, var(--accent) 40%, var(--border));
  background: color-mix(in srgb, var(--accent) 5%, var(--bg-1));
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.inh-uma-main { display: flex; align-items: center; gap: 0.6rem; }
.inh-uma-portrait { flex: none; display: inline-flex; }
.inh-uma-meta { display: flex; flex-direction: column; min-width: 0; }
.inh-uma-name {
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.inh-uma-epithet {
  color: var(--fg-muted);
  font-size: 0.78rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.inh-uma-change { margin-left: auto; flex: none; }
.inh-uma-apts { margin-top: 0; }
.inh-uma-picker { margin-top: 0.2rem; }
```

- [ ] **Step 5: Run the page test to verify it passes**

Run: `pnpm vitest run src/features/inheritance/InheritancePage.test.tsx`
Expected: PASS (1 test, now also asserting the card).

- [ ] **Step 6: Typecheck + full build + full suite**

Run: `pnpm build`
Expected: typecheck + vite build clean.

Run: `pnpm test`
Expected: all green (880 prior + 5 new: 3 helper + 2 card; the page test count is unchanged).

- [ ] **Step 7: Commit**

```bash
git add src/features/inheritance/InheritancePage.tsx src/features/inheritance/InheritancePage.test.tsx src/features/inheritance/inheritance.css
git commit -m "feat(m1): wire Your-uma-plan card into the workbench left column

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

- **Spec coverage:** roadmap M1.2 = "Plan-uma display (portrait, name, pink-aptitude chips) + Change/swap via the bundled SearchPicker." → Task 2 (chips), Task 3 (card: portrait/name/epithet/chips/Change→SearchPicker), Task 4 (wire + swap via setPlan). ✓
- **Placeholder scan:** the only remaining `Placeholder` is M1.3 ("Plan targets"), intentional. No hand-wave steps; all code is concrete. ✓
- **Type consistency:** `AptChip` shape identical across Task 2→3→4; `UmaPlanCardProps` identical Task 3→4; `SearchItem` is the real `@/features/parents/SearchPicker` export; `currentAptitudeKeys` returns `{distance,surface,strategy}` AptKeys (cast narrowed). `setPlan` is the real `useActivePlan` uma1 setter. ✓
- **Provider safety:** `UmaPlanCard` imports no `useGameData`/`useUmas`; portrait + item icons are props. The page (under providers) builds the `GameIcon`s; the page test mocks `useUmas` so no `GameIcon` renders → no provider needed. ✓
- **Unique-skill coupling (out of scope):** swapping `umaId` leaves `uniqueSkillId` as-is. M1 doesn't surface the unique skill on this card; the umaId↔unique coupling is M4's concern. Intentionally deferred (not a gap for M1.2).
