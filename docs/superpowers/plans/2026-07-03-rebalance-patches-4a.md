# Rebalance Patches 4a — Data + Preview — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bake versioned rebalance annotations onto skills (AUTO gametora condition-diff candidates + HAND `rebalances.json` curation with foresight-projected arrivals), light up the M3 timeline patch lane, and render Δ badges + a version-timeline readout. **No sim/engine change** (that's 4b).

**Architecture:** Pure version math in `src/core/rebalance.ts`; detection/curation/baking in `scripts/lib/rebalances.ts` wired through `build-all`; `SkillRecord.rebalance` flows to the UI via `SkillSummary`; timeline patch entries ride the existing `buildTimeline` merge.

**Tech Stack:** TypeScript, Vitest, tsx build scripts, React 19. No new deps. No `sim:build`.

## Global Constraints

- **Version-set model (spec decision A):** versions are ver-ascending, each a FULL parameter set (`conditions?`/`modifier?`/`duration?`/`cooldown?` — absent = pin baseline); `globalVer` = confirmed-live; `jpVer` = highest ver.
- **Honesty ladder (C):** AUTO candidates are badge-only (`uncuratedCandidate`, undated, never sim-eligible); curated versions with values REQUIRE `sourceUrl`; predicted arrivals never count as live at Current.
- **Arrival dates:** `globalDate` (announced) wins → `predicted:false`; else foresight-project `jpDate` with the build's existing `cal` → `predicted:true`. Reuse `projectReleaseDate` (`scripts/lib/foresight-build.ts`) — no new date math.
- **Empirical baseline (verified 2026-07-03):** the AUTO diff yields **88** Global-released skills with JP≠Global conditions (29 white / 23 gold / 36 unique); real structural drift (e.g. Focused Mind `10111`: JP `is_last_straight==1…` vs Global `is_finalcorner==1&corner==0…`). No noise filter needed.
- **`rebalances.json` ships EMPTY** (`[]` + schema comment): we have no researched JP patch dates — inventing them violates P3. Tests use fixtures; real entries arrive via the maintainer confirm workflow.
- **Windows case-FS:** component `RebalanceBadge.tsx` / helpers in existing files — no same-name lowercase siblings.
- **Git:** stage only each task's files; never `git add -A/./-u`; one commit per task; trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` via `git commit -F -`.
- **jsdom gotchas (existing):** components calling `useAvailability()` need the static mock in tests; disclosure with `traceContext` needs `useSkillTrace` mocked; ≥2-render files need `afterEach(cleanup)`.

---

### Task 1: Core version math + types

**Files:**
- Create: `src/core/rebalance.ts`
- Modify: `src/core/types.ts` (add `SkillVersion`/`RebalanceInfo` + `SkillRecord.rebalance?`)
- Test: `src/core/rebalance.test.ts`

**Interfaces — Produces (verbatim, later tasks depend on these):**

```ts
// src/core/types.ts (near SkillRecord)
export interface SkillVersion {
  ver: number;
  jpDate?: string;
  /** Announced/confirmed Global date; wins over projection. */
  globalDate?: string;
  /** true when the arrival below was foresight-projected from jpDate. */
  globalDatePredicted?: boolean;
  /** Resolved Global arrival (globalDate ?? projected); absent = undatable. */
  globalArrival?: string;
  conditions?: string;
  modifier?: number;
  duration?: number;
  cooldown?: number;
  note?: string;
  sourceUrl?: string;
}
export interface RebalanceInfo {
  globalVer: number;
  jpVer: number;
  versions: SkillVersion[];
  uncuratedCandidate?: boolean;
  candidateConditions?: { jp: string; global: string };
}
// on SkillRecord:
  /** Versioned rebalance history (availability #4); absent = never rebalanced. */
  rebalance?: RebalanceInfo;
```

```ts
// src/core/rebalance.ts
import type { RebalanceInfo, SkillVersion } from './types';

/** Engine-facing parameter override for 4b (also used by the readout). */
export interface SkillPatch { conditions?: string; modifier?: number; duration?: number; cooldown?: number }

/**
 * Highest version live at the cutoff: arrival ≤ cutoffISO, where a PREDICTED
 * arrival additionally requires cutoffISO > todayISO (never live at Current).
 * Falls back to the confirmed globalVer.
 */
export function effectiveVersion(info: RebalanceInfo, cutoffISO: string, todayISO: string): SkillVersion;

/** The parameter override a version implies; undefined for the baseline (no fields). */
export function versionPatch(v: SkillVersion): SkillPatch | undefined;
```

- [ ] **Step 1: Write the failing tests** `src/core/rebalance.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { effectiveVersion, versionPatch } from './rebalance';
import type { RebalanceInfo } from './types';

const info: RebalanceInfo = {
  globalVer: 1,
  jpVer: 3,
  versions: [
    { ver: 1 },
    { ver: 2, jpDate: '2025-11-20', globalArrival: '2026-08-10', globalDatePredicted: true, conditions: 'corner==2', sourceUrl: 'https://x' },
    { ver: 3, jpDate: '2026-05-10', globalDate: '2026-09-01', globalArrival: '2026-09-01', modifier: 0.25, sourceUrl: 'https://x' },
  ],
};
const today = '2026-07-03';

describe('effectiveVersion', () => {
  it('falls back to globalVer when no version has arrived by the cutoff', () => {
    expect(effectiveVersion(info, today, today).ver).toBe(1); // Current: v2 predicted, v3 not yet
  });
  it('a predicted arrival activates only when the cutoff is beyond today', () => {
    expect(effectiveVersion(info, '2026-08-26', today).ver).toBe(2); // CM horizon past v2's projection
  });
  it('an announced arrival wins at its date; highest live version is picked', () => {
    expect(effectiveVersion(info, '2026-09-01', today).ver).toBe(3);
  });
  it('an announced arrival that already elapsed is live even at Current (pin lag)', () => {
    const lag: RebalanceInfo = { globalVer: 2, jpVer: 2, versions: [
      { ver: 1 }, { ver: 2, globalDate: '2026-06-20', globalArrival: '2026-06-20', modifier: 0.3, sourceUrl: 'https://x' },
    ]};
    expect(effectiveVersion(lag, today, today).ver).toBe(2);
  });
});

describe('versionPatch', () => {
  it('baseline has no patch; parameterized versions surface only their set fields', () => {
    expect(versionPatch(info.versions[0]!)).toBeUndefined();
    expect(versionPatch(info.versions[1]!)).toEqual({ conditions: 'corner==2' });
    expect(versionPatch(info.versions[2]!)).toEqual({ modifier: 0.25 });
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `pnpm vitest run src/core/rebalance.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement.** Add the types to `src/core/types.ts` exactly as above. `src/core/rebalance.ts`:

```ts
/** Availability #4 — versioned skill rebalances: pure version-selection math. */
import type { RebalanceInfo, SkillVersion } from './types';

export interface SkillPatch { conditions?: string; modifier?: number; duration?: number; cooldown?: number }

/** Is this version's Global arrival live at the cutoff? Predicted arrivals are
 *  never live at Current (cutoff === today) — a projection elapsing is still a guess. */
function liveAt(v: SkillVersion, cutoffISO: string, todayISO: string): boolean {
  if (v.globalArrival === undefined) return false;
  if (v.globalArrival > cutoffISO) return false;
  if (v.globalDatePredicted === true && cutoffISO <= todayISO) return false;
  return true;
}

export function effectiveVersion(info: RebalanceInfo, cutoffISO: string, todayISO: string): SkillVersion {
  let best: SkillVersion | undefined;
  for (const v of info.versions) {
    if (v.ver <= info.globalVer || liveAt(v, cutoffISO, todayISO)) {
      if (best === undefined || v.ver > best.ver) best = v;
    }
  }
  return best ?? info.versions[0]!;
}

export function versionPatch(v: SkillVersion): SkillPatch | undefined {
  const patch: SkillPatch = {};
  if (v.conditions !== undefined) patch.conditions = v.conditions;
  if (v.modifier !== undefined) patch.modifier = v.modifier;
  if (v.duration !== undefined) patch.duration = v.duration;
  if (v.cooldown !== undefined) patch.cooldown = v.cooldown;
  return Object.keys(patch).length > 0 ? patch : undefined;
}
```

(Note the `v.ver <= info.globalVer` clause: everything up to the confirmed-live version counts regardless of dates — that IS the pin-lag case when `globalVer ≥ 2`.)

- [ ] **Step 4: Run to verify it passes** — 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/core/types.ts src/core/rebalance.ts src/core/rebalance.test.ts
git commit -m "feat(rebalance): SkillVersion/RebalanceInfo types + effectiveVersion core math"
```

---

### Task 2: Detection + curation + baking (`scripts/lib/rebalances.ts`)

**Files:**
- Create: `scripts/lib/rebalances.ts`, `data-overrides/rebalances.json`
- Test: `scripts/lib/rebalances.test.ts`

**Interfaces:**
- Consumes: Task 1 types; `GtSkill` (`scripts/lib/upstream-types.ts`); `projectReleaseDate` + `Calibration` (`scripts/lib/foresight-build.ts` / `@/core/foresight`).
- Produces:
  ```ts
  /** AUTO feed: Global-released skills whose gametora JP conditions ≠ Global conditions. */
  export function detectCandidates(gametora: GtSkill[], masterSkillIds: ReadonlySet<string>): Map<string, { jp: string; global: string }>;
  /** Load + validate data-overrides/rebalances.json; throws with a precise message on invalid entries (P5: fail loudly). */
  export function loadRebalances(path: string): CuratedRebalance[];
  /** Merge curated entries over auto candidates, resolve arrivals via cal, return skillId → RebalanceInfo. */
  export function bakeRebalances(inputs: { candidates: Map<string, { jp: string; global: string }>; curated: CuratedRebalance[]; cal: Calibration | null }): Map<string, RebalanceInfo>;
  export interface CuratedRebalance { skillId: string; globalVer: number; versions: Array<Omit<SkillVersion, 'globalArrival' | 'globalDatePredicted'>> }
  ```

- [ ] **Step 1: Write the failing tests** `scripts/lib/rebalances.test.ts` — cover:
  - `detectCandidates`: differs → in map with both strings; identical / missing `loc.en` / not-in-master (JP-only) → absent. Use minimal `GtSkill` fixtures with `condition_groups` + `loc.en.condition_groups` (serialize = join non-empty `condition` fields with `@`, matching `build-skills.ts`'s `serializeConditions` — reimplement the tiny serializer locally or export it; prefer a local copy to avoid coupling).
  - Validation (`loadRebalances` via a temp file or an exported `validateRebalances(entries)` — implementer's choice, but invalid input MUST throw): non-ascending vers; duplicate vers; `globalVer` not in versions; a ver ≥ 2 with value fields (`modifier`/`duration`/`cooldown`) but no `sourceUrl`; ver 1 carrying parameters (baseline must be empty).
  - `bakeRebalances`: curated entry → arrivals resolved (`globalDate` wins `predicted:false`; `jpDate`-only projects `predicted:true` via `cal`; neither → no `globalArrival`); `jpVer` = max ver; a curated skillId ABSORBS its auto candidate (no `uncuratedCandidate` flag); an un-curated candidate → `RebalanceInfo` with `globalVer:1, jpVer:1, versions:[{ver:1}], uncuratedCandidate:true, candidateConditions`; `cal:null` → curated `jpDate`-only versions get no arrival (undatable, still displayed).

  (Write these as real executable tests with fixtures — the assertions above are the required coverage.)

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement** `scripts/lib/rebalances.ts` per the interfaces (mirror `foresight-build.ts`'s style: thin, pure, node-only file I/O isolated in `loadRebalances`). Create `data-overrides/rebalances.json`:

```jsonc
[]
```

plus a sibling comment header — JSON has no comments, so put the schema documentation in `data-overrides/README.md` if one exists (check), else as a `docs/data-refresh-runbook.md` addition in Task 6; the file itself ships as `[]`.

- [ ] **Step 4: Run to verify green.**

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/rebalances.ts scripts/lib/rebalances.test.ts data-overrides/rebalances.json
git commit -m "feat(rebalance): auto condition-diff candidates + curated rebalances loader/baker"
```

---

### Task 3: Build wiring + timeline patch lane

**Files:**
- Modify: `scripts/build-all.ts` (bake onto skills; pass patch entries to the timeline), `scripts/build-timeline.ts` (accept extra entries), `scripts/outputs.test.ts`
- Test: `scripts/build-timeline.test.ts` (extend if exists — check; else assert via outputs)

**Interfaces:**
- Consumes: Task 2's three functions; build-all's `cal` (line ~109), `skills` (`let`, line ~58), `buildTimeline({...})` call (line ~188).
- Produces: `buildTimeline` gains an optional `extraEntries?: TimelineEntry[]` input (merged before the final sort); `skills.json` records carry `rebalance`; `timeline.json` carries `type:'patch'` entries for dated curated versions.

- [ ] **Step 1: Wire the bake** in `scripts/build-all.ts` — after the JP-skill merge (so annotations land on the final `skills` array), before the writes:

```ts
import { bakeRebalances, detectCandidates, loadRebalances } from './lib/rebalances';
// …
const rebalanceMap = bakeRebalances({
  candidates: detectCandidates(gametoraSkills, releasedSkillIds),   // reuse the gametora skills array already read for buildSkills — hoist it to a const if still inline
  curated: loadRebalances(join(OVERRIDES_DIR, 'rebalances.json')),
  cal,
});
skills = skills.map((s) => {
  const info = rebalanceMap.get(s.skillId);
  return info ? { ...s, rebalance: info } : s;
});
console.log(`rebalances: ${rebalanceMap.size} annotated (${[...rebalanceMap.values()].filter((r) => r.uncuratedCandidate).length} uncurated candidates)`);
```

- [ ] **Step 2: Timeline patch entries.** Extend `buildTimeline`'s inputs with `extraEntries?: TimelineEntry[]` (concat into the merged list before sorting). In build-all, for each curated (non-candidate) version with a `globalArrival`, emit:

```ts
{
  id: `patch-${skillId}-v${v.ver}`,
  type: 'patch',
  title: `Skill rebalance: ${skillName} v${v.ver}`,
  dates: { start: v.globalArrival },
  tier: v.globalDatePredicted ? 'prediction' : 'official',
  status: v.globalDatePredicted ? 'unconfirmed' : 'confirmed',
  source: { kind: 'community', url: v.sourceUrl ?? '' },
  server: 'global',
  dataVersion: DATA_VERSION,
}
```

(CHECK the real `TimelineEntry` field values against `src/core/types.ts` + how `build-timeline.ts` stamps `tier`/`status`/`source` on existing entries — match its exact vocabulary, don't invent enum values. Uncurated candidates emit NO timeline entry.)

- [ ] **Step 3: Failing test first** — extend `scripts/outputs.test.ts` (and `build-timeline`'s own test if one exists): with `rebalances.json` empty, assert skills.json has exactly **88** `rebalance.uncuratedCandidate` records and 0 curated ones, and timeline has 0 patch entries; unit-test the `extraEntries` merge in buildTimeline with a fixture entry. Run → fail → wire → `pnpm data:build` → verify the log (`rebalances: 88 annotated (88 uncurated candidates)`) → tests green. If the real count differs from 88, use the real number.

- [ ] **Step 4: Full gate** — `pnpm typecheck && pnpm test`.

- [ ] **Step 5: Commit**

```bash
git add scripts/build-all.ts scripts/build-timeline.ts scripts/outputs.test.ts public/data/skills.json public/data/timeline.json scripts/lib/rebalances.ts
git commit -m "feat(rebalance): bake annotations into skills.json + timeline patch lane wiring"
```

(`rebalances.ts` only if Step 2 required signature tweaks; timeline.json only if its bytes changed — with an empty rebalances.json it may not.)

---

### Task 4: Δ rebalance badge (rows)

**Files:**
- Create: `src/app/RebalanceBadge.tsx`
- Modify: `src/features/cm-planner/skillTechnicalDetails.ts` (`SkillSummary` + `skillRecordToSummary` gain `rebalance?`), `src/features/cm-planner/SkillChartPanel.tsx`, `src/features/cm-planner/AccelChartPanel.tsx`, `src/features/skill-planner/SkillPicker.tsx`, `src/styles/app.css`
- Test: `src/app/RebalanceBadge.test.tsx` + one badge assertion in `SkillChartPanel.test.tsx`

**Interfaces:**
- Consumes: `RebalanceInfo` (Task 1); rows' `v.skill` / `skill` records (which now carry `rebalance?`).
- Produces: `<RebalanceBadge info={RebalanceInfo | undefined} />` — renders nothing when `info` is undefined; `Δ?` (title: "JP conditions differ — not yet curated") for `uncuratedCandidate`; `Δv{jpVer} ~{arrival}` (title: version + note) for curated with a dated latest version; `Δv{jpVer}` when undated.

- [ ] **Step 1: Failing tests** — `RebalanceBadge.test.tsx`: undefined → null; candidate → `Δ?`; curated dated → `Δv2 ~2026-08-10`; curated undated → `Δv2`. Chart test: a skill fixture with `rebalance` shows the badge, one without doesn't.
- [ ] **Step 2:** Run → fail.
- [ ] **Step 3: Implement.** `RebalanceBadge` (small span, amber-family `.rebalance-badge` class using `--warn*` tokens; `title` carries the explanation). Thread `rebalance: skill.rebalance` through `skillRecordToSummary` + the `SkillSummary` interface (optional — all constructors elsewhere stay valid). Render `<RebalanceBadge info={v.skill.rebalance} />` next to `<TierChip …/>` in both chart rows and the picker row.
- [ ] **Step 4:** Run the three test files + `pnpm typecheck` → green.
- [ ] **Step 5: Commit**

```bash
git add src/app/RebalanceBadge.tsx src/app/RebalanceBadge.test.tsx src/features/cm-planner/skillTechnicalDetails.ts src/features/cm-planner/SkillChartPanel.tsx src/features/cm-planner/SkillChartPanel.test.tsx src/features/cm-planner/AccelChartPanel.tsx src/features/skill-planner/SkillPicker.tsx src/styles/app.css
git commit -m "feat(rebalance): Δ badge on skill rows (charts + picker)"
```

---

### Task 5: "Rebalance history" readout in SkillDetailDisclosure

**Files:**
- Modify: `src/features/cm-planner/SkillDetailDisclosure.tsx` (+ its CSS home)
- Test: `src/features/cm-planner/SkillDetailDisclosure.test.tsx` (extend; check the file exists — if disclosure tests live inside consumers' tests, add a focused new file with the required mocks)

**Interfaces:** Consumes `SkillSummary.rebalance` (Task 4).

- [ ] **Step 1: Failing test** — render the disclosure (open) with a curated 3-version fixture: assert the section title "Rebalance history", a row per version (v1 "Global (live)" marker per `globalVer`, v2 `~date` predicted mark, v3 announced date), parameter lines (conditions string / `modifier 0.25`), note + source link (`rel="noreferrer"`); with only `uncuratedCandidate`: assert the candidate copy ("JP conditions differ — not yet curated") + both condition strings; without `rebalance`: section absent. Respect the jsdom gotchas (no `traceContext` needed here).
- [ ] **Step 2:** Run → fail.
- [ ] **Step 3: Implement** — a new `<section className="cmp-rebalance">` rendered when `skill.rebalance` is set, placed AFTER the existing alternatives/effect sections and BEFORE the `SkillTraceSection` block (~line 458). Version list ver-ascending: `v{ver}` + (`Global (live)` when `ver === globalVer`) + arrival (`✓ date` announced / `~date` predicted / `date unknown`) + parameter chips + note + source link. Candidate state renders the JP/Global condition pair in a two-line mono block. Minimal CSS (muted, compact — mirror `cmp-alt` styling).
- [ ] **Step 4:** Run + typecheck → green. Full `pnpm test`.
- [ ] **Step 5: Commit**

```bash
git add src/features/cm-planner/SkillDetailDisclosure.tsx <its test file> <css file if touched>
git commit -m "feat(rebalance): version-timeline readout in the skill detail"
```

---

### Task 6: User version pin — `WishlistItem.skillVer` + sidebar picker

**Files:**
- Modify: `src/core/types.ts` (`WishlistItem.skillVer?: number`), `src/db/exportImport.ts` (round-trip the field IF the validator whitelists — read `src/db/exportImport.ts:356-365` first: if the validated wishlist item is reconstructed field-by-field, add `skillVer` with a finite-number check; if the record passes through, only add an optional-type validation), `src/features/cm-planner/PlannerSidebar.tsx` (version picker on wishlist plates), `src/core/rebalance.ts` (one helper)
- Test: `src/core/rebalance.test.ts` (extend), `src/features/cm-planner/PlannerSidebar.test.tsx` (extend), `src/db/exportImport.test.ts` (round-trip case)

**Interfaces:**
- Consumes: Task 1's `effectiveVersion`; Task 4's `SkillSummary.rebalance`.
- Produces:
  ```ts
  // types.ts — on WishlistItem:
  /** User-pinned rebalance version (availability #4); absent = horizon default. */
  skillVer?: number;
  // rebalance.ts:
  /** Version resolution everywhere: the user's pin wins; else the horizon default. */
  export function resolveVersion(info: RebalanceInfo, pinned: number | undefined, cutoffISO: string, todayISO: string): SkillVersion;
  ```

- [ ] **Step 1: Failing tests.** `rebalance.test.ts`: `resolveVersion` — pinned valid ver returned even when not horizon-live (the whole point: sim the imminent patch early); pinned unknown ver → falls back to default; undefined pin → `effectiveVersion` result. `PlannerSidebar.test.tsx`: a wishlist skill WITH `rebalance` (2+ versions) shows a version picker on its plate (`aria-label` like `Rebalance version for {name}`); picking `v2` calls the plan update with `skillVer: 2` on that item; picking the default clears the field (`skillVer` removed — keep plans clean); a plate whose skill has NO `rebalance` shows no picker. (Keep the existing `useUniqueSkillL` + `useAvailability` mocks; extend the hoisted skill fixture with a `rebalance` info.) `exportImport.test.ts`: a plan whose wishlist item carries `skillVer: 2` survives export → import.
- [ ] **Step 2:** Run → fail.
- [ ] **Step 3: Implement.** `resolveVersion` (tiny: `info.versions.find(v => v.ver === pinned) ?? effectiveVersion(info, cutoffISO, todayISO)`). Sidebar: on each wishlist plate whose `skill.rebalance` exists, a compact `v⌄` select in the plate's `side` area (NEXT TO the existing controls — mirror how the unique-level stepper occupies `side` on the unique plate; wishlist plates may not use `side` today — place the select in the same row as the plate's remove/priority controls, matching the sidebar's control grammar). Options: each version (`v1 (Global)`, `v2 ~2026-08-10`, …) with the DEFAULT annotated; value = `item.skillVer ?? default`; non-default pin gets an accent ring/class `is-pinned` + title "Pinned — sims will use v{N} parameters (4b)". Update via the sidebar's existing wishlist-mutation path (`onChange({...plan, wishlist: …})` — grep how priority edits mutate items and mirror it).
- [ ] **Step 4:** Run the three test files + `pnpm typecheck && pnpm test` → green.
- [ ] **Step 5: Commit**

```bash
git add src/core/types.ts src/core/rebalance.ts src/core/rebalance.test.ts src/db/exportImport.ts src/db/exportImport.test.ts src/features/cm-planner/PlannerSidebar.tsx src/features/cm-planner/PlannerSidebar.test.tsx
git commit -m "feat(rebalance): user-pinned skill versions on the plan (WishlistItem.skillVer + sidebar picker)"
```

---

### Task 7: Docs — confirm workflow + runbook

**Files:**
- Modify: `.claude/skills/confirm-timeline/SKILL.md` (add the rebalance-confirmation flow), `docs/data-refresh-runbook.md` (a "record a skill rebalance" section incl. the `rebalances.json` schema + the ver≥2-values-need-sourceUrl rule + the full-`data:build` rebuild rule)

- [ ] **Step 1:** Read both files; add: (a) runbook section — schema example (the spec's JSON block), the honesty ladder, "flip `globalVer` + set `globalDate` when Global patch notes land, then FULL `pnpm data:build` (arrivals re-project on the shared calibration clock)"; (b) confirm-timeline SKILL.md — a "Rebalance confirmations" subsection mirroring the CM-confirmation flow.
- [ ] **Step 2:** Commit

```bash
git add .claude/skills/confirm-timeline/SKILL.md docs/data-refresh-runbook.md
git commit -m "docs(rebalance): curation schema + confirmation workflow (runbook + confirm-timeline skill)"
```

---

## Self-Review

**Spec coverage (4a):** model+math (A/D → T1); AUTO+HAND feeds, validation, projection (B/C → T2); bake + patch lane (components 1–3 → T3); badge (component 4 → T4); readout (component 4 → T5); user version pin (H → T6: `WishlistItem.skillVer` + `resolveVersion` + sidebar picker + import round-trip); confirm workflow docs (E/component 5 → T7). 4b (components 6–8) intentionally excluded — own plan; it consumes `resolveVersion(info, item.skillVer, …)`.
**Type consistency:** `SkillVersion.globalArrival` resolved at bake-time (T2) and consumed by `effectiveVersion` (T1) + the badge/readout (T4/T5); `CuratedRebalance` omits the two resolved fields; `SkillSummary.rebalance` threading named identically in T4/T5.
**Placeholder scan:** empirical values pinned (88 candidates, verified); run-to-read items called out with how-to (TimelineEntry vocabulary check in T3; disclosure-test file existence in T5; README existence in T2). Test shapes without full code (T2/T4/T5) specify the exact required assertions against verified file structures.
