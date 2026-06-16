# M4 Uma (Unique-Skill) Chart — Design

> The §1 "Pick runner" chart on the rebuilt `/` page: rank Global umas by **how
> much length (L) their native unique skill adds on the selected track**, as the
> *first* CM-planning step. Runs **only on a Run button**. Reuses the merged
> sidebar's icon / skill-plate / light-theme grammar.

**Date:** 2026-06-16 · **Module:** M4 · **Route:** `/` (`CmPlannerPage`)
**Supersedes** the earlier draft of this file (which assumed per-uma base aptitudes + a runtime `umaCatalog`; both dropped — see "Model" below).

## Goal

Answer *"which uma's unique skill is strongest on this track?"* before any uma /
stats / aptitude / style is chosen. The unique is reserved to its uma, so it's
the thing you decide from first. Selecting a uma commits it (`umaId` +
`uniqueSkillId`) to the active `CmPlan` — the same write the sidebar does.

## Model — grounded in `basinnhyou`

The authoritative blueprint is **`uma-skill-tools/tools/basinnhyou.ts`** (バ身表,
the generator behind the community per-CM skill-ranking sheets;
`spikes/repos/uma-skill-tools/tools/basinnhyou.ts`). Investigation
(2026-06-16, workflow `wf_12928aa1`) established:

- There is **no physics-free / analytic per-skill-L** anywhere in umalator or
  uma-skill-tools. `basinnhyou` computes L the same way umalator does: a
  **seeded paired Monte-Carlo A/B** — run a runner WITHOUT the skill vs a clone
  WITH it on the same seed, take the finish-line gap, `÷ 2.5` = lengths, average
  over samples (`calcRows`, lines 122-174).
- It is **runner-independent of *your* build** because it runs on a **fixed
  reference runner** defined by a per-CM `cmdef` (`baseStats`, default aptitudes
  Distance S / Surface A / Strategy A, `presupposedSkills`, fixed
  `strategyPositions`), and it emits **one table per running style**
  (nige/senkou/sasi/oikomi).
- It **omits** a skill when its condition yields no region on the course
  (`buildSkillData` → `regions[0].start >= 9999` → `null`) and drops anything
  with `max ≤ 0`.

**Our realization** (faithful, reusing our engine — no new sim work):

1. For each Global uma, take its **native unique skill id** (`1xxxxx`, not the
   `9xxxxx` inherited version).
2. Simulate that unique with our existing `evalSkillDelta` (which *is* the same
   A/B Monte-Carlo) on a **fixed reference runner**, **once per running style**
   (front / pace / late / end). All inputs identical except the style.
3. Rank umas by the **best (max) L across the four styles**, label the winning
   style, and expose the **per-style breakdown** in the row.
4. **Faithful, no realism filter** (per user, 2026-06-16): we do NOT skip styles
   that "don't make sense" for a unique (e.g. an `order==1` unique evaluated as
   End Closer). The engine returns whatever it returns (≈0 if it can't reach the
   required position); the user judges realism from the per-style breakdown + the
   labeled best style. Only `max L ≤ DEAD_L` (can't meaningfully activate at any
   style on this track) de-emphasises / hides the row — `basinnhyou`'s `max > 0`.

**Plan-independence:** the chart ignores the active plan's stats/strategy/aptitude
and uses the fixed reference, so editing your plan never changes the ranking —
exactly the requirement. **Honesty (P3):** numbers are relative to that
documented standard runner with the engine's default field — a *relative
yardstick*, not an absolute prediction.

### Fixed reference runner (documented constant)

`basinnhyou` defaults: Distance **S**, Surface **A**, Strategy **A**, mood **+2**,
`baseStats` from the CM. We mirror the aptitudes/mood and use a single documented
standard stat line. **The JP cmdefs' `baseStats` exceed Global's 1200 stat cap**
(CM15 = `spd 1850 / sta 1500 / …`), so we clamp to the cap — and since both the
CM15 and CM16 cmdefs are all ≥ 1200, clamping lands at **all-1200** (a "maxed
Global runner" yardstick, derived from the working cmdef):

```ts
REFERENCE_STATS = { spd: 1200, sta: 1200, pow: 1200, gut: 1200, wit: 1200 }
REFERENCE_APTITUDES = { distance: 'S', surface: 'A', strategy: 'A' }
REFERENCE_MOOD = 2
UMA_CHART_STRATEGIES = ['front', 'pace', 'late', 'end']
```

A tunable yardstick — the **only chart-specific value to maintain**, and only when
Global raises its stat cap. (A higher-fidelity follow-up can mirror a real `cmdef`'s
`baseStats` + `presupposedSkills` + fixed `strategyPositions`.) A 0-speed build
throws `firstPositionInLateRace`, so the reference must stay non-zero.

## Architecture & file map

Mirrors the existing skill-chart split. **No data-pipeline change, no bundle
change, no runtime engine catalog** — per-uma unique ids come from the existing
`loadUniqueSkillByUmaId()` (the `Map<outfitId, SkillSummary>` the sidebar already
uses), uma display data from `gameData.umas`, and the sim from `SimClient`.

| File | Create/Modify | Responsibility |
|---|---|---|
| `src/core/rankUmaChart.ts` | Create | Pure streaming best-of-4-styles L-rank over `{outfitId, uniqueSkillId}[]` on the fixed reference build (injected `skillDelta`). |
| `src/core/rankUmaChart.test.ts` | Create | Best-of-4 / sort / na / throw-skip / omit / streaming tests (injected sim). |
| `src/features/cm-planner/useUmaChart.ts` | Create | **Run-on-demand** hook over `rankUmaChart` via `SimClient`; streams rows; `isStale` on course change; cancels in-flight. |
| `src/features/cm-planner/useUmaChart.test.tsx` | Create | run() gates compute; stale flag; cancel-on-rerun (injected deps). |
| `src/features/cm-planner/UmaChartPanel.tsx` | Create | The §1 card: Run bar, rows (portrait · name · unique plate w/ L+style · per-style detail · Select), search + show-all filters. |
| `src/features/cm-planner/UmaChartPanel.test.tsx` | Create | No sim before Run; Run lists rows; Select writes plan; filter narrows; stale hint. |
| `src/features/cm-planner/CmPlannerPage.tsx` | Modify | Mount `<UmaChartPanel>` in `.cmp-main` below `RaceSetup`. |
| `src/features/cm-planner/cm-planner.css` | Modify | Uma-chart run-bar / row / per-style styles (light theme, `cmp-*`). |
| `docs/modules/module-4-skill-acquisition.md` | Modify | Correct the stale "master.mdb-gated" claim; record the basinnhyou model + what shipped. |

### Data flow

```
gameData.umas (Global)            ┐
loadUniqueSkillByUmaId() (lazy)   ┘→ candidates: {outfitId, uniqueSkillId}[]
                                         │ (Run click; race = {courseId: selection.courseId})
                                         ▼
        useUmaChart.run() → rankUmaChart → for each uma × 4 styles: SimClient.skillDelta
                                         │  best (max) L + winning style, streamed per uma
                                         ▼
        UmaChartPanel rows → Select → setPlan({ ...plan, umaId, uniqueSkillId })
```

## Core — `rankUmaChart.ts`

```ts
import type { BashinStats, Grade, SimBuild, SimRaceParams, Strategy } from '@/sim';
import type { Stat } from '@/core/types';
import { DEAD_L, DISCOVERY_NSAMPLES } from './rankSkillChart'; // reuse constants (DRY)

export const REFERENCE_STATS: Record<Stat, number> =
  { spd: 1400, sta: 1200, pow: 1000, gut: 600, wit: 1000 };
export const REFERENCE_APTITUDES: { distance: Grade; surface: Grade; strategy: Grade } =
  { distance: 'S', surface: 'A', strategy: 'A' };
export const REFERENCE_MOOD = 2 as const;
export const UMA_CHART_STRATEGIES: Strategy[] = ['front', 'pace', 'late', 'end'];

export interface UmaChartCandidate { outfitId: string; uniqueSkillId: string | null; }

export interface UmaStyleL { strategy: Strategy; L: number; nsamples: number; }

export interface UmaChartRow {
  outfitId: string;
  uniqueSkillId: string | null;
  /** best (max) mean L across styles; null when na. */
  L: number | null;
  bestStrategy: Strategy | null;
  /** faithful per-style values (for the user to judge); only successfully-simmed styles. */
  perStyle: UmaStyleL[];
  status: 'live' | 'zero' | 'na';
  nsamples: number;
}

export interface RankUmaChartDeps {
  skillDelta: (b: SimBuild, r: SimRaceParams, skillId: string, n: number, seed?: number)
    => BashinStats | Promise<BashinStats>;
  nsamples?: number;
  seed?: number;
}
```

Semantics (twin of `rankSkillChart`, with best-of-4):
- `uniqueSkillId === null` → `na` (no sim).
- For each style: `s = skillDelta(refBuild(style), race, uniqueSkillId, n, seed)`. A
  thrown call or `s.nsamples === 0` → that style is skipped (not counted). Record
  the rest in `perStyle`.
- No successful style → `na`. Else `L = max(perStyle.L)`, `bestStrategy` = its
  style, `status = L > DEAD_L ? 'live' : 'zero'`.
- Stream each finished uma via `onRow`. Final sort: L desc, `na` last
  (`rankValue = status === 'na' ? -Infinity : (L ?? 0)`).
- `race` is `{ courseId }` only (the legacy chart's convention; conditions
  default in the adapter).

## Run-on-demand — `useUmaChart`

Idle until `run()`. State `{ rows, status: 'idle'|'running'|'done', done, total, isStale, run }`.
- `run()` snapshots a signature of `(race.courseId, candidates' outfitId+uniqueSkillId, nsamples)`,
  sets `running`, clears rows, streams via `rankUmaChart` (worker `SimClient.skillDelta`,
  like `useSkillChart`); on completion sets sorted rows + `done`.
- `isStale = status !== 'idle' && currentSig !== sigAtLastRun` → panel shows
  "track changed — Run again" **without** recomputing.
- A new `run()`/unmount cancels the in-flight run (token ref; late rows dropped).
- `total = candidates.length`; `done` increments per uma.
- The chart depends only on the **selected course** (reference build is constant),
  so track/stat/filter edits never auto-run.

## UI — `UmaChartPanel`

Card in `.cmp-main` below `RaceSetup`, light theme + `cmp-*` grammar.

- **Run bar:** title "Pick runner — Unique-skill chart"; **Run / Re-run** button
  (disabled while running); progress "ranking n/m" while running; "track changed —
  Run again" when `isStale`; idle empty-state ("Run to rank umas by their unique
  skill's length on this track. Uses a fixed standard runner — independent of your
  build.").
- **Filter bar (client-side only, never recompute):** search (uma name / epithet /
  unique name) + a **"show all"** toggle that reveals `zero`/`na` rows (default
  hides them, per `basinnhyou`'s `max > 0`).
- **Row:** `<GameIcon kind="uma" id={outfitId}>` · name + epithet · unique skill via
  `SkillDetailDisclosure` (`skill` from the `uniqueByUmaId` `SkillSummary`,
  `showCost={false}`, `side =` the L + best-style label, e.g. `+1.42 · Front`).
  The disclosure's expanded body already shows the raw condition/effects; we also
  render the **per-style breakdown** (`perStyle`: Front/Pace/Late/End values, best
  marked) so the user can judge realism. `Select` button → `onSelectRunner(outfitId,
  uniqueSkillId)`; shows "✓ runner" (pressed) when `plan.umaId === outfitId`.
- L display: `+N.NN`/`zero`/`n/a` like the skill chart.

### Candidate assembly (panel)

`useGameData().umas` filtered to `server === plan.server`; `loadUniqueSkillByUmaId()`
loaded once in an effect (injectable via `deps`); `candidates = umas.map(u =>
({ outfitId: u.umaId, uniqueSkillId: uniqueByUmaId.get(u.umaId)?.skillId ?? null }))`.
The same map supplies the unique `SkillSummary` for the plate. A uma whose unique
isn't in the map → `na` row (shown only under "show all").

## Honesty (P3 / P4)

- L is a **streaming estimate on a fixed standard runner** — label "estimate ·
  relative to a standard runner"; never present `n/a` as `0 L`.
- We compute **faithfully per style** and let the user judge realism (no
  style-sensibility filter). The labeled best style + per-style breakdown make the
  basis legible.
- **Global only (P4):** candidates from the curated Global `gameData.umas`.

## Out of scope (deferred — noted, not built)

- Higher-fidelity reference: mirror a real `cmdef` (`baseStats`, `presupposedSkills`,
  fixed `strategyPositions`) + the `*` random-proc (`ErlangRandomPolicy`) marking.
- Effect-summary badges (effect-type gate, shared with the skill chart).
- Now / Upcoming / Future availability toggle; §3 innate column.
- The Skill chart itself (`/legacy` still owns it) — a separate slice.

## Testing (TDD)

- `rankUmaChart.test.ts` (injected `skillDelta`): best-of-4 picks the max + records
  `bestStrategy`; `perStyle` holds the per-style values; `uniqueSkillId === null` →
  `na` without simming; a style that throws is skipped but others still count; all
  styles throw → `na`; `mean ≤ DEAD_L` → `zero`; sort L desc with `na` last; `onRow`
  streams once per uma.
- `useUmaChart.test.tsx` (injected deps): nothing simmed before `run()`; `run()`
  populates rows; changing the `courseId` prop after a run flips `isStale` without
  recomputing; a second `run()` cancels the first.
- `UmaChartPanel.test.tsx` (jsdom; mirror `PlannerSidebar.test`'s `vi.hoisted` +
  `vi.mock('@/features/data/gameData')` + `vi.mock('./skillTechnicalDetails')`):
  no sim before Run; Run lists ranked rows with the best-style label; `Select`
  calls `onSelectRunner` with the right `umaId`+`uniqueSkillId`; search filters
  displayed rows without a re-run; `zero`/`na` hidden until "show all".
```
