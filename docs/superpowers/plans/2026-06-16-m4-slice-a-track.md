# M4 Slice A — Vendored Static Race-Track Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace our hand-rolled `§0` track with umalator's *real* race-track visualization (course elevation/slopes, corner/straight bands, Opening/Mid/Late/Last-spurt legs, distance ruler) rendered for the active plan's CM course, mounted at `/`.

**Architecture:** Vendor umalator's **pure SVG layer + primitive components** (they take a `course` object as a prop, use hardcoded `rgb()` colours, and have no store/Tailwind/i18n coupling) into `src/features/planner/racetrack/vendor/`. Compose them in our own thin `RaceTrackView` container fed by the real `CourseData` our engine bundle already returns (lazy-loaded). Two tiny shims replace umalator's only external couplings: `i18n.t` (a local label map) and `CourseService.phaseStart` (trivial math). The store-coupled orchestrator (`racetrack.tsx`), the chartData overlays (velocity/HP/skill-zones), and Tailwind/Base-UI are NOT vendored — those belong to later slices (HP + skill zones need the engine's per-frame run trace).

**Tech Stack:** TypeScript + Vite + React 19, Vitest (jsdom). **No new npm dependencies** (d3 is removed from the vendored XAxis via a local tick helper). GPL-3.0 — vendored source is from `jalbarrang/umalator-global`, same repo/licence as our engine.

**Provenance:** record the UI vendor (umalator-global racetrack layers, pin v0.14.2 / commit `c1fa2107`, retrieved 2026-06-16) in `docs/provenance.md` (Task 9).

---

## File Structure

**New — vendored (copied verbatim except the noted import rewrites):**
- `src/features/planner/racetrack/vendor/types.ts` — `RaceTrackDimensions` + `slopeValueToPercentage` (copy as-is)
- `src/features/planner/racetrack/vendor/primitives/distance-marker.tsx` (copy as-is)
- `src/features/planner/racetrack/vendor/primitives/section-text.tsx` (copy + rewrite the i18n import)
- `src/features/planner/racetrack/vendor/layers/slope-visualization.tsx` (copy + rewrite CourseData import)
- `src/features/planner/racetrack/vendor/layers/slope-label-bar.tsx` (copy + rewrite CourseData import)
- `src/features/planner/racetrack/vendor/layers/section-bar.tsx` (copy + rewrite CourseData import)
- `src/features/planner/racetrack/vendor/layers/section-numbers.tsx` (copy as-is)
- `src/features/planner/racetrack/vendor/layers/phase-bar.tsx` (copy + rewrite CourseData + CourseService imports)
- `src/features/planner/racetrack/vendor/axes/x-axis.tsx` (copy + rewrite to drop the d3 dependency)
- `src/features/planner/racetrack/vendor/RaceTrack.css` (copy as-is)

**New — ours:**
- `src/features/planner/racetrack/shims/labels.ts` — local `i18n`-shaped label map (replaces `@/i18n`)
- `src/features/planner/racetrack/shims/course.ts` — re-exports `CourseData` type + a `CourseService.phaseStart` shim
- `src/features/planner/racetrack/RaceTrackView.tsx` — our container composing the layers
- `src/features/planner/racetrack/racetrack.css` — wrapper styles + `--color-foreground` bridge
- `src/sim/courseData.ts` — `courseDataFor(courseId)` lazy raw-`CourseData` loader

**Modified:**
- `src/sim/index.ts` — export the `CourseData` type from the barrel
- `src/features/cm-planner/CmPlannerPage.tsx` — render `RaceTrackView` instead of `TrackDiagramPanel`

**Deleted (retired hand-rolled Part-1 track):**
- `src/features/cm-planner/TrackDiagramPanel.tsx` (+ `.test.tsx`)
- `src/core/track.ts` (+ `track.test.ts`)
- `src/sim/courseGeometry.ts` (+ `courseGeometry.test.ts`)
- (Keep `src/features/cm-planner/useSelectedSkill.tsx` — reused by a later slice.)

---

## Task 1: Export `CourseData` from the sim barrel + the course loader

**Files:**
- Modify: `src/sim/index.ts`
- Create: `src/sim/courseData.ts`
- Test: `src/sim/courseData.test.ts`

- [ ] **Step 1: Add the `CourseData` type export to the barrel**

In `src/sim/index.ts`, add after the existing type export line:

```ts
export type { CourseData } from './vendor/umalator.bundle.mjs';
```

- [ ] **Step 2: Write the failing test** (`src/sim/courseData.test.ts`)

```ts
// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { courseDataFor } from './courseData';

describe('courseDataFor', () => {
  it('returns the real engine CourseData for course 10906 (CM15 Hanshin 2200m)', () => {
    const c = courseDataFor('10906');
    expect(c.distance).toBe(2200);
    expect(c.turn).toBe(1);
    expect(c.corners.length).toBe(4);
    expect(c.straights.length).toBeGreaterThan(0);
    expect(c.slopes.length).toBeGreaterThan(0);
  });
  it('throws for an unknown course', () => {
    expect(() => courseDataFor('99999999')).toThrow(/course/i);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `pnpm vitest run src/sim/courseData.test.ts`
Expected: FAIL — `Failed to load url ./courseData` (module missing).

- [ ] **Step 4: Implement `src/sim/courseData.ts`**

```ts
import { resolveCourse } from './adapter';
import type { CourseData } from './vendor/umalator.bundle.mjs';

/**
 * Raw engine CourseData (distance + corners/straights/slopes/turn) for a course id.
 * Reuses the adapter's resolveCourse; callers on the main thread should reach this
 * via a lazy `import('@/sim/courseData')` so the engine bundle stays out of the
 * initial chunk. Throws on an unknown course.
 */
export function courseDataFor(courseId: string): CourseData {
  return resolveCourse(courseId);
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `pnpm vitest run src/sim/courseData.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/sim/index.ts src/sim/courseData.ts src/sim/courseData.test.ts
git commit -m "feat(sim): expose CourseData type + courseDataFor loader"
```

---

## Task 2: The two shims (labels + course)

**Files:**
- Create: `src/features/planner/racetrack/shims/labels.ts`
- Create: `src/features/planner/racetrack/shims/course.ts`
- Test: `src/features/planner/racetrack/shims/labels.test.ts`

- [ ] **Step 1: Write the failing test** (`shims/labels.test.ts`)

```ts
import { describe, expect, it } from 'vitest';
import i18n from './labels';

describe('racetrack label shim', () => {
  it('returns full labels for known keys', () => {
    expect(i18n.t('racetrack.straight')).toBe('Straight');
    expect(i18n.t('racetrack.phase3')).toBe('Last spurt');
  });
  it('interpolates {{n}} for corner labels', () => {
    expect(i18n.t('racetrack.corner', { n: 3 })).toBe('Corner 3');
    expect(i18n.t('racetrack.short.corner', { n: 4 })).toBe('C4');
  });
  it('falls back to the key when unknown', () => {
    expect(i18n.t('racetrack.nope')).toBe('racetrack.nope');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run src/features/planner/racetrack/shims/labels.test.ts`
Expected: FAIL — module `./labels` missing.

- [ ] **Step 3: Implement `shims/labels.ts`** (strings copied verbatim from umalator `src/i18n/index.ts` `racetrack` namespace)

```ts
/**
 * Local stand-in for umalator's `@/i18n` default export, scoped to the racetrack
 * namespace the vendored SVG layers use. Strings copied verbatim from
 * umalator-global src/i18n/index.ts (racetrack.*). Avoids pulling in i18next.
 */
const LABELS: Record<string, string> = {
  'racetrack.straight': 'Straight',
  'racetrack.corner': 'Corner {{n}}',
  'racetrack.uphill': 'Uphill',
  'racetrack.downhill': 'Downhill',
  'racetrack.phase0': 'Early-race',
  'racetrack.phase1': 'Mid-race',
  'racetrack.phase2': 'Late-race',
  'racetrack.phase3': 'Last spurt',
  'racetrack.short.straight': '→',
  'racetrack.short.corner': 'C{{n}}',
  'racetrack.short.uphill': '↗',
  'racetrack.short.downhill': '↘',
};

function interpolate(tpl: string, fields?: Record<string, string | number>): string {
  if (!fields) return tpl;
  return tpl.replace(/\{\{(\w+)\}\}/g, (_m, k: string) => String(fields[k] ?? ''));
}

export default {
  t(key: string, fields?: Record<string, string | number>): string {
    const tpl = LABELS[key];
    return tpl != null ? interpolate(tpl, fields) : key;
  },
};
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm vitest run src/features/planner/racetrack/shims/labels.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Implement `shims/course.ts`** (no test — pure passthrough + arithmetic, exercised via PhaseBar render in Task 7)

```ts
/**
 * Shims for the two umalator engine imports the vendored racetrack layers use:
 * the CourseData type and CourseService.phaseStart. CourseData is our widened
 * bundle type; phaseStart is the engine's phase-boundary math (verified: phase
 * boundaries at 0, 1/6, 2/3, 5/6 of the course distance).
 */
import type { CourseData } from '@/sim';

export type { CourseData };

export const CourseService = {
  phaseStart(distance: number, phase: number): number {
    switch (phase) {
      case 1:
        return distance / 6;
      case 2:
        return (distance * 2) / 3;
      case 3:
        return (distance * 5) / 6;
      default:
        return 0;
    }
  },
};
```

- [ ] **Step 6: Commit**

```bash
git add src/features/planner/racetrack/shims
git commit -m "feat(m4): racetrack shims (local labels + CourseService.phaseStart)"
```

---

## Task 3: Vendor the primitives + types

**Files:**
- Create: `src/features/planner/racetrack/vendor/types.ts`
- Create: `src/features/planner/racetrack/vendor/primitives/distance-marker.tsx`
- Create: `src/features/planner/racetrack/vendor/primitives/section-text.tsx`

Source root (read-only): `spikes/repos/umalator-global/src/modules/racetrack/`

- [ ] **Step 1: Copy `types.ts` as-is**

Copy `spikes/repos/umalator-global/src/modules/racetrack/types.ts` → `src/features/planner/racetrack/vendor/types.ts`. No edits (it has no `@/` imports — only `React` types + plain constants).

- [ ] **Step 2: Copy `distance-marker.tsx` as-is**

Copy `…/racetrack/primitives/distance-marker.tsx` → `vendor/primitives/distance-marker.tsx`. No edits (imports only `react`).

- [ ] **Step 3: Copy `section-text.tsx` and rewrite the i18n import**

Copy `…/racetrack/primitives/section-text.tsx` → `vendor/primitives/section-text.tsx`, then change the first import line:

```diff
-import i18n from '@/i18n';
+import i18n from '../../shims/labels';
```

(No other edits — `i18n.t(translationKey, fields)` call sites are unchanged.)

- [ ] **Step 4: Verify typecheck**

Run: `pnpm typecheck`
Expected: PASS (no errors from the three new files). If `section-text.tsx` errors on missing React import for JSX, confirm our tsconfig uses `react-jsx` (it does — no React import needed).

- [ ] **Step 5: Commit**

```bash
git add src/features/planner/racetrack/vendor/types.ts src/features/planner/racetrack/vendor/primitives
git commit -m "vendor(m4): racetrack types + SVG primitives (umalator-global)"
```

---

## Task 4: Vendor the layer components

**Files (all under `src/features/planner/racetrack/vendor/layers/`):**
- Create: `slope-visualization.tsx`, `slope-label-bar.tsx`, `section-bar.tsx`, `section-numbers.tsx`, `phase-bar.tsx`

- [ ] **Step 1: Copy `section-numbers.tsx` as-is**

Copy `…/racetrack/layers/section-numbers.tsx` → `vendor/layers/section-numbers.tsx`. No edits (imports only `react` + `../types`).

- [ ] **Step 2: Copy `slope-visualization.tsx` + rewrite CourseData import**

Copy → `vendor/layers/slope-visualization.tsx`, then:

```diff
-import { CourseData } from '@/lib/sunday-tools/course/definitions';
+import type { CourseData } from '../../shims/course';
```

(`../types` import of `RaceTrackDimensions, slopeValueToPercentage` is unchanged.)

- [ ] **Step 3: Copy `slope-label-bar.tsx` + rewrite CourseData import**

Copy → `vendor/layers/slope-label-bar.tsx`, then:

```diff
-import { CourseData } from '@/lib/sunday-tools/course/definitions';
+import type { CourseData } from '../../shims/course';
```

(`../primitives/section-text`, `../primitives/distance-marker`, `../types` imports unchanged.)

- [ ] **Step 4: Copy `section-bar.tsx` + rewrite CourseData import**

Copy → `vendor/layers/section-bar.tsx`, then:

```diff
-import { CourseData } from '@/lib/sunday-tools/course/definitions';
+import type { CourseData } from '../../shims/course';
```

- [ ] **Step 5: Copy `phase-bar.tsx` + rewrite the two engine imports**

Copy → `vendor/layers/phase-bar.tsx`, then:

```diff
-import { CourseService } from '@/modules/data/services/CourseService';
-import { CourseData } from '@/lib/sunday-tools/course/definitions';
+import { CourseService } from '../../shims/course';
+import type { CourseData } from '../../shims/course';
```

- [ ] **Step 6: Verify typecheck**

Run: `pnpm typecheck`
Expected: PASS. (The layers read `course.straights/corners/slopes/distance`, all present on our widened `CourseData`.)

- [ ] **Step 7: Commit**

```bash
git add src/features/planner/racetrack/vendor/layers
git commit -m "vendor(m4): racetrack layer components (slope/section/phase/numbers)"
```

---

## Task 5: Vendor the X-axis without d3

**Files:**
- Create: `src/features/planner/racetrack/vendor/axes/x-axis.tsx`

- [ ] **Step 1: Create `x-axis.tsx` (umalator's XAxis with d3 replaced by a local tick helper)**

```tsx
import { memo, useMemo } from 'react';
import { RaceTrackDimensions } from '../types';

const barHeight = RaceTrackDimensions.xAxisHeight;
const barWidth = RaceTrackDimensions.RenderWidth;
const sectionY = RaceTrackDimensions.xAxisY;
const sectionX = RaceTrackDimensions.xOffset;

/** d3.scaleLinear().ticks()-style "nice" round ticks, dependency-free. */
function niceTicks(max: number, count = 10): number[] {
  if (max <= 0) return [0];
  const raw = max / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag;
  const ticks: number[] = [];
  for (let t = 0; t <= max + 1e-9; t += step) ticks.push(Math.round(t));
  return ticks;
}

type XAxisProps = { courseDistance: number };

export const XAxis = memo<XAxisProps>(function XAxis({ courseDistance }) {
  const ticks = useMemo(() => niceTicks(courseDistance), [courseDistance]);
  const scale = (v: number) => (v / courseDistance) * barWidth;
  return (
    <svg id="racetrack-x-axis" x={sectionX} y={sectionY} width={barWidth} height={barHeight} overflow="visible">
      <line x1={0} x2={barWidth} y1={0} y2={0} stroke="var(--color-foreground)" />
      {ticks.map((tick) => (
        <g key={tick} transform={`translate(${scale(tick)},0)`}>
          <line y2={6} stroke="var(--color-foreground)" />
          <text y={15} textAnchor="middle" fontSize={10} fill="var(--color-foreground)">
            {tick}
          </text>
        </g>
      ))}
    </svg>
  );
});
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm typecheck`
Expected: PASS (no `d3` import).

- [ ] **Step 3: Commit**

```bash
git add src/features/planner/racetrack/vendor/axes/x-axis.tsx
git commit -m "vendor(m4): racetrack x-axis (d3 removed, local tick helper)"
```

---

## Task 6: Vendor RaceTrack.css + the theme bridge

**Files:**
- Create: `src/features/planner/racetrack/vendor/RaceTrack.css`
- Create: `src/features/planner/racetrack/racetrack.css`

- [ ] **Step 1: Copy `RaceTrack.css` as-is**

Copy `…/racetrack/components/RaceTrack.css` → `vendor/RaceTrack.css`. No edits. (The static layers use `.sectionText` + `.distanceMarker`; the marker/tooltip rules are inert without those elements.)

- [ ] **Step 2: Create the wrapper stylesheet `racetrack.css`**

```css
/* Container + theme bridge for the vendored umalator racetrack (M4 §0).
   The vendored XAxis uses var(--color-foreground); map it to our token. */
.rt-view {
  --color-foreground: var(--fg);
  width: 100%;
  overflow-x: auto;
}
.rt-view .racetrackView {
  width: 100%;
  height: auto;
  display: block;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/features/planner/racetrack/vendor/RaceTrack.css src/features/planner/racetrack/racetrack.css
git commit -m "vendor(m4): RaceTrack.css + theme-var bridge"
```

---

## Task 7: The `RaceTrackView` container

**Files:**
- Create: `src/features/planner/racetrack/RaceTrackView.tsx`
- Test: `src/features/planner/racetrack/RaceTrackView.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { CmPlan } from '@/core/types';
import { RaceTrackView } from './RaceTrackView';

afterEach(cleanup);

const HANSHIN_2200 = {
  courseId: 10906,
  distance: 2200,
  surface: 1,
  turn: 1,
  corners: [
    { start: 520, length: 190 },
    { start: 710, length: 190 },
    { start: 1250, length: 300 },
    { start: 1550, length: 300 },
  ],
  straights: [
    { start: 0, end: 520, frontType: 1 },
    { start: 900, end: 1250, frontType: 2 },
    { start: 1850, end: 2200, frontType: 1 },
  ],
  slopes: [
    { start: 0, length: 290, slope: -10000 },
    { start: 295, length: 125, slope: 20000 },
    { start: 1400, length: 595, slope: -10000 },
    { start: 2000, length: 125, slope: 20000 },
  ],
};

function makePlan(over: Partial<CmPlan> = {}): CmPlan {
  return {
    id: 'p', name: 'p', planNumber: 1,
    cmRef: { cmId: 'CM15', cmNumber: 15, courseId: '10906', surface: 'turf', distance: 2200 },
    umaId: '100101', uniqueSkillId: 'u', role: 'ace', strategy: 'front',
    statProfile: { stats: { spd: 1200, sta: 650, pow: 900, gut: 400, wit: 600 }, mood: 0 },
    sparkGoals: { pink: [], blue: {} }, wishlist: [], lockedDeckSlots: [], parents: {},
    patch: { version: 't' }, server: 'global', dataVersion: 't', ...over,
  } as CmPlan;
}

const deps = { loadCourse: () => Promise.resolve(HANSHIN_2200 as never) };

describe('RaceTrackView', () => {
  it('renders the race-phase, section, and slope bars for the course', async () => {
    render(<RaceTrackView plan={makePlan()} deps={deps} />);
    await waitFor(() => expect(document.querySelector('#race-phases')).toBeInTheDocument());
    expect(document.querySelector('#race-sections')).toBeInTheDocument();
    expect(document.querySelector('#racetrack-slope-visualization')).toBeInTheDocument();
  });

  it('labels the legs (Early-race … Last spurt) and section types', async () => {
    render(<RaceTrackView plan={makePlan()} deps={deps} />);
    expect(await screen.findByText('Last spurt')).toBeInTheDocument();
    expect(screen.getByText('Early-race')).toBeInTheDocument();
    expect(screen.getAllByText('Straight').length).toBeGreaterThan(0);
  });

  it('degrades gracefully when the course cannot be resolved', async () => {
    const failing = { loadCourse: () => Promise.reject(new Error('Unknown course: x')) };
    render(<RaceTrackView plan={makePlan()} deps={failing} />);
    expect(await screen.findByText(/unavailable/i)).toBeInTheDocument();
    expect(document.querySelector('#race-phases')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run src/features/planner/racetrack/RaceTrackView.test.tsx`
Expected: FAIL — module `./RaceTrackView` missing.

- [ ] **Step 3: Implement `RaceTrackView.tsx`**

```tsx
/**
 * M4 §0 — race-track visualization. Renders umalator's vendored SVG layers
 * (slope profile, corner/straight bands, race legs, distance ruler) for the
 * active plan's CM course. Course geometry is the real engine CourseData,
 * lazy-loaded so the engine bundle stays out of the initial chunk.
 *
 * Slice A scope: static course only. HP, velocity, and skill-activation zones
 * (which need the engine's per-frame run trace) land in a later slice.
 */
import { useEffect, useState } from 'react';
import type { CmPlan } from '@/core/types';
import type { CourseData } from '@/sim';
import { RaceTrackDimensions } from './vendor/types';
import { SlopeVisualization } from './vendor/layers/slope-visualization';
import { SlopeLabelBar } from './vendor/layers/slope-label-bar';
import { SectionTypesBar } from './vendor/layers/section-bar';
import { PhaseBar } from './vendor/layers/phase-bar';
import { SectionNumbersBar } from './vendor/layers/section-numbers';
import { XAxis } from './vendor/axes/x-axis';
import './vendor/RaceTrack.css';
import './racetrack.css';

interface RaceTrackViewProps {
  plan: CmPlan;
  deps?: { loadCourse: (courseId: string) => Promise<CourseData> };
}

const defaultLoadCourse = (courseId: string): Promise<CourseData> =>
  import('@/sim/courseData').then((m) => m.courseDataFor(courseId));

export function RaceTrackView({ plan, deps }: RaceTrackViewProps) {
  const loadCourse = deps?.loadCourse ?? defaultLoadCourse;
  const courseId = plan.cmRef.courseId;
  const [course, setCourse] = useState<CourseData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setCourse(null);
    setError(null);
    if (!courseId) {
      setError('no course selected');
      return;
    }
    loadCourse(courseId)
      .then((c) => {
        if (!cancelled) setCourse(c);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [courseId, loadCourse]);

  if (error) return <p className="muted">Track unavailable: {error}</p>;
  if (!course) return <p className="muted small">Loading track…</p>;

  return (
    <div className="rt-view">
      <svg
        version="1.1"
        xmlns="http://www.w3.org/2000/svg"
        viewBox={`0 0 ${RaceTrackDimensions.ViewWidth} ${RaceTrackDimensions.ViewHeight}`}
        preserveAspectRatio="xMidYMid meet"
        className="racetrackView"
        data-courseid={courseId}
      >
        <SlopeVisualization course={course} />
        <SlopeLabelBar course={course} />
        <SectionTypesBar course={course} />
        <PhaseBar course={course} />
        <SectionNumbersBar />
        <XAxis courseDistance={course.distance} />
      </svg>
    </div>
  );
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm vitest run src/features/planner/racetrack/RaceTrackView.test.tsx`
Expected: PASS (3 tests). If "Straight"/"Last spurt" not found, confirm the label-shim import path in `section-text.tsx` (Task 3 Step 3).

- [ ] **Step 5: Commit**

```bash
git add src/features/planner/racetrack/RaceTrackView.tsx src/features/planner/racetrack/RaceTrackView.test.tsx
git commit -m "feat(m4): RaceTrackView container composing vendored racetrack layers"
```

---

## Task 8: Mount in CmPlannerPage + retire the hand-rolled track

**Files:**
- Modify: `src/features/cm-planner/CmPlannerPage.tsx`
- Delete: `src/features/cm-planner/TrackDiagramPanel.tsx`, `src/features/cm-planner/TrackDiagramPanel.test.tsx`, `src/core/track.ts`, `src/core/track.test.ts`, `src/sim/courseGeometry.ts`, `src/sim/courseGeometry.test.ts`

- [ ] **Step 1: Swap the panel in `CmPlannerPage.tsx`**

Change the import:

```diff
-import { TrackDiagramPanel } from './TrackDiagramPanel';
+import { RaceTrackView } from '@/features/planner/racetrack/RaceTrackView';
```

And the render:

```diff
-        <TrackDiagramPanel plan={plan} />
+        <RaceTrackView plan={plan} />
```

(Keep `SelectedSkillProvider` wrapping and the race-setup `<section>` as-is.)

- [ ] **Step 2: Run the page test to confirm it still renders**

Note: `CmPlannerPage.test.tsx` mocks `@/sim/courseGeometry`. Update that mock to `@/sim/courseData` returning the `HANSHIN_2200` object (same shape as Task 7's fixture), and change the assertion from `.tseg` to `document.querySelector('#race-phases')`.

Run: `pnpm vitest run src/features/cm-planner/CmPlannerPage.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 3: Delete the retired hand-rolled files**

```bash
git rm src/features/cm-planner/TrackDiagramPanel.tsx src/features/cm-planner/TrackDiagramPanel.test.tsx \
       src/core/track.ts src/core/track.test.ts \
       src/sim/courseGeometry.ts src/sim/courseGeometry.test.ts
```

- [ ] **Step 4: Remove the dropped barrel export**

In `src/sim/index.ts`, delete the `courseGeometryFor`-related comment line added in Part 1 (the `// courseGeometryFor is intentionally NOT re-exported…` note) — it now refers to a deleted file.

- [ ] **Step 5: Verify nothing else imports the deleted modules**

Run: `pnpm typecheck`
Expected: PASS. If any error references `@/core/track`, `courseGeometry`, or `TrackDiagramPanel`, fix the importing file (there should be none beyond CmPlannerPage).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(m4): mount vendored RaceTrackView at /, retire hand-rolled track"
```

---

## Task 9: Full verification + provenance

**Files:**
- Modify: `docs/provenance.md`

- [ ] **Step 1: Record the UI vendor in provenance**

Add a short entry under the engine/provenance section noting: umalator-global **racetrack UI layers** vendored as source into `src/features/planner/racetrack/vendor/` (pin v0.14.2 / commit `c1fa2107`, retrieved 2026-06-16, GPL-3.0-only — same repo/licence as the engine; d3 removed from the x-axis; `@/i18n` + `CourseService` replaced by local shims).

- [ ] **Step 2: Full suite + typecheck + build**

Run: `pnpm typecheck && pnpm test && pnpm build`
Expected: typecheck clean; all tests pass (the new courseData/labels/RaceTrackView tests + the rest, minus the deleted track/courseGeometry/TrackDiagramPanel tests); build succeeds. Confirm the main-chunk size is unchanged vs. before (the engine still loads only via the lazy `courseData` import → its own small chunk).

- [ ] **Step 3: Manual visual check (REQUIRED — visual-fidelity goal)**

Run: `pnpm dev`, open `/`. Confirm the track renders like umalator/uma.guide: green slope/elevation profile on top, the purple slope-label bar (Uphill/Downhill), blue straight + orange corner bands with "Straight"/"Corner N" labels and metre markers, the four coloured legs (Early-race / Mid-race / Late-race / Last spurt), the 1–24 section ruler, and the distance axis. Compare against the `m4-current.html` mockup + an umalator screenshot.

- [ ] **Step 4: Commit**

```bash
git add docs/provenance.md
git commit -m "docs(provenance): record umalator racetrack UI vendor (M4 slice A)"
```

---

## Self-Review

**Spec coverage** (against `2026-06-16-m4-umalator-build-foundation-design.md`, Slice A = track):
- Vendor umalator track UI into our shell → Tasks 3–7. ✓
- Mount at `/`, retire hand-rolled track → Task 8. ✓
- Visual fidelity (look like umalator) → vendored layers verbatim + RaceTrack.css + Task 9 Step 3 manual check. ✓
- Reuse engine data, no new data layer → `courseDataFor` reuses the bundle's `resolveCourse` (Task 1). ✓
- Contained / no Tailwind-Base-UI-i18n-store adoption → only pure layers + 2 shims; d3 dropped. ✓
- Deferred (HP + skill-activation zones via run trace) → explicitly out of this slice (noted in `RaceTrackView` header). ✓

**Placeholder scan:** none — every step has exact paths, commands, and full code for new/rewritten files; vendored copies specify exact source→dest + the precise import diffs.

**Type consistency:** `CourseData` is sourced once (Task 1 barrel export) and consumed identically by the shim (Task 2), the layers (Task 4), and `RaceTrackView` (Task 7). `courseDataFor` / `loadCourse` signatures match between `src/sim/courseData.ts`, the `RaceTrackView` `deps`, and the test mocks. `RaceTrackDimensions` member names used in `RaceTrackView`/`x-axis` match the vendored `types.ts`.

**Note on Task 7 test fixture:** the inline `HANSHIN_2200` object is `as never`/`as` cast into the `CourseData`/loadCourse types because it's a structural stand-in for the engine object — acceptable in a test (the layers read only distance/corners/straights/slopes).
