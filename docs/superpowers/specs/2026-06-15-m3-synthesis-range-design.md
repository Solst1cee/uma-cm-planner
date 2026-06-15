# M3 Synthesis + Range/Zoom — Design Spec

**Status:** APPROVED (2026-06-15) · **Owner:** Sun · **Origin:** brainstorm (superpowers:brainstorming), follow-up to the shipped M3 timeline (`2026-06-14-m3-meta-intel-design.md` §1.4/§5/§7; timeline UI `2026-06-15-m3-timeline-ui.md`).

**Scope (this spec):** two increments on the existing `/meta-intel` timeline —
1. **Synthesis auto-fill** — generate *predicted* upcoming Champions Meetings (CM16+) from `cm_tracks.json` so the timeline shows what's coming ahead of official confirmation.
2. **Range/zoom controls** — a date-window selector on the timeline (deferred from the Plan-3 UI).

**Explicitly out of scope:** phase-2 three-up (JP/TW prior vs Global observed vs sim) — a separate, larger, engine-dependent sub-module; gets its own spec later.

---

## 1. Background / data facts (verified 2026-06-15)

- `public/data/cm_tracks.json` (from uma.guide, P5/private-use import) is indexed by **Global CM number**: validated **#15 = Cancer Cup / Hanshin / 2200m / medium / turf**, which matches the hand-seeded official CM15 exactly. It has 43 rows up to index 44 (with occasional gaps — e.g. **#14 is absent**). Each row: `{ index, cupName, racetrack, distance, distanceClass, surface }`. **It has no `courseId`.**
- `public/data/timeline.json` is the build-time bake: `cm_presets` → base `cm` entries, then `mergeTimeline(base, overrides)` (overrides merged at build). The runtime (`gameData.ts`) loads **only** `timeline.json`. **Only the CM15 override carries a `cmNumber`;** the umalator-imported rows (zodiac JP history + "MILE/CLASSIC"-named Global rows) have none.
- `cm_tracks.json` is **not** consumed by the build pipeline yet.
- `projectCmSchedule` (M4 feed) emits a row only for `cm` entries that have **both** `cmNumber` and `courseId`.

**Implication:** track geometry for upcoming CMs is reliably known (rotation), but **dates must be predicted** and **`courseId` is unknown until official**. CM cadence is ~one zodiac cup/month on both servers, so dates follow a **monthly cadence**, *not* the JP→Global content-pace multiplier (`predictGlobalDate`/1.422 stays reserved for future banner/patch forecasting).

## 2. Approach (chosen: A — build-time synthesis, pure-core math)

Predicted CMs are generated **at build time** by a pure function, appended to `timeline.json` after the override merge. Overrides always win. Runtime stays a thin renderer. Rejected: runtime synthesis (diverges from the bake; predictions never land in the baked file; buys little since predictions are confirmation-anchored, not now-anchored) and manual-overrides-only (defeats the automation goal).

## 3. Pure core

Two homes: the generic date util lands in the existing core timeline module; the CM-generation logic gets its own module.

### 3.1 `addMonths(iso, months)` — added to `src/core/timeline.ts`
Homed in `timeline.ts` because it's a generic date util shared by §3.2 (synthesis) and §6 (windowing). Signature `addMonths(iso: string, months: number): string`. Deterministic UTC month step with **end-of-month clamping**: `addMonths('2026-01-31', 1) === '2026-02-28'` (never rolls into March). Implementation: parse `iso+'T00:00:00Z'`, remember `day = getUTCDate()`, `setUTCMonth(getUTCMonth()+months)`, and if the resulting `getUTCDate() !== day` (overflow), `setUTCDate(0)` to snap to the last day of the intended month. Return `toISOString().slice(0,10)`. (`new Date(isoString)`/`Date.UTC` are fine in core/build code — the argless-`new Date()` restriction only applies to Workflow scripts.)

### 3.2 `src/core/cmSynthesis.ts` (new) — `synthesizeUpcomingCms(merged, tracks, opts): TimelineEntry[]`
Imports `addMonths` from `@/core/timeline`.
```ts
interface SynthesizeOpts {
  monthsPerCm?: number;   // default 1  (one zodiac cup per month)
  horizon?: number;       // default 3  (predict CM anchor+1 … anchor+3)
  dataVersion: string;
  sourceUrl?: string;     // default 'https://uma.guide/cm-schedule/'
}
function synthesizeUpcomingCms(
  merged: TimelineEntry[],   // imported ⊕ overrides (the post-merge entries)
  tracks: CmTrack[],         // cm_tracks.json
  opts: SynthesizeOpts,
): TimelineEntry[]
```
Algorithm:
1. **Anchor** = among `merged`, the `cm` entry with the highest `cm.cmNumber` that also has a `dates.finals`. If none → return `[]`.
2. **present** = `Set` of every `cm.cmNumber` found in `merged` (so a confirmed/override CM is never duplicated).
3. For `N` from `anchorNumber + 1` to `anchorNumber + horizon`:
   - skip if `present.has(N)`;
   - `track` = `tracks.find(t => t.index === N)`; skip if absent (gap, e.g. #14);
   - emit:
     ```ts
     {
       id: `cm${N}-${slug(track.cupName)}-predicted`,
       type: 'cm',
       title: track.cupName,
       dates: { finals: addMonths(anchorFinals, (N - anchorNumber) * monthsPerCm) },
       cm: {
         cmNumber: N,
         // NO courseId — direction / inner-outer unknown until official.
         trackSummary: `${track.racetrack} ${track.surface} ${track.distance}m (${track.distanceClass})`,
       },
       tier: 'prediction',
       status: 'unconfirmed',
       source: { kind: 'umaguide', url: opts.sourceUrl ?? 'https://uma.guide/cm-schedule/' },
       server: 'global',
       dataVersion: opts.dataVersion,
     }
     ```
4. Return the predicted entries (the caller appends to `merged` and re-sorts).

With today's data (anchor CM15, horizon 3): emits **CM16 Leo (Nakayama turf 1200m sprint)**, **CM17 Virgo (Oi dirt 2000m medium)**, **CM18 Libra (Hanshin turf 1600m mile)**, finals `2026-07-30 / 2026-08-30 / 2026-09-30`.

## 4. Build-pipeline integration

- `scripts/build-timeline.ts` — `buildTimeline` gains a `tracks: CmTrack[]` input (and optional synth opts). After `mergeTimeline(base, overrides)` it computes `synthesizeUpcomingCms(merged, tracks, { dataVersion, horizon: 3 })`, concatenates, and returns `sortTimeline([...merged, ...predicted])`.
- `scripts/build-all.ts` — reads the already-generated `public/data/cm_tracks.json` and passes its `tracks` to `buildTimeline`. (Ordering: `cm_tracks.json` is a committed generated artifact; it exists before the timeline step. If a clean rebuild order is needed, the uma.guide import runs before the timeline build.)
- Output: `pnpm data:build` regenerates `public/data/timeline.json` with CM16–18 predictions appended (committed).

## 5. M4 honesty boundary — no code change

Predicted CMs have no `courseId`; `projectCmSchedule` already requires one, so predictions **render on the timeline but never feed M4's `cmSchedule`**. The boundary is automatic; a test asserts a predicted CM is excluded from `projectCmSchedule` output. (P3: a predicted track/date is shown as `~ predicted`, never as something M4 can plan a precise build against.)

## 6. Range/zoom UI

- **`timelineView.ts`** — add `RangeKey = 'upcoming' | 'year' | 'all'`, a `RANGES` label list, and a pure `windowTimeline(entries, nowISO, range): TimelineEntry[]`:
  - `upcoming` → `effectiveDate(e) >= nowISO` (also keeps undated/`''`? **no** — undated sorts before now; treat `''` as *not* upcoming, i.e. excluded from `upcoming`, included in `all`);
  - `year` → `effectiveDate(e)` within `[addMonths(nowISO,-6), addMonths(nowISO,12)]` inclusive (`addMonths` imported from `@/core/timeline`); undated (`''`) entries fall outside this window, so they appear only under `all`;
  - `all` → unchanged.
- **`TimelinePage.tsx`** — a `<select>` (or segmented control) in the `.timeline-controls` row, default **`upcoming`**, state `useState<RangeKey>('upcoming')`. Apply `windowTimeline` to `entries` **before** `filterTimeline`/`partitionByLane`; `currentCm`/now-marker logic is unchanged. `now` stays an injectable prop for tests.
- **`meta-intel.css`** — minor styling for the range select (reuse existing control styles).

Default `upcoming` keeps the planner forward-looking and hides the long JP datamined history by default; `all` restores it.

## 7. Testing

- **`timeline.test.ts`** — `addMonths` (normal step, year rollover, Jan-31→Feb clamp).
- **`cmSynthesis.test.ts`** — `synthesizeUpcomingCms` (anchor = highest-cmNumber-with-finals; monthly dates; skip already-present numbers (overrides-win); skip `cm_tracks` gaps; horizon cap = 3; no-anchor → `[]`; **emitted entries have no `courseId`** and `tier:'prediction'`/`status:'unconfirmed'`).
- **`timelineView.test.ts`** — `windowTimeline` for `upcoming` / `year` / `all`, incl. an undated entry (excluded from `upcoming`, present in `all`).
- **Build** — `buildTimeline` with `tracks` appends predicted entries and they merge+sort correctly; overrides for a synthesized number suppress the prediction. Update the existing `build-timeline` test.
- **`projectCmSchedule`** — a predicted (no-`courseId`) CM is excluded; a confirmed CM15 is included (guards the M4 boundary).
- **`TimelinePage.test.tsx`** — range select filters (default `upcoming` hides a past entry; switching to `all` reveals it); a predicted CM renders with the `~ predicted` badge. Existing Plan-3 tests stay green.

## 8. Principles / provenance

- **P3 honest numbers** — predictions badged `~`, dates explicitly monthly-estimated, `courseId` withheld until official; never fed to M4.
- **P5 hand-patchable** — predictions are generated; `timeline_overrides.json` corrects/confirms and always wins.
- **P6 pure core** — date math + synthesis are pure, tested functions in `src/core/`; importers/build in `scripts/`; UI thin.
- **Provenance** — note the synthesis (cm_tracks → predicted CMs, monthly cadence) and the uma.guide source in `docs/provenance.md` under the timeline datasets.

## 9. Risks

1. **Monthly cadence is approximate** — real finals dates drift a few days; acceptable for a `~ predicted` badge, corrected on confirmation.
2. **`cm_tracks` gaps / index drift** — synthesis skips missing indices; if uma.guide's numbering ever desyncs from the official CM number, a wrong cup/track could be predicted. Mitigated by the override-wins confirmation step and the validated #15 alignment.
3. **No `courseId` for predictions** — intentional; means M4 can't plan against unconfirmed CMs (correct), and the timeline detail panel should not imply otherwise.
