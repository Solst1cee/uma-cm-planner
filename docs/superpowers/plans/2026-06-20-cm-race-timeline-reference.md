# CM Race → Timeline Reference Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the timeline the single SSOT for the CM race chooser/default/conditions, and redesign `CmPlan.cmRef` into a discriminated reference (`cm` = derive from timeline | `custom` = self-contained), collapsing `CmPlannerPage`'s dual race state into one.

**Architecture:** Two phases. **Phase 1** (additive, always green) adds the new data + pure core + standalone new `CmRef` union, touching no existing consumer. **Phase 2** (the coordinated switch) flips `CmPlan.cmRef` to the union and updates every consumer together (types, Dexie migration, import, single-state UI, `PRESETS` deletion) — green only at the end of the switch tasks.

**Tech Stack:** TypeScript + Vite + React 19, pnpm, Vitest (jsdom), Dexie. Path alias `@/*` → `src/*`. Spec: [docs/superpowers/specs/2026-06-20-cm-race-timeline-reference-design.md](../specs/2026-06-20-cm-race-timeline-reference-design.md).

## Global Constraints

- **`cmRef` is `{ kind:'cm'; cmId; cmNumber } | { kind:'custom'; courseId; surface; distance; ground; weather; season }`.** A CM race stores only the reference; a custom race is self-contained. Editing any track/condition field of a CM race flips it to `custom`.
- **Conditions = `{ ground, weather, season }`** only. `Ground = 'firm'|'good'|'soft'|'heavy'`, `Weather='sunny'|'cloudy'|'rainy'|'snowy'`, `Season='spring'|'summer'|'fall'|'winter'`. No time-of-day.
- **`cm` vs `custom` classification rule (shared by migration + import):** a legacy/flat `cmRef` with `cmNumber > 0` → `{kind:'cm', cmId, cmNumber}` (drop the embedded track); `cmNumber === 0` (or `cmId === 'CM0'`) → `{kind:'custom', …}` from its fields (old `condition` → new `ground`).
- **Dropdown lists every timeline CM entry with a `courseId`, recent-first by date.**
- **P6** pure core (no React) under `src/core/`, unit-tested. **P5** generated `public/data/` never hand-edited; timeline conditions go in `data-overrides/timeline_overrides.json`. **P3** uncurated conditions render as assumed defaults.
- **Engine/sim is NOT wired to conditions** (`SimRaceParams` stays `{courseId}`) — out of scope.
- **Sequencing:** this lands on a CLEAN base — the current uncommitted M4 WIP (`CmPlannerPage.test.tsx`, `PlanInventoryCard.tsx`, `cm-planner.css`) must be committed first. Phase 2 UI tasks re-anchor against the then-current files.
- **Commits:** file-scoped `git add` of only the task's files (the tree carries unrelated work); end each commit body with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- **Gates:** `pnpm typecheck` + `pnpm test` + `pnpm build` green per task. Re-run a flaky UI test file once (dev-server/Vitest HMR race).

---

## PHASE 1 — additive foundations (each task green on its own)

### Task 1: `raceConditions.ts` core module

**Files:**
- Create: `src/core/raceConditions.ts`
- Test: `src/core/raceConditions.test.ts`

**Interfaces:**
- Produces: `Ground`, `Weather`, `Season` types; `RaceConditions = { ground; weather; season }`; `defaultConditions(finalsISO: string | undefined): RaceConditions`.

- [ ] **Step 1: Write the failing test** `src/core/raceConditions.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { defaultConditions } from './raceConditions';

describe('defaultConditions', () => {
  it('derives season from the CM month and defaults ground/weather', () => {
    expect(defaultConditions('2026-07-15')).toEqual({ ground: 'good', weather: 'sunny', season: 'summer' });
    expect(defaultConditions('2026-01-15').season).toBe('winter');
    expect(defaultConditions('2026-04-15').season).toBe('spring');
    expect(defaultConditions('2026-10-15').season).toBe('fall');
  });
  it('falls back to spring when the date is missing/unparseable', () => {
    expect(defaultConditions(undefined)).toEqual({ ground: 'good', weather: 'sunny', season: 'spring' });
    expect(defaultConditions('').season).toBe('spring');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run src/core/raceConditions.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** `src/core/raceConditions.ts`:
```ts
/** Race conditions the planner models (ground/weather/season). Time-of-day is not modeled. */
export type Ground = 'firm' | 'good' | 'soft' | 'heavy';
export type Weather = 'sunny' | 'cloudy' | 'rainy' | 'snowy';
export type Season = 'spring' | 'summer' | 'fall' | 'winter';

export interface RaceConditions {
  ground: Ground;
  weather: Weather;
  season: Season;
}

/** Northern-hemisphere season from a 1-based month. */
function seasonForMonth(month: number): Season {
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'fall';
  return 'winter';
}

/**
 * Assumed conditions for a CM with none curated (P3): season from the finals
 * month, default good/sunny. Editable in the chooser; flaggable as assumed.
 */
export function defaultConditions(finalsISO: string | undefined): RaceConditions {
  const m = finalsISO && /^\d{4}-(\d{2})-/.test(finalsISO) ? Number(finalsISO.slice(5, 7)) : NaN;
  return { ground: 'good', weather: 'sunny', season: Number.isNaN(m) ? 'spring' : seasonForMonth(m) };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run src/core/raceConditions.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/core/raceConditions.ts src/core/raceConditions.test.ts
git commit -m "feat(core): raceConditions types + defaultConditions"
```

---

### Task 2: Timeline conditions — type + curated data

**Files:**
- Modify: `src/core/types.ts` (the `TimelineEntry.cm` shape)
- Modify: `data-overrides/timeline_overrides.json` (CM15 conditions; promote CM16)
- Modify: `src/core/timeline.test.ts` (assert conditions flow through `mergeTimeline`)

**Interfaces:**
- Consumes: `Ground`/`Weather`/`Season` from `@/core/raceConditions` (Task 1).
- Produces: `TimelineEntry.cm.conditions?: RaceConditions`.

- [ ] **Step 1: Add the type.** In `src/core/types.ts`, add `import type { RaceConditions } from './raceConditions';` and extend the `cm` shape on `TimelineEntry` (currently `cm?: { cmNumber?: number; courseId?: string; trackSummary?: string }`) with `conditions?: RaceConditions`.

- [ ] **Step 2: Write the failing test.** In `src/core/timeline.test.ts`, add:
```ts
it('carries cm.conditions through mergeTimeline overrides', () => {
  const base: TimelineEntry[] = [{ id: 'cm15', type: 'cm', title: 'Cancer Cup',
    dates: { finals: '2026-06-24' }, cm: { cmNumber: 15, courseId: '10906' },
    tier: 'official', status: 'confirmed', source: { kind: 'official_news', url: '' },
    server: 'global', dataVersion: 'x' }];
  const merged = mergeTimeline(base, [{ id: 'cm15', cm: { conditions: { ground: 'good', weather: 'cloudy', season: 'summer' } } }]);
  expect(merged[0]?.cm?.conditions).toEqual({ ground: 'good', weather: 'cloudy', season: 'summer' });
  expect(merged[0]?.cm?.courseId).toBe('10906'); // unrelated cm fields preserved by the deep merge
});
```

- [ ] **Step 3: Run to verify it fails / passes.** `mergeTimeline` already deep-merges `cm`, so this should PASS once the type compiles.

Run: `pnpm vitest run src/core/timeline.test.ts && pnpm typecheck`
Expected: PASS. (If the merge does NOT preserve sibling `cm` fields, fix `patchEntry` in `src/core/timeline.ts` to spread `cm` — but it already does `cm: patch.cm ? { ...base.cm, ...patch.cm } : base.cm`.)

- [ ] **Step 4: Curate the data.** In `data-overrides/timeline_overrides.json`, on the existing `cm15-cancer-cup` entry add `"conditions": { "ground": "good", "weather": "cloudy", "season": "summer" }` inside its `cm` object. Add a new CM16 entry (promoting the predicted Leo Cup to track-known):
```json
{
  "id": "cm16-leo-cup",
  "type": "cm",
  "title": "Leo Cup",
  "dates": { "finals": "2026-07-30" },
  "cm": { "cmNumber": 16, "courseId": "10501", "trackSummary": "Nakayama turf 1200m (sprint)",
          "conditions": { "ground": "firm", "weather": "sunny", "season": "summer" } },
  "tier": "prediction", "status": "unconfirmed",
  "source": { "kind": "umaguide", "url": "https://uma.guide/cm-schedule/" },
  "server": "global", "dataVersion": "global-76214c82"
}
```
(The CM-schedule synthesis skips any `cmNumber` already present in the merged timeline — "a present CM# is never re-predicted" — so this `cm16` override **automatically suppresses** the synthesized CM16 prediction. After `pnpm data:build`, verify exactly one CM16 entry exists in `public/data/timeline.json`, carrying `courseId 10501`.)

- [ ] **Step 5: Rebuild + verify.**

Run: `pnpm data:build && pnpm vitest run src/core/timeline.test.ts && pnpm build`
Expected: build green; `public/data/timeline.json` shows CM15 with `conditions` and CM16 with `courseId 10501` + `conditions`. Confirm only `public/data/timeline.json` changed under `public/data/`.

- [ ] **Step 6: Commit**
```bash
git add src/core/types.ts src/core/timeline.test.ts data-overrides/timeline_overrides.json public/data/timeline.json
git commit -m "feat(m3): timeline CM conditions + promote CM16 to track-known"
```

---

### Task 3: `CmRefV2` types + `normalizeCmRef` + `cmRaceOptions` (pure core)

Defines the NEW `cmRef` shape as standalone exported types plus the pure data logic — **without yet changing `CmPlan.cmRef`** (that switch is Phase 2). Core stays pure (P6): it imports nothing from `src/features/` or `src/sim/`.

**Files:**
- Modify: `src/core/types.ts` (add `CmRefV2` union + `CmRaceOption`; leave `CmRef`/`CmPlan.cmRef` untouched this task)
- Create: `src/core/cmRace.ts` (`normalizeCmRef`, `cmRaceOptions`)
- Test: `src/core/cmRace.test.ts`

**Interfaces:**
- Consumes: `RaceConditions`/`defaultConditions` (Task 1), `TimelineEntry` + `cm.conditions` (Task 2), `effectiveDate` (`@/core/timeline`), `CmId` (`@/core/types`).
- Produces:
  - `type CmRefV2 = { kind:'cm'; cmId: CmId; cmNumber: number } | { kind:'custom'; courseId: string; surface: 'turf'|'dirt'; distance: number; ground: Ground; weather: Weather; season: Season }`
  - `interface CmRaceOption { cmId: CmId; cmNumber: number; name: string; courseId: string; conditions: RaceConditions }`
  - `normalizeCmRef(raw: unknown): CmRefV2`
  - `cmRaceOptions(entries: TimelineEntry[]): CmRaceOption[]`  (no catalog param — options carry `courseId`; geometry is resolved later, in the feature layer)

- [ ] **Step 1: Add the types.** In `src/core/types.ts` add `CmRefV2` and `CmRaceOption` exactly as in the Interfaces block (import `Ground`/`Weather`/`Season`/`RaceConditions` from `./raceConditions`). Do NOT modify `CmRef` or `CmPlan` yet.

- [ ] **Step 2: Write the failing test** `src/core/cmRace.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import type { TimelineEntry } from './types';
import { normalizeCmRef, cmRaceOptions } from './cmRace';

const entries: TimelineEntry[] = [
  { id: 'cm15', type: 'cm', title: 'Cancer Cup', dates: { finals: '2026-06-24' },
    cm: { cmNumber: 15, courseId: '10906', conditions: { ground: 'good', weather: 'cloudy', season: 'summer' } },
    tier: 'official', status: 'confirmed', source: { kind: 'official_news', url: '' }, server: 'global', dataVersion: 'x' },
  { id: 'cm16', type: 'cm', title: 'Leo Cup', dates: { finals: '2026-07-30' },
    cm: { cmNumber: 16, courseId: '10501' /* no conditions → defaults */ },
    tier: 'prediction', status: 'unconfirmed', source: { kind: 'umaguide', url: '' }, server: 'global', dataVersion: 'x' },
  { id: 'cm17pred', type: 'cm', title: 'Virgo', dates: { finals: '2026-08-30' },
    cm: { cmNumber: 17 /* NO courseId → excluded from options */ },
    tier: 'prediction', status: 'unconfirmed', source: { kind: 'umaguide', url: '' }, server: 'global', dataVersion: 'x' },
];

describe('normalizeCmRef', () => {
  it('classifies a legacy CM ref (cmNumber>0) as kind:cm, dropping the track', () => {
    expect(normalizeCmRef({ cmId: 'CM15', cmNumber: 15, courseId: '10906', surface: 'turf', distance: 2200, condition: 'good', weather: 'cloudy', season: 'summer' }))
      .toEqual({ kind: 'cm', cmId: 'CM15', cmNumber: 15 });
  });
  it('classifies a legacy custom ref (cmNumber 0) as kind:custom, mapping condition→ground', () => {
    expect(normalizeCmRef({ cmId: 'CM0', cmNumber: 0, courseId: '10906', surface: 'turf', distance: 2200, condition: 'soft', weather: 'rainy', season: 'fall' }))
      .toEqual({ kind: 'custom', courseId: '10906', surface: 'turf', distance: 2200, ground: 'soft', weather: 'rainy', season: 'fall' });
  });
  it('passes a new-shape cm ref through unchanged', () => {
    expect(normalizeCmRef({ kind: 'cm', cmId: 'CM15', cmNumber: 15 })).toEqual({ kind: 'cm', cmId: 'CM15', cmNumber: 15 });
  });
});

describe('cmRaceOptions', () => {
  it('lists only courseId entries, recent-first, conditions curated-or-default', () => {
    const opts = cmRaceOptions(entries);
    expect(opts.map((o) => o.cmNumber)).toEqual([16, 15]); // recent-first by finals date; cm17 excluded (no courseId)
    expect(opts.find((o) => o.cmNumber === 15)?.conditions).toEqual({ ground: 'good', weather: 'cloudy', season: 'summer' });
    expect(opts.find((o) => o.cmNumber === 16)?.conditions.season).toBe('summer'); // default from 2026-07
  });
});
```

- [ ] **Step 3: Run to verify it fails.** `pnpm vitest run src/core/cmRace.test.ts` → FAIL (module not found).

- [ ] **Step 4: Implement** `src/core/cmRace.ts` (pure — only `@/core/*` imports):
```ts
/**
 * The CM race reference + the chooser option list (M4). A race is either a
 * reference to a timeline CM (derive track+conditions) or a self-contained
 * custom race. The timeline is the SSOT for CMs; see the 2026-06-20 spec.
 * Pure core: no feature/sim imports. The cmRef↔RaceSelection mappers live in
 * the race-setup feature (they touch RaceSelection + the course catalog).
 */
import type { CmId, CmRaceOption, CmRefV2, TimelineEntry } from './types';
import type { Ground, RaceConditions, Season, Weather } from './raceConditions';
import { defaultConditions } from './raceConditions';
import { effectiveDate } from './timeline';

/** Classify a legacy/flat or new-shape cmRef into the discriminated union. */
export function normalizeCmRef(raw: unknown): CmRefV2 {
  const r = (raw ?? {}) as Record<string, unknown>;
  if (r['kind'] === 'cm') return { kind: 'cm', cmId: r['cmId'] as CmId, cmNumber: Number(r['cmNumber']) };
  if (r['kind'] === 'custom') {
    return { kind: 'custom', courseId: String(r['courseId']), surface: r['surface'] === 'dirt' ? 'dirt' : 'turf',
      distance: Number(r['distance']), ground: r['ground'] as Ground, weather: r['weather'] as Weather, season: r['season'] as Season };
  }
  // legacy flat: cmNumber>0 → cm reference (drop the track); else custom.
  const cmNumber = Number(r['cmNumber'] ?? 0);
  if (cmNumber > 0) return { kind: 'cm', cmId: (r['cmId'] as CmId) ?? (`CM${cmNumber}` as CmId), cmNumber };
  return {
    kind: 'custom', courseId: String(r['courseId'] ?? ''), surface: r['surface'] === 'dirt' ? 'dirt' : 'turf',
    distance: Number(r['distance'] ?? 0),
    ground: (r['ground'] ?? r['condition'] ?? 'good') as Ground, // old name was `condition`
    weather: (r['weather'] ?? 'sunny') as Weather, season: (r['season'] ?? 'spring') as Season,
  };
}

function conditionsFor(e: TimelineEntry): RaceConditions {
  return e.cm?.conditions ?? defaultConditions(e.dates.finals ?? e.dates.start);
}

/** Track-known CMs (entries with a courseId + cmNumber), recent-first by date. */
export function cmRaceOptions(entries: TimelineEntry[]): CmRaceOption[] {
  return entries
    .filter((e) => e.type === 'cm' && e.cm?.courseId && e.cm.cmNumber !== undefined)
    .sort((a, b) => (effectiveDate(a) < effectiveDate(b) ? 1 : effectiveDate(a) > effectiveDate(b) ? -1 : 0)) // recent-first
    .map((e) => ({ cmId: `CM${e.cm!.cmNumber}` as CmId, cmNumber: e.cm!.cmNumber!, name: e.title, courseId: e.cm!.courseId!, conditions: conditionsFor(e) }));
}
```

- [ ] **Step 5: Run to verify it passes.** `pnpm vitest run src/core/cmRace.test.ts && pnpm typecheck`
Expected: PASS (`CmPlan.cmRef` unchanged → typecheck still green).

- [ ] **Step 6: Commit**
```bash
git add src/core/types.ts src/core/cmRace.ts src/core/cmRace.test.ts
git commit -m "feat(core): CmRefV2 union + normalizeCmRef + cmRaceOptions"
```

---

### Task 3b: `cmRef ↔ RaceSelection` mappers (race-setup feature)

The two mappers that bridge a `cmRef` to the Race-setup view. They live in the **feature** layer (they touch `RaceSelection` + `courseToSelection` + the course catalog), keeping core pure. Still Phase 1 (additive, green — nothing yet consumes them).

**Files:**
- Create: `src/features/planner/race-setup/cmRefSelection.ts`
- Test: `src/features/planner/race-setup/cmRefSelection.test.ts`

**Interfaces:**
- Consumes: `CmRefV2`/`CmRaceOption`/`TimelineEntry` (`@/core/types`), `RaceConditions` (`@/core/raceConditions`), `defaultConditions` (`@/core/raceConditions`), `RaceSelection`/`courseToSelection` (`./selection`), `CourseCatalogEntry` (`@/sim/courseCatalog`).
- Produces:
  - `cmRefToSelection(cmRef: CmRefV2, catalog: CourseCatalogEntry[], entries: TimelineEntry[]): RaceSelection`
  - `selectionToCmRef(sel: RaceSelection, options: CmRaceOption[]): CmRefV2`

- [ ] **Step 1: Write the failing test** `src/features/planner/race-setup/cmRefSelection.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import type { TimelineEntry } from '@/core/types';
import type { CourseCatalogEntry } from '@/sim/courseCatalog';
import { cmRaceOptions } from '@/core/cmRace';
import { cmRefToSelection, selectionToCmRef } from './cmRefSelection';

const entries: TimelineEntry[] = [
  { id: 'cm15', type: 'cm', title: 'Cancer Cup', dates: { finals: '2026-06-24' },
    cm: { cmNumber: 15, courseId: '10906', conditions: { ground: 'good', weather: 'cloudy', season: 'summer' } },
    tier: 'official', status: 'confirmed', source: { kind: 'official_news', url: '' }, server: 'global', dataVersion: 'x' },
];
const catalog: CourseCatalogEntry[] = [
  { courseId: '10906', raceTrackId: 10009, surface: 'turf', distance: 2200, distanceClass: 'medium', turn: 1, course: 2 } as CourseCatalogEntry,
];

describe('cmRefToSelection / selectionToCmRef', () => {
  it('derives a CM selection from the timeline + catalog', () => {
    const sel = cmRefToSelection({ kind: 'cm', cmId: 'CM15', cmNumber: 15 }, catalog, entries);
    expect(sel).toMatchObject({ courseId: '10906', distance: 2200, surface: 'turf', ground: 'good', weather: 'cloudy', season: 'summer', presetCmId: 'CM15' });
  });
  it('uses stored fields for a custom ref', () => {
    const sel = cmRefToSelection({ kind: 'custom', courseId: '10906', surface: 'turf', distance: 2200, ground: 'soft', weather: 'rainy', season: 'fall' }, catalog, entries);
    expect(sel).toMatchObject({ courseId: '10906', ground: 'soft', weather: 'rainy', presetCmId: undefined });
  });
  it('round-trips a matched CM selection back to kind:cm', () => {
    const opts = cmRaceOptions(entries);
    const sel = cmRefToSelection({ kind: 'cm', cmId: 'CM15', cmNumber: 15 }, catalog, entries);
    expect(selectionToCmRef(sel, opts)).toEqual({ kind: 'cm', cmId: 'CM15', cmNumber: 15 });
  });
  it('maps an edited (non-matching) selection to kind:custom', () => {
    const opts = cmRaceOptions(entries);
    const sel = cmRefToSelection({ kind: 'cm', cmId: 'CM15', cmNumber: 15 }, catalog, entries);
    const edited = { ...sel, weather: 'rainy' as const }; // diverges from CM15's cloudy
    expect(selectionToCmRef(edited, opts)).toMatchObject({ kind: 'custom', courseId: '10906', weather: 'rainy' });
  });
});
```

- [ ] **Step 2: Run to verify it fails.** `pnpm vitest run src/features/planner/race-setup/cmRefSelection.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement** `src/features/planner/race-setup/cmRefSelection.ts`:
```ts
/**
 * Bridge a CmRefV2 to the Race-setup view (RaceSelection) and back. Lives in the
 * feature layer because it touches RaceSelection + the course catalog; the pure
 * data logic (normalizeCmRef, cmRaceOptions) stays in @/core/cmRace.
 */
import type { CmRaceOption, CmRefV2, TimelineEntry } from '@/core/types';
import type { RaceConditions } from '@/core/raceConditions';
import { defaultConditions } from '@/core/raceConditions';
import type { CourseCatalogEntry } from '@/sim/courseCatalog';
import { courseToSelection, type RaceSelection } from './selection';

function conditionsFor(e: TimelineEntry): RaceConditions {
  return e.cm?.conditions ?? defaultConditions(e.dates.finals ?? e.dates.start);
}

/** Minimal selection when the catalog hasn't resolved a courseId yet (no flicker). */
function fallbackSelection(courseId: string, c: RaceConditions, surface: 'turf' | 'dirt' = 'turf', distance = 0): RaceSelection {
  return { courseId, racetrack: '', surface, distance, distanceClass: '', direction: 'right', inOut: undefined, ...c };
}

/** Derive the Race-setup view from a cmRef. */
export function cmRefToSelection(cmRef: CmRefV2, catalog: CourseCatalogEntry[], entries: TimelineEntry[]): RaceSelection {
  if (cmRef.kind === 'cm') {
    const entry = entries.find((e) => e.type === 'cm' && e.cm?.cmNumber === cmRef.cmNumber && e.cm.courseId);
    const courseId = entry?.cm?.courseId ?? '';
    const conditions = entry ? conditionsFor(entry) : defaultConditions(undefined);
    const course = catalog.find((c) => c.courseId === courseId);
    const sel = course ? courseToSelection(course, conditions) : fallbackSelection(courseId, conditions);
    return { ...sel, presetCmId: cmRef.cmId };
  }
  const course = catalog.find((c) => c.courseId === cmRef.courseId);
  const conditions: RaceConditions = { ground: cmRef.ground, weather: cmRef.weather, season: cmRef.season };
  const sel = course ? courseToSelection(course, conditions) : fallbackSelection(cmRef.courseId, conditions, cmRef.surface, cmRef.distance);
  return { ...sel, presetCmId: undefined };
}

/** Inverse: a selection that exactly matches a CM option → cm ref; else custom. */
export function selectionToCmRef(sel: RaceSelection, options: CmRaceOption[]): CmRefV2 {
  const match = options.find((o) =>
    o.courseId === sel.courseId && o.conditions.ground === sel.ground && o.conditions.weather === sel.weather && o.conditions.season === sel.season);
  if (match) return { kind: 'cm', cmId: match.cmId, cmNumber: match.cmNumber };
  return { kind: 'custom', courseId: sel.courseId, surface: sel.surface, distance: sel.distance, ground: sel.ground, weather: sel.weather, season: sel.season };
}
```
(`courseToSelection`'s `conditions` param is `RaceConditions` = `{ ground, weather, season }`.)

- [ ] **Step 4: Run to verify it passes.** `pnpm vitest run src/features/planner/race-setup/cmRefSelection.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/features/planner/race-setup/cmRefSelection.ts src/features/planner/race-setup/cmRefSelection.test.ts
git commit -m "feat(m4): cmRef↔RaceSelection mappers (feature layer)"
```

---

## PHASE 2 — the coordinated switch (lands after the M4 WIP is committed; re-anchor UI files)

> Phase 2 flips `CmPlan.cmRef` to `CmRefV2` and updates every consumer. The build is **red between Task 4's type change and Task 7's completion** — treat Tasks 4–7 as one landing; run the full gate at the end of Task 7. Re-read each UI/db file before editing (the WIP + merges move line numbers).

### Task 4: Switch `CmPlan.cmRef` + Dexie v4 migration

**Files:**
- Modify: `src/core/types.ts` (`CmPlan.cmRef: CmRefV2`; remove the old flat `CmRef` interface or keep it as `@deprecated` only if something still needs it — prefer delete)
- Modify: `src/db/db.ts` (add `.version(4)` with an `upgrade`)
- Test: `src/db/api.test.ts` (migration test)

**Interfaces:**
- Consumes: `normalizeCmRef` (`@/core/cmRace`), `CmRefV2` (`@/core/types`).

- [ ] **Step 1: Flip the type.** In `src/core/types.ts`, change `CmPlan.cmRef` from `CmRef` to `CmRefV2`. Delete the old flat `CmRef` interface (grep `CmRef\b` first; the only legitimate remaining consumers are updated in Tasks 5–7). Expect the build to go red — that's the point; the following tasks fix every site.

- [ ] **Step 2: Write the failing migration test.** In `src/db/api.test.ts` (or a new `src/db/migration.test.ts` matching the file's style), add a test that opens a v3 db, inserts a plan with a legacy flat `cmRef` (`{ cmId:'CM15', cmNumber:15, courseId:'10906', surface:'turf', distance:2200, condition:'good', weather:'cloudy', season:'summer' }`), re-opens at v4, and asserts the stored plan's `cmRef` is now `{ kind:'cm', cmId:'CM15', cmNumber:15 }`; and a `cmNumber:0` plan becomes `{ kind:'custom', … ground:'…' }`. (Use the file's existing db-reset pattern: `await db.delete(); await db.open();`.)

- [ ] **Step 3: Run to verify it fails.** `pnpm vitest run src/db/api.test.ts` → FAIL (no v4 upgrade).

- [ ] **Step 4: Add the migration.** In `src/db/db.ts`, after the `version(3)` block, add:
```ts
import { normalizeCmRef } from '@/core/cmRace';
// ...
// v4: cmRef → discriminated reference (kind:'cm' | 'custom'). See 2026-06-20 spec.
this.version(4).stores({ cmPlans: 'id, name' }).upgrade(async (tx) => {
  await tx.table('cmPlans').toCollection().modify((plan: { cmRef: unknown }) => {
    plan.cmRef = normalizeCmRef(plan.cmRef);
  });
});
```

- [ ] **Step 5: Run to verify it passes.** `pnpm vitest run src/db/api.test.ts`
Expected: PASS. (Full `pnpm typecheck` still red — consumers fixed in Tasks 5–7. That's expected mid-landing.)

- [ ] **Step 6: Commit**
```bash
git add src/core/types.ts src/db/db.ts src/db/api.test.ts
git commit -m "feat(db): cmRef union on CmPlan + Dexie v4 migration"
```

### Task 5: Import normalization (`exportImport.ts`)

**Files:**
- Modify: `src/db/exportImport.ts` (`parseCmPlan` cmRef validation → accept union + normalize legacy)
- Test: `src/db/exportImport.test.ts`

**Interfaces:**
- Consumes: `normalizeCmRef` (`@/core/cmRace`).

- [ ] **Step 1: Write the failing test.** In `src/db/exportImport.test.ts`, add: importing a plan whose `cmRef` is legacy-flat `{cmId:'CM15',cmNumber:15,courseId:'10906',…}` → the parsed plan's `cmRef` equals `{kind:'cm',cmId:'CM15',cmNumber:15}` (embedded track dropped); a `cmNumber:0` flat ref → `kind:'custom'`; a new-shape `{kind:'cm',…}` passes through. (Match the file's `parsePlanFile`/`parseExportBlobV2` test style.)

- [ ] **Step 2: Run to verify it fails.** `pnpm vitest run src/db/exportImport.test.ts` → FAIL (parseCmPlan still expects flat).

- [ ] **Step 3: Implement.** In `exportImport.ts`, replace the cmRef block in `parseCmPlan` (current lines ~304-312: the `reqString cmId` … `optString season`) with: validate `cmRef` is an object, then set `(row as Rec)['cmRef'] = normalizeCmRef(row['cmRef'])` (import `normalizeCmRef` from `@/core/cmRace`). `normalizeCmRef` both validates-by-coercion and classifies — a `cm`-tagged ref keeps only `{kind,cmId,cmNumber}`, a legacy/custom ref is normalized. Keep the rest of `parseCmPlan` unchanged.

- [ ] **Step 4: Run to verify it passes.** `pnpm vitest run src/db/exportImport.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/db/exportImport.ts src/db/exportImport.test.ts
git commit -m "feat(db): import normalizes cmRef to the union (drops inconsistent CM tracks)"
```

### Task 6: `RaceSetup` dropdown from timeline options

**Files:**
- Modify: `src/features/planner/race-setup/RaceSetup.tsx` (dropdown source: `cmRaceOptions` instead of `PRESETS`)
- Modify: `src/features/planner/race-setup/selection.ts` (drop the `presetToSelection`/`RacePreset` import path as needed; `Ground/Weather/Season` now from `@/core/raceConditions`)
- Test: `src/features/planner/race-setup/RaceSetup.test.tsx` (if present; else add a focused render test)

> **Re-anchor:** re-read `RaceSetup.tsx` before editing — it was last seen importing `PRESETS`, `presetToSelection`, `courseToSelection`, and mapping the dropdown over `PRESETS`. Replace the `PRESETS`-derived list with a `CmRaceOption[]` prop (passed from `CmPlannerPage`, sourced from `cmRaceOptions(timeline)` in `@/core/cmRace`), and replace `matchPreset`/`fieldsFromPreset`/`presetToSelection` with the new mappers from `@/features/planner/race-setup/cmRefSelection` (`cmRefToSelection`/`selectionToCmRef`) + `courseToSelection`. The Track/Surface/Distance/Ground/Weather/Season controls stay as-is.

- [ ] **Step 1: Write/adjust the test** so `RaceSetup` is fed timeline-derived `options` (CM15/CM16) rather than `PRESETS`, and the dropdown renders those CM labels + selecting one emits the right `RaceSelection`.
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** the prop + mapping swap (full re-anchored code written at execution against the current file).
- [ ] **Step 4: Run the RaceSetup test → PASS** + `pnpm typecheck` (still red until Task 7).
- [ ] **Step 5: Commit** `git add src/features/planner/race-setup/RaceSetup.tsx src/features/planner/race-setup/selection.ts src/features/planner/race-setup/RaceSetup.test.tsx` → `refactor(m4): RaceSetup dropdown from timeline CM options`.

### Task 7: `CmPlannerPage` single-state + `makeDefaultPlan(currentCm)` + delete `PRESETS`

**Files:**
- Modify: `src/features/cm-planner/CmPlannerPage.tsx` (derive `selection` from `plan.cmRef`; delete `applyPlanTrackSetup`; `handleRaceChange`/`newDefaultPlan`; auto-apply-track off path)
- Modify: `src/app/ActivePlanContext.tsx` (`makeDefaultPlan(currentCm?)` → cmRef `{kind:'cm',…}`; its 4 call sites pass `useGameData().currentCm`)
- Delete: `src/features/planner/race-setup/presets.ts` (+ update `presets.test.ts` — delete or repoint)
- Test: `src/features/cm-planner/CmPlannerPage.test.tsx`, `src/app/ActivePlanContext.test.tsx`

> **Re-anchor:** re-read both files before editing (they're in the active WIP). The shape of the change is fixed by the spec; the exact lines are not.

- [ ] **Step 1: Write the failing tests** for the three flows: (a) pick a CM → `plan.cmRef` becomes `{kind:'cm',cmNumber}`; (b) New → keeps the current `plan.cmRef`; (c) load a saved plan with auto-apply **on** → its track shows; with auto-apply **off** → the build loads but `plan.cmRef` stays the current race, and Save persists the current race. Plus: `makeDefaultPlan(currentCmEntry)` yields `cmRef.kind==='cm'` with the current CM's number; `makeDefaultPlan()` with no current CM falls back to a `kind:'cm'` of the latest option (or a defined default).
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement:**
  - `CmPlannerPage`: replace `const [selection,setSelection]=useState(...)` with `const options = useMemo(() => cmRaceOptions(timeline ?? []), [timeline])` (from `@/core/cmRace`) and `const selection = useMemo(() => cmRefToSelection(plan.cmRef, courseCatalog, timeline ?? []), [plan.cmRef, courseCatalog, timeline])` (from `@/features/planner/race-setup/cmRefSelection`). `handleRaceChange(next) => setPlan({ ...plan, cmRef: selectionToCmRef(next, options) })`. Delete `applyPlanTrackSetup`. `newDefaultPlan` keeps `plan.cmRef`. Inventory `onSelectPlan`: auto-apply **on** = `selectPlan(id)` only; **off** = capture `current = plan.cmRef`, `await selectPlan(id)`, then `setPlan({ ...activePlanAfterSelect, cmRef: current })`. Pass `options` (or the active CM) into `RaceSetup`.
  - `ActivePlanContext.makeDefaultPlan(currentCm?: TimelineEntry | null)`: `cmRef = currentCm?.cm?.cmNumber != null ? { kind:'cm', cmId:`CM${currentCm.cm.cmNumber}`, cmNumber: currentCm.cm.cmNumber } : <a defined fallback cm option or custom>`. Provider passes `useGameData().currentCm` at the 4 call sites.
  - Delete `presets.ts`; remove all `PRESETS` imports (grep `PRESETS` → zero in `src/`).
- [ ] **Step 4: Run the full gate** `pnpm typecheck && pnpm test && pnpm build` — now GREEN (the landing is complete). Confirm `grep -rn "PRESETS\|presetToSelection\|applyPlanTrackSetup" src` returns nothing stale.
- [ ] **Step 5: Commit** `git add src/features/cm-planner/CmPlannerPage.tsx src/app/ActivePlanContext.tsx src/features/cm-planner/CmPlannerPage.test.tsx src/app/ActivePlanContext.test.tsx` (+ deletion of `presets.ts`/`presets.test.ts`) → `feat(m4): single-state race from cmRef; default from currentCm; retire PRESETS`.

---

## Out of scope

Wiring conditions into the engine/sim; time-of-day; sparse CM-condition overrides; M1/M2/M3 changes; the §3 sourcing toggles.
