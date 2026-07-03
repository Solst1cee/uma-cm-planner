# Availability Gate — JP-ahead Umas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Emit the ~170 JP-only umas as `server:'jp'` records with foresight-projected Global dates, and gate both uma surfaces (M4 unique chart + the runner picker) by the plan's CM date + a `show upcoming` toggle. Their uniques come free from the engine bundle — no skill emission.

**Architecture:** `buildJpUmas` mirrors slice 2a's `buildJpCards`, reusing `foresight-build.ts` + the existing `statGrowthFromGt`/`baseAptitudesFromGt`/`stripTitleBrackets` helpers. Each gated surface changes its `globalUmas` memo to opt-in JP umas released by the CM date behind a toggle.

**Tech Stack:** TypeScript, Vitest, tsx build scripts, React. No new deps. No `sim:build`.

## Global Constraints

- **Reuse:** dates via `projectReleaseDate` / `buildForesightCalibration` (`scripts/lib/foresight-build.ts`, from slice 2a on main); uma-record helpers `statGrowthFromGt`/`baseAptitudesFromGt`/`stripTitleBrackets` (in `scripts/build-umas.ts`); gate via `isReleasedBy` (`@/core/availability`); CM-date derivation mirrors `SkillChartPanel`. No reinvented math.
- **No skill emission / no `skills.json` change:** uniques come from the engine bundle via `loadUniqueSkillByUmaId` (verified: `120011`/`110071`/`120131` are in `@/sim/vendor/*.mjs`). `skills.json` and its counts are untouched.
- **P3:** JP umas are `server:'jp'`, projected dates carry `releaseDatePredicted:true`; an announced `release_en` wins. JP umas show gametora fan-TL names (`name_en`/`title`) as honest preview.
- **Gate rule:** a surface shows a uma when `u.server === plan.server` OR (`showUpcoming` AND `isReleasedBy(u, asOfISO)`). Default (`showUpcoming` off) is unchanged behaviour.
- **Confirmed-CM calibration** comes from `timeline_overrides.json` `status:'confirmed'` (the `cal` already computed in `build-all.ts` by slice 2a).
- **Windows/case-FS:** `noUncheckedIndexedAccess` is on — guard array indexing.

---

### Task 1: Emit JP-only umas in the build

**Files:**
- Modify: `src/core/types.ts` (`UmaRecord`: add `releaseDate?` + `releaseDatePredicted?`)
- Modify: `scripts/lib/upstream-types.ts` (`GtCharacterCard`: add `release?`)
- Modify: `scripts/build-umas.ts` (add `buildJpUmas`)
- Modify: `scripts/build-all.ts` (concat JP umas, reusing the slice-2a `cal`)
- Modify: `scripts/outputs.test.ts` (uma count)
- Test: `scripts/build-umas.jp.test.ts`

**Interfaces:**
- Consumes: `projectReleaseDate` + `Calibration` from `scripts/lib/foresight-build.ts` / `@/core/foresight`; `statGrowthFromGt`, `baseAptitudesFromGt`, `stripTitleBrackets` (exported or module-local in `scripts/build-umas.ts` — export if needed).
- Produces: `buildJpUmas(inputs: { gametoraChars: GtCharacterCard[]; masterUmaIds: ReadonlySet<string>; cal: Calibration | null; dataVersion: string }): UmaRecord[]`.

- [ ] **Step 1: Add `UmaRecord` fields** in `src/core/types.ts` (in the `UmaRecord` interface, after `epithet`):

```ts
  /** ISO Global release date; absent = released/unknown. Set on upcoming (server:'jp') records. */
  releaseDate?: string;
  /** true when releaseDate is a JP→Global projection, not an official announcement (P3). */
  releaseDatePredicted?: boolean;
```

- [ ] **Step 2: Extend `GtCharacterCard`** in `scripts/lib/upstream-types.ts` (add after `release_en?`):

```ts
  /** JP release date (ISO), present across the whole catalog incl. JP-only. */
  release?: string;
```

- [ ] **Step 3: Write the failing test** `scripts/build-umas.jp.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildJpUmas } from './build-umas';
import type { GtCharacterCard } from './lib/upstream-types';
import { buildForesightCalibration } from './lib/foresight-build';

const cal = buildForesightCalibration(
  [{ cmNumber: 15, cupName: 'Cancer Cup', jpDate: '2022-07-14' }, { cmNumber: 14, cupName: 'Gemini Cup', jpDate: '2022-06-14' }],
  [{ cmNumber: 15, global: '2026-06-24' }, { cmNumber: 14, global: '2026-06-04' }],
);
const chars: GtCharacterCard[] = [
  { card_id: 100103, char_id: 1001, name_en: 'Special Week', title: 'Special Dreamer',
    aptitude: ['A','G','G','C','A','A','A','B','C','G'], stat_bonus: [10,0,10,0,10], release: '2022-08-13' },
  { card_id: 100101, char_id: 1001, name_en: 'Special Week', title: 'Base', // in master set → skipped
    aptitude: ['A','G','G','C','A','A','A','B','C','G'], stat_bonus: [10,0,10,0,10], release: '2020-01-01', release_en: '2025-06-26' },
];

describe('buildJpUmas', () => {
  const out = buildJpUmas({ gametoraChars: chars, masterUmaIds: new Set(['100101']), cal, dataVersion: 'test' });
  it('emits gametora chars absent from the master set as server:jp', () => {
    expect(out).toHaveLength(1);
    expect(out[0]!.umaId).toBe('100103');
    expect(out[0]!.server).toBe('jp');
    expect(out[0]!.charaId).toBe('1001');
  });
  it('projects the release date (predicted) + maps name/epithet/aptitudes', () => {
    expect(out[0]!.releaseDate).toBeDefined();
    expect(out[0]!.releaseDatePredicted).toBe(true);
    expect(out[0]!.nameEn).toBe('Special Week');
    expect(out[0]!.epithet).toBe('Special Dreamer');
    expect(out[0]!.baseAptitudes).toBeDefined();
    expect(out[0]!.statGrowth).toBeDefined();
  });
});
```

- [ ] **Step 4: Run to verify it fails**

Run: `pnpm vitest run scripts/build-umas.jp.test.ts`
Expected: FAIL — `buildJpUmas` not exported.

- [ ] **Step 5: Implement `buildJpUmas`** in `scripts/build-umas.ts` (add after `buildUmas`; ensure `statGrowthFromGt`, `baseAptitudesFromGt`, `stripTitleBrackets` are reachable — they're module-local, so just call them; import `projectReleaseDate` + `Calibration`):

```ts
// at top of build-umas.ts:
import { projectReleaseDate } from './lib/foresight-build';
import type { Calibration } from '@/core/foresight';

/** JP-ahead umas: gametora chars absent from the Global master extract (server:'jp'). */
export function buildJpUmas(inputs: {
  gametoraChars: GtCharacterCard[];
  masterUmaIds: ReadonlySet<string>;
  cal: Calibration | null;
  dataVersion: string;
}): UmaRecord[] {
  const { gametoraChars, masterUmaIds, cal, dataVersion } = inputs;
  const records: UmaRecord[] = [];
  for (const gt of gametoraChars) {
    const umaId = String(gt.card_id);
    if (masterUmaIds.has(umaId)) continue; // Global uma
    const charaId = String(Math.floor(gt.card_id / 100));
    const { releaseDate, predicted } = projectReleaseDate(gt.release, gt.release_en, cal);
    const epithet = stripTitleBrackets(gt.title_en_gl ?? gt.title ?? '');
    const rec: UmaRecord = {
      umaId,
      charaId,
      nameEn: gt.name_en ?? `Uma ${umaId}`,
      server: 'jp',
      dataVersion,
      ...(gt.aptitude && gt.stat_bonus
        ? { statGrowth: statGrowthFromGt(gt, umaId), baseAptitudes: baseAptitudesFromGt(gt, umaId) }
        : {}),
    };
    if (epithet !== '') rec.epithet = epithet;
    if (releaseDate !== undefined) rec.releaseDate = releaseDate;
    if (predicted) rec.releaseDatePredicted = true;
    records.push(rec);
  }
  records.sort((a, b) => Number(a.umaId) - Number(b.umaId));
  return records;
}
```

(If `statGrowthFromGt`/`baseAptitudesFromGt`/`stripTitleBrackets` are declared `function` at module scope they are already reachable; no export needed. If any is currently un-exported *and* the test imports it, export it — but the test above only imports `buildJpUmas`.)

- [ ] **Step 6: Run the JP-uma test to verify it passes**

Run: `pnpm vitest run scripts/build-umas.jp.test.ts`
Expected: PASS.

- [ ] **Step 7: Wire into `scripts/build-all.ts`.** Find where umas are built (`buildUmas({ … })` assigned to a `umas`/`globalUmas` var) and the slice-2a calibration `cal`. Concat JP umas:

```ts
import { buildJpUmas } from './build-umas';
// … after the Global umas are built (call the existing result `umaRecords`):
const jpUmas = buildJpUmas({
  gametoraChars,                    // the GtCharacterCard[] already read for buildUmas
  masterUmaIds: new Set(umaRecords.map((u) => u.umaId)),
  cal,                              // reuse the Calibration computed for the cards slice
  dataVersion: DATA_VERSION,
});
console.log(`build-umas: emitted ${jpUmas.length} JP-ahead uma(s) (${jpUmas.filter((u) => u.releaseDatePredicted).length} date-projected)`);
const allUmas = [...umaRecords, ...jpUmas].sort((a, b) => Number(a.umaId) - Number(b.umaId));
// write allUmas to public/data/umas.json (replace the prior `umas` write)
```

(Confirm the actual local var names for the built umas + gametora chars + `cal`; if `cal` is scoped to the cards block, lift its declaration so umas can reuse it — do NOT recompute a second calibration.)

- [ ] **Step 8: Rebuild + update the count.**

Run: `pnpm data:fetch && pnpm data:build`
Expected: succeeds; logs `build-umas: emitted N JP-ahead uma(s)` + the final `… N umas`. Update `scripts/outputs.test.ts`: the uma-count assertion from `87` to the new total (87 + emitted); add a Global-count assertion if helpful. Do NOT hardcode the JP count if the file uses a total (a total pins it).

- [ ] **Step 9: Full gate + commit**

Run: `pnpm typecheck && pnpm test`
Expected: PASS.

```bash
git add src/core/types.ts scripts/lib/upstream-types.ts scripts/build-umas.ts scripts/build-umas.jp.test.ts scripts/build-all.ts scripts/outputs.test.ts public/data/umas.json
git commit -m "feat(availability): emit JP-ahead umas (server:jp, foresight-dated)"
```

---

### Task 2: Gate the M4 unique-skill chart

**Files:**
- Modify: `src/features/cm-planner/UmaChartPanel.tsx`
- Test: `src/features/cm-planner/UmaChartPanel.test.tsx` (extend)

**Interfaces:**
- Consumes: `isReleasedBy` (`@/core/availability`); `TimelineEntry` (`@/core/types`); the `UmaRecord.server`/`releaseDate`/`releaseDatePredicted` fields (Task 1).

- [ ] **Step 1: Write the failing test** — extend `UmaChartPanel.test.tsx`. Mock `useGameData` with a Global uma + a JP uma (released by the CM date), and a `timeline` giving the plan's CM a date. Assert the JP uma isn't among the chart candidates by default and appears after toggling `show upcoming`. (Match the file's existing render helper + how it stubs `useUmaChart`/`loadUniqueByUmaId` — the chart's sim runs a Worker, so keep those stubbed as the existing tests do.) The load-bearing assertion is on the **candidate/`globalUmas`** set:

```tsx
it('gates JP umas behind show-upcoming + the CM date', async () => {
  // …render with umas = [globalUma, jpUmaReleasedByCmDate], timeline giving the CM a start date…
  expect(screen.queryByText(/JP Uma Name/i)).not.toBeInTheDocument();
  await userEvent.click(screen.getByLabelText(/show upcoming/i));
  expect(screen.getByText(/JP Uma Name/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run src/features/cm-planner/UmaChartPanel.test.tsx`
Expected: FAIL — no `show upcoming` control; JP uma never shown.

- [ ] **Step 3: Implement.** In `UmaChartPanel.tsx`:
  - Add `timeline` to the `useGameData()` destructure; add the CM-date derivation (mirror `SkillChartPanel`):

```ts
const { umas, umaById, timeline } = useGameData();
const [showUpcoming, setShowUpcoming] = useState(false);
const cmNumber = plan.cmRef.kind === 'cm' ? plan.cmRef.cmNumber : undefined;
const cmEntry = (timeline as TimelineEntry[] | undefined)?.find((e) => e.type === 'cm' && e.cm?.cmNumber === cmNumber);
const asOfISO = cmEntry?.dates.start ?? cmEntry?.dates.finals ?? new Date().toISOString().slice(0, 10);
```

  - Change the `globalUmas` memo to opt-in released JP umas:

```ts
const globalUmas = useMemo(
  () => (umas ?? []).filter((u) => u.server === plan.server || (showUpcoming && isReleasedBy(u, asOfISO))),
  [umas, plan.server, showUpcoming, asOfISO],
);
```

  - Add a `show upcoming` checkbox near the chart's existing controls (search/caption row):

```tsx
<label className="cmp-upcoming-toggle">
  <input type="checkbox" checked={showUpcoming} onChange={(e) => setShowUpcoming(e.target.checked)} /> show upcoming
</label>
```

  - In `UmaRow`, when the row's uma is predicted (`umaById?.get(row.outfitId)?.releaseDatePredicted`), render a small `~{releaseDate}` badge next to the name.

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run src/features/cm-planner/UmaChartPanel.test.tsx`
Expected: PASS. (Re-run once if a UI test flakes.)

- [ ] **Step 5: Typecheck + commit**

```bash
pnpm typecheck
git add src/features/cm-planner/UmaChartPanel.tsx src/features/cm-planner/UmaChartPanel.test.tsx
git commit -m "feat(availability): show-upcoming gate + badge in the M4 uma chart"
```

---

### Task 3: Gate the runner picker (PlannerSidebar)

**Files:**
- Modify: `src/features/cm-planner/PlannerSidebar.tsx`
- Test: `src/features/cm-planner/PlannerSidebar.test.tsx` (extend)

**Interfaces:**
- Consumes: `isReleasedBy`, `TimelineEntry`; `UmaRecord` availability fields (Task 1). Mirrors Task 2.

- [ ] **Step 1: Write the failing test** — extend `PlannerSidebar.test.tsx`. With `umas` = [Global, JP-released] + a `timeline` for the CM, assert the runner search excludes the JP uma by default and includes it after toggling `show upcoming`. (Match the file's existing render + mocks; note `useUniqueSkillL` must stay mocked — see the CLAUDE.md jsdom gotcha.)

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run src/features/cm-planner/PlannerSidebar.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement.** In `PlannerSidebar.tsx`:
  - Add `timeline` to `useGameData()`; add the same `showUpcoming` state + `cmEntry`/`asOfISO` derivation as Task 2.
  - Change `globalUmas` (line ~223) to:

```ts
const globalUmas = useMemo(
  () => (umas ?? []).filter((u) => u.server === plan.server || (showUpcoming && isReleasedBy(u, asOfISO))),
  [umas, plan.server, showUpcoming, asOfISO],
);
```

  - Add a `show upcoming` checkbox next to the runner search input.
  - In the runner-search result row, show a `~{releaseDate}` badge when `uma.releaseDatePredicted`.

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run src/features/cm-planner/PlannerSidebar.test.tsx`
Expected: PASS (re-run once if flaky).

- [ ] **Step 5: Typecheck + commit**

```bash
pnpm typecheck
git add src/features/cm-planner/PlannerSidebar.tsx src/features/cm-planner/PlannerSidebar.test.tsx
git commit -m "feat(availability): show-upcoming gate + badge in the runner picker"
```

---

### Task 4: Safe-exclude JP umas from other consumers

**Files:**
- Modify: the other `useGameData().umas` consumer(s) found (at least `src/features/parents/ChosenParentsPicker.tsx`)
- Test: that consumer's test (extend) or a focused new test

**Interfaces:** Consumes `UmaRecord.server`.

- [ ] **Step 1: Audit.** Run `grep -rn "useGameData().umas\|\.umas\b\|umas ??" src/features --include=*.tsx | grep -v "UmaChartPanel\|PlannerSidebar\|.test."` and read each hit. Any consumer that lists umas for selection/inheritance and does NOT already filter by `server` will now surface JP umas ungated. `UmaChartPanel` + `PlannerSidebar` are handled (Tasks 2–3); `ChosenParentsPicker` is the prime suspect (inheritance parents).

- [ ] **Step 2: Write the failing test** — for the identified consumer, mock `umas` with a Global + a JP uma and assert the JP uma is NOT offered. (Match the consumer's existing test style.)

```tsx
it('excludes JP-ahead umas from the parents picker', () => {
  // render with umas = [globalUma, jpUma]; assert jpUma is not selectable
  expect(screen.queryByText(/JP Uma Name/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm vitest run <that test file>`
Expected: FAIL — JP uma shown.

- [ ] **Step 4: Implement.** Filter the consumer's uma list to `u.server === 'global'` (JP umas are preview, gated only in the two dedicated surfaces). Add a one-line comment referencing the availability gate.

- [ ] **Step 5: Run to verify it passes + full gate**

Run: `pnpm vitest run <that test file> && pnpm typecheck && pnpm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add <changed consumer files + tests>
git commit -m "fix(availability): exclude JP-ahead umas from non-gated consumers"
```

---

## Self-Review

**Spec coverage:**
- ✅ `UmaRecord` release-date fields + `buildJpUmas` + `GtCharacterCard.release` + build wiring + uma count — Task 1.
- ✅ Uniques from the engine bundle (no emission) — no task needed; verified. Task 2's test exercises the chart displaying a JP uma's unique via the stubbed/real `loadUniqueByUmaId`.
- ✅ Gate `UmaChartPanel` — Task 2; gate `PlannerSidebar` — Task 3.
- ✅ Safe-exclude other consumers — Task 4.
- Decisions A (uniques free) / B (newest-uma engine gap, degrades) / C (fan-TL names) — respected; B needs no code (na rank).

**Type consistency:** `buildJpUmas` signature + `Calibration`/`projectReleaseDate` reuse match slice 2a; the `globalUmas` gate predicate is identical in Tasks 2 & 3; `isReleasedBy` reads `{ releaseDate?, server }` which `UmaRecord` now provides.

**Placeholder scan:** concrete code + real gametora field names + the verified engine-unique facts. Two run-to-read values (the emitted JP uma count for `outputs.test.ts`; the exact `build-all` local var names / `cal` scope) are called out with how to obtain them, not left vague.
