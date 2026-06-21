# M4 handoff — velocity + HP **vs distance** overlay (for the racetrack visualizer)

**Status:** designed + prototyped 2026-06-20, then **reverted out of the skill-detail graph** (wrong home) and parked here for reuse. **Not on any branch as live code** — re-apply from the snippets below when building the racetrack overlay.

## Why this exists / where it belongs

The per-skill **skill-detail velocity chart stays velocity-vs-_time_** (VFalator-style — speed curve over the run). That is correct and shipped; **do not convert it to distance.**

This document is the **velocity + HP vs _distance_** view, which belongs on the **§0 racetrack visualizer** (`RaceTrackView` / `src/features/planner/racetrack/`), the open task already noted in `CLAUDE.md`:

> **HP / velocity / skill-activation zones overlaid on the racetrack** — the racetrack SVG overlay still needs the per-frame trace piped to `RaceTrackView`.

It was briefly (and mistakenly) built into `SkillTraceSection`; that change was reverted. The research + geometry + plumbing below are sound and reusable for the track overlay.

## Research — what umalator-lineage tools plot (verified from source in `spikes/repos/`)

Every umalator tool plots velocity (and HP) against **distance / course position**, not time:

| Tool | Source | X-axis |
|---|---|---|
| umalator | `uma-tools/umalator/app.tsx` → `VelocityLines` | `d3.scaleLinear().domain([0, courseDistance])`; velocity on left scale, **HP on a right scale**, both umas overlaid, skill activations marked at their **position** |
| umalator-global (vendored engine UI) | `umalator-global/src/components/bassin-chart/charts/*` | `XAxis domain={[0, courseDistance]}`, binned by position; phase reference lines via `getPhaseForPosition` |

So the **racetrack overlay** should map each per-frame `pos` → x along the track (the track already does distance→x), and draw velocity + HP as overlaid curves with the skill-activation regions shaded — exactly the umalator main view.

**No new engine data needed.** Every `SkillFrame` is already `{ t, v, pos, hp }` (`src/sim/types.ts`). `runComparison`'s `runData.{min,max,mean,median}run` carry the per-frame trace for both runners; `runSkillTrace` (`src/sim/run.ts`) already zips them into `SkillTraceRun.{withSkill,without}` + `activation` regions (metres).

## Reusable pieces (all reverted from the skill-detail graph — re-add where the track overlay lives)

### 1. Course distance on the trace

The x-axis domain is the **exact course distance** (not observed max-pos, which overshoots the finish). Thread it through:

```ts
// src/sim/types.ts — SkillTrace
export interface SkillTrace {
  runs: Record<RunChoice, SkillTraceRun>;
  meanL: number;
  nsamples: number;
  distance: number; // course distance (m) — x-axis domain
}

// src/sim/run.ts — runSkillTrace: capture the course once, return its distance
const course = resolveCourse(race.courseId);
// ...runComparison({ ..., course, ... })...
return { runs: {...}, meanL: _mean(results), nsamples: results.length,
  distance: typeof course.distance === 'number' ? course.distance : 0 };
// EMPTY_TRACE gets distance: 0
```

If reused via `useSkillTrace`, also expose it: add `distance: number` to `SkillTraceState` and return `trace?.distance ?? 0`. (For the racetrack, the course distance is likely already known from the selected course, so you may not need the hook plumbing at all — `coursesService`/`courseCatalog` gives `distance` directly.)

### 2. Geometry helpers (distance axis + dual scale)

```ts
// Axis domains: course distance (falls back to furthest sampled pos) + max v and max HP across both runs.
export function velocityDistanceDomain(run: SkillTraceRun, distance: number): { distance: number; vMax: number; hpMax: number } {
  const all = [...run.withSkill, ...run.without];
  return {
    distance: distance > 0 ? distance : Math.max(1, ...all.map((f) => f.pos)),
    vMax: Math.max(1, ...all.map((f) => f.v)),
    hpMax: Math.max(1, ...all.map((f) => f.hp)),
  };
}

// Per-frame series vs position: x = pos/distance, y = pick(f)/max (inverted so up = larger).
export function posPoints(frames: SkillFrame[], box: Box, distance: number, pick: (f: SkillFrame) => number, max: number): Pt[] {
  return frames.map((f) => ({ x: scale(f.pos, distance, box.w), y: box.h - scale(pick(f), max, box.h) }));
}

// Tracked-skill activation regions (already in metres) → x/width boxes on the distance axis.
export function activationZonesByPos(run: SkillTraceRun, box: Box, distance: number): { x: number; w: number }[] {
  return run.activation.map(({ start, end }) => ({
    x: scale(start, distance, box.w),
    w: Math.max(1, scale(end - start, distance, box.w)),
  }));
}
```

`scale`, `Box`, `Pt`, `gridLinesX`, `distancePhaseBands`, `PhaseBands`(box-param) all already exist in `src/features/cm-planner/skill-trace/geometry.ts` + `SkillTraceCharts.tsx`. (These distance-axis helpers replaced the time-axis `vtPoints`/`domainOf`/`timePhaseBands`/`activationTimes` — for the track overlay, keep both: time helpers feed the skill-detail chart, position helpers feed the track.)

### 3. The chart component (prototype — adapt into `RaceTrackView` overlay)

```tsx
export function VelocityDistanceChart({ run, distance }: { run: SkillTraceRun; distance: number }) {
  const d = velocityDistanceDomain(run, distance);
  const withV    = polyline(posPoints(run.withSkill, BOX, d.distance, (f) => f.v, d.vMax));
  const withoutV = polyline(posPoints(run.without,   BOX, d.distance, (f) => f.v, d.vMax));
  const hp       = polyline(posPoints(run.withSkill, BOX, d.distance, (f) => f.hp, d.hpMax));
  const bands  = distancePhaseBands(BOX);
  const xGrid  = gridLinesX(d.distance, X_STEP, BOX);                                  // 500 m: lines + labels
  const xMinor = gridLinesX(d.distance, X_STEP / 2, BOX).filter((g) => g.value % X_STEP !== 0); // 250 m: faint, unlabelled
  const zones  = activationZonesByPos(run, BOX, d.distance);
  // <svg> PhaseBands → xMinor/xGrid lines → activation zones → polylines (is-hp, is-without, is-with)
  // overlays: left y-label num(d.vMax); right HP label num(d.hpMax)+' HP' (.cmp-hplabel);
  //           x-labels 0 / 500m / 1000m … (reuse the PositionBarChart label block)
}
```

CSS used (violet HP on the right scale so it reads over the blue velocity line + phase bands):

```css
.cmp-trace-line.is-hp { stroke: #7c4dff; stroke-width: 1.1; }
.cmp-trace-graph .cmp-hplabel { right: 2px; color: #7c4dff; font-weight: 600; } /* top-right, inside the graph */
```

## Reuse plan for the racetrack overlay

1. The track SVG already maps **distance → x**; reuse that x-scale instead of `posPoints`' `box.w` mapping (or pass the track width as `box.w`).
2. Pipe a chosen `SkillTraceRun` (or a full-race `runComparison` trace for the two umas — see [full-race compare handoff](2026-06-20-m4-full-race-compare-handoff.md)) into `RaceTrackView`.
3. Draw velocity + HP as overlaid polylines along the track, with `activationZonesByPos` shading the skill windows at their true track positions.
4. Phase bands already exist on the track (Early/Mid/Late/Spurt) — the `distancePhaseBands` fractions (1/6, 2/3, 5/6) match, so the overlay lines up by construction.

## Do NOT

- Do **not** convert the skill-detail `VelocityTimeChart` to distance — it is intentionally velocity-vs-**time** (VFalator parity). This overlay is a **separate** surface on the racetrack.
