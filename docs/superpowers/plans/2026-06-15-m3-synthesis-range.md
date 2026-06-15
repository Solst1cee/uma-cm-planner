# M3 Synthesis + Range/Zoom Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-fill *predicted* upcoming Champions Meetings (CM16+) onto the `/meta-intel` timeline from `cm_tracks.json` (monthly cadence, no `courseId`, `~ predicted`), and add a date-range selector (Upcoming / ±1yr / All) to the timeline.

**Architecture:** Pure-core month math (`addMonths` in `src/core/timeline.ts`) + a new pure `src/core/cmSynthesis.ts` that turns the confirmed anchor + track rotation into predicted `TimelineEntry`s. The build pipeline (`scripts/build-timeline.ts`) appends predictions after the override merge; a new `scripts/rebuild-timeline.ts` (`pnpm timeline:rebuild`) regenerates `timeline.json` from committed `public/data` inputs (no `scripts/borrowed/` needed). The UI gains a pure `windowTimeline` helper + a `<select>` in `TimelinePage`. Predictions have no `courseId`, so `projectCmSchedule` already excludes them from M4.

**Tech Stack:** TypeScript (strict; `noUncheckedIndexedAccess`, `verbatimModuleSyntax`), React 19, Vitest + @testing-library/react, tsx build scripts. Spec: `docs/superpowers/specs/2026-06-15-m3-synthesis-range-design.md`.

---

## File Structure

- **Modify** `src/core/timeline.ts` — add `addMonths`.
- **Modify** `src/core/timeline.test.ts` — `addMonths` tests.
- **Create** `src/core/cmSynthesis.ts` — `synthesizeUpcomingCms` (+ `SynthesizeOpts`).
- **Create** `src/core/cmSynthesis.test.ts`.
- **Modify** `scripts/build-timeline.ts` — accept `tracks`, append synthesized predictions.
- **Create** `scripts/build-timeline.test.ts`.
- **Modify** `scripts/build-all.ts` — read `cm_tracks.json` (guarded), pass `tracks`.
- **Create** `scripts/rebuild-timeline.ts` + **modify** `package.json` (`timeline:rebuild` script).
- **Regenerate** `public/data/timeline.json` (generated artifact, +3 predictions).
- **Modify** `src/features/meta-intel/timelineView.ts` — `RangeKey`, `RANGES`, `windowTimeline`.
- **Modify** `src/features/meta-intel/timelineView.test.ts` — `windowTimeline` tests.
- **Modify** `src/features/meta-intel/TimelinePage.tsx` — range `<select>`.
- **Modify** `src/features/meta-intel/meta-intel.css` — range select style.
- **Modify** `src/features/meta-intel/TimelinePage.test.tsx` — range tests.
- **Modify** `docs/provenance.md` — synthesis provenance note.

Reused types: `CmTrack` (`{ index; cupName; racetrack; distance; distanceClass; surface }`), `TimelineEntry`, `CmPreset` — all in `src/core/types.ts`.

---

## Task 1: `addMonths` in `src/core/timeline.ts`

**Files:**
- Modify: `src/core/timeline.ts`
- Test: `src/core/timeline.test.ts`

- [ ] **Step 1: Write the failing test**

Read `src/core/timeline.test.ts`, add `addMonths` to the existing `import { ... } from './timeline'`, and append this describe block:

```ts
describe('addMonths', () => {
  it('adds whole months', () => {
    expect(addMonths('2026-06-30', 1)).toBe('2026-07-30');
    expect(addMonths('2026-06-30', 3)).toBe('2026-09-30');
  });
  it('rolls over the year', () => {
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15');
  });
  it('clamps to the last day when the target month is shorter', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-03-31', 1)).toBe('2026-04-30');
  });
  it('handles negative months (windowing lower bound)', () => {
    expect(addMonths('2026-06-15', -6)).toBe('2025-12-15');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/core/timeline.test.ts`
Expected: FAIL — `addMonths is not exported` / not a function.

- [ ] **Step 3: Implement**

Append to `src/core/timeline.ts`:

```ts
/**
 * Add `months` calendar months to an ISO date (UTC), clamping to the last day
 * of the target month so day-of-month never overflows (2026-01-31 +1mo →
 * 2026-02-28, not 2026-03-03). Shared by CM-schedule synthesis + timeline windowing.
 */
export function addMonths(iso: string, months: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + months);
  if (d.getUTCDate() !== day) d.setUTCDate(0); // overflowed → snap to last day of intended month
  return d.toISOString().slice(0, 10);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/core/timeline.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

Run: `pnpm typecheck` → no errors.

```bash
git add src/core/timeline.ts src/core/timeline.test.ts
git commit -m "feat(m3): addMonths date helper (end-of-month clamp)"
```

---

## Task 2: `synthesizeUpcomingCms` in `src/core/cmSynthesis.ts`

**Files:**
- Create: `src/core/cmSynthesis.ts`
- Test: `src/core/cmSynthesis.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/core/cmSynthesis.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { CmTrack, TimelineEntry } from '@/core/types';
import { synthesizeUpcomingCms } from './cmSynthesis';

const TRACKS: CmTrack[] = [
  { index: 15, cupName: 'Cancer Cup', racetrack: 'Hanshin', distance: 2200, distanceClass: 'medium', surface: 'turf' },
  { index: 16, cupName: 'Leo Cup', racetrack: 'Nakayama', distance: 1200, distanceClass: 'sprint', surface: 'turf' },
  { index: 17, cupName: 'Virgo Cup', racetrack: 'Oi', distance: 2000, distanceClass: 'medium', surface: 'dirt' },
  { index: 18, cupName: 'Libra Cup', racetrack: 'Hanshin', distance: 1600, distanceClass: 'mile', surface: 'turf' },
  { index: 19, cupName: 'Scorpio Cup', racetrack: 'Kyoto', distance: 2200, distanceClass: 'medium', surface: 'turf' },
];

function cm(num: number, finals: string): TimelineEntry {
  return {
    id: `cm${num}`, type: 'cm', title: `CM${num}`,
    dates: { finals }, cm: { cmNumber: num, courseId: '10906' },
    tier: 'official', status: 'confirmed',
    source: { kind: 'official_news', url: '' }, server: 'global', dataVersion: 'test',
  };
}

describe('synthesizeUpcomingCms', () => {
  const anchor = [cm(15, '2026-06-30')];

  it('predicts horizon CMs at monthly cadence from the anchor', () => {
    const out = synthesizeUpcomingCms(anchor, TRACKS, { dataVersion: 'test', horizon: 3 });
    expect(out.map((e) => e.cm?.cmNumber)).toEqual([16, 17, 18]);
    expect(out.map((e) => e.dates.finals)).toEqual(['2026-07-30', '2026-08-30', '2026-09-30']);
    expect(out.map((e) => e.title)).toEqual(['Leo Cup', 'Virgo Cup', 'Libra Cup']);
  });

  it('marks predictions as prediction/unconfirmed with no courseId', () => {
    const out = synthesizeUpcomingCms(anchor, TRACKS, { dataVersion: 'test', horizon: 1 });
    const e = out[0]!;
    expect(e.tier).toBe('prediction');
    expect(e.status).toBe('unconfirmed');
    expect(e.cm?.courseId).toBeUndefined();
    expect(e.server).toBe('global');
    expect(e.source.kind).toBe('umaguide');
    expect(e.cm?.trackSummary).toBe('Nakayama turf 1200m (sprint)');
  });

  it('slides the window forward — confirming CM16 predicts the next 3 (17,18,19)', () => {
    const out = synthesizeUpcomingCms([cm(15, '2026-06-30'), cm(16, '2026-07-25')], TRACKS, {
      dataVersion: 'test', horizon: 3,
    });
    expect(out.map((e) => e.cm?.cmNumber)).toEqual([17, 18, 19]);
    expect(out[0]!.dates.finals).toBe('2026-08-25'); // measured from latest confirmed (CM16)
  });

  it('skips numbers already on the timeline, even undated ones (overrides win)', () => {
    const cm17NoDate: TimelineEntry = {
      id: 'cm17', type: 'cm', title: 'CM17 TBD', dates: {},
      cm: { cmNumber: 17 }, tier: 'official', status: 'confirmed',
      source: { kind: 'manual', url: '' }, server: 'global', dataVersion: 'test',
    };
    const out = synthesizeUpcomingCms([cm(15, '2026-06-30'), cm17NoDate], TRACKS, {
      dataVersion: 'test', horizon: 3,
    });
    expect(out.map((e) => e.cm?.cmNumber)).toEqual([16, 18]); // anchor CM15; CM17 present-but-undated → skipped
  });

  it('skips gaps in the track list', () => {
    const sparse = TRACKS.filter((t) => t.index !== 17);
    const out = synthesizeUpcomingCms(anchor, sparse, { dataVersion: 'test', horizon: 3 });
    expect(out.map((e) => e.cm?.cmNumber)).toEqual([16, 18]);
  });

  it('caps at the horizon', () => {
    const out = synthesizeUpcomingCms(anchor, TRACKS, { dataVersion: 'test', horizon: 2 });
    expect(out.map((e) => e.cm?.cmNumber)).toEqual([16, 17]);
  });

  it('anchors on the highest-numbered CM that has a finals date', () => {
    const out = synthesizeUpcomingCms([cm(14, '2026-05-30'), cm(15, '2026-06-30')], TRACKS, {
      dataVersion: 'test', horizon: 1,
    });
    expect(out.map((e) => e.cm?.cmNumber)).toEqual([16]);
  });

  it('returns [] when nothing has a cmNumber + finals to anchor on', () => {
    const noAnchor: TimelineEntry[] = [{
      id: 'x', type: 'cm', title: 'x', dates: { finals: '2026-06-30' },
      cm: { courseId: '1' }, tier: 'official', status: 'confirmed',
      source: { kind: 'manual', url: '' }, server: 'global', dataVersion: 'test',
    }];
    expect(synthesizeUpcomingCms(noAnchor, TRACKS, { dataVersion: 'test' })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/core/cmSynthesis.test.ts`
Expected: FAIL — cannot resolve `./cmSynthesis`.

- [ ] **Step 3: Implement**

Create `src/core/cmSynthesis.ts`:

```ts
/**
 * Build-time CM-schedule synthesis: from the merged (imported ⊕ overrides)
 * timeline + the uma.guide track rotation (cm_tracks.json), generate *predicted*
 * upcoming Champions Meetings so the timeline shows CM16+ ahead of official
 * confirmation. PREDICTION ONLY (P3): monthly cadence, no courseId, tier
 * 'prediction'. Overrides win — any CM number already present is skipped.
 */
import type { CmTrack, TimelineEntry } from './types';
import { addMonths } from './timeline';

export interface SynthesizeOpts {
  /** Months between consecutive CMs (Global runs ~one zodiac cup/month). Default 1. */
  monthsPerCm?: number;
  /** How many CMs past the anchor to predict. Default 3. */
  horizon?: number;
  dataVersion: string;
  /** Source URL stamped on predicted entries. Default the uma.guide CM schedule. */
  sourceUrl?: string;
}

const UMA_GUIDE_URL = 'https://uma.guide/cm-schedule/';

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function synthesizeUpcomingCms(
  merged: TimelineEntry[],
  tracks: CmTrack[],
  opts: SynthesizeOpts,
): TimelineEntry[] {
  const monthsPerCm = opts.monthsPerCm ?? 1;
  const horizon = opts.horizon ?? 3;
  const sourceUrl = opts.sourceUrl ?? UMA_GUIDE_URL;

  // Collect every present CM number (so overrides/confirmed CMs are never
  // duplicated) and the anchor = highest number that also has a finals date.
  const present = new Set<number>();
  let anchor: { num: number; finals: string } | null = null;
  for (const e of merged) {
    const num = e.cm?.cmNumber;
    if (e.type !== 'cm' || num === undefined) continue;
    present.add(num);
    const finals = e.dates.finals;
    if (finals !== undefined && (anchor === null || num > anchor.num)) {
      anchor = { num, finals };
    }
  }
  if (anchor === null) return [];

  const byIndex = new Map(tracks.map((t) => [t.index, t]));
  const out: TimelineEntry[] = [];
  for (let n = anchor.num + 1; n <= anchor.num + horizon; n++) {
    if (present.has(n)) continue;
    const track = byIndex.get(n);
    if (track === undefined) continue;
    out.push({
      id: `cm${n}-${slug(track.cupName)}-predicted`,
      type: 'cm',
      title: track.cupName,
      dates: { finals: addMonths(anchor.finals, (n - anchor.num) * monthsPerCm) },
      cm: {
        cmNumber: n,
        // No courseId — track direction / inner-outer unknown until official (P3).
        trackSummary: `${track.racetrack} ${track.surface} ${track.distance}m (${track.distanceClass})`,
      },
      tier: 'prediction',
      status: 'unconfirmed',
      source: { kind: 'umaguide', url: sourceUrl },
      server: 'global',
      dataVersion: opts.dataVersion,
    });
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/core/cmSynthesis.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Typecheck + commit**

Run: `pnpm typecheck` → no errors.

```bash
git add src/core/cmSynthesis.ts src/core/cmSynthesis.test.ts
git commit -m "feat(m3): synthesizeUpcomingCms — predicted CMs from track rotation"
```

---

## Task 3: Build-time synthesis in `scripts/build-timeline.ts`

**Files:**
- Modify: `scripts/build-timeline.ts`
- Test: `scripts/build-timeline.test.ts`

- [ ] **Step 1: Write the failing test**

Create `scripts/build-timeline.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { CmPreset, CmTrack } from '@/core/types';
import { buildTimeline } from './build-timeline';

const PRESETS: CmPreset[] = [
  { name: 'Cancer Cup', date: '2026-06-30', server: 'global', dataVersion: 'test', courseId: '10906', surface: 'turf', distance: 2200 },
];
const TRACKS: CmTrack[] = [
  { index: 15, cupName: 'Cancer Cup', racetrack: 'Hanshin', distance: 2200, distanceClass: 'medium', surface: 'turf' },
  { index: 16, cupName: 'Leo Cup', racetrack: 'Nakayama', distance: 1200, distanceClass: 'sprint', surface: 'turf' },
  { index: 17, cupName: 'Virgo Cup', racetrack: 'Oi', distance: 2000, distanceClass: 'medium', surface: 'dirt' },
];
// Override stamps the anchor CM15 with its cmNumber (mirrors timeline_overrides.json).
const OVERRIDES = [
  { id: 'cm-cancer-cup-2026-06-30', cm: { cmNumber: 15, courseId: '10906', trackSummary: 'Hanshin turf 2200m' } },
];

describe('buildTimeline synthesis', () => {
  it('appends predicted CMs from cm_tracks after the anchor', () => {
    const { entries } = buildTimeline({ presets: PRESETS, overrides: OVERRIDES, tracks: TRACKS, dataVersion: 'test', horizon: 2 });
    const predicted = entries.filter((e) => e.tier === 'prediction');
    expect(predicted.map((e) => e.cm?.cmNumber)).toEqual([16, 17]);
    expect(predicted.every((e) => e.cm?.courseId === undefined)).toBe(true);
  });

  it('produces no predictions without tracks', () => {
    const { entries } = buildTimeline({ presets: PRESETS, overrides: OVERRIDES, dataVersion: 'test' });
    expect(entries.some((e) => e.tier === 'prediction')).toBe(false);
  });

  it('keeps entries sorted by effective date', () => {
    const { entries } = buildTimeline({ presets: PRESETS, overrides: OVERRIDES, tracks: TRACKS, dataVersion: 'test', horizon: 2 });
    const dates = entries.map((e) => e.dates.finals ?? '');
    expect([...dates]).toEqual([...dates].sort());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run scripts/build-timeline.test.ts`
Expected: FAIL — `buildTimeline` does not accept `tracks` / no `prediction` entries.

- [ ] **Step 3: Implement**

Replace the contents of `scripts/build-timeline.ts` with:

```ts
import { mergeTimeline, sortTimeline } from '@/core/timeline';
import { synthesizeUpcomingCms } from '@/core/cmSynthesis';
import type { CmPreset, CmTrack, TimelineEntry } from '@/core/types';

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/**
 * Each cm_preset → a `cm` TimelineEntry (real data; tier/status by server, P4),
 * overrides merged, then synthesized *predicted* CMs (cm_tracks rotation, monthly
 * cadence) appended — predictions never overwrite a present CM number.
 */
export function buildTimeline(inputs: {
  presets: CmPreset[];
  overrides: Array<Partial<TimelineEntry> & { id: string }>;
  tracks?: CmTrack[];
  dataVersion: string;
  horizon?: number;
}): { dataVersion: string; entries: TimelineEntry[] } {
  const base: TimelineEntry[] = inputs.presets.map((p) => ({
    id: `cm-${slug(p.name)}-${p.date}`,
    type: 'cm' as const,
    title: p.name,
    dates: { finals: p.date },
    cm: { courseId: p.courseId, trackSummary: `${p.distance}m ${p.surface}` },
    tier: (p.server === 'global' ? 'official' : 'datamined') as 'official' | 'datamined',
    status: (p.server === 'global' ? 'confirmed' : 'unconfirmed') as 'confirmed' | 'unconfirmed',
    source: { kind: 'umalator' as const, url: 'https://github.com/jalbarrang/umalator-global' },
    server: p.server,
    dataVersion: inputs.dataVersion,
  }));
  const merged = mergeTimeline(base, inputs.overrides);
  const predicted = synthesizeUpcomingCms(merged, inputs.tracks ?? [], {
    dataVersion: inputs.dataVersion,
    horizon: inputs.horizon,
  });
  return { dataVersion: inputs.dataVersion, entries: sortTimeline([...merged, ...predicted]) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run scripts/build-timeline.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Typecheck + commit**

Run: `pnpm typecheck` → no errors (existing `build-all.ts` call still compiles — `tracks` is optional).

```bash
git add scripts/build-timeline.ts scripts/build-timeline.test.ts
git commit -m "feat(m3): build-timeline appends synthesized predicted CMs"
```

---

## Task 4: Wire `cm_tracks` into the build + `timeline:rebuild` + regenerate `timeline.json`

**Files:**
- Modify: `scripts/build-all.ts`
- Create: `scripts/rebuild-timeline.ts`
- Modify: `package.json`
- Regenerate: `public/data/timeline.json`

- [ ] **Step 1: Wire `cm_tracks` into `build-all.ts`**

In `scripts/build-all.ts`: (a) add `existsSync` to the `node:fs` imports — there is currently no `node:fs` import, so add `import { existsSync } from 'node:fs';` near the `node:path` import; (b) add `CmTrack` to the `@/core/types` import on line 12; (c) replace the timeline-build line:

```ts
  const timeline = buildTimeline({ presets, overrides: timelineOverrides, dataVersion: DATA_VERSION });
```

with:

```ts
  // cm_tracks.json is generated out-of-band by `pnpm timeline:import`; read it if
  // present so synthesis can append predicted CMs (empty → no predictions).
  const cmTracksPath = join(PUBLIC_DATA_DIR, 'cm_tracks.json');
  const tracks = existsSync(cmTracksPath)
    ? readJson<{ tracks: CmTrack[] }>(cmTracksPath).tracks
    : [];
  const timeline = buildTimeline({ presets, overrides: timelineOverrides, tracks, dataVersion: DATA_VERSION });
```

- [ ] **Step 2: Create the focused rebuild script**

Create `scripts/rebuild-timeline.ts`:

```ts
/**
 * Focused timeline-only rebuild: regenerate public/data/timeline.json from the
 * already-built cm_presets.json + cm_tracks.json + data-overrides/timeline_overrides.json.
 * Unlike `pnpm data:build` it needs no scripts/borrowed/ inputs, so it runs in a
 * worktree. Assumes the other public/data/*.json are current.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { CmPreset, CmTrack, TimelineEntry } from '@/core/types';
import { buildTimeline } from './build-timeline';
import { UPSTREAM_COMMIT } from './fetch-borrowed';
import { OVERRIDES_DIR, PUBLIC_DATA_DIR, readJson, writeJsonDeterministic } from './lib/io';

const DATA_VERSION = `global-${UPSTREAM_COMMIT.slice(0, 8)}`;

const presets = readJson<CmPreset[]>(join(PUBLIC_DATA_DIR, 'cm_presets.json'));
const tracksPath = join(PUBLIC_DATA_DIR, 'cm_tracks.json');
const tracks = existsSync(tracksPath) ? readJson<{ tracks: CmTrack[] }>(tracksPath).tracks : [];
const overrides =
  readJson<{ entries?: Array<Partial<TimelineEntry> & { id: string }> }>(
    join(OVERRIDES_DIR, 'timeline_overrides.json'),
  ).entries ?? [];

const timeline = buildTimeline({ presets, overrides, tracks, dataVersion: DATA_VERSION });
writeJsonDeterministic(join(PUBLIC_DATA_DIR, 'timeline.json'), timeline);
const predicted = timeline.entries.filter((e) => e.tier === 'prediction').length;
console.log(`timeline.json rebuilt: ${timeline.entries.length} entries (${predicted} predicted).`);
```

- [ ] **Step 3: Add the `package.json` script**

In `package.json` `scripts`, add after the `timeline:import` line:

```json
    "timeline:rebuild": "tsx scripts/rebuild-timeline.ts",
```

- [ ] **Step 4: Typecheck, regenerate, verify the diff**

Run: `pnpm typecheck` → no errors.
Run: `pnpm timeline:rebuild`
Expected console: `timeline.json rebuilt: 35 entries (3 predicted).`

Run: `git --no-pager diff --stat public/data/timeline.json`
Expected: only additions (the 3 predicted entries). Inspect with `git --no-pager diff public/data/timeline.json` and confirm the new entries are CM16 Leo (`2026-07-30`), CM17 Virgo (`2026-08-30`), CM18 Libra (`2026-09-30`), each `"tier": "prediction"`, `"status": "unconfirmed"`, no `courseId`, and that **no existing entry changed**. If existing entries changed unexpectedly, STOP and report.

- [ ] **Step 5: Commit**

```bash
git add scripts/build-all.ts scripts/rebuild-timeline.ts package.json public/data/timeline.json
git commit -m "feat(m3): wire cm_tracks into build + timeline:rebuild; bake CM16-18 predictions"
```

---

## Task 5: `windowTimeline` range helper in `timelineView.ts`

**Files:**
- Modify: `src/features/meta-intel/timelineView.ts`
- Test: `src/features/meta-intel/timelineView.test.ts`

- [ ] **Step 1: Write the failing test**

In `src/features/meta-intel/timelineView.test.ts`, add `windowTimeline` to the existing `import { ... } from './timelineView'`, and append (the `entry()` builder already exists in this file):

```ts
describe('windowTimeline', () => {
  const entries = [
    entry({ id: 'ancient', dates: { finals: '2025-06-15' } }), // >1y ago
    entry({ id: 'recent', dates: { finals: '2026-05-15' } }),
    entry({ id: 'soon', dates: { finals: '2026-07-15' } }),
    entry({ id: 'far', dates: { finals: '2027-09-15' } }),     // >1y ahead
    entry({ id: 'undated', dates: {} }),
  ];
  const now = '2026-06-15';

  it('all → everything, order preserved', () => {
    expect(windowTimeline(entries, now, 'all').map((e) => e.id)).toEqual([
      'ancient', 'recent', 'soon', 'far', 'undated',
    ]);
  });
  it('upcoming → effective date on/after now (undated excluded)', () => {
    expect(windowTimeline(entries, now, 'upcoming').map((e) => e.id)).toEqual(['soon', 'far']);
  });
  it('year → [now-6mo, now+12mo], undated excluded', () => {
    expect(windowTimeline(entries, now, 'year').map((e) => e.id)).toEqual(['recent', 'soon']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/meta-intel/timelineView.test.ts`
Expected: FAIL — `windowTimeline` not exported.

- [ ] **Step 3: Implement**

In `src/features/meta-intel/timelineView.ts`, change the core import to add `addMonths`:

```ts
import { addMonths, effectiveDate } from '@/core/timeline';
```

and append:

```ts
export type RangeKey = 'upcoming' | 'year' | 'all';

export const RANGES: readonly { key: RangeKey; label: string }[] = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'year', label: '±1 year' },
  { key: 'all', label: 'All' },
];

/**
 * Restrict entries to a date window around `nowISO`. Undated entries (effectiveDate
 * '') appear only under 'all'. Order is preserved (caller sorts per lane).
 */
export function windowTimeline(entries: TimelineEntry[], nowISO: string, range: RangeKey): TimelineEntry[] {
  if (range === 'all') return entries;
  if (range === 'upcoming') return entries.filter((e) => effectiveDate(e) >= nowISO);
  const lo = addMonths(nowISO, -6);
  const hi = addMonths(nowISO, 12);
  return entries.filter((e) => {
    const d = effectiveDate(e);
    return d !== '' && d >= lo && d <= hi;
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/features/meta-intel/timelineView.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

Run: `pnpm typecheck` → no errors.

```bash
git add src/features/meta-intel/timelineView.ts src/features/meta-intel/timelineView.test.ts
git commit -m "feat(m3): windowTimeline range helper (upcoming/year/all)"
```

---

## Task 6: Range `<select>` in `TimelinePage.tsx`

**Files:**
- Modify: `src/features/meta-intel/TimelinePage.tsx`
- Modify: `src/features/meta-intel/meta-intel.css`
- Test: `src/features/meta-intel/TimelinePage.test.tsx`

- [ ] **Step 1: Write the failing test**

In `src/features/meta-intel/TimelinePage.test.tsx`, append two tests inside the existing `describe('TimelinePage', …)` block (the `ENTRIES` array already includes `cm14` "Gemini Cup" with finals `2026-05-30`, which is past relative to `now="2026-06-15"`):

```ts
  it('defaults to the Upcoming range, hiding past entries', () => {
    renderPage();
    expect(screen.queryByText('Gemini Cup')).not.toBeInTheDocument(); // cm14, 2026-05-30 (past)
    expect(screen.getByText('Cancer Cup')).toBeInTheDocument();       // cm15, 2026-06-30 (upcoming)
  });

  it('switching range to All reveals past entries', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.selectOptions(screen.getByLabelText('Date range'), 'all');
    expect(screen.getByText('Gemini Cup')).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/meta-intel/TimelinePage.test.tsx`
Expected: FAIL — no `Date range` control; Gemini Cup currently renders (no windowing).

- [ ] **Step 3: Implement**

In `src/features/meta-intel/TimelinePage.tsx`:

(a) Extend the timelineView import:

```ts
import { LANES, RANGES, type LaneKey, type RangeKey, currentCm, filterTimeline, nowIndex, partitionByLane, windowTimeline } from './timelineView';
```

(b) Add range state next to the other `useState`s (after `confirmedOnly`):

```ts
  const [range, setRange] = useState<RangeKey>('upcoming');
```

(c) Apply `windowTimeline` before `filterTimeline` and add `range` to the deps:

```ts
  const filtered = useMemo(
    () => filterTimeline(windowTimeline(entries, nowISO, range), { lanes: enabledLanes, confirmedOnly }),
    [entries, nowISO, range, enabledLanes, confirmedOnly],
  );
```

(d) Add the range `<select>` inside `.timeline-controls`, immediately after the "Confirmed only" `<label>` and before the "Jump to now" `<button>`:

```tsx
          <select
            className="tl-range"
            value={range}
            onChange={(e) => setRange(e.target.value as RangeKey)}
            aria-label="Date range"
          >
            {RANGES.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
```

- [ ] **Step 4: Style the select**

Append to `src/features/meta-intel/meta-intel.css`:

```css
.tl-range {
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--fg);
  font: inherit;
  padding: 0.15rem 0.35rem;
}
.tl-range:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run src/features/meta-intel/TimelinePage.test.tsx`
Expected: PASS — the two new tests plus all pre-existing TimelinePage tests stay green (none asserted "Gemini Cup" visible; the now-marker, confirmed-only, lane-toggle, and selection tests operate on upcoming entries — Cancer Cup, Maruzensky Banner, v2.1 Balance — which all remain visible under the default Upcoming range).

If any pre-existing test fails because the default Upcoming range hid an entry it relied on, fix the test by switching that test's range to `all` via `await user.selectOptions(screen.getByLabelText('Date range'), 'all')` before its assertions — do NOT change the component default.

- [ ] **Step 6: Typecheck + commit**

Run: `pnpm typecheck` → no errors.

```bash
git add src/features/meta-intel/TimelinePage.tsx src/features/meta-intel/meta-intel.css src/features/meta-intel/TimelinePage.test.tsx
git commit -m "feat(m3): timeline range selector (Upcoming/±1yr/All)"
```

---

## Task 7: Full verification + provenance note

**Files:**
- Modify: `docs/provenance.md`

- [ ] **Step 1: Add the provenance note**

In `docs/provenance.md`, find the timeline / `cm_tracks` dataset section and append a short note (match surrounding style):

```markdown
- **CM-schedule synthesis (M3):** `scripts/build-timeline.ts` appends *predicted* upcoming CMs via `synthesizeUpcomingCms` (`src/core/cmSynthesis.ts`) — cup name + track geometry from `cm_tracks.json` (uma.guide, https://uma.guide/cm-schedule/), dates by **monthly cadence** from the last confirmed CM (`tier: 'prediction'`, `status: 'unconfirmed'`, **no `courseId`** → excluded from M4's `projectCmSchedule`). Horizon 3. Overrides in `timeline_overrides.json` win. Regenerate timeline-only with `pnpm timeline:rebuild` (no `scripts/borrowed/` needed).
```

If no timeline dataset section exists, add this as a new bullet under the datasets list.

- [ ] **Step 2: Full test suite**

Run: `pnpm test`
Expected: PASS — all prior tests + the new synthesis/window/range tests, 0 failures.

- [ ] **Step 3: Build**

Run: `pnpm build`
Expected: typecheck + Vite build succeed.

- [ ] **Step 4: Commit**

```bash
git add docs/provenance.md
git commit -m "docs(m3): provenance note for CM-schedule synthesis"
```

---

## Self-Review (run after all tasks)

- **Spec coverage:** synthesis (`cmSynthesis.ts`, Task 2) ✓; monthly cadence via `addMonths` (Task 1) ✓; build integration + overrides-win + horizon 3 (Tasks 3–4) ✓; baked `timeline.json` CM16–18 (Task 4) ✓; M4 boundary preserved — predictions have no `courseId`, `projectCmSchedule` unchanged, asserted in `cmSynthesis.test.ts` (no-courseId) ✓; range/zoom `windowTimeline` + selector, default Upcoming (Tasks 5–6) ✓; provenance (Task 7) ✓.
- **Type consistency:** `synthesizeUpcomingCms(merged, tracks, SynthesizeOpts)` signature identical across `cmSynthesis.ts`, `build-timeline.ts`, and the rebuild script; `RangeKey`/`RANGES`/`windowTimeline` names match between `timelineView.ts` and `TimelinePage.tsx`; `addMonths` imported from `@/core/timeline` in both `cmSynthesis.ts` and `timelineView.ts`.
- **Placeholder scan:** none — every step ships complete code.
- **Honesty (P3/P4):** predictions badged `~`, no `courseId`, never fed to M4; `courseId`-less means `projectCmSchedule` excludes them; the existing detail-panel hand-confirm hint covers unconfirmed entries.

---

## Execution Handoff

Subagent-driven: one fresh subagent per task with the full task text, TDD, two-stage review. After Task 7, finish via finishing-a-development-branch (merge to main). Note: `public/data/timeline.json` regenerated in Task 4 will conflict on merge only if `main` regenerated it meanwhile — unlikely; resolve by re-running `pnpm timeline:rebuild` on `main` post-merge if so.
