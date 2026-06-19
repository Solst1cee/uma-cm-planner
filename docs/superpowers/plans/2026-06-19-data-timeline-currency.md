# Data & Timeline Currency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the baked game data current (engine-safe pin bump v0.14.2 → v0.16.1), make the CM timeline accurate and authoritative app-wide ("current CM" everywhere + planner default + M3), and ship the availability mechanism (release-date predicate + a skill-chart "show upcoming" toggle).

**Architecture:** Two file-disjoint tracks on the `data-timeline-currency` branch. **Phase A** (data pipeline + `src/core/` + `gameData` context + app shell + M3) touches no M4 feature files and runs fully parallel to active M4 work. **Phase B** (planner default race + skill-chart toggle) edits in-flight M4 files (`SkillChartPanel.tsx`, `ActivePlanContext.tsx`) and is sequenced after M4's uncommitted edits settle. Neither track touches `src/sim/` (the vendored engine stays at v0.14.2).

**Tech Stack:** TypeScript + Vite + React 19, pnpm, Vitest (jsdom), Dexie. Data pipeline is `tsx` scripts under `scripts/`. Path alias `@/*` → `src/*`.

## Global Constraints

- **Engine stays at v0.14.2.** Bump only the *data* fetch pin; do NOT run `pnpm sim:build` or touch `src/sim/`.
- **v0.16.1 data commit SHA = `76214c821a2573a532657c90cb406f3f5fe65f3e`** → `DATA_VERSION = "global-76214c82"`. Fallback (if a v0.16.1 skill condition trips the v0.14.2 parser): v0.16.0 = `d2f0b056d6894971c9d43eed6e37beb0431d4ed6` → `"global-d2f0b056"`.
- **P3 — never fabricate data.** Schedule entries carry real sourced dates; predicted dates are flagged `releaseDatePredicted: true`. Ship empty upcoming files rather than invented entries.
- **P4 — server-versioned.** Every record carries `server: 'global' | 'jp'` + `dataVersion`. JP-ahead = preview, gated behind the toggle, never silently mixed.
- **P5 — generated files (`public/data/`) are never hand-edited;** all hand data lives in `data-overrides/`.
- **P6 — pure-function core.** Mechanics (`isReleasedBy`, `currentCm`) live in `src/core/` with unit tests; UI is a thin layer.
- **Verification gates (every commit that changes data or core):** `pnpm typecheck`, `pnpm test`, `pnpm build` green. `pnpm build` / `pnpm typecheck` are race-free; if a UI test file flakes with `Cannot read properties of null (reading 'useState')`, re-run that file before treating it as a real failure (dev-server/Vitest HMR race).
- **Commits:** end each message body with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

**Verified CM10–15 reference data (two-source confirmed 2026-06-19; courseIds from `scripts/borrowed/course_data.json`):**

| CM | Cup | Track | courseId | signup start | finals (Round 1) | end | news |
|----|-----|-------|----------|--------------|------------------|-----|------|
| 10 | Aquarius | Tokyo 1600m dirt (mile) | `10611` | 2026-03-02 | 2026-03-06 | 2026-03-12 | /news/612/ |
| 11 | Pisces | Hanshin 3200m turf (long) | `10914` | 2026-03-26 | 2026-03-30 | 2026-04-05 | /news/642/ |
| 12 | Aries | Nakayama 2000m turf (medium) | `10504` | 2026-04-20 | 2026-04-23 | 2026-04-29 | /news/700/ |
| 13 | Taurus | Tokyo 2400m turf (medium) | `10606` | 2026-05-10 | 2026-05-14 | 2026-05-20 | /news/771/ |
| 14 | Gemini | Tokyo 1600m turf (mile) | `10602` | 2026-05-31 | 2026-06-04 | 2026-06-10 | /news/790/ |
| 15 | Cancer | Hanshin 2200m turf (medium) | `10906` | 2026-06-21 | **2026-06-24** | 2026-06-30 | /news/829/ |

> The `/news/<id>/` pages render via JS and could not be machine-read; the **dates/tracks/courseIds above are two-source confirmed** (Game8 + uma.guide), but the permalink **id numbers** (612/642/700/771/790) are best-effort — open each before committing and correct if it doesn't announce that CM. /news/829/ is already in the repo for CM15.

---

## PHASE A — parallel-safe (no M4 feature files)

### Task 1: Centralize the `DATA_VERSION` constant

Eliminates 3 hand-synced copies of the version literal so the pin bump (Task 2) flows from one place.

**Files:**
- Modify: `scripts/fetch-borrowed.ts` (add an exported `DATA_VERSION` next to `UPSTREAM_COMMIT`)
- Modify: `scripts/build-all.ts:39` (import it instead of re-deriving)
- Modify: `scripts/import-official-news.ts:11` (import it instead of the literal)
- Modify: `scripts/import-uma-guide.ts:23` (import it instead of the literal)

**Interfaces:**
- Produces: `export const DATA_VERSION: string` from `scripts/fetch-borrowed.ts` (value `global-${UPSTREAM_COMMIT.slice(0,8)}`).

- [ ] **Step 1: Add the exported constant.** In `scripts/fetch-borrowed.ts`, immediately after the `UPSTREAM_COMMIT` declaration (line 19), add:

```ts
/** Data version stamped on every generated record = `global-<first 8 of UPSTREAM_COMMIT>`. */
export const DATA_VERSION = `global-${UPSTREAM_COMMIT.slice(0, 8)}`;
```

- [ ] **Step 2: Use it in build-all.** In `scripts/build-all.ts`, replace line 39 (`const DATA_VERSION = ...`) by importing it. Change the import on line 22 from `import { borrowedFilesPresent, copyFromSpikes, UPSTREAM_COMMIT } from './fetch-borrowed';` to also pull `DATA_VERSION`, and delete the local `const DATA_VERSION` line:

```ts
import { borrowedFilesPresent, copyFromSpikes, DATA_VERSION } from './fetch-borrowed';
```
(Remove the now-unused `UPSTREAM_COMMIT` import if nothing else uses it in that file.)

- [ ] **Step 3: Use it in the two importer scripts.** In `scripts/import-official-news.ts:11` replace `{ dataVersion: 'global-c1fa2107', items }` with `{ dataVersion: DATA_VERSION, items }` and add `import { DATA_VERSION } from './fetch-borrowed';` at the top. Do the same in `scripts/import-uma-guide.ts:23` (`{ dataVersion: DATA_VERSION, tracks }`).

- [ ] **Step 4: Verify typecheck.**

Run: `pnpm typecheck`
Expected: PASS (no unused-import or type errors).

- [ ] **Step 5: Commit.**

```bash
git add scripts/fetch-borrowed.ts scripts/build-all.ts scripts/import-official-news.ts scripts/import-uma-guide.ts
git commit -m "refactor(data): centralize DATA_VERSION in fetch-borrowed"
```

---

### Task 2: Bump the data pin, re-fetch, rebuild, reconcile

The mechanical currency refresh. Network required (`pnpm data:fetch` downloads the new pin; `--from-spikes` would copy the *old* pin).

**Files:**
- Modify: `scripts/fetch-borrowed.ts:19` (`UPSTREAM_COMMIT`), `:27` (`TACHYONS_COMMIT`)
- Modify (regenerated): `public/data/*.json` (via `pnpm data:build`)
- Modify (likely delete entries): `data-overrides/card_additions.json`
- Modify (count + version assertions): `scripts/outputs.test.ts:25,74,231,284`
- Modify (literals → new version): `src/db/exportImport.test.ts:34`, `src/features/sp-optimizer/rankBaskets.test.ts:53`, `src/db/capturesApi.test.ts:16`, `src/core/__fixtures__/m2/basic-screen.json:6`, `src/features/sp-optimizer/BuildContextForm.tsx:23`, `scripts/build-spark-rates.ts:40` (comment only)

- [ ] **Step 1: Resolve the latest Tachyons-lab commit** touching the data file:

Run: `gh api "repos/jechto/Tachyons-lab/commits?path=front/src/app/data/data.json&per_page=1" -q '.[0].sha'`
Expected: a 40-char SHA. Record it; use it in Step 2. (If `gh` is unavailable, open `https://github.com/jechto/Tachyons-lab/commits/main/front/src/app/data/data.json` and copy the newest commit SHA.)

- [ ] **Step 2: Bump both pins.** In `scripts/fetch-borrowed.ts` set:

```ts
export const UPSTREAM_COMMIT = '76214c821a2573a532657c90cb406f3f5fe65f3e'; // v0.16.1, 2026-06-19
```
and set `TACHYONS_COMMIT` (line 27) to the SHA from Step 1.

- [ ] **Step 3: Fetch + build.**

Run: `pnpm data:fetch && pnpm data:build`
Expected (success path): final line `public/data written: <N> skills, <M> support cards, <P> cm presets, <Q> umas, ...`. **Record N/M/P/Q — they feed Step 5.**
Expected (likely first failure): `card_additions.json failed validation: card_additions record "30102": already emitted by the generator — the upstream pin caught up; delete this addition.` (and/or 30103/30104). This is the designed reconciliation signal.

- [ ] **Step 4: Reconcile `card_additions.json`.** For each id the build flagged as "already emitted": open `data-overrides/card_additions.json`, delete that record object. If ALL three are now upstream, the `records` array becomes `[]` (keep the file with `{ "_comment": "...", "records": [] }`). Re-run `pnpm data:build` until it succeeds and prints the written-counts line. If the build instead throws a skill-condition parse error from the engine, fall back to the v0.16.0 SHA (`d2f0b056d6894971c9d43eed6e37beb0431d4ed6`) in Step 2 and re-run.

- [ ] **Step 5: Update `scripts/outputs.test.ts`.** Replace the version literal AND the hardcoded counts with the values printed in Step 3/4:
  - Line 25: `s.dataVersion === 'global-c1fa2107'` → `'global-76214c82'`
  - Line 74: `c.dataVersion === 'global-c1fa2107'` → `'global-76214c82'` AND `.toHaveLength(217)` → `.toHaveLength(<M>)`
  - Line 231: `u.dataVersion === 'global-c1fa2107'` → `'global-76214c82'`
  - Line 284: `p.dataVersion === 'global-c1fa2107'` → `'global-76214c82'`
  - Also fix the skill-count assertion near line 25 ("578 Global-released skills") to the new `<N>` if it changed, and the uma count near line 231 if `<Q>` changed. Grep the file for `578`, `217`, `84` and reconcile each against Step 3's counts.

- [ ] **Step 6: Update the remaining `global-c1fa2107` literals** to `global-76214c82`:
  - `src/db/exportImport.test.ts:34`, `src/features/sp-optimizer/rankBaskets.test.ts:53`, `src/db/capturesApi.test.ts:16`, `src/core/__fixtures__/m2/basic-screen.json:6`, `src/features/sp-optimizer/BuildContextForm.tsx:23` (the `dataVersion = 'global-c1fa2107'` default param), and the comment at `scripts/build-spark-rates.ts:40`.

Run: `grep -rn "global-c1fa2107" src scripts` (or use the editor's search)
Expected: **zero matches** after this step.

- [ ] **Step 7: Verify the full gate.**

Run: `pnpm typecheck && pnpm test && pnpm build`
Expected: all PASS. (`outputs.test.ts` parity oracle `assertTachyonsParity` runs inside `pnpm data:build`, already green from Step 4.)

- [ ] **Step 8: Update provenance + commit.** Add a dated line to `docs/provenance.md` §1 recording the new pin (`v0.16.1 / 76214c82…`, data 2026-06-19) and the Tachyons bump, mirroring the existing v0.14.2 note.

```bash
git add scripts/fetch-borrowed.ts public/data data-overrides/card_additions.json scripts/outputs.test.ts src/db/exportImport.test.ts src/features/sp-optimizer/rankBaskets.test.ts src/db/capturesApi.test.ts src/core/__fixtures__/m2/basic-screen.json src/features/sp-optimizer/BuildContextForm.tsx scripts/build-spark-rates.ts docs/provenance.md
git commit -m "feat(data): bump pin to umalator v0.16.1 + Tachyons; refresh public/data"
```

---

### Task 3: Availability schema fields + `isReleasedBy` predicate

The reusable mechanism. Pure core (P6).

**Files:**
- Modify: `src/core/types.ts` (`SupportCardRecord` lines 146-159; `SkillRecord` lines 92-120)
- Create: `src/core/availability.ts`
- Test: `src/core/availability.test.ts`

**Interfaces:**
- Consumes: `Server` (`src/core/types.ts:9`).
- Produces: optional `releaseDate?: string` + `releaseDatePredicted?: boolean` on `SupportCardRecord` and `SkillRecord`; `export function isReleasedBy(record: { releaseDate?: string; server: Server }, asOfISO: string): boolean`.

- [ ] **Step 1: Write the failing test.** Create `src/core/availability.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { isReleasedBy } from './availability';

describe('isReleasedBy', () => {
  it('treats an undated global record as always released', () => {
    expect(isReleasedBy({ server: 'global' }, '2020-01-01')).toBe(true);
  });
  it('treats an undated jp record as never released', () => {
    expect(isReleasedBy({ server: 'jp' }, '2999-01-01')).toBe(false);
  });
  it('gates a dated record by asOf >= releaseDate', () => {
    const rec = { server: 'jp' as const, releaseDate: '2026-07-30' };
    expect(isReleasedBy(rec, '2026-07-29')).toBe(false);
    expect(isReleasedBy(rec, '2026-07-30')).toBe(true); // inclusive: available on release day
    expect(isReleasedBy(rec, '2026-08-01')).toBe(true);
  });
  it('a dated global record is also gated by its date', () => {
    expect(isReleasedBy({ server: 'global', releaseDate: '2026-07-30' }, '2026-07-01')).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails.**

Run: `pnpm vitest run src/core/availability.test.ts`
Expected: FAIL — `isReleasedBy` not found / module missing.

- [ ] **Step 3: Add the schema fields.** In `src/core/types.ts`, add to `SupportCardRecord` (after `server: Server;` at line 157) and to `SkillRecord` (after `server: Server;` at line 118), the same two lines in each:

```ts
  /** ISO Global release date; absent = released (global) / unknown. Set on upcoming (server:'jp') records. */
  releaseDate?: string;
  /** true when releaseDate is a JP→Global projection, not an official announcement (P3). */
  releaseDatePredicted?: boolean;
```

- [ ] **Step 4: Implement the predicate.** Create `src/core/availability.ts`:

```ts
import type { Server } from './types';

/**
 * Is a server-versioned record available on Global as of `asOfISO` (yyyy-mm-dd)?
 * Dated records gate on releaseDate (inclusive); undated records fall back to
 * server ('global' = on Global now, 'jp' = preview, not yet). The reference
 * date is supplied by the caller (planner → CM start date; a generic view →
 * today + horizon). See the 2026-06-19 data-timeline-currency spec.
 */
export function isReleasedBy(
  record: { releaseDate?: string; server: Server },
  asOfISO: string,
): boolean {
  if (record.releaseDate !== undefined) return record.releaseDate <= asOfISO;
  return record.server === 'global';
}
```

- [ ] **Step 5: Run to verify it passes.**

Run: `pnpm vitest run src/core/availability.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit.**

```bash
git add src/core/types.ts src/core/availability.ts src/core/availability.test.ts
git commit -m "feat(core): add releaseDate schema + isReleasedBy availability predicate"
```

---

### Task 4: Upcoming-skill insert pipeline

A minimal insert path for not-yet-released skills (the data side of the skill-chart toggle). Mirrors `card_additions.ts` but for skills and `server:'jp'`. The existing `applyOverrides` path can only patch, and `loadCardAdditions` requires `server:'global'` — so this is a new, clearly-labeled loader. Ships with an **empty** file (no fabricated entries, P3).

**Files:**
- Create: `data-overrides/skill_additions.json` (empty `records: []`)
- Create: `scripts/lib/skill-additions.ts`
- Test: `scripts/skill-additions.test.ts`
- Modify: `scripts/build-all.ts` (load + merge before overrides)

**Interfaces:**
- Consumes: `SkillRecord` (now with `releaseDate?`/`releaseDatePredicted?`), `DATA_VERSION`.
- Produces: `export function loadSkillAdditions(path: string, opts: { existingSkillIds: ReadonlySet<string> }): SkillRecord[]` — inserts full `SkillRecord`s with `server:'jp'` + required `releaseDate`; throws on duplicate/colliding id or schema violation.

- [ ] **Step 1: Write the failing test.** Create `scripts/skill-additions.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadSkillAdditions } from './lib/skill-additions';

function tmpFile(contents: object): string {
  const dir = mkdtempSync(join(tmpdir(), 'skilladd-'));
  const p = join(dir, 'skill_additions.json');
  writeFileSync(p, JSON.stringify(contents), 'utf8');
  return p;
}

const valid = {
  skillId: '999001', nameEn: 'Preview Skill', nameJp: 'プレビュー', baseSpCost: 200,
  rarity: 'gold', iconId: '00001', conditions: 'distance_type==2',
  server: 'jp', dataVersion: 'global-76214c82',
  releaseDate: '2026-07-30', releaseDatePredicted: true,
};

describe('loadSkillAdditions', () => {
  it('returns [] when the file is missing', () => {
    expect(loadSkillAdditions(join(tmpdir(), 'nope-skill_additions.json'), { existingSkillIds: new Set() })).toEqual([]);
  });
  it('inserts a valid server:jp upcoming skill', () => {
    const recs = loadSkillAdditions(tmpFile({ records: [valid] }), { existingSkillIds: new Set() });
    expect(recs).toHaveLength(1);
    expect(recs[0]?.skillId).toBe('999001');
  });
  it('rejects server:global (use skills.json / overrides instead)', () => {
    expect(() => loadSkillAdditions(tmpFile({ records: [{ ...valid, server: 'global' }] }), { existingSkillIds: new Set() })).toThrow(/server must be "jp"/);
  });
  it('rejects a skill missing releaseDate', () => {
    const { releaseDate, ...noDate } = valid;
    expect(() => loadSkillAdditions(tmpFile({ records: [noDate] }), { existingSkillIds: new Set() })).toThrow(/releaseDate/);
  });
  it('rejects collision with an already-emitted skill id', () => {
    expect(() => loadSkillAdditions(tmpFile({ records: [valid] }), { existingSkillIds: new Set(['999001']) })).toThrow(/already emitted/);
  });
});
```

- [ ] **Step 2: Run to verify it fails.**

Run: `pnpm vitest run scripts/skill-additions.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the loader.** Create `scripts/lib/skill-additions.ts`:

```ts
/**
 * data-overrides/skill_additions.json — full SkillRecord entries for upcoming
 * (server:'jp') skills not yet in the Global cutover, so the skill chart's
 * "show upcoming" toggle has data to gate by CM date. Each entry MUST carry a
 * releaseDate. Mirrors card-additions.ts (insert, not patch). P3/P4/P5.
 */
import { existsSync } from 'node:fs';
import type { SkillRecord } from '@/core/types';
import { readJson } from './io';

export interface SkillAdditionsFile {
  _comment?: string;
  records: SkillRecord[];
}

const RARITIES = new Set(['white', 'gold', 'unique', 'inherited_unique']);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function stripMeta<T>(value: T): T {
  if (Array.isArray(value)) return value.map(stripMeta) as T;
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) if (!k.startsWith('_')) out[k] = stripMeta(v);
    return out as T;
  }
  return value;
}

function validate(r: SkillRecord, problems: string[]): void {
  const w = `skill_additions record "${r.skillId}"`;
  if (typeof r.skillId !== 'string' || !/^\d+$/.test(r.skillId)) problems.push(`${w}: skillId must be a numeric string`);
  if (typeof r.nameEn !== 'string' || r.nameEn.length === 0) problems.push(`${w}: nameEn missing`);
  if (!RARITIES.has(r.rarity)) problems.push(`${w}: bad rarity "${r.rarity}"`);
  if (typeof r.conditions !== 'string') problems.push(`${w}: conditions must be a string`);
  if (r.server !== 'jp') problems.push(`${w}: server must be "jp" (upcoming preview, P4)`);
  if (typeof r.releaseDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.releaseDate)) problems.push(`${w}: releaseDate (ISO yyyy-mm-dd) is required for upcoming skills`);
  if (typeof r.dataVersion !== 'string' || r.dataVersion.length === 0) problems.push(`${w}: dataVersion missing`);
}

export function loadSkillAdditions(
  path: string,
  opts: { existingSkillIds: ReadonlySet<string> },
): SkillRecord[] {
  if (!existsSync(path)) return [];
  const parsed = readJson<SkillAdditionsFile>(path);
  if (!Array.isArray(parsed.records)) {
    throw new Error('skill_additions.json: "records" must be an array of full SkillRecord entries');
  }
  const problems: string[] = [];
  const seen = new Set<string>();
  const records = parsed.records.map((raw) => stripMeta(raw));
  for (const r of records) {
    validate(r, problems);
    if (seen.has(r.skillId)) problems.push(`skill_additions record "${r.skillId}": duplicate id in file`);
    seen.add(r.skillId);
    if (opts.existingSkillIds.has(r.skillId)) {
      problems.push(`skill_additions record "${r.skillId}": already emitted by the generator — the upstream pin caught up; delete this addition.`);
    }
  }
  if (problems.length > 0) throw new Error(`skill_additions.json failed validation:\n  ${problems.join('\n  ')}`);
  return records;
}
```

- [ ] **Step 4: Run to verify it passes.**

Run: `pnpm vitest run scripts/skill-additions.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Create the empty data file.** Create `data-overrides/skill_additions.json`:

```json
{
  "_comment": "Full SkillRecord entries for upcoming (server:'jp') skills not yet in the Global cutover, so the skill chart 'show upcoming' toggle can gate them by CM date. Each entry MUST have a releaseDate (announced from official news, else predicted via JP->Global pace with releaseDatePredicted:true). Inserted before overrides. Delete an entry when the pin catches up (the build fails on a duplicate id). Never fabricate entries (P3).",
  "records": []
}
```

- [ ] **Step 6: Wire into the build.** In `scripts/build-all.ts`, after `skills` is built (it is `let skills = buildSkills({...})` around line 54) and `releasedSkillIds` exists (line 52), add the skill-additions merge BEFORE the override loop:

```ts
import { loadSkillAdditions } from './lib/skill-additions';
// ...after `let skills = buildSkills({...});` and before the override loop:
const skillAdditions = loadSkillAdditions(join(OVERRIDES_DIR, 'skill_additions.json'), {
  existingSkillIds: new Set(skills.map((s) => s.skillId)),
});
if (skillAdditions.length > 0) {
  skills = [...skills, ...skillAdditions].sort((a, b) => Number(a.skillId) - Number(b.skillId));
  console.log(`applied skill_additions.json → ${skillAdditions.length} upcoming skill(s)`);
}
```

- [ ] **Step 7: Verify the build still produces identical output** (empty additions = no change).

Run: `pnpm data:build && pnpm typecheck && pnpm test`
Expected: PASS; written-counts line unchanged from Task 2 Step 3.

- [ ] **Step 8: Commit.**

```bash
git add scripts/lib/skill-additions.ts scripts/skill-additions.test.ts data-overrides/skill_additions.json scripts/build-all.ts
git commit -m "feat(data): add upcoming-skill insert pipeline (skill_additions.json)"
```

---

### Task 5: Promote `currentCm` to core

Move the selector to pure core so it can be the app-wide SSOT (consumed by the context, not just M3).

**Files:**
- Modify: `src/core/timeline.ts` (add `currentCm`)
- Modify: `src/core/timeline.test.ts` (add the 3 cases)
- Modify: `src/features/meta-intel/timelineView.ts` (remove `currentCm`, lines 55-61)
- Modify: `src/features/meta-intel/timelineView.test.ts` (remove the `currentCm` describe block, lines 72-89)
- Modify: `src/features/meta-intel/TimelinePage.tsx:12` (drop `currentCm` from the `./timelineView` import — it will come from context in Task 9)

**Interfaces:**
- Consumes: `TimelineEntry` + `effectiveDate` (already in `src/core/timeline.ts`).
- Produces: `export function currentCm(cmEntries: TimelineEntry[], nowISO: string): TimelineEntry | null`.

- [ ] **Step 1: Write the failing test.** In `src/core/timeline.test.ts`, add (near the other describes; the file already imports `TimelineEntry` and uses full literals):

```ts
import { currentCm } from './timeline'; // add to the existing import from './timeline'

describe('currentCm', () => {
  const cms: TimelineEntry[] = [
    { id: 'cm1', type: 'cm', title: 'A', dates: { finals: '2026-05-30' }, tier: 'official', status: 'confirmed', source: { kind: 'official_news', url: '' }, server: 'global', dataVersion: 'x' },
    { id: 'cm2', type: 'cm', title: 'B', dates: { finals: '2026-06-30' }, tier: 'official', status: 'confirmed', source: { kind: 'official_news', url: '' }, server: 'global', dataVersion: 'x' },
  ];
  it('picks the first CM on/after now', () => {
    expect(currentCm(cms, '2026-06-15')?.id).toBe('cm2');
  });
  it('falls back to the most recent past CM when none are upcoming', () => {
    expect(currentCm(cms, '2027-01-01')?.id).toBe('cm2');
  });
  it('returns null for an empty list', () => {
    expect(currentCm([], '2026-06-15')).toBeNull();
  });
});
```
(Merge `currentCm` into the existing `import { ... } from './timeline';` line rather than adding a duplicate import.)

- [ ] **Step 2: Run to verify it fails.**

Run: `pnpm vitest run src/core/timeline.test.ts`
Expected: FAIL — `currentCm` not exported from `./timeline`.

- [ ] **Step 3: Implement in core.** In `src/core/timeline.ts`, add (it can reuse `effectiveDate` + `sortTimeline` already in the file):

```ts
/** The current/next CM: first CM on/after now, else the most recent past one. */
export function currentCm(cmEntries: TimelineEntry[], nowISO: string): TimelineEntry | null {
  if (cmEntries.length === 0) return null;
  const sorted = sortTimeline(cmEntries);
  const upcoming = sorted.find((e) => effectiveDate(e) >= nowISO);
  return upcoming ?? sorted[sorted.length - 1] ?? null;
}
```

- [ ] **Step 4: Remove the duplicate from the view layer.** Delete the `currentCm` function (lines 55-61) from `src/features/meta-intel/timelineView.ts`. Delete the `describe('currentCm', ...)` block (lines 72-89) from `src/features/meta-intel/timelineView.test.ts`. In `src/features/meta-intel/TimelinePage.tsx`, remove `currentCm` from the `import { ... } from './timelineView';` on line 12 (it is re-sourced from context in Task 9 — until then TimelinePage still references it on line 36, so temporarily import it from `@/core/timeline` to keep the build green: `import { currentCm } from '@/core/timeline';`).

- [ ] **Step 5: Run to verify all pass.**

Run: `pnpm vitest run src/core/timeline.test.ts src/features/meta-intel/timelineView.test.ts && pnpm typecheck`
Expected: PASS (core gains the tests; view layer no longer defines/tests `currentCm`).

- [ ] **Step 6: Commit.**

```bash
git add src/core/timeline.ts src/core/timeline.test.ts src/features/meta-intel/timelineView.ts src/features/meta-intel/timelineView.test.ts src/features/meta-intel/TimelinePage.tsx
git commit -m "refactor(core): promote currentCm selector to core/timeline"
```

---

### Task 6: Surface `currentCm` on the GameData context

Make the live CM available app-wide via `useGameData().currentCm`.

**Files:**
- Modify: `src/features/data/gameData.ts` (`GameData` interface ~lines 38-77; the `useMemo` value ~lines 184-200)
- Test: `src/features/data/gameData.test.tsx` (create if absent; otherwise extend)

**Interfaces:**
- Consumes: `currentCm` from `@/core/timeline`; the provider's `timeline`.
- Produces: `GameData.currentCm?: TimelineEntry | null`.

- [ ] **Step 1: Add the field to the interface.** In `src/features/data/gameData.ts`, in the `GameData` interface after the `cmSchedule?` field, add:

```ts
  /**
   * The live/next Champions Meeting derived from `timeline` + today (M3 SSOT).
   * null when the timeline has no CM entries. Optional so pre-M3 GameData
   * literals keep compiling — consumers should treat undefined as null.
   */
  currentCm?: TimelineEntry | null;
```

- [ ] **Step 2: Compute it in the value memo.** Add the import `import { currentCm as selectCurrentCm, projectCmSchedule } from '@/core/timeline';` (extend the existing `projectCmSchedule` import on line 21). Inside the `useMemo` (after `cmSchedule: projectCmSchedule(timeline),` at line 195), add:

```ts
      currentCm: selectCurrentCm(
        timeline.filter((e) => e.type === 'cm'),
        new Date().toISOString().slice(0, 10),
      ),
```
(Using `new Date()` in the runtime provider is fine — it is not pure core. `currentCm` itself stays pure/testable.)

- [ ] **Step 3: Verify typecheck + build.**

Run: `pnpm typecheck && pnpm build`
Expected: PASS.

- [ ] **Step 4: Commit.**

```bash
git add src/features/data/gameData.ts
git commit -m "feat(data): expose currentCm on the GameData context (timeline SSOT)"
```

---

### Task 7: Fill the CM10–14 gap, fix CM15, add CM14 track

Make the timeline accurate. Data only (P5), all sourced from the Global-Constraints table.

**Files:**
- Modify: `data-overrides/timeline_overrides.json` (add CM10–14; fix CM15 finals)
- Test: `src/core/timeline.test.ts` (assert `projectCmSchedule` now yields CM10–15)

> **Why not `cm_tracks.json` here:** it is a generated file (P5, regenerated by `pnpm timeline:import` from uma.guide), and it only feeds *prediction* synthesis. CM10–14 are now **confirmed** entries carrying their own `cm.courseId`, and `projectCmSchedule` reads `cm.courseId` straight off the timeline entry — so cm_tracks is not on this task's critical path. Adding its missing index-14 row is routed through the runbook (Task 12), which runs the importer rather than hand-editing the generated file.

- [ ] **Step 1: Add the five entries + fix CM15.** In `data-overrides/timeline_overrides.json`, replace the `entries` array so it contains the corrected CM15 plus CM10–14 (dataVersion `global-76214c82`). Each entry:

```json
{
  "id": "cm10-aquarius-cup",
  "type": "cm",
  "title": "Aquarius Cup",
  "dates": { "start": "2026-03-02", "finals": "2026-03-06", "end": "2026-03-12" },
  "cm": { "cmNumber": 10, "courseId": "10611", "trackSummary": "Tokyo dirt 1600m (mile)" },
  "tier": "official", "status": "confirmed",
  "source": { "kind": "official_news", "url": "https://umamusume.com/news/612/" },
  "server": "global", "dataVersion": "global-76214c82"
}
```
Repeat for CM11 (Pisces, `10914`, start 2026-03-26 / finals 2026-03-30 / end 2026-04-05, news/642, "Hanshin turf 3200m (long)"), CM12 (Aries, `10504`, 2026-04-20 / 2026-04-23 / 2026-04-29, news/700, "Nakayama turf 2000m (medium)"), CM13 (Taurus, `10606`, 2026-05-10 / 2026-05-14 / 2026-05-20, news/771, "Tokyo turf 2400m (medium)"), CM14 (Gemini, `10602`, 2026-05-31 / 2026-06-04 / 2026-06-10, news/790, "Tokyo turf 1600m (mile)"). For the existing `cm15-cancer-cup` entry, change `dates.finals` from `2026-06-30` to `2026-06-24` (keep `start` `2026-06-21`, `end` `2026-06-30`) and bump its `dataVersion` to `global-76214c82`.

- [ ] **Step 2: Confirm the news permalinks.** Open each `/news/<id>/` URL (612, 642, 700, 771, 790). If one does not announce that CM, replace the id with the correct permalink or, if not locatable, set `source.kind` to `umaguide` and `source.url` to `https://uma.guide/cm-schedule/`. Do NOT change the dates — they are two-source confirmed.

- [ ] **Step 3: Rebuild + assert.** In `src/core/timeline.test.ts`, add a test that `projectCmSchedule` over a fixture containing CM10–15 yields exactly those six rows in date order with the right courseIds (use the table values). Then:

Run: `pnpm data:build && pnpm vitest run src/core/timeline.test.ts`
Expected: build prints `... <X> timeline entries.` (5 more than before); test PASSES.

- [ ] **Step 4: Verify the app reads it.** Sanity-check `public/data/timeline.json` now contains the CM10–14 entries with `cmNumber` 10–14 and the corrected CM15 finals.

Run: `pnpm build && pnpm test`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add data-overrides/timeline_overrides.json public/data/timeline.json src/core/timeline.test.ts
git commit -m "feat(m3): fill CM10-14 Global history, fix CM15 finals date"
```

---

### Task 8: App-wide "current CM" nav badge

**Files:**
- Modify: `src/app/App.tsx` (the `app-title-row`, lines 36-39)
- Modify: `src/app/app.css` or the relevant stylesheet (a small `.cmp-now-chip` style; follow existing token usage)
- Test: extend an existing App/shell render test if present; otherwise verify by build + `pnpm dev`.

**Interfaces:**
- Consumes: `useGameData().currentCm`.

- [ ] **Step 1: Add a badge component in App.tsx.** Below `FixtureBanner` (line 30) add:

```tsx
function CurrentCmBadge() {
  const { currentCm } = useGameData();
  if (!currentCm) return null;
  const date = currentCm.dates.finals ?? currentCm.dates.start ?? '';
  return (
    <span className="cmp-now-chip" title="Current / next Champions Meeting (from the timeline)">
      Now: {currentCm.title}{date ? ` · ${date}` : ''}
    </span>
  );
}
```

- [ ] **Step 2: Render it in the title row.** In `Shell`, inside `<div className="app-title-row">` (lines 36-39), add `<CurrentCmBadge />` after `<h1>` (before or after `<SettingsMenu />` per layout).

- [ ] **Step 3: Add minimal styling** for `.cmp-now-chip` (small pill: padding, `bg-1`, border, rounded, muted text) in the app stylesheet, matching the existing chip grammar referenced in CLAUDE.md.

- [ ] **Step 4: Verify.**

Run: `pnpm build && pnpm test`
Expected: PASS. (Optionally `pnpm dev` and confirm the chip reads "Now: Cancer Cup · 2026-06-24".)

- [ ] **Step 5: Commit.**

```bash
git add src/app/App.tsx src/app/app.css
git commit -m "feat(app): current-CM nav badge from timeline SSOT"
```

---

### Task 9: M3 page reads `currentCm` from context

Remove the local computation; use the SSOT.

**Files:**
- Modify: `src/features/meta-intel/TimelinePage.tsx` (lines 12, 35-38)
- Test: `src/features/meta-intel/*` page test if present; else build.

- [ ] **Step 1: Use context.** In `TimelinePage.tsx`, remove the temporary `import { currentCm } from '@/core/timeline';` added in Task 5, and replace the `currentCmId` useMemo (lines 35-38) with a read from context:

```tsx
const { status, timeline, currentCm } = useGameData();
// ...
const currentCmId = currentCm?.id ?? null;
```
Drop the now-unused `partitionByLane` usage *for currentCm* (it is still used for `partitioned` at line 34, so keep that import).

- [ ] **Step 2: Verify.**

Run: `pnpm typecheck && pnpm test && pnpm build`
Expected: PASS; the M3 page still highlights the current CM card (now CM15 with the corrected date).

- [ ] **Step 3: Commit.**

```bash
git add src/features/meta-intel/TimelinePage.tsx
git commit -m "refactor(m3): read currentCm from context instead of recomputing"
```

---

## PHASE B — coordinate with in-flight M4 work

> These edit files with uncommitted M4 changes (`SkillChartPanel.tsx`, `ActivePlanContext.tsx`). Execute after M4's current edits land/settle, or rebase onto them. The line numbers below reflect the working-tree state at planning time — re-anchor against current contents before editing.

### Task 10: Planner default race from `currentCm`

New plans default to the live CM's track instead of `PRESETS[0]`.

**Files:**
- Modify: `src/app/ActivePlanContext.tsx` (`makeDefaultPlan`, lines 28-71; the `PRESETS[0]!` source at line 29)
- Modify: `src/features/cm-planner/CmPlannerPage.tsx` (the `selection` initializer at line 63; the `newDefaultPlan` cmRef compose, lines 170-208)
- Test: `src/app/ActivePlanContext.test.tsx`

**Interfaces:**
- Consumes: `useGameData().currentCm` (a `TimelineEntry` with `cm.courseId`, `cm.cmNumber`, `title`).
- Produces: `makeDefaultPlan(currentCm?: TimelineEntry | null): CmPlan` — when a current CM with a `courseId` is supplied, its `cmRef` is seeded from it; otherwise falls back to `PRESETS[0]` (current behavior).

- [ ] **Step 1: Write the failing test.** In `src/app/ActivePlanContext.test.tsx`, add a case: calling `makeDefaultPlan(currentCmEntry)` (a CM15 fixture with `cm.courseId:'10906'`, `cm.cmNumber:15`, surface/distance derivable) yields `plan.cmRef.courseId === '10906'` and `plan.cmRef.cmNumber === 15`; and `makeDefaultPlan()` (no arg) still yields the `PRESETS[0]` courseId. (Match the existing test file's import + render style.)

- [ ] **Step 2: Run to verify it fails.**

Run: `pnpm vitest run src/app/ActivePlanContext.test.tsx`
Expected: FAIL — `makeDefaultPlan` takes no args / cmRef not seeded from the entry.

- [ ] **Step 3: Parameterize `makeDefaultPlan`.** Change its signature to `makeDefaultPlan(currentCm?: TimelineEntry | null): CmPlan`. Derive a `cmRef` source: if `currentCm?.cm?.courseId` is set, build `cmRef` from it (`cmId: \`CM${currentCm.cm.cmNumber}\``, `cmNumber`, `courseId`, and surface/distance — resolve surface/distance from `currentCm.cm.trackSummary` or look them up from the matching `PRESETS`/course catalog entry by `courseId`); else keep `const race = PRESETS[0]!` and the existing literal. Keep `scenarioId`, stats, sparkGoals unchanged.

- [ ] **Step 4: Pass the current CM at the call sites.** In `ActivePlanContext.tsx`, the provider has access to game data — pass `currentCm` into the first-run/post-delete `makeDefaultPlan()` calls (lines ~155-160, ~266). In `CmPlannerPage.tsx`, initialize `selection` (line 63) from the current CM when present (else `PRESETS[0]`), and ensure `newDefaultPlan` (lines 170-208) continues to override `cmRef` from `selection` (so the New button honors the current CM too).

- [ ] **Step 5: Run to verify it passes.**

Run: `pnpm vitest run src/app/ActivePlanContext.test.tsx && pnpm typecheck && pnpm build`
Expected: PASS.

- [ ] **Step 6: Commit.**

```bash
git add src/app/ActivePlanContext.tsx src/features/cm-planner/CmPlannerPage.tsx src/app/ActivePlanContext.test.tsx
git commit -m "feat(m4): default new-plan race to the current CM from the timeline"
```

---

### Task 11: Skill-chart "show upcoming" toggle

The use-case-1 UI. Gates display by `isReleasedBy(skill, cmDate)`; surfaces `server:'jp'` upcoming skills when on. With an empty `skill_additions.json` it behaves exactly like today; it lights up the moment an upcoming skill is curated.

**Files:**
- Modify: `src/features/cm-planner/SkillChartPanel.tsx` (state ~line 83; catalog `reps`/`ids` ~lines 90-96; display filter ~lines 131-136; toolbar ~lines 190-210)
- Test: `src/features/cm-planner/SkillChartPanel.test.tsx`

**Interfaces:**
- Consumes: `isReleasedBy` from `@/core/availability`; the active plan's CM date (`plan.cmRef` → the timeline entry's `dates.start`; if `cmRef` carries no date, use the matched `currentCm`/preset start, else `new Date()`); `SkillRecord.server` / `.releaseDate`.

- [ ] **Step 1: Write the failing test.** In `SkillChartPanel.test.tsx`, add a case rendering the panel with a skills fixture containing one `server:'global'` skill and one `server:'jp'` skill with `releaseDate` after the plan's CM date: assert the jp skill is hidden by default and appears after toggling "show upcoming" (find the new checkbox by its label text). Match the file's existing render/fixture style.

- [ ] **Step 2: Run to verify it fails.**

Run: `pnpm vitest run src/features/cm-planner/SkillChartPanel.test.tsx`
Expected: FAIL — no "show upcoming" control; jp skill never shown.

- [ ] **Step 3: Add state + the CM date.** Beside `const [showAll, setShowAll] = useState(false);` (line 83) add `const [showUpcoming, setShowUpcoming] = useState(false);`. Compute the gate date once, e.g. `const cmDateISO = plan.cmRef ... // the CM start date; fall back to new Date().toISOString().slice(0,10)`.

- [ ] **Step 4: Broaden the catalog when toggled.** Where `reps`/`ids` are assembled (lines 90-96 via `acquirableSkills(skills ?? [], plan.server)`), when `showUpcoming` is true also include acquirable-rarity `server:'jp'` skills whose `isReleasedBy(skill, cmDateISO)` is true (union by `skillId`). When off, leave as-is.

- [ ] **Step 5: Gate the display filter.** In the `views` `.filter(...)` chain (lines 131-136), add: `if (!showUpcoming && v.row.skill && v.row.skill.releaseDate && !isReleasedBy(v.row.skill, cmDateISO)) return false;` (drop not-yet-released skills unless the toggle is on). Adjust to the actual `RowView` shape (the row likely exposes the `SkillRecord` or its id — look it up via `skillById` if needed).

- [ ] **Step 6: Add the toolbar control.** In the `cmp-uma-toolbar` block (lines 190-210), next to the "show not-activatable" label, add:

```tsx
<label className="cmp-showall small" title="Skills from cards/banners that release on or before this CM's start date">
  <input type="checkbox" checked={showUpcoming} onChange={(e) => setShowUpcoming(e.target.checked)} /> show upcoming
</label>
```

- [ ] **Step 7: Run to verify it passes.**

Run: `pnpm vitest run src/features/cm-planner/SkillChartPanel.test.tsx && pnpm typecheck && pnpm build`
Expected: PASS.

- [ ] **Step 8: Commit.**

```bash
git add src/features/cm-planner/SkillChartPanel.tsx src/features/cm-planner/SkillChartPanel.test.tsx
git commit -m "feat(m4): skill-chart 'show upcoming' toggle gated by CM date"
```

---

### Task 12: Currency runbook

Make the refresh repeatable (the durable SSOT win).

**Files:**
- Create: `docs/data-refresh-runbook.md`
- Modify: `CLAUDE.md` (add a one-line pointer under the data section)

- [ ] **Step 1: Write the runbook.** Cover, with exact commands: (1) **Pin bump** — update `UPSTREAM_COMMIT`/`TACHYONS_COMMIT` in `fetch-borrowed.ts`, `pnpm data:fetch && pnpm data:build`, reconcile `card_additions.json` on the duplicate-id failure, update `outputs.test.ts` counts + the `dataVersion` literals (grep `global-<old8>`), run the gates. (2) **Add a confirmed CM** — append a `TimelineEntry` to `timeline_overrides.json` with the `/news/<id>/` permalink + courseId (resolve via `scripts/borrowed/course_data.json`), add its `cm_tracks.json` index row, `pnpm timeline:rebuild`. (3) **Add an upcoming card/skill** — append a `SkillRecord` to `skill_additions.json` with `server:'jp'` + `releaseDate` (announced date, else `predictGlobalDateDefault(jpDate)` with `releaseDatePredicted:true`), `pnpm data:build`. (4) **Deferred (Phase C):** the card-source "include upcoming" toggle (use case 2) lands when M4 §3 builds the support-card sourcing UI; the `isReleasedBy` predicate is already ready for it, and an `upcoming_cards.json` insert loader mirroring `skill-additions.ts` (but for `SupportCardRecord`, `server:'jp'`) is the data half.

- [ ] **Step 2: Add the CLAUDE.md pointer + commit.**

```bash
git add docs/data-refresh-runbook.md CLAUDE.md
git commit -m "docs: data + timeline refresh runbook"
```

---

## Out of scope (this plan)

- Re-vendoring the engine (`src/sim/`, `pnpm sim:build`).
- The **card-source "include upcoming" toggle** (use case 2) and `upcoming_cards.json` insert loader — deferred to Phase C; needs M4 §3 sourcing UI. Sketched in the runbook.
- Renumbering / dating the 2025-era Global CMs (CM1–9) — only CM10–15 are verified here.
- Populating exact Global release dates for the already-released back-catalog (no borrowed source).
- M1/M2 cross-module CM context; banner/patch timeline lanes; M3 grid-layout fidelity; upcoming umas.
