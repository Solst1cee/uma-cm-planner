# App-wide Planning Horizon — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One persisted app-wide `PlanningHorizon` (Current | CM ▾ | All JP) that every availability-sensitive site reads through a single `useAvailability()` predicate, plus tier chips, a foresight gap-pace tooltip, an allJp hypothetical banner, and JP inherited-unique emission.

**Architecture:** Pure tier/visibility math in `src/core/availability.ts`; horizon state in `ActivePlanContext` (Dexie-setting persisted, `autoSave` pattern); a `useAvailability()` hook derives `cutoffISO`/`tierOf`/`visible` from horizon + timeline; a header `HorizonControl` (ThemeToggle `ds-seg` pattern) + `TierChip`; 13 sites across 8 files rewired to `visible()`; `build-all` bakes `foresight.json`; `buildJpSkills` emits `gene_version` inherited uniques.

**Tech Stack:** TypeScript, Vitest (jsdom), React 19, Dexie settings, tsx build scripts. No new deps. No `sim:build`.

## Global Constraints

- **Behavior preservation (spec decision D):** at `{kind:'current'}` every rewired site's output is **identical to today** (`server === 'global'`). Each rewire task includes a current-horizon regression test.
- **Visibility = calc-inclusion (decision C):** no separate calc filter; whatever `visible()` reveals is selectable and counted. `allJp` is flagged by the app-level banner, never silently.
- **One predicate:** every site calls `useAvailability().visible(record)` (or receives the predicate as an input if presentational/pure). No site keeps its own `showUpcoming` state or `asOfISO` derivation after its rewire task.
- **Tier labels:** `now` (Global) / `upcoming` (JP, `releaseDate ≤ cutoffISO`) / `future` (JP after cutoff or undated). Under `allJp`, tiers are still labeled against the **plan's CM date** so "future" keeps meaning "after your CM".
- **Persistence:** Dexie settings via `getSetting`/`setSetting` (the `autoSave` pattern in `ActivePlanContext`), key `'planningHorizon'`. Invalid/stale stored value → fallback `{kind:'current'}`.
- **Numbers:** 175 inherited-unique records emitted (of 561 JP uniques, 0 id collisions) → skills.json 1549 → **1724**. Verify against the build log; the 2c id-uniqueness test must stay green.
- **Windows case-FS:** component files with pure-helper siblings must not collide by case (`HorizonControl.tsx` + `horizon.ts` is safe).
- **Git:** stage only each task's files; never `git add -A/./-u`; one commit per task; body trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` via `git commit -F -`.
- **jsdom gotchas (existing):** tests rendering `PlannerSidebar`/`CmPlannerPage` must mock `useUniqueSkillL`; open `SkillDetailDisclosure` with `traceContext` needs `useSkillTrace` mocked; ≥2 render tests need `afterEach(cleanup)`.

---

### Task 1: Core tier + horizon math

**Files:**
- Modify: `src/core/availability.ts`
- Test: `src/core/availability.test.ts` (extend)

**Interfaces:**
- Produces:
  ```ts
  export type AvailabilityTier = 'now' | 'upcoming' | 'future';
  export type PlanningHorizon = { kind: 'current' } | { kind: 'cm'; cmNumber: number } | { kind: 'allJp' };
  export function availabilityTier(record: { server: Server; releaseDate?: string }, cutoffISO: string, todayISO: string): AvailabilityTier;
  export function visibleAtHorizon(tier: AvailabilityTier, horizon: PlanningHorizon): boolean;
  ```

- [ ] **Step 1: Write the failing tests** — append to `src/core/availability.test.ts`:

```ts
import { availabilityTier, visibleAtHorizon, type PlanningHorizon } from './availability';

describe('availabilityTier', () => {
  const today = '2026-07-02';
  const cutoff = '2026-08-26'; // e.g. CM17's date
  it('global records are now', () => {
    expect(availabilityTier({ server: 'global' }, cutoff, today)).toBe('now');
  });
  it('jp released by today is also now (already on Global)', () => {
    expect(availabilityTier({ server: 'jp', releaseDate: '2026-06-01' }, cutoff, today)).toBe('now');
  });
  it('jp releasing between today and the cutoff is upcoming', () => {
    expect(availabilityTier({ server: 'jp', releaseDate: '2026-08-01' }, cutoff, today)).toBe('upcoming');
  });
  it('jp releasing after the cutoff is future', () => {
    expect(availabilityTier({ server: 'jp', releaseDate: '2027-01-01' }, cutoff, today)).toBe('future');
  });
  it('undated jp is future', () => {
    expect(availabilityTier({ server: 'jp' }, cutoff, today)).toBe('future');
  });
});

describe('visibleAtHorizon', () => {
  const current: PlanningHorizon = { kind: 'current' };
  const cm: PlanningHorizon = { kind: 'cm', cmNumber: 17 };
  const allJp: PlanningHorizon = { kind: 'allJp' };
  it('current reveals only now', () => {
    expect(visibleAtHorizon('now', current)).toBe(true);
    expect(visibleAtHorizon('upcoming', current)).toBe(false);
    expect(visibleAtHorizon('future', current)).toBe(false);
  });
  it('cm reveals now + upcoming', () => {
    expect(visibleAtHorizon('now', cm)).toBe(true);
    expect(visibleAtHorizon('upcoming', cm)).toBe(true);
    expect(visibleAtHorizon('future', cm)).toBe(false);
  });
  it('allJp reveals everything', () => {
    expect(visibleAtHorizon('future', allJp)).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run src/core/availability.test.ts`
Expected: FAIL — `availabilityTier` not exported.

- [ ] **Step 3: Implement** — append to `src/core/availability.ts` (keep `isReleasedBy` untouched):

```ts
/** Availability tier of a record relative to a cutoff date (a CM's date). */
export type AvailabilityTier = 'now' | 'upcoming' | 'future';

/** The app-wide planning-horizon lens (spec 2026-07-02-planning-horizon). */
export type PlanningHorizon =
  | { kind: 'current' }
  | { kind: 'cm'; cmNumber: number }
  | { kind: 'allJp' };

/**
 * now      = available on Global today (server global, or dated ≤ today);
 * upcoming = JP-ahead, arriving by the cutoff (releaseDate ≤ cutoffISO);
 * future   = JP-ahead after the cutoff, or undated JP.
 */
export function availabilityTier(
  record: { server: Server; releaseDate?: string },
  cutoffISO: string,
  todayISO: string,
): AvailabilityTier {
  if (record.server === 'global') return 'now';
  if (record.releaseDate === undefined) return 'future';
  if (record.releaseDate <= todayISO) return 'now';
  if (record.releaseDate <= cutoffISO) return 'upcoming';
  return 'future';
}

/** Which tiers a horizon reveals: current→now · cm→now+upcoming · allJp→all. */
export function visibleAtHorizon(tier: AvailabilityTier, horizon: PlanningHorizon): boolean {
  if (horizon.kind === 'allJp') return true;
  if (horizon.kind === 'cm') return tier !== 'future';
  return tier === 'now';
}
```

- [ ] **Step 4: Run to verify it passes** — `pnpm vitest run src/core/availability.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/availability.ts src/core/availability.test.ts
git commit -m "feat(horizon): availabilityTier + visibleAtHorizon core math"
```

---

### Task 2: Horizon state in ActivePlanContext + `useAvailability()` hook

**Files:**
- Modify: `src/app/ActivePlanContext.tsx`
- Create: `src/app/useAvailability.ts`
- Test: `src/app/useAvailability.test.tsx` (new), `src/app/ActivePlanContext.test.tsx` (extend)

**Interfaces:**
- Consumes: Task 1 types/functions; `getSetting`/`setSetting` from `@/db`; `useGameData().timeline`; `plan.cmRef`.
- Produces:
  ```ts
  // on ActivePlanValue:
  horizon: PlanningHorizon;
  setHorizon: (h: PlanningHorizon) => void;   // persists via setSetting('planningHorizon', h)
  // hook:
  export function useAvailability(): {
    horizon: PlanningHorizon;
    setHorizon: (h: PlanningHorizon) => void;
    cutoffISO: string;        // today | chosen CM date | plan-CM date (allJp tier labeling)
    todayISO: string;
    planCmISO: string;        // the plan's own CM date (banner copy + allJp labeling)
    tierOf: (r: { server: Server; releaseDate?: string }) => AvailabilityTier;
    visible: (r: { server: Server; releaseDate?: string }) => boolean;
    futureCms: Array<{ cmNumber: number; title: string; date: string; predicted: boolean }>; // dropdown feed
  };
  ```

- [ ] **Step 1: Write the failing hook test** `src/app/useAvailability.test.tsx`. Mock `@/features/data/gameData` (timeline with CM 17 dated `2026-08-26`, `tier:'prediction'`) and render the hook under a lightweight `ActivePlanProvider` OR mock `useActivePlan` — match how `ActivePlanContext.test.tsx` already stubs Dexie (`vi.mock('@/db', …)` with in-memory settings). Assert:

```tsx
it('current: visible ≡ server===global; cm horizon reveals released-by-CM jp', () => {
  // with horizon {kind:'current'}: visible(jpUpcoming) === false, visible(globalRec) === true
  // after setHorizon({kind:'cm', cmNumber:17}): visible({server:'jp',releaseDate:'2026-08-01'}) === true
  //   and visible({server:'jp',releaseDate:'2027-01-01'}) === false
});
it('allJp reveals future and persists via setSetting', () => {
  // setHorizon({kind:'allJp'}) → visible(futureJp) === true; setSetting called with 'planningHorizon'
});
it('stale cm number falls back to current cutoff=today', () => {
  // horizon {kind:'cm', cmNumber: 99} (not in timeline) → cutoffISO === todayISO
});
it('futureCms lists timeline CMs dated >= today with predicted flag', () => {});
```

(Write these as real tests with the mocks — the shapes above are the assertions to encode.)

- [ ] **Step 2: Run to verify it fails** — `pnpm vitest run src/app/useAvailability.test.tsx` → FAIL (module missing).

- [ ] **Step 3: Implement.**
  - `ActivePlanContext.tsx`: add `horizon`/`setHorizon` state following the `autoSave` pattern exactly — `const [horizon, setHorizonState] = useState<PlanningHorizon>({ kind: 'current' });` · on mount load `getSetting<PlanningHorizon>('planningHorizon')` and accept it only if it parses to a valid shape (`kind` in the union; `cm` requires a finite `cmNumber`) · `setHorizon` sets state + `void setSetting('planningHorizon', h)`. Add both to the context value + `ActivePlanValue` type.
  - `src/app/useAvailability.ts`:

```ts
import { useMemo } from 'react';
import { useActivePlan } from '@/app/ActivePlanContext';
import { useGameData } from '@/features/data/gameData';
import { availabilityTier, visibleAtHorizon, type AvailabilityTier, type PlanningHorizon } from '@/core/availability';
import type { Server, TimelineEntry } from '@/core/types';

const todayISO = () => new Date().toISOString().slice(0, 10);
const cmDate = (e: TimelineEntry) => e.dates.start ?? e.dates.finals ?? '';

export function useAvailability() {
  const { plan, horizon, setHorizon } = useActivePlan();
  const { timeline } = useGameData();
  return useMemo(() => {
    const today = todayISO();
    const cms = ((timeline as TimelineEntry[] | undefined) ?? []).filter(
      (e) => e.type === 'cm' && e.cm?.cmNumber !== undefined && cmDate(e) !== '',
    );
    const planCmNumber = plan?.cmRef.kind === 'cm' ? plan.cmRef.cmNumber : undefined;
    const planCmISO = cmDate(cms.find((e) => e.cm!.cmNumber === planCmNumber) ?? ({ dates: {} } as TimelineEntry)) || today;
    let cutoffISO = today;
    if (horizon.kind === 'cm') {
      const chosen = cms.find((e) => e.cm!.cmNumber === horizon.cmNumber);
      cutoffISO = chosen ? cmDate(chosen) : today; // stale cmNumber → today (≈ current)
    } else if (horizon.kind === 'allJp') {
      cutoffISO = planCmISO; // tiers still labeled against the plan's CM
    }
    const tierOf = (r: { server: Server; releaseDate?: string }): AvailabilityTier =>
      availabilityTier(r, cutoffISO, today);
    const visible = (r: { server: Server; releaseDate?: string }) => visibleAtHorizon(tierOf(r), horizon);
    const futureCms = cms
      .filter((e) => cmDate(e) >= today)
      .sort((a, b) => cmDate(a).localeCompare(cmDate(b)))
      .map((e) => ({ cmNumber: e.cm!.cmNumber!, title: e.title, date: cmDate(e), predicted: e.tier === 'prediction' }));
    return { horizon, setHorizon, cutoffISO, todayISO: today, planCmISO, tierOf, visible, futureCms };
  }, [plan, horizon, setHorizon, timeline]);
}
```

- [ ] **Step 4: Run to verify** — hook test + `pnpm vitest run src/app/ActivePlanContext.test.tsx` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/ActivePlanContext.tsx src/app/useAvailability.ts src/app/useAvailability.test.tsx src/app/ActivePlanContext.test.tsx
git commit -m "feat(horizon): persisted PlanningHorizon in ActivePlanContext + useAvailability hook"
```

---

### Task 3: Bake `foresight.json` + load in gameData

**Files:**
- Modify: `scripts/build-all.ts` (after `const cal` line 109; add a write near the writes block ~195)
- Modify: `src/features/data/gameData.ts` (optional dataset, `timeline` pattern)
- Modify: `src/core/types.ts` (the record type)
- Test: `scripts/outputs.test.ts` (extend), `src/features/data/gameData.test.ts` if present (else covered by outputs)

**Interfaces:**
- Produces: `public/data/foresight.json` = `ForesightInfo | { cal: null }` where
  ```ts
  export interface ForesightInfo { pace: number; gapDays: number; windowSteps: number; anchorJp: string; anchorGlobal: string; dataVersion: string }
  ```
  and `GameData.foresight?: ForesightInfo | null`.

- [ ] **Step 1: Add `ForesightInfo`** to `src/core/types.ts` (near `TimelineEntry`), exactly the shape above with doc comments.

- [ ] **Step 2: Write the failing outputs test** — append to `scripts/outputs.test.ts`:

```ts
describe('public/data/foresight.json', () => {
  const foresight = readData<{ pace?: number; gapDays?: number; windowSteps?: number; cal?: null }>('foresight.json');
  it('carries the rolling calibration', () => {
    expect(foresight.pace).toBeGreaterThan(1);
    expect(foresight.gapDays).toBeGreaterThan(1000);
    expect(foresight.windowSteps).toBeGreaterThanOrEqual(2);
  });
});
```

- [ ] **Step 3: Run to verify it fails** — `pnpm vitest run scripts/outputs.test.ts` → FAIL (file missing).

- [ ] **Step 4: Implement the bake** in `scripts/build-all.ts` — after the umas/timeline writes:

```ts
  writeJsonDeterministic(
    join(PUBLIC_DATA_DIR, 'foresight.json'),
    cal
      ? { pace: cal.pace, gapDays: cal.gapDays, windowSteps: cal.windowSteps, anchorJp: cal.anchorJp, anchorGlobal: cal.anchorGlobal, dataVersion: DATA_VERSION }
      : { cal: null, dataVersion: DATA_VERSION },
  );
```

(Confirm `Calibration` field names against `src/core/foresight.ts` — `pace`, `gapDays`, `anchorJp`, `anchorGlobal`, `windowSteps`.) Run `pnpm data:build`; verify `public/data/foresight.json` exists with pace ≈ 1.3, gapDays ≈ 1441.

- [ ] **Step 5: Load in gameData** — in `loadDatasets` (`src/features/data/gameData.ts` ~128), add alongside the `umas` optional-fetch pattern:

```ts
  const foresight: ForesightInfo | null = await fetchJson<ForesightInfo & { cal?: null }>('foresight.json')
    .then((f) => ('cal' in f && f.cal === null ? null : f))
    .catch(() => null);
```

Thread `foresight` through `Datasets`/`GameData` as an optional field (mirror `timeline`).

- [ ] **Step 6: Full gate + commit**

Run: `pnpm vitest run scripts/outputs.test.ts && pnpm typecheck` → PASS.

```bash
git add src/core/types.ts scripts/build-all.ts scripts/outputs.test.ts src/features/data/gameData.ts public/data/foresight.json
git commit -m "feat(horizon): bake foresight.json calibration + load in gameData"
```

---

### Task 4: HorizonControl + banner + TierChip (UI foundations)

**Files:**
- Create: `src/app/HorizonControl.tsx` (control + banner), `src/app/TierChip.tsx`
- Modify: `src/app/App.tsx` (mount control in the header title row; banner strip below header), `src/styles/app.css` (chip/banner/control styles)
- Test: `src/app/HorizonControl.test.tsx`

**Interfaces:**
- Consumes: `useAvailability()` (Task 2), `useGameData().foresight` (Task 3).
- Produces: `<HorizonControl />` (self-contained, reads the hook); `<TierChip tier={AvailabilityTier} />` (renders nothing for `'now'`, an amber `upcoming` chip, a violet `future` chip — reuse design-system chip tokens).

- [ ] **Step 1: Write the failing tests** `src/app/HorizonControl.test.tsx` — mock `useAvailability` (controllable horizon + `futureCms` fixture + `setHorizon` spy) and `useGameData` (foresight `{pace:1.327, gapDays:1441, windowSteps:6}`):

```tsx
it('renders Current | CM | All JP and switches', async () => {
  // click "All JP" → setHorizon({kind:'allJp'})
});
it('CM segment opens the future-CM dropdown and picks one', async () => {
  // click CM segment → options "16 Leo Cup ~2026-07-30" … ; pick 17 → setHorizon({kind:'cm', cmNumber:17})
});
it('foresight tooltip carries pace and gap', () => {
  // the info element's title/aria contains "1441" and "1.33"
});
it('allJp shows the hypothetical banner naming the plan CM', () => {
  // horizon {kind:'allJp'} → banner text matches /Hypothetical .* not achievable/
});
```

- [ ] **Step 2: Run to verify it fails** — FAIL (module missing).

- [ ] **Step 3: Implement.**
  - `TierChip.tsx`: `export function TierChip({ tier }: { tier: AvailabilityTier }) { if (tier === 'now') return null; return <span className={`tier-chip tier-${tier}`}>{tier}</span>; }`
  - `HorizonControl.tsx`: a `ds-seg ds-miniseg` group (ThemeToggle pattern) with three buttons — `Current`, the CM segment (label = chosen CM's short title + `~date` when predicted; clicking opens a small dropdown `<ul>` of `futureCms`, dismiss-on-outside via the shared `useDismissOnOutside` helper), `All JP`. An adjacent `?` span with `title` = the foresight sentence built from `foresight` (fallback copy when `foresight` is null: "projection unavailable — too few shared CMs"). Export also `HorizonBanner` (or render it from the same file): when `horizon.kind === 'allJp'`, a `role="alert"` strip: `Hypothetical horizon — includes JP content not achievable by {planCm title/date}; results are for scouting, not this CM.`
  - `App.tsx`: render `<HorizonControl />` in the `app-title-row` (next to `SettingsMenu`), and the banner strip directly under `<header>` (alongside the existing fixture-data banner slot).
  - CSS: `.tier-chip` (small, rounded, `--warn*`-family amber for upcoming; violet for future), `.horizon-banner` (accent border, visible in both themes), dropdown styles scoped `.horizon-menu`.

- [ ] **Step 4: Run to verify** — `pnpm vitest run src/app/HorizonControl.test.tsx` → PASS.

- [ ] **Step 5: Typecheck + commit**

```bash
pnpm typecheck
git add src/app/HorizonControl.tsx src/app/TierChip.tsx src/app/HorizonControl.test.tsx src/app/App.tsx src/styles/app.css
git commit -m "feat(horizon): header horizon control + hypothetical banner + tier chips"
```

---

### Task 5: Rewire the two skill charts

**Files:**
- Modify: `src/features/cm-planner/SkillChartPanel.tsx`, `src/features/cm-planner/AccelChartPanel.tsx`
- Test: `src/features/cm-planner/SkillChartPanel.test.tsx`, `src/features/cm-planner/AccelChartPanel.test.tsx` (extend)

**Interfaces:** Consumes `useAvailability()` (`visible`, `tierOf`) + `TierChip`.

- [ ] **Step 1: Write the failing tests.** In each chart's test file, mock `@/app/useAvailability` with a controllable horizon fixture (helper: a mutable `mockAvail` object the mock returns; default = current-horizon behavior `visible = (r) => r.server === 'global'`). Tests per chart:

```tsx
it('current horizon: JP skills absent (behavior preservation)', () => { /* default mock; assert JP name not in document */ });
it('cm horizon reveals upcoming with a tier chip; future stays hidden', () => { /* mockAvail.visible reveals releaseDate<=cutoff; assert chip text "upcoming" */ });
it('allJp reveals future rows tagged future', () => {});
```

- [ ] **Step 2: Run to verify they fail.**

- [ ] **Step 3: Implement (identically in both files):**
  - Delete: the `showUpcoming` state, the `cmNumber`/`cmEntry`/`asOfISO` derivation, the `isReleasedBy` import + the `plan.server === 'global' && isReleasedBy(...)` reps clause, the view filter `if (!showUpcoming && v.skill.server === 'jp') return false;`, and the `show upcoming` checkbox from the toolbar.
  - Add: `const { visible, tierOf } = useAvailability();` — the candidate/reps memo filters with `visible(s)` (JP reps: `(s) => s.server === 'jp' && s.rarity === r && visible(s)` — keep the rarity-family logic); include `visible` in the memo deps. In the row `<li>`, next to the existing `~date` badge: `<TierChip tier={tierOf(v.skill)} />`.
  - The existing `~date` badge stays; add `title={v.skill.releaseDatePredicted ? 'Projected Global date (foresight pace) — not announced' : 'Announced Global release'}`.

- [ ] **Step 4: Run to verify** both test files pass; re-run once if flaky.

- [ ] **Step 5: Typecheck + commit**

```bash
pnpm typecheck
git add src/features/cm-planner/SkillChartPanel.tsx src/features/cm-planner/AccelChartPanel.tsx src/features/cm-planner/SkillChartPanel.test.tsx src/features/cm-planner/AccelChartPanel.test.tsx
git commit -m "feat(horizon): skill + accel charts read the shared horizon (toggles removed)"
```

---

### Task 6: Rewire SkillPicker (+ callers), PlannerSidebar runner search, UmaChartPanel

**Files:**
- Modify: `src/features/skill-planner/SkillPicker.tsx` (remove `asOfISO` prop + local toggle), `src/features/cm-planner/PlannerSidebar.tsx`, `src/features/inheritance/InheritancePage.tsx` (drop the `asOfISO` prop pass), `src/features/cm-planner/UmaChartPanel.tsx`
- Test: `src/features/skill-planner/SkillPicker.test.tsx`, `src/features/cm-planner/PlannerSidebar.test.tsx`, `src/features/cm-planner/UmaChartPanel.test.tsx` (rewrite the gate tests against the hook mock)

**Interfaces:** Consumes `useAvailability()` + `TierChip`. **Breaking internal change:** `SkillPicker` loses `asOfISO?` (all callers in-repo: PlannerSidebar :~1009, InheritancePage :~407 drop the prop; SearchPicker/PlanHeaderPanel were never passing it).

- [ ] **Step 1: Write the failing tests** — same `mockAvail` pattern as Task 5:
  - SkillPicker: current → JP absent + no toggle rendered (the toggle is GONE for good — the horizon control owns it); cm-horizon mock → JP visible with `TierChip`; the two old toggle tests are replaced.
  - PlannerSidebar runner search: current → JP uma absent; cm-horizon mock → present + chip. Delete the old local-toggle test; keep the `useUniqueSkillL` mock.
  - UmaChartPanel: same conversion (the old `show upcoming` toggle test is replaced by hook-driven reveal + Re-run flow — candidates change → stale → Re-run, as the existing test does).

- [ ] **Step 2: Run to verify they fail.**

- [ ] **Step 3: Implement:**
  - `SkillPicker.tsx`: remove the `asOfISO` prop, `showUpcoming` state, `isReleasedBy` import, and the toggle markup; filter clause becomes `visible(s) && s.rarity !== 'unique' && …` via `const { visible, tierOf } = useAvailability();`; row badge gains the announced/projected `title`; add `<TierChip tier={tierOf(skill)} />` in the row. NOTE: SkillPicker is now provider-DEPENDENT (uses the hook) — its tests mock `@/app/useAvailability` instead of passing props; `SearchPicker`/`PlanHeaderPanel` callers are unaffected markup-wise but their tests may need the hook mock (default current = Global-only, matching today).
  - `PlannerSidebar.tsx`: delete its `showUpcoming` state + `cmEntry`/`asOfISO` derivation + toggle markup + `isReleasedBy` import; `globalUmas` memo → `(umas ?? []).filter((u) => visible(u))` with `visible` in deps; result rows get `<TierChip tier={tierOf(uma)} />`; drop `asOfISO={asOfISO}` from its `<SkillPicker>`. (If other code in the file still needs `asOfISO` — check before deleting the derivation; the uma-gate was its only consumer plus the SkillPicker prop.)
  - `InheritancePage.tsx`: drop `asOfISO={asOfISO}` from its wishlist `<SkillPicker>`; keep the derivation ONLY if the support-card pool (Task 7) still consumes it this commit — it does until Task 7, so leave the variable in place (typecheck stays green) and let Task 7 remove it.
  - `UmaChartPanel.tsx`: delete its `showUpcoming`/derivation/toggle/`isReleasedBy`; `globalUmas` → `visible(u)`; keep the `predictedDate` badge; add the tier chip beside it (pass `tier` into `UmaRow` like `predictedDate`).

- [ ] **Step 4: Run to verify** the three test files pass (re-run once if flaky).

- [ ] **Step 5: Typecheck + full suite + commit**

```bash
pnpm typecheck && pnpm test
git add src/features/skill-planner/SkillPicker.tsx src/features/skill-planner/SkillPicker.test.tsx src/features/cm-planner/PlannerSidebar.tsx src/features/cm-planner/PlannerSidebar.test.tsx src/features/cm-planner/UmaChartPanel.tsx src/features/cm-planner/UmaChartPanel.test.tsx src/features/inheritance/InheritancePage.tsx
git commit -m "feat(horizon): pickers + uma chart read the shared horizon (asOfISO prop removed)"
```

---

### Task 7: Rewire the M1 card pool + M4 sourcing index

**Files:**
- Modify: `src/features/inheritance/poolModel.ts` (pure signature change), `src/features/inheritance/SupportCardPoolCard.tsx` (remove checkbox; take the predicate), `src/features/inheritance/InheritancePage.tsx` (pass `visible`/`tierOf`; remove the now-unused `asOfISO` derivation), `src/features/cm-planner/SourcingSection.tsx`
- Test: `src/features/inheritance/poolModel.test.ts`, `src/features/inheritance/SupportCardPoolCard.test.tsx`, `src/features/cm-planner/SourcingSection.test.tsx` (extend)

**Interfaces:**
- `poolModel`: `PoolFilters` loses `showUpcoming`; `filterPool(items, filters, visible: (it: PoolItem) => boolean)` — the availability clause becomes `items.filter(visible)` composed with the other filters. Stays pure/provider-free.
- `SupportCardPoolCard`: new props `visible: (c) => boolean`, `tierOf: (c) => AvailabilityTier` (replacing `asOfISO?`); the `show upcoming` checkbox row is **removed** (spec open-item 3: removed, the horizon control owns it); tiles show `TierChip`.
- `SourcingSection`/`useCardHintIndex`: `(cards ?? []).filter((c) => c.server === 'global')` → `(cards ?? []).filter(visible)` via the hook (this is a component-level hook file — confirm `useCardHintIndex` is a hook inside the component file; if it's pure, take the predicate as an arg).

- [ ] **Step 1: Write the failing tests:**
  - `poolModel.test.ts`: replace `showUpcoming` cases with predicate cases — `filterPool(items, filters, (it) => it.server === 'global')` hides JP; a cm-like predicate reveals the released-by-cutoff item; composition with rarity/search filters unchanged.
  - `SupportCardPoolCard.test.tsx`: current-predicate → JP tile absent + NO `show upcoming` checkbox in the document; upcoming-predicate → tile present + chip.
  - `SourcingSection.test.tsx`: current → upcoming card not listed as a source (today's behavior); cm-horizon mock → the upcoming card IS listed.

- [ ] **Step 2: Run to verify they fail.**

- [ ] **Step 3: Implement** per the interfaces above. `InheritancePage` builds `visible`/`tierOf` once from `useAvailability()` and passes them down; delete its `cmNumber`/`cmEntry`/`asOfISO` derivation (now unused — Task 6 left it for this).

- [ ] **Step 4: Run to verify** the three test files pass.

- [ ] **Step 5: Typecheck + commit**

```bash
pnpm typecheck
git add src/features/inheritance/poolModel.ts src/features/inheritance/poolModel.test.ts src/features/inheritance/SupportCardPoolCard.tsx src/features/inheritance/SupportCardPoolCard.test.tsx src/features/inheritance/InheritancePage.tsx src/features/cm-planner/SourcingSection.tsx src/features/cm-planner/SourcingSection.test.tsx
git commit -m "feat(horizon): card pool + sourcing index read the shared horizon"
```

---

### Task 8: Rewire InheritanceCard + ParentForm (the hard-excludes)

**Files:**
- Modify: `src/features/inheritance/InheritanceCard.tsx` (white options :50, unique options :58, `charaToUma` :69), `src/features/parents/ParentForm.tsx` (uma list :326, white sparks :342, inherited-unique sparks :356)
- Test: `src/features/inheritance/InheritanceCard.test.tsx`, `src/features/parents/ParentForm.test.tsx` (extend; create focused tests if ParentForm has none — check first and match the parents feature's test style)

**Interfaces:** Consumes `useAvailability().visible`. Each `s.server === 'global' && …` / `u.server === 'global' && …` clause becomes `visible(s) && …` / `visible(u) && …` with a one-line comment (`// Planning horizon: availability follows the app-wide lens (current ≡ Global-only).`).

- [ ] **Step 1: Write the failing tests** — mock `@/app/useAvailability`:
  - InheritanceCard: current → JP white + JP unique absent from the captured option lists (this test EXISTS from 2c — convert it to the hook mock); cm-horizon mock → the upcoming JP white appears.
  - ParentForm: current → JP uma/white/inherited-unique absent from the search items; upcoming-predicate → present.
  (These components are provider-free today in tests — if `ParentForm` is rendered without providers, mock the hook module; that keeps them presentational-in-practice.)

- [ ] **Step 2: Run to verify they fail.**

- [ ] **Step 3: Implement** the six clause conversions. `charaToUma` follows the lens too (`visible(u)` — at current identical to the 2b guard).

- [ ] **Step 4: Run to verify + full gate**

Run: `pnpm vitest run src/features/inheritance/InheritanceCard.test.tsx src/features/parents/ParentForm.test.tsx && pnpm typecheck && pnpm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/inheritance/InheritanceCard.tsx src/features/inheritance/InheritanceCard.test.tsx src/features/parents/ParentForm.tsx src/features/parents/ParentForm.test.tsx
git commit -m "feat(horizon): inheritance + parents availability follows the app-wide lens"
```

---

### Task 9: JP inherited-unique emission

**Files:**
- Modify: `scripts/build-skills.ts` (`buildJpSkills` emits `gene_version` inherited records)
- Modify: `scripts/outputs.test.ts` (counts)
- Test: `scripts/build-skills.jp.test.ts` (extend)

**Interfaces:** No signature change — `buildJpSkills` just emits more records.

- [ ] **Step 1: Write the failing test** — extend `scripts/build-skills.jp.test.ts`: give the JP unique fixture a `gene_version`:

```ts
  { id: 100301011, rarity: 5, iconid: 10030, name_en: 'Uma Unique', jpname: 'ユニーク', char: [100301],
    gene_version: { id: 900301, condition_groups: [{ condition: 'phase>=2' }] } },
```

Assert: the output contains `900301` with `rarity: 'inherited_unique'`, `baseSpCost: 0`, `server:'jp'`, the SAME `releaseDate`/`releaseDatePredicted` as its parent `100301011`, `nameEn` = the parent's name, and conditions serialized from the `gene_version.condition_groups`. Also: a unique WITHOUT `gene_version` emits no extra record; a `gene_version` whose id already exists in `masterSkillIds` is skipped.

- [ ] **Step 2: Run to verify it fails.**

- [ ] **Step 3: Implement** — in `buildJpSkills`, after pushing a unique's record (only when `mapGtRarity(gt.rarity)` ∈ {3,4,5,6}-mapped `'unique'` and `gt.gene_version` exists):

```ts
    // Inherited-unique twin: gametora nests it under the native unique's gene_version
    // (same structure buildSkills reads for Global inherited uniques). Dated like its parent.
    if (record.rarity === 'unique' && gt.gene_version) {
      const geneId = String(gt.gene_version.id);
      if (!masterSkillIds.has(geneId)) {
        const geneGroups = gt.loc?.en?.gene_version?.condition_groups ?? gt.gene_version.condition_groups;
        const gene: SkillRecord = {
          skillId: geneId,
          nameEn: record.nameEn,
          nameJp: record.nameJp,
          baseSpCost: 0,
          rarity: 'inherited_unique',
          iconId: record.iconId,
          conditions: geneGroups !== undefined && geneGroups.length > 0 ? serializeConditions(geneGroups) : record.conditions,
          server: 'jp',
          releaseDate: record.releaseDate!,
          dataVersion,
        };
        if (record.releaseDatePredicted) gene.releaseDatePredicted = true;
        records.push(gene);
      }
    }
```

(Note: `releaseDate` is non-undefined here — the parent passed the dated gate. The final sort covers the new records.)

- [ ] **Step 4: Rebuild + update counts.** `pnpm data:build` → log shows the new emitted count. Expect **175** inherited records (verified 2026-07-02: 175 of 561 emitted JP uniques carry `gene_version`, 0 collisions) → totals 1549 → **1724** with jp 962 → **1137**. Update `scripts/outputs.test.ts` (total + jp count; add `jp.filter(s => s.rarity === 'inherited_unique')` length assertion). The id-uniqueness test must stay green.

- [ ] **Step 5: Full gate + commit**

```bash
pnpm typecheck && pnpm test
git add scripts/build-skills.ts scripts/build-skills.jp.test.ts scripts/outputs.test.ts public/data/skills.json
git commit -m "feat(horizon): emit JP inherited-unique skills (gene_version, dated like parent)"
```

---

## Self-Review

**Spec coverage:** Core math (C1→T1); shared state + hook (C2→T2); control/banner/readout (C3→T4); foresight.json (C4→T3); all 13 sites (C5: charts→T5, pickers/uma→T6, pool+sourcing→T7, hard-excludes→T8); tier chips + badge tooltip (C6→T4 component, applied T5–T8); inherited-uniques (C7→T9). Decisions A–F all encoded; deferred items untouched.

**Type consistency:** `PlanningHorizon`/`AvailabilityTier`/`availabilityTier`/`visibleAtHorizon` (T1) match the hook (T2) and every consumer; `visible`/`tierOf` names uniform across T5–T8; `filterPool(items, filters, visible)` consistent between T7's model and card; `ForesightInfo` consistent T3/T4.

**Placeholder scan:** run-to-read values (Task 9's build-log counts — pre-verified 175/1724; Task 8's ParentForm test-file existence; SourcingSection's hook-vs-pure shape) are each called out with how to resolve, not left vague. Task-2 test shapes are specified as assertions to encode against the file's existing mock style — the one intentional degree of freedom, since ActivePlanContext.test.tsx's Dexie mock is the binding pattern.

**Ordering note:** T6 leaves InheritancePage's `asOfISO` derivation in place for T7 to remove (typecheck stays green at every commit). T4 depends on T2+T3; T5–T8 depend on T2+T4; T9 is independent (can run any time).
