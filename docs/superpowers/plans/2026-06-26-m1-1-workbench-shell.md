# M1.1 — Inheritance workbench shell + plan-context header Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un-stub `/inheritance` and stand up the M1 Inheritance *workbench shell* — a 3-column responsive grid with a populated **plan-context header** (PLAN #N · name · "From CM Planner · {track}" · surface/distance/strategy chips) reading the active `CmPlan`. Columns hold labeled placeholder panels that later phases (M1.2–M1.8) replace.

**Architecture:** A new feature folder `src/features/inheritance/`. A pure view-model helper (`planContextHeader.ts`) derives the header strings from a `CmPlan` + a resolved track name (no async, fully unit-tested). A presentational `PlanContextHeader` renders it from props (no context, testable in isolation). `InheritancePage` wires `useActivePlan().uma1Plan` + a lazy `@/sim/courseCatalog` track-name lookup (injectable `deps` for tests, mirroring `RaceSetup`) and renders the header over the `WorkbenchShell` grid. Route wired in `App.tsx`.

**Tech Stack:** TypeScript + React 19, Vitest (jsdom) + @testing-library/react, existing design tokens + `.panel`/`.badge`/`.chip-sm` classes (app.css), feature CSS `inheritance.css`.

## Global Constraints

- The handoff at `docs/modules/design_handoff_support_card_builder/` is the design source of truth (README §"Top: Plan context header" + §"Workbench grid"). Reference screenshot: `screenshots/01-overview.png`.
- Reuse existing token-based classes `.panel`, `.badge`, `.chip-sm` (app.css) — they map 1:1 to the handoff's DS. New structural classes are `inh-*` prefixed.
- **Do NOT put the global `.page` class on this page** — at wide widths `.page` becomes a 2-column grid (legacy gotcha). Use `.inh-page` (flex column).
- **Keep the engine lazy** — reach the catalog via lazy `import('@/sim/courseCatalog')`, never the `@/sim` barrel. Make the catalog loader an injectable `deps` prop so tests don't import the engine bundle (mirror `src/features/planner/race-setup/RaceSetup.tsx`).
- `Stat` literals are `'spd'|'sta'|'pow'|'gut'|'wit'` (never `'speed'`). `Strategy` is `'front'|'pace'|'late'|'end'`.
- Test files with ≥2 render-and-query tests must `afterEach(cleanup)`.
- Stop any `pnpm dev` server before running vitest (HMR flake). Trust `pnpm typecheck` / `pnpm build`.
- Commit messages end with: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

## File Structure

- Create: `src/features/inheritance/planContextHeader.ts` — pure `planContextView(plan, trackName)`.
- Create: `src/features/inheritance/planContextHeader.test.ts` — pure helper tests.
- Create: `src/features/inheritance/PlanContextHeader.tsx` — presentational header.
- Create: `src/features/inheritance/PlanContextHeader.test.tsx` — render-from-props tests.
- Create: `src/features/inheritance/InheritancePage.tsx` — page = header + `WorkbenchShell`, lazy track-name resolve via `deps`.
- Create: `src/features/inheritance/InheritancePage.test.tsx` — page smoke (mocked `useActivePlan`, injected catalog).
- Create: `src/features/inheritance/inheritance.css` — `.inh-page`, `.inh-grid`, `.inh-col`, header, responsive breakpoints.
- Modify: `src/app/App.tsx` — add NavLink + Route, remove `'Inheritance'` from `STUB_MODULES` (leaving the array empty but kept for future stubs).
- Modify: `src/main.tsx` (or wherever feature CSS is imported) — import `inheritance.css` IF feature CSS isn't auto-imported by the page. (Check: M4 imports `cm-planner.css` from its page module — follow that pattern and import from `InheritancePage.tsx` instead of `main.tsx`.)

---

### Task 1: Pure plan-context view-model

**Files:**
- Create: `src/features/inheritance/planContextHeader.ts`
- Test: `src/features/inheritance/planContextHeader.test.ts`

**Interfaces:**
- Consumes: `CmPlan` (`@/core/types`), `distanceClass` (`@/core/simBuild`).
- Produces: `interface PlanContextView { planLabel: string; name: string; source: string; chips: { surface: string; distance: string; strategy: string } }` and `function planContextView(plan: CmPlan, trackName: string | null): PlanContextView`.

- [ ] **Step 1: Write the failing test**

```ts
// src/features/inheritance/planContextHeader.test.ts
import { describe, expect, it } from 'vitest';
import type { CmPlan } from '@/core/types';
import { planContextView } from './planContextHeader';

const basePlan = (over: Partial<CmPlan> = {}): CmPlan =>
  ({
    id: 'p1',
    name: 'Cancer Cup — Late ace',
    planNumber: 1,
    cmRef: { kind: 'cm', cmId: 'CM15', cmNumber: 15, courseId: '10906', surface: 'turf', distance: 2200 },
    scenarioId: 4,
    umaId: '106801',
    uniqueSkillId: '',
    role: 'ace',
    strategy: 'late',
    statProfile: { stats: { spd: 1200, sta: 900, pow: 1000, gut: 600, wit: 1100 }, mood: 2 },
    sparkGoals: { pink: [], blue: {} },
    wishlist: [],
    lockedDeckSlots: [],
    parents: {},
    patch: { version: 'x' },
    server: 'global',
    dataVersion: 'x',
    ...over,
  }) as CmPlan;

describe('planContextView', () => {
  it('derives label, name, source, and chips from a plan + track name', () => {
    // 2200m → core distanceClass 'medium' (1801–2400). We follow OUR thresholds
    // (game-correct, P3) — NOT the handoff sample data's loose "Long · 2400m".
    const v = planContextView(basePlan(), 'Hanshin');
    expect(v.planLabel).toBe('PLAN #1');
    expect(v.name).toBe('Cancer Cup — Late ace');
    expect(v.source).toBe('From CM Planner · Hanshin Racecourse');
    expect(v.chips).toEqual({ surface: 'Turf', distance: 'Medium · 2200m', strategy: 'Late' });
  });

  it('drops the racetrack suffix when the track name is not yet resolved', () => {
    expect(planContextView(basePlan(), null).source).toBe('From CM Planner');
  });

  it('classifies distance via core thresholds (1600 → Mile, 2500 → Long)', () => {
    const mile = planContextView(
      basePlan({ cmRef: { kind: 'cm', cmId: 'CM16', cmNumber: 16, courseId: '10501', surface: 'dirt', distance: 1600 } }),
      'Nakayama',
    );
    expect(mile.chips).toEqual({ surface: 'Dirt', distance: 'Mile · 1600m', strategy: 'Late' });
    const long = planContextView(
      basePlan({ cmRef: { kind: 'cm', cmId: 'CM17', cmNumber: 17, courseId: '10913', surface: 'turf', distance: 2500 } }),
      'Kyoto',
    );
    expect(long.chips.distance).toBe('Long · 2500m');
  });

  it('falls back to "Untitled plan" when the name is blank', () => {
    expect(planContextView(basePlan({ name: '' }), 'Tokyo').name).toBe('Untitled plan');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/inheritance/planContextHeader.test.ts`
Expected: FAIL — `planContextView` is not defined / module missing.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/features/inheritance/planContextHeader.ts
/** Pure view-model for the M1 workbench plan-context header (handoff README
 *  §"Top: Plan context header"). Derives display strings from the active CmPlan
 *  plus an already-resolved racetrack name (resolution itself is async + lives
 *  in the page, so this stays pure + unit-testable). */
import { distanceClass } from '@/core/simBuild';
import type { CmPlan, Strategy } from '@/core/types';

export interface PlanContextView {
  /** "PLAN #N" badge text. */
  planLabel: string;
  /** Plan name (falls back to "Untitled plan"). */
  name: string;
  /** "From CM Planner · {Track} Racecourse" (suffix dropped when track unknown). */
  source: string;
  /** Right-aligned chips: surface / distance / strategy. */
  chips: { surface: string; distance: string; strategy: string };
}

const STRATEGY_LABEL: Record<Strategy, string> = { front: 'Front', pace: 'Pace', late: 'Late', end: 'End' };
const cap = (v: string): string => v.charAt(0).toUpperCase() + v.slice(1);

export function planContextView(plan: CmPlan, trackName: string | null): PlanContextView {
  const dist = plan.cmRef.distance;
  return {
    planLabel: `PLAN #${plan.planNumber}`,
    name: plan.name.trim() || 'Untitled plan',
    source: trackName ? `From CM Planner · ${trackName} Racecourse` : 'From CM Planner',
    chips: {
      surface: cap(plan.cmRef.surface),
      distance: `${cap(distanceClass(dist))} · ${dist}m`,
      strategy: STRATEGY_LABEL[plan.strategy],
    },
  };
}
```

Note: `distanceClass` (`@/core/simBuild`) returns `'short'|'mile'|'medium'|'long'` with thresholds `<1400 short`, `≤1800 mile`, `≤2400 medium`, else `long`. So 2200 → `'medium'` → "Medium", 2500 → "Long". This is game-correct (P3) — do NOT match the handoff sample's loose "Long · 2400m". A `'short'` value renders "Short · Nm" — fine for the chip.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/features/inheritance/planContextHeader.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/inheritance/planContextHeader.ts src/features/inheritance/planContextHeader.test.ts
git commit -m "feat(m1): pure plan-context header view-model

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Presentational PlanContextHeader

**Files:**
- Create: `src/features/inheritance/PlanContextHeader.tsx`
- Test: `src/features/inheritance/PlanContextHeader.test.tsx`

**Interfaces:**
- Consumes: `planContextView` (Task 1), `CmPlan`.
- Produces: `function PlanContextHeader(props: { plan: CmPlan | null; trackName: string | null }): JSX.Element`. Renders a `.panel.inh-context` with a `.badge` PLAN label, `<h1>` name, muted source, and a right-pushed `.inh-context-chips` of three `.chip-sm`. When `plan` is null renders a muted "Loading plan…" panel.

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/inheritance/PlanContextHeader.test.tsx
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { CmPlan } from '@/core/types';
import { PlanContextHeader } from './PlanContextHeader';

afterEach(cleanup);

const plan: CmPlan = {
  id: 'p1', name: 'Cancer Cup — Late ace', planNumber: 2,
  cmRef: { kind: 'cm', cmId: 'CM15', cmNumber: 15, courseId: '10906', surface: 'turf', distance: 2200 },
  scenarioId: 4, umaId: '106801', uniqueSkillId: '', role: 'ace', strategy: 'late',
  statProfile: { stats: { spd: 1200, sta: 900, pow: 1000, gut: 600, wit: 1100 }, mood: 2 },
  sparkGoals: { pink: [], blue: {} }, wishlist: [], lockedDeckSlots: [], parents: {},
  patch: { version: 'x' }, server: 'global', dataVersion: 'x',
} as CmPlan;

describe('PlanContextHeader', () => {
  it('renders the plan label, name, source, and chips', () => {
    render(<PlanContextHeader plan={plan} trackName="Hanshin" />);
    expect(screen.getByText('PLAN #2')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Cancer Cup — Late ace' })).toBeInTheDocument();
    expect(screen.getByText('From CM Planner · Hanshin Racecourse')).toBeInTheDocument();
    expect(screen.getByText('Turf')).toBeInTheDocument();
    expect(screen.getByText('Medium · 2200m')).toBeInTheDocument();
    expect(screen.getByText('Late')).toBeInTheDocument();
  });

  it('renders a loading state when no plan is set', () => {
    render(<PlanContextHeader plan={null} trackName={null} />);
    expect(screen.getByText(/loading plan/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/inheritance/PlanContextHeader.test.tsx`
Expected: FAIL — module/component missing.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/features/inheritance/PlanContextHeader.tsx
/** M1 workbench plan-context header (handoff README §"Top: Plan context header").
 *  Presentational — derives its strings from planContextView so it stays testable
 *  without the ActivePlan context. */
import type { CmPlan } from '@/core/types';
import { planContextView } from './planContextHeader';

export function PlanContextHeader({ plan, trackName }: { plan: CmPlan | null; trackName: string | null }) {
  if (!plan) {
    return (
      <div className="panel inh-context inh-context-empty" role="status">
        <span className="inh-context-source">Loading plan…</span>
      </div>
    );
  }
  const v = planContextView(plan, trackName);
  return (
    <div className="panel inh-context">
      <span className="badge inh-plan-badge">{v.planLabel}</span>
      <h1 className="inh-context-name">{v.name}</h1>
      <span className="inh-context-source">{v.source}</span>
      <div className="inh-context-chips">
        <span className="chip-sm">{v.chips.surface}</span>
        <span className="chip-sm">{v.chips.distance}</span>
        <span className="chip-sm">{v.chips.strategy}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/features/inheritance/PlanContextHeader.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/inheritance/PlanContextHeader.tsx src/features/inheritance/PlanContextHeader.test.tsx
git commit -m "feat(m1): presentational plan-context header

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: InheritancePage — shell + lazy track-name resolve

**Files:**
- Create: `src/features/inheritance/InheritancePage.tsx`
- Create: `src/features/inheritance/inheritance.css`
- Test: `src/features/inheritance/InheritancePage.test.tsx`

**Interfaces:**
- Consumes: `useActivePlan` (`@/app/ActivePlanContext` — read `uma1Plan`), `PlanContextHeader` (Task 2), `CourseCatalogEntry` + lazy `courseCatalog()` (`@/sim/courseCatalog`), `trackName` (`@/features/planner/race-setup/trackCatalog`).
- Produces: `function InheritancePage(props?: { deps?: { loadCatalog?: () => Promise<CourseCatalogEntry[]> } }): JSX.Element`. Default `loadCatalog` = `() => import('@/sim/courseCatalog').then(m => m.courseCatalog())`. Resolves the active plan's `cmRef.courseId` → `raceTrackId` → `trackName`, passes it to the header. Renders `.inh-page` containing the header + `.inh-grid` with three `.inh-col` (left/center/right) of labeled placeholder `.panel`s for M1.2–M1.8.

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/inheritance/InheritancePage.test.tsx
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { CmPlan } from '@/core/types';
import type { CourseCatalogEntry } from '@/sim/courseCatalog';

const plan: CmPlan = {
  id: 'p1', name: 'Cancer Cup — Late ace', planNumber: 1,
  cmRef: { kind: 'cm', cmId: 'CM15', cmNumber: 15, courseId: '10906', surface: 'turf', distance: 2400 },
  scenarioId: 4, umaId: '106801', uniqueSkillId: '', role: 'ace', strategy: 'late',
  statProfile: { stats: { spd: 1200, sta: 900, pow: 1000, gut: 600, wit: 1100 }, mood: 2 },
  sparkGoals: { pink: [], blue: {} }, wishlist: [], lockedDeckSlots: [], parents: {},
  patch: { version: 'x' }, server: 'global', dataVersion: 'x',
} as CmPlan;

// Stub the ActivePlan context so the page test needs no Dexie/gameData providers.
vi.mock('@/app/ActivePlanContext', () => ({
  useActivePlan: () => ({ uma1Plan: plan, plan }),
}));

import { InheritancePage } from './InheritancePage';

afterEach(cleanup);

const CATALOG: CourseCatalogEntry[] = [
  { courseId: '10906', raceTrackId: 10006, surface: 'turf', distance: 2400, distanceClass: 'long', course: 2, turn: 2 },
];
const deps = { loadCatalog: () => Promise.resolve(CATALOG) };

describe('InheritancePage', () => {
  it('renders the plan-context header and the 3-column workbench shell', async () => {
    render(<InheritancePage deps={deps} />);
    // Header is present immediately (track suffix fills in after the catalog resolves).
    expect(screen.getByText('PLAN #1')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Cancer Cup — Late ace' })).toBeInTheDocument();
    // Three workbench columns render.
    expect(document.querySelectorAll('.inh-col').length).toBe(3);
    // Track name resolves from courseId 10906 → raceTrackId 10006 → "Tokyo".
    await waitFor(() =>
      expect(screen.getByText('From CM Planner · Tokyo Racecourse')).toBeInTheDocument(),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/inheritance/InheritancePage.test.tsx`
Expected: FAIL — module/component missing.

- [ ] **Step 3: Write the page**

```tsx
// src/features/inheritance/InheritancePage.tsx
/** M1 — Inheritance workbench (handoff: docs/modules/design_handoff_support_card_builder/).
 *  M1.1 lands the shell + plan-context header; the column panels are placeholders
 *  that later phases (M1.2–M1.8) replace. */
import { useEffect, useState } from 'react';
import { useActivePlan } from '@/app/ActivePlanContext';
import type { CourseCatalogEntry } from '@/sim/courseCatalog';
import { trackName } from '@/features/planner/race-setup/trackCatalog';
import { PlanContextHeader } from './PlanContextHeader';
import './inheritance.css';

interface Deps {
  loadCatalog?: () => Promise<CourseCatalogEntry[]>;
}
const defaultLoadCatalog = () => import('@/sim/courseCatalog').then((m) => m.courseCatalog());

/** Placeholder for a workbench card not yet built (M1.2–M1.8). */
function Placeholder({ title, phase }: { title: string; phase: string }) {
  return (
    <div className="panel inh-placeholder">
      <span className="inh-placeholder-title">{title}</span>
      <span className="inh-placeholder-phase">{phase}</span>
    </div>
  );
}

export function InheritancePage({ deps }: { deps?: Deps } = {}) {
  const { uma1Plan } = useActivePlan();
  const [track, setTrack] = useState<string | null>(null);
  const loadCatalog = deps?.loadCatalog ?? defaultLoadCatalog;

  const courseId = uma1Plan?.cmRef.courseId;
  useEffect(() => {
    if (!courseId) return;
    let cancelled = false;
    loadCatalog()
      .then((catalog) => {
        if (cancelled) return;
        const entry = catalog.find((c) => c.courseId === courseId);
        setTrack(entry ? trackName(entry.raceTrackId) : null);
      })
      .catch(() => {
        if (!cancelled) setTrack(null);
      });
    return () => {
      cancelled = true;
    };
    // loadCatalog is stable (module default or test-injected); key on the course only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  return (
    <div className="inh-page">
      <PlanContextHeader plan={uma1Plan} trackName={track} />
      <div className="inh-grid">
        <div className="inh-col inh-col-left">
          <Placeholder title="Your uma plan" phase="M1.2" />
          <Placeholder title="Plan targets" phase="M1.3" />
        </div>
        <div className="inh-col inh-col-center">
          <Placeholder title="Inheritance" phase="M1.4" />
          <Placeholder title="Your deck" phase="M1.5" />
          <Placeholder title="Support cards" phase="M1.6" />
          <Placeholder title="Obtainable vs. wishlist" phase="M1.7" />
        </div>
        <div className="inh-col inh-col-right">
          <Placeholder title="Target spark" phase="M1.8" />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write the CSS**

```css
/* src/features/inheritance/inheritance.css
   M1 Inheritance workbench shell (handoff README §"Workbench grid").
   Own page class (NOT global .page — that becomes a 2-col grid at width). */
.inh-page {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  max-width: 1560px;
  margin: 0 auto;
  padding: 0.85rem 0.9rem 4rem;
}

/* Plan-context header */
.inh-context {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem 0.7rem;
}
.inh-plan-badge {
  color: var(--accent);
  border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
  font-weight: 700;
}
.inh-context-name { font-size: 1.05rem; margin: 0; }
.inh-context-source { color: var(--fg-muted); font-size: 0.82rem; }
.inh-context-chips { margin-left: auto; display: flex; gap: 0.4rem; flex-wrap: wrap; }
.inh-context-empty { color: var(--fg-muted); }

/* 3-column workbench grid */
.inh-grid {
  display: grid;
  grid-template-columns: minmax(290px, 320px) minmax(0, 1fr) minmax(290px, 320px);
  gap: 0.8rem;
  align-items: start;
}
.inh-col { display: flex; flex-direction: column; gap: 0.8rem; min-width: 0; }
@media (max-width: 1120px) {
  .inh-grid { grid-template-columns: 1fr; }
}

/* Placeholder cards (replaced by M1.2–M1.8) */
.inh-placeholder {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  min-height: 3.4rem;
  border-style: dashed;
  color: var(--fg-muted);
}
.inh-placeholder-title { font-weight: 600; }
.inh-placeholder-phase { font-size: 0.7rem; opacity: 0.8; }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run src/features/inheritance/InheritancePage.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 6: Commit**

```bash
git add src/features/inheritance/InheritancePage.tsx src/features/inheritance/inheritance.css src/features/inheritance/InheritancePage.test.tsx
git commit -m "feat(m1): inheritance workbench shell + lazy track-name resolve

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Wire the route + nav

**Files:**
- Modify: `src/app/App.tsx`

**Interfaces:**
- Consumes: `InheritancePage` (Task 3).
- Produces: a `/inheritance` route + an "Inheritance" NavLink; `'Inheritance'` removed from `STUB_MODULES` (array kept, now empty).

- [ ] **Step 1: Write the failing test (route smoke)**

Add to a NEW test `src/app/App.inheritance.test.tsx` (App.test may not exist; a focused smoke avoids coupling). Mock the engine-lazy bits used downstream so the route mounts in jsdom:

```tsx
// src/app/App.inheritance.test.tsx
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// Stub ActivePlan so no Dexie is needed; the page only reads uma1Plan here.
vi.mock('@/app/ActivePlanContext', () => ({
  useActivePlan: () => ({ uma1Plan: null, plan: null }),
}));

import { InheritancePage } from '@/features/inheritance/InheritancePage';

afterEach(cleanup);

describe('Inheritance route', () => {
  it('mounts InheritancePage at /inheritance', async () => {
    render(
      <MemoryRouter initialEntries={['/inheritance']}>
        <Routes>
          <Route path="/inheritance" element={<InheritancePage deps={{ loadCatalog: () => Promise.resolve([]) }} />} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText(/loading plan/i)).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run it to verify it passes already** (it imports the page directly)

Run: `pnpm vitest run src/app/App.inheritance.test.tsx`
Expected: PASS — this guards the page mounts route-side with a null plan. (The real wiring is the edit below; this test documents the contract.)

- [ ] **Step 3: Edit `App.tsx` — import, NavLink, Route, trim stub**

Add the import alongside the others:
```tsx
import { InheritancePage } from '@/features/inheritance/InheritancePage';
```
Change the stub list (keep the array for future stubs, but it is now empty):
```tsx
// Module stubs (nav shows them disabled). Inheritance un-stubbed in M1.1.
const STUB_MODULES: readonly string[] = [];
```
Add the NavLink after the "Parents" link (M1 sits next to Parents):
```tsx
          <NavLink to="/inheritance" className={navItemClass}>
            Inheritance
          </NavLink>
```
Add the route alongside the others:
```tsx
          <Route path="/inheritance" element={<InheritancePage />} />
```

- [ ] **Step 4: Typecheck + full build**

Run: `pnpm build`
Expected: typecheck clean, vite build succeeds. (`STUB_MODULES.map` over an empty readonly array still compiles.)

- [ ] **Step 5: Run the full test suite**

Run: `pnpm test`
Expected: all green (prior 872 + the new inheritance tests).

- [ ] **Step 6: Commit**

```bash
git add src/app/App.tsx src/app/App.inheritance.test.tsx
git commit -m "feat(m1): un-stub /inheritance route + nav link

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

- **Spec coverage:** roadmap M1.1 = "un-stub `/inheritance`; 3-col grid (collapses <1120px); top plan-context bar (PLAN #N, name, From CM Planner · {course}, surface/distance/strategy chips) reading the active CmPlan." → Task 4 (route), Task 3 (grid + breakpoint + columns), Tasks 1–2 (header + chips). ✓
- **Placeholder scan:** the only `Placeholder` components are intentional, labeled, and called out as M1.2–M1.8 replacements — not plan-placeholders. No "TBD"/"add error handling" hand-waves. ✓
- **Type consistency:** `planContextView(plan, trackName)` signature is identical across Tasks 1→2→3; `PlanContextHeader` props `{plan, trackName}` match Task 2→3; `InheritancePage` `deps.loadCatalog` matches the test injection. `trackName(raceTrackId: number)` is the real `trackCatalog` export. ✓
- **Lazy engine:** the catalog import is lazy + injectable; tests never import `@/sim`. ✓
