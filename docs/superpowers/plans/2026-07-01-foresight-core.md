# Foresight Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Predict Global CM dates by calibrating a rolling pace from shared Champions Meetings (JP↔Global) and projecting upcoming JP CMs, replacing `cmSynthesis`'s naive "+1 month" cadence.

**Architecture:** A pure-core `foresight.ts` (`calibratePace` + `projectGlobalDate`, the latter reusing the existing `predictGlobalDate`) is fed JP dates from a hand-curated `data-overrides/jp-schedule.json` and Global dates from the merged timeline. `cmSynthesis.synthesizeUpcomingCms` uses it to date predicted CMs, falling back to `addMonths` when uncalibratable.

**Tech Stack:** TypeScript, Vitest (jsdom), pure `src/core/` functions (P6). No new deps.

## Global Constraints

- **P3 honesty:** predicted CMs stay `tier:'prediction'`, `status:'unconfirmed'`. Confirmed Global dates ALWAYS win — foresight only fills CMs with no confirmed Global date.
- **P6 pure core:** all prediction math lives in `src/core/foresight.ts` as pure functions, unit-tested.
- **Reuse, don't reinvent:** `projectGlobalDate` MUST call the existing `predictGlobalDate(jpISO, pace, anchorJp, anchorGlobal)` from `src/core/timeline.ts` — no new date math.
- **No regression:** with no JP schedule / < 2 shared CMs, `synthesizeUpcomingCms` reproduces today's `addMonths` output byte-for-byte.
- **No importer / no scraping:** `data-overrides/jp-schedule.json` is hand-curated (uma.guide verified to carry no dates, 2026-07-01). JP dates are public facts; Moomoolator/GameTora are cross-check references only.
- **Mapping fact:** Global CM number N mirrors JP CM number N (verified: JP ids 10–15 gaps 32/31/32/21/30 reproduce GameTora's table exactly).
- **Windows/case-FS:** `noUncheckedIndexedAccess` is on — guard array indexing (no bare `arr[0].x`).

---

### Task 1: JP schedule data + type

**Files:**
- Create: `data-overrides/jp-schedule.json`
- Modify: `src/core/types.ts` (append the JP-schedule types near the other CM types, ~line 308 after `CmTrack`)
- Test: `src/core/jpSchedule.test.ts`

**Interfaces:**
- Produces: `JpCmDate { cmNumber: number; cupName: string; jpDate: string }`, `JpBanner { name: string; jpDate: string; kind: 'support'|'uma' }`, `JpScenario { name: string; jpDate: string }`, `JpSchedule { cms: JpCmDate[]; banners: JpBanner[]; scenarios: JpScenario[] }`.

- [ ] **Step 1: Add the types** to `src/core/types.ts` (append after the `CmTrack` interface):

```ts
/**
 * Hand-curated JP schedule (data-overrides/jp-schedule.json). Global CM number N
 * mirrors JP CM number N, so `cmNumber` is the shared index. `jpDate` = JP-server
 * date (CM: finals-adjacent start; banner/scenario: release/start). Dates are
 * public facts; seeded by cross-checking Moomoolator + trackers. PREDICTION input
 * only (P3). uma.guide carries no dates, so this is not imported.
 */
export interface JpCmDate {
  cmNumber: number;
  cupName: string;
  jpDate: string; // YYYY-MM-DD
}
export interface JpBanner {
  name: string;
  jpDate: string; // YYYY-MM-DD
  kind: 'support' | 'uma';
}
export interface JpScenario {
  name: string;
  jpDate: string; // YYYY-MM-DD
}
export interface JpSchedule {
  cms: JpCmDate[];
  banners: JpBanner[];
  scenarios: JpScenario[];
}
```

- [ ] **Step 2: Create the seed data** `data-overrides/jp-schedule.json`. CM `jpDate`s are JP start dates from Moomoolator's `jp-champions-meetings.json` (ids 10–18). `banners`/`scenarios` are empty this slice (schema ready; seeded when a consumer lands — no wired consumer yet, so hand-curating them now is premature per YAGNI):

```json
{
  "_comment": "Hand-curated JP schedule (public-fact dates). Global CM N mirrors JP CM N. jpDate = JP start date. Seeded from Moomoolator jp-champions-meetings.json (cross-check GameTora). Add rows when JP announces new CMs. banners/scenarios: schema ready, seeded when consumed (foresight slice #2/#3).",
  "cms": [
    { "cmNumber": 10, "cupName": "Aquarius Cup", "jpDate": "2022-02-18" },
    { "cmNumber": 11, "cupName": "Pisces Cup", "jpDate": "2022-03-22" },
    { "cmNumber": 12, "cupName": "Aries Cup", "jpDate": "2022-04-22" },
    { "cmNumber": 13, "cupName": "Taurus Cup", "jpDate": "2022-05-24" },
    { "cmNumber": 14, "cupName": "Gemini Cup", "jpDate": "2022-06-14" },
    { "cmNumber": 15, "cupName": "Cancer Cup", "jpDate": "2022-07-14" },
    { "cmNumber": 16, "cupName": "Leo Cup", "jpDate": "2022-08-13" },
    { "cmNumber": 17, "cupName": "Virgo Cup", "jpDate": "2022-09-15" },
    { "cmNumber": 18, "cupName": "Libra Cup", "jpDate": "2022-10-14" }
  ],
  "banners": [],
  "scenarios": []
}
```

- [ ] **Step 3: Write the failing test** `src/core/jpSchedule.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { JpSchedule } from './types';
import schedule from '../../data-overrides/jp-schedule.json';

const jp = schedule as unknown as JpSchedule;

describe('jp-schedule.json', () => {
  it('parses as a JpSchedule with sorted CM rows and ISO dates', () => {
    expect(Array.isArray(jp.cms)).toBe(true);
    const nums = jp.cms.map((c) => c.cmNumber);
    expect(nums).toEqual([...nums].sort((a, b) => a - b)); // sorted, no dupes handled below
    expect(new Set(nums).size).toBe(nums.length);
    for (const c of jp.cms) {
      expect(c.jpDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(c.cupName.length).toBeGreaterThan(0);
    }
  });

  it('carries the CM10-15 JP dates used by the pace self-validation', () => {
    const byNum = new Map(jp.cms.map((c) => [c.cmNumber, c.jpDate]));
    expect(byNum.get(10)).toBe('2022-02-18');
    expect(byNum.get(11)).toBe('2022-03-22');
    expect(byNum.get(12)).toBe('2022-04-22');
    expect(byNum.get(13)).toBe('2022-05-24');
    expect(byNum.get(14)).toBe('2022-06-14');
    expect(byNum.get(15)).toBe('2022-07-14');
  });
});
```

- [ ] **Step 4: Run the test to verify it fails, then passes**

Run: `pnpm vitest run src/core/jpSchedule.test.ts`
Expected: FAIL if the JSON import resolves before the file/types exist; PASS once Steps 1–2 are in. (JSON imports need `resolveJsonModule`, already on in this repo.)

- [ ] **Step 5: Commit**

```bash
git add src/core/types.ts data-overrides/jp-schedule.json src/core/jpSchedule.test.ts
git commit -m "feat(foresight): hand-curated jp-schedule.json + JpSchedule types"
```

---

### Task 2: `foresight.ts` — calibrate + project (the self-validation)

**Files:**
- Create: `src/core/foresight.ts`
- Test: `src/core/foresight.test.ts`

**Interfaces:**
- Consumes: `predictGlobalDate(jpISO: string, paceMultiplier: number, anchorJpISO: string, anchorGlobalISO: string): string` from `./timeline`.
- Produces:
  - `SharedCm { cmNumber: number; jp: string; global: string }`
  - `Calibration { pace: number; gapDays: number; anchorJp: string; anchorGlobal: string; windowSteps: number }`
  - `calibratePace(shared: SharedCm[], window?: number): Calibration | null`
  - `projectGlobalDate(jpISO: string, cal: Calibration): string`

- [ ] **Step 1: Write the failing test** `src/core/foresight.test.ts`. The first test reproduces GameTora's published Foresight numbers (Aquarius→Cancer / CM10→15); JP dates from `jp-schedule`, Global finals are the real confirmed dates:

```ts
import { describe, it, expect } from 'vitest';
import { calibratePace, projectGlobalDate, type SharedCm } from './foresight';

// CM10-15: JP start dates (jp-schedule) + real confirmed Global finals.
const SHARED: SharedCm[] = [
  { cmNumber: 10, jp: '2022-02-18', global: '2026-03-06' },
  { cmNumber: 11, jp: '2022-03-22', global: '2026-03-30' },
  { cmNumber: 12, jp: '2022-04-22', global: '2026-04-23' },
  { cmNumber: 13, jp: '2022-05-24', global: '2026-05-14' },
  { cmNumber: 14, jp: '2022-06-14', global: '2026-06-04' },
  { cmNumber: 15, jp: '2022-07-14', global: '2026-06-24' },
];

describe('calibratePace (reproduces GameTora Foresight numbers)', () => {
  it('computes ~1.33x pace and ~1441-day gap over CM10-15', () => {
    const cal = calibratePace(SHARED)!;
    expect(cal).not.toBeNull();
    // JP span 146d / Global span 110d = 1.3273 (GameTora: avg JA 29.2 / avg server 22 = 1.33x)
    expect(cal.pace).toBeCloseTo(1.327, 2);
    expect(cal.gapDays).toBe(1441); // GameTora: "1441.8 days behind JA"
    expect(cal.windowSteps).toBe(5);
    expect(cal.anchorJp).toBe('2022-07-14');
    expect(cal.anchorGlobal).toBe('2026-06-24');
  });

  it('uses only the last `window` shared CMs', () => {
    const cal = calibratePace(SHARED, 3)!; // last 3 = CM13,14,15
    expect(cal.windowSteps).toBe(2);
    expect(cal.anchorGlobal).toBe('2026-06-24');
  });

  it('returns null with fewer than 2 shared CMs', () => {
    expect(calibratePace([])).toBeNull();
    expect(calibratePace([SHARED[0]!])).toBeNull();
  });
});

describe('projectGlobalDate', () => {
  it('projects the next JP CM onto the compressed Global timeline', () => {
    const cal = calibratePace(SHARED)!;
    // CM16 Leo JP 2022-08-13 = anchor + 30d; /1.3273 = 22.6d after 2026-06-24 = 2026-07-16
    expect(projectGlobalDate('2022-08-13', cal)).toBe('2026-07-16');
  });

  it('round-trips the anchor CM to ~its real Global date', () => {
    const cal = calibratePace(SHARED)!;
    expect(projectGlobalDate('2022-07-14', cal)).toBe('2026-06-24');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/core/foresight.test.ts`
Expected: FAIL — `foresight.ts` does not exist / functions undefined.

- [ ] **Step 3: Implement** `src/core/foresight.ts`:

```ts
/**
 * Foresight: predict Global dates from JP dates by calibrating a *rolling* pace
 * from the last N shared Champions Meetings (JP↔Global), then compressing the
 * interval from the most recent shared CM. Generalizes predictGlobalDate from
 * fixed launch anchors to rolling CM anchors (GameTora's Foresight method).
 * PREDICTION ONLY (P3). Pure (P6).
 */
import { predictGlobalDate } from './timeline';

const DAY = 86_400_000;

/** A CM present on both servers with real dates. */
export interface SharedCm {
  cmNumber: number;
  jp: string; // YYYY-MM-DD, JP date
  global: string; // YYYY-MM-DD, confirmed Global date
}

export interface Calibration {
  /** JP days per Global day over the window (>1 ⇒ Global compresses JP). */
  pace: number;
  /** global[last] − jp[last]: how far behind JP the latest shared CM is. */
  gapDays: number;
  anchorJp: string;
  anchorGlobal: string;
  /** CM-to-CM steps used (window length − 1). */
  windowSteps: number;
}

/**
 * Rolling calibration over the last `window` (default 6) shared CMs.
 * pace = (jp[last] − jp[first]) / (global[last] − global[first])
 *      = total JP span / total Global span (== GameTora's avg JA gap / avg server gap).
 * Returns null with < 2 shared CMs or a non-positive Global span (caller falls back).
 */
export function calibratePace(shared: SharedCm[], window = 6): Calibration | null {
  const sorted = [...shared].sort((a, b) => a.cmNumber - b.cmNumber);
  const w = sorted.slice(-window);
  if (w.length < 2) return null;
  const first = w[0];
  const last = w[w.length - 1];
  if (first === undefined || last === undefined) return null;
  const jpSpan = (Date.parse(last.jp) - Date.parse(first.jp)) / DAY;
  const globalSpan = (Date.parse(last.global) - Date.parse(first.global)) / DAY;
  if (globalSpan <= 0) return null;
  return {
    pace: jpSpan / globalSpan,
    gapDays: Math.round((Date.parse(last.global) - Date.parse(last.jp)) / DAY),
    anchorJp: last.jp,
    anchorGlobal: last.global,
    windowSteps: w.length - 1,
  };
}

/** Project a JP date to Global using the rolling calibration (reuses predictGlobalDate). */
export function projectGlobalDate(jpISO: string, cal: Calibration): string {
  return predictGlobalDate(jpISO, cal.pace, cal.anchorJp, cal.anchorGlobal);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/core/foresight.test.ts`
Expected: PASS (7 assertions across 5 tests).

- [ ] **Step 5: Typecheck + commit**

```bash
pnpm typecheck
git add src/core/foresight.ts src/core/foresight.test.ts
git commit -m "feat(foresight): calibratePace + projectGlobalDate (rolling CM pace)"
```

---

### Task 3: Wire foresight into CM synthesis

**Files:**
- Modify: `src/core/cmSynthesis.ts` (add `jpCms` to `SynthesizeOpts`; build shared CMs; project or fall back)
- Modify: `scripts/build-timeline.ts:11-34` (`buildTimeline` accepts + forwards `jpCms`)
- Modify: `scripts/build-all.ts:137-143` (read `data-overrides/jp-schedule.json`, pass `jpCms`)
- Modify: `scripts/rebuild-timeline.ts` (same read + pass)
- Test: `src/core/cmSynthesis.test.ts` (extend)

**Interfaces:**
- Consumes: `calibratePace`, `projectGlobalDate`, `SharedCm` from `./foresight`; `JpCmDate` from `./types`.
- Produces: `SynthesizeOpts.jpCms?: JpCmDate[]`; `buildTimeline` input gains `jpCms?: JpCmDate[]`.

- [ ] **Step 1: Write the failing test** — extend `src/core/cmSynthesis.test.ts` with a describe block. It asserts that WITH `jpCms` the predicted CM16 uses the projected date (2026-07-16), and WITHOUT it the old `addMonths` date (2026-07-24, one month after the CM15 anchor 2026-06-24):

```ts
import type { JpCmDate } from './types';

describe('synthesizeUpcomingCms — foresight pace projection', () => {
  const merged: TimelineEntry[] = [
    { id: 'cm15', type: 'cm', title: 'Cancer Cup', dates: { finals: '2026-06-24' },
      cm: { cmNumber: 15 }, tier: 'official', status: 'confirmed',
      source: { kind: 'official_news', url: '' }, server: 'global', dataVersion: 'x' },
    // a prior confirmed CM so there are >= 2 shared CMs to calibrate
    { id: 'cm14', type: 'cm', title: 'Gemini Cup', dates: { finals: '2026-06-04' },
      cm: { cmNumber: 14 }, tier: 'official', status: 'confirmed',
      source: { kind: 'official_news', url: '' }, server: 'global', dataVersion: 'x' },
  ];
  const tracks: CmTrack[] = [
    { index: 16, cupName: 'Leo Cup', racetrack: 'Hanshin', distance: 2200, distanceClass: 'medium', surface: 'turf' },
  ];
  const jpCms: JpCmDate[] = [
    { cmNumber: 14, cupName: 'Gemini Cup', jpDate: '2022-06-14' },
    { cmNumber: 15, cupName: 'Cancer Cup', jpDate: '2022-07-14' },
    { cmNumber: 16, cupName: 'Leo Cup', jpDate: '2022-08-13' },
  ];

  it('dates a predicted CM by pace projection when jpCms is supplied', () => {
    const out = synthesizeUpcomingCms(merged, tracks, { dataVersion: 'x', horizon: 1, jpCms });
    expect(out).toHaveLength(1);
    expect(out[0]!.cm?.cmNumber).toBe(16);
    // CM14->15 pace = 30d/20d = 1.5; CM16 JP +30d / 1.5 = 20d after 2026-06-24 = 2026-07-14
    expect(out[0]!.dates.finals).toBe('2026-07-14');
    expect(out[0]!.tier).toBe('prediction');
  });

  it('falls back to +1-month cadence when jpCms is absent (no regression)', () => {
    const out = synthesizeUpcomingCms(merged, tracks, { dataVersion: 'x', horizon: 1 });
    expect(out[0]!.dates.finals).toBe('2026-07-24'); // addMonths(2026-06-24, 1)
  });
});
```

> Note the projected value here is **2026-07-14**, not 2026-07-16: this fixture has only CM14→15 shared (pace 30/20 = 1.5), a smaller window than the full CM10-15 (pace 1.327). The math is identical; the window differs. This is intentional — it proves the projection tracks the calibrated pace.

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run src/core/cmSynthesis.test.ts`
Expected: FAIL — `jpCms` unused, predicted CM16 still `addMonths` (2026-07-24) in the first test.

- [ ] **Step 3: Modify `src/core/cmSynthesis.ts`**. Add the import, the `jpCms` option, shared-CM construction, and the projection-or-fallback:

Change the imports (line 8–10):

```ts
import type { CmTrack, JpCmDate, TimelineEntry } from './types';
import { addMonths } from './timeline';
import { calibratePace, projectGlobalDate, type SharedCm } from './foresight';
import { slug } from './slug';
```

Add to `SynthesizeOpts` (after `sourceUrl`, line 19):

```ts
  /** JP CM dates (data-overrides/jp-schedule.json) for pace projection; absent ⇒ +1-month fallback. */
  jpCms?: JpCmDate[];
```

After `if (anchor === null) return [];` (line 46), build the calibration:

```ts
  // Calibrate a rolling JP→Global pace from CMs present on both servers (confirmed
  // Global finals ∩ a JP date). null ⇒ too few shared CMs ⇒ +1-month fallback.
  const jpByNum = new Map((opts.jpCms ?? []).map((c) => [c.cmNumber, c.jpDate]));
  const shared: SharedCm[] = [];
  for (const e of merged) {
    const num = e.cm?.cmNumber;
    if (e.type !== 'cm' || num === undefined) continue;
    const global = e.dates.finals;
    const jp = jpByNum.get(num);
    if (global !== undefined && jp !== undefined) shared.push({ cmNumber: num, jp, global });
  }
  const cal = calibratePace(shared);
```

Replace the `dates` line inside the loop (line 63) with:

```ts
      dates: {
        finals:
          cal && jpByNum.has(n)
            ? projectGlobalDate(jpByNum.get(n)!, cal)
            : addMonths(anchor.finals, (n - anchor.num) * monthsPerCm),
      },
```

- [ ] **Step 4: Run to verify the core tests pass**

Run: `pnpm vitest run src/core/cmSynthesis.test.ts src/core/foresight.test.ts`
Expected: PASS (both fixtures + no-regression case).

- [ ] **Step 5: Forward `jpCms` through the build.** In `scripts/build-timeline.ts`, add to the `buildTimeline` input type (line 11–17) and the `synthesizeUpcomingCms` call (line 31–34):

```ts
import type { CmPreset, CmTrack, JpCmDate, TimelineEntry } from '@/core/types';
// ... in the inputs type:
  jpCms?: JpCmDate[];
// ... in the synthesize call:
  const predicted = synthesizeUpcomingCms(merged, inputs.tracks ?? [], {
    dataVersion: inputs.dataVersion,
    horizon: inputs.horizon,
    jpCms: inputs.jpCms,
  });
```

In `scripts/build-all.ts`, before the `buildTimeline(...)` call (~line 143), read the schedule and pass it:

```ts
  const jpSchedule = readJson<{ cms?: JpCmDate[] }>(join(OVERRIDES_DIR, 'jp-schedule.json'));
  const timeline = buildTimeline({ presets, overrides: timelineOverrides, tracks, jpCms: jpSchedule.cms ?? [], dataVersion: DATA_VERSION });
```

Add `JpCmDate` to the `@/core/types` import at the top of `build-all.ts`.

In `scripts/rebuild-timeline.ts`, mirror the same read + pass (it calls `buildTimeline` too — add the `jpCms` read from `OVERRIDES_DIR/jp-schedule.json` and pass it, plus the `JpCmDate` import).

- [ ] **Step 6: Rebuild the timeline + verify real output changed and the gate holds**

Run: `pnpm data:build` (or `pnpm timeline:rebuild`)
Expected: succeeds; console shows the timeline rebuilt. Predicted CMs (e.g. CM16 Leo) now carry a **pace-projected** finals date, not `addMonths`. Confirmed CMs are unchanged (finals from official news / overrides win).

Run: `pnpm typecheck && pnpm test`
Expected: PASS. If `scripts/outputs.test.ts` asserts an exact predicted-CM date, update it to the projected value.

- [ ] **Step 7: Commit**

```bash
git add src/core/cmSynthesis.ts src/core/cmSynthesis.test.ts scripts/build-timeline.ts scripts/build-all.ts scripts/rebuild-timeline.ts public/data/timeline.json
git commit -m "feat(foresight): cmSynthesis dates predicted CMs by rolling pace (fallback +1mo)"
```

---

## Self-Review

**Spec coverage:**
- ✅ `data-overrides/jp-schedule.json` (hand-curated) — Task 1.
- ✅ `foresight.ts` (`calibratePace` + `projectGlobalDate`, reuses `predictGlobalDate`) — Task 2.
- ✅ Rolling last-N pace + GameTora self-validation — Task 2 test.
- ✅ Wire into `cmSynthesis` + fallback guard — Task 3.
- ✅ Confirmed-wins / `tier:'prediction'` — preserved (Task 3 only sets predicted CMs' finals; `present` still skips confirmed).
- ✅ Banners/scenarios: schema in types + empty in seed (no consumer this slice) — Task 1, matches spec Non-goals.
- Out of scope (later slices), correctly absent: availability gate, UI readout, per-card prediction, rebalances.

**Type consistency:** `SharedCm`/`Calibration` (foresight.ts) and `JpCmDate`/`JpSchedule` (types.ts) are used identically across tasks; `projectGlobalDate(jpISO, cal)` signature matches its call in cmSynthesis; `calibratePace` returns `Calibration | null` and every caller null-checks.

**Placeholder scan:** no TBDs; every code step shows complete code; dates are concrete and validated against GameTora's published numbers.
