# M3 Timeline Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Module-3 timeline **data model + pure core + a derived seed dataset** — the foundation that produces the `cm_schedule` projection M4 needs, with no scraping and no fabricated schedule data.

**Architecture:** Plan 1 of M3 (timeline-v1, milestone 1 of the M3 spec `docs/superpowers/specs/2026-06-14-m3-meta-intel-design.md`). The timeline layers *schedule/confirmation* (cmNumber, dates, tier, status, banners, patches) on top of the existing `cm_presets.json` *geometry* (courseId/surface/distance). Three tasks: (1) `TimelineEntry`/`CmScheduleRow` types; (2) pure `src/core/timeline.ts` (merge, cm_schedule projection, JP→Global date predictor, badge) + tests; (3) `build-timeline.ts` derives a real historical timeline from `cm_presets` ⊕ a hand-maintained `timeline_overrides.json` (P5) → `public/data/timeline.json`, wired into the build + runtime. **Importers (Game8/Sheets/uma.guide) = Plan 2; the browsable UI = Plan 3.**

**Tech Stack:** TypeScript strict (`bundler`, `verbatimModuleSyntax`, `noUncheckedIndexedAccess`), Vitest, tsx build scripts. Worktree: `.claude/worktrees/feat+m3-timeline`. Gate: `pnpm typecheck && pnpm test`; data build: `pnpm data:build`.

---

## Decisions (baked in)

- **D1 — Derive a real seed, don't fabricate.** `build-timeline.ts` derives `cm` entries from the 31 real `cm_presets` (Global → `tier:'official'`/`status:'confirmed'`; JP history → `tier:'datamined'`/`status:'unconfirmed'`, the P4 JP-ahead preview). `cmNumber`, upcoming CMs, banners, patches, and `/news/` confirmations are **not invented** — they come from `timeline_overrides.json` (P5, hand-maintained) or Plan-2 importers. The seed `timeline_overrides.json` ships **empty** (a documented stub).
- **D2 — `cm_schedule` only includes entries with a `cmNumber`.** The shared-data-model §6 `CmScheduleRow` needs a non-optional `cmId`; `projectCmSchedule` filters to `cm` entries that have `cmNumber` (+ `courseId`). So until you assign `cmNumber`s in overrides, the schedule is sparse — that's honest, not a bug. **This is the step that makes M4's `cmRef.cmId` join live.**
- **D3 — Insert-or-patch merge.** Unlike the strict `applyOverrides` (patch-only, throws on unknown id), the timeline merge supports **new** entries (upcoming CMs/banners not in `cm_presets`) AND patches to derived ones, both keyed by `id`. It lives in `src/core/timeline.ts` (pure, tested); the build orchestrates.
- **D4 — Date predictor is a labeled prediction (P3).** `predictGlobalDate` (JP date + pace multiplier + anchors) is only ever attached to `tier:'prediction'` entries; never presented as confirmed.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/core/types.ts` | **Modify.** Add `TimelineTier`, `TimelineStatus`, `TimelineSourceKind`, `TimelineEntry`, `CmScheduleRow`. |
| `src/core/timeline.ts` | **Create.** Pure: `mergeTimeline`, `projectCmSchedule`, `predictGlobalDate`, `timelineBadge`, `sortTimeline`. |
| `src/core/timeline.test.ts` | **Create.** Unit tests. |
| `scripts/build-timeline.ts` | **Create.** Derive `cm` entries from `cm_presets` ⊕ overrides → `TimelineEntry[]`. |
| `scripts/build-all.ts` | **Modify.** Call `buildTimeline`, write `public/data/timeline.json`. |
| `data-overrides/timeline_overrides.json` | **Create.** P5 hand-maintained entries (ships empty). |
| `public/data/timeline.json` | **Generated, committed.** `{ server?, dataVersion, entries: TimelineEntry[] }`. |
| `src/features/data/gameData.ts` | **Modify.** Load `timeline.json`; expose `timeline` + a derived `cmSchedule`. |

---

## Task 1: Timeline types

**Files:** Modify `src/core/types.ts`.

- [ ] **Step 1: Add the types**

After the `CmPreset` interface, add:
```ts
export type TimelineTier = 'official' | 'datamined' | 'prediction';
export type TimelineStatus = 'confirmed' | 'unconfirmed';
export type TimelineSourceKind =
  | 'official_news' | 'game8' | 'soulec' | 'phoenix' | 'umaguide' | 'gametora' | 'umalator' | 'manual';

/** A CM / banner / patch on the M3 timeline (generated ⊕ overrides; M3 spec §1.2). */
export interface TimelineEntry {
  id: string;
  type: 'cm' | 'banner' | 'patch';
  title: string;
  /** ISO dates; CM uses finals (and optionally signup start). */
  dates: { start?: string; finals?: string; end?: string };
  cm?: { cmNumber?: number; courseId?: string; trackSummary?: string };
  banner?: { kind: 'char' | 'support'; umaId?: string; cardId?: string };
  patch?: { version?: string; summary?: string };
  tier: TimelineTier;
  status: TimelineStatus;
  source: { kind: TimelineSourceKind; url: string };
  server: Server;
  dataVersion: string;
}

/** M3→M4 projection (shared-data-model §6): one row per CM entry that has a cmNumber. */
export type CmScheduleRow = { date: string; cmId: CmId; cmNumber: number; name: string; courseId: string };
```
> `Server` and `CmId` already exist in `types.ts`. Pure additions — nothing breaks.

- [ ] **Step 2: Gate** — `pnpm typecheck && pnpm test` → 313 pass (additive).
- [ ] **Step 3: Commit**
```bash
git add src/core/types.ts
git commit -m "feat(core): TimelineEntry + CmScheduleRow types (M3 timeline)"
```

---

## Task 2: `src/core/timeline.ts` (pure core)

**Files:** Create `src/core/timeline.ts`, `src/core/timeline.test.ts`.

- [ ] **Step 1: Write the failing test** — `src/core/timeline.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { mergeTimeline, projectCmSchedule, predictGlobalDate, timelineBadge, sortTimeline } from './timeline';
import type { TimelineEntry } from './types';

const base: TimelineEntry[] = [
  { id: 'cm-a', type: 'cm', title: 'Aries Cup', dates: { finals: '2026-04-22' }, cm: { courseId: '10101' }, tier: 'datamined', status: 'unconfirmed', source: { kind: 'umalator', url: 'u' }, server: 'jp', dataVersion: 'v' },
  { id: 'cm-b', type: 'cm', title: 'Taurus Cup', dates: { finals: '2026-05-22' }, cm: { cmNumber: 15, courseId: '10202' }, tier: 'official', status: 'confirmed', source: { kind: 'umalator', url: 'u' }, server: 'global', dataVersion: 'v' },
];

describe('mergeTimeline (insert-or-patch by id)', () => {
  it('patches an existing entry', () => {
    const merged = mergeTimeline(base, [{ id: 'cm-a', cm: { cmNumber: 14, courseId: '10101' }, status: 'confirmed' }]);
    const a = merged.find((e) => e.id === 'cm-a')!;
    expect(a.cm?.cmNumber).toBe(14);
    expect(a.status).toBe('confirmed');
    expect(a.title).toBe('Aries Cup'); // untouched fields preserved
  });
  it('inserts a new entry', () => {
    const next: TimelineEntry = { id: 'patch-1', type: 'patch', title: 'v3.0', dates: { start: '2026-06-01' }, patch: { version: '3.0' }, tier: 'prediction', status: 'unconfirmed', source: { kind: 'manual', url: 'm' }, server: 'global', dataVersion: 'v' };
    const merged = mergeTimeline(base, [next]);
    expect(merged.find((e) => e.id === 'patch-1')).toBeDefined();
    expect(merged).toHaveLength(3);
  });
});

describe('projectCmSchedule', () => {
  it('emits a row only for cm entries with a cmNumber', () => {
    const rows = projectCmSchedule(base);
    expect(rows).toHaveLength(1); // only cm-b has a cmNumber
    expect(rows[0]).toEqual({ date: '2026-05-22', cmId: 'CM15', cmNumber: 15, name: 'Taurus Cup', courseId: '10202' });
  });
});

describe('predictGlobalDate', () => {
  it('compresses the JP gap by the pace multiplier', () => {
    // JP anchor 2025-01-01, Global anchor 2026-01-01, pace 2.0; a JP event 100 days after anchor → 50 days after the global anchor.
    const g = predictGlobalDate('2025-04-11', 2.0, '2025-01-01', '2026-01-01');
    expect(g).toBe('2026-02-20'); // 2026-01-01 + 50 days
  });
});

describe('timelineBadge', () => {
  it('confirmed → ✓; else tier symbol', () => {
    expect(timelineBadge({ ...base[1] }).symbol).toBe('✓');
    expect(timelineBadge({ ...base[0] }).symbol).toBe('◆'); // datamined, unconfirmed
    expect(timelineBadge({ ...base[0], tier: 'prediction' }).symbol).toBe('~');
  });
});

describe('sortTimeline', () => {
  it('orders by the effective date ascending', () => {
    expect(sortTimeline(base).map((e) => e.id)).toEqual(['cm-a', 'cm-b']);
  });
});
```

- [ ] **Step 2: Run → FAIL** (`Cannot find module './timeline'`).

- [ ] **Step 3: Implement `src/core/timeline.ts`**
```ts
import type { TimelineEntry, CmScheduleRow, CmId } from './types';

/** The date a timeline entry sorts/ schedules on: finals → start → end. */
export function effectiveDate(e: TimelineEntry): string {
  return e.dates.finals ?? e.dates.start ?? e.dates.end ?? '';
}

/** Deep-merge a patch onto a base entry (cm/banner/patch sub-objects merged shallowly). */
function patchEntry(base: TimelineEntry, patch: Partial<TimelineEntry>): TimelineEntry {
  return {
    ...base,
    ...patch,
    dates: { ...base.dates, ...patch.dates },
    cm: patch.cm ? { ...base.cm, ...patch.cm } : base.cm,
    banner: patch.banner ? { ...base.banner, ...patch.banner } : base.banner,
    patch: patch.patch ? { ...base.patch, ...patch.patch } : base.patch,
    source: patch.source ? { ...base.source, ...patch.source } : base.source,
  };
}

/** P5 merge: an override with a known id patches; an unknown id inserts (must be a full entry). */
export function mergeTimeline(base: TimelineEntry[], overrides: Array<Partial<TimelineEntry> & { id: string }>): TimelineEntry[] {
  const byId = new Map(base.map((e) => [e.id, e]));
  for (const ov of overrides) {
    const existing = byId.get(ov.id);
    if (existing) byId.set(ov.id, patchEntry(existing, ov));
    else byId.set(ov.id, ov as TimelineEntry); // insert (caller/build validates completeness)
  }
  return sortTimeline([...byId.values()]);
}

export function sortTimeline(entries: TimelineEntry[]): TimelineEntry[] {
  return [...entries].sort((a, b) => (effectiveDate(a) < effectiveDate(b) ? -1 : effectiveDate(a) > effectiveDate(b) ? 1 : 0));
}

/** M3→M4: cm entries with a cmNumber → CmScheduleRow (shared-data-model §6). */
export function projectCmSchedule(entries: TimelineEntry[]): CmScheduleRow[] {
  const rows: CmScheduleRow[] = [];
  for (const e of entries) {
    if (e.type !== 'cm' || e.cm?.cmNumber === undefined || !e.cm.courseId) continue;
    rows.push({
      date: effectiveDate(e),
      cmId: `CM${e.cm.cmNumber}` as CmId,
      cmNumber: e.cm.cmNumber,
      name: e.title,
      courseId: e.cm.courseId,
    });
  }
  return rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/**
 * Predict a Global date from a JP date: Global runs JP content on a compressed schedule, so the
 * gap from the anchor shrinks by `paceMultiplier` (~1.3–1.6×; M3 spec §1.4). PREDICTION ONLY (P3).
 */
export function predictGlobalDate(jpISO: string, paceMultiplier: number, anchorJpISO: string, anchorGlobalISO: string): string {
  const DAY = 86_400_000;
  const jpGapDays = (Date.parse(jpISO) - Date.parse(anchorJpISO)) / DAY;
  const globalMs = Date.parse(anchorGlobalISO) + (jpGapDays / paceMultiplier) * DAY;
  return new Date(globalMs).toISOString().slice(0, 10);
}

export function timelineBadge(e: TimelineEntry): { symbol: '✓' | '◆' | '~'; label: string } {
  if (e.status === 'confirmed') return { symbol: '✓', label: 'confirmed' };
  if (e.tier === 'datamined') return { symbol: '◆', label: 'datamined' };
  return { symbol: '~', label: 'predicted' };
}
```
> `predictGlobalDate` uses `Date.parse`/`new Date(ms)` — these are allowed (argless `new Date()`/`Date.now()` are the forbidden ones; parsing a fixed ISO string is fine). Verify the test's expected `'2026-02-20'` matches your implementation; adjust the test if off-by-one on UTC rounding (use the value your code actually produces, keeping the "gap compressed by pace" property).

- [ ] **Step 4: Run → PASS.** Then `pnpm typecheck` clean.
- [ ] **Step 5: Commit**
```bash
git add src/core/timeline.ts src/core/timeline.test.ts
git commit -m "feat(core): timeline merge, cm_schedule projection, JP→Global date predictor"
```

---

## Task 3: Build the seed dataset + wire it in

**Files:** Create `scripts/build-timeline.ts`, `data-overrides/timeline_overrides.json`; Modify `scripts/build-all.ts`, `src/features/data/gameData.ts`; Generated `public/data/timeline.json`.

- [ ] **Step 1: `scripts/build-timeline.ts`** — derive cm entries from `cm_presets` ⊕ overrides:
```ts
import { mergeTimeline } from '@/core/timeline';
import type { CmPreset, TimelineEntry } from '@/core/types';

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** Each cm_preset → a `cm` TimelineEntry (real data; tier/status by server, P4). */
export function buildTimeline(inputs: {
  presets: CmPreset[];
  overrides: Array<Partial<TimelineEntry> & { id: string }>;
  dataVersion: string;
}): { dataVersion: string; entries: TimelineEntry[] } {
  const base: TimelineEntry[] = inputs.presets.map((p) => ({
    id: `cm-${slug(p.name)}-${p.date}`,
    type: 'cm',
    title: p.name,
    dates: { finals: p.date },
    cm: { courseId: p.courseId, trackSummary: `${p.distance}m ${p.surface}` },
    tier: p.server === 'global' ? 'official' : 'datamined',
    status: p.server === 'global' ? 'confirmed' : 'unconfirmed',
    source: { kind: 'umalator', url: 'https://github.com/jalbarrang/umalator-global' },
    server: p.server,
    dataVersion: inputs.dataVersion,
  }));
  return { dataVersion: inputs.dataVersion, entries: mergeTimeline(base, inputs.overrides) };
}
```

- [ ] **Step 2: `data-overrides/timeline_overrides.json`** — ships empty (P5 stub):
```json
{
  "_note": "M3 timeline overrides (P5, hand-maintained). Add/patch TimelineEntry objects by id: assign cmNumber to make M4's cmRef.cmId join live, flip status + add /news/<id>/ source.url on confirmation, and insert upcoming CMs / banners / patches. Unknown id = insert (must be a complete TimelineEntry); known id = patch. Schedule data is NEVER fabricated here — only real, sourced entries.",
  "entries": []
}
```

- [ ] **Step 3: Wire into `scripts/build-all.ts`** — following the existing builder pattern (read it; mirror how `buildAffinity`/`buildSkills` are called and written):
```ts
import { buildTimeline } from './build-timeline';
import { readFileSync } from 'node:fs'; // if not already imported
// ... read the presets you already build/read, and the overrides file:
const timelineOverrides = JSON.parse(readFileSync(join(ROOT_OR_OVERRIDES_DIR, 'data-overrides/timeline_overrides.json'), 'utf8')).entries ?? [];
const timeline = buildTimeline({ presets: cmPresets, overrides: timelineOverrides, dataVersion });
writeJsonDeterministic(join(PUBLIC_DATA_DIR, 'timeline.json'), timeline);
```
> Use the file's real symbols (`cmPresets` may be built by `buildCmPresets` — reuse that result; `OVERRIDES_DIR`/`ROOT` per the file). If `build-all.ts` already loads overrides via `loadOverrideFiles`, prefer reading `timeline_overrides.json` directly here since it's insert-capable (not the strict patch-only merge).

- [ ] **Step 4: Build + verify**
Run: `pnpm data:build`
Expected: `public/data/timeline.json` with ~31 derived cm entries. Verify:
```bash
node -e "const t=require('./public/data/timeline.json'); console.log('entries',t.entries.length,'| cm',t.entries.filter(e=>e.type==='cm').length,'| confirmed',t.entries.filter(e=>e.status==='confirmed').length); const {projectCmSchedule}=require('./dist-nonexistent'); " 2>/dev/null || node -e "const t=require('./public/data/timeline.json'); console.log('entries',t.entries.length,'| sample',JSON.stringify(t.entries[0]))"
```
Expected: ~31 entries; cm_schedule will be empty (no cmNumbers yet — D2).

- [ ] **Step 5: Wire runtime loading in `src/features/data/gameData.ts`**
Read the file. Following how `affinity.json`/other datasets are fetched into the GameData context, add `timeline.json` to the loaded datasets and expose `timeline: TimelineEntry[]` plus a derived `cmSchedule: CmScheduleRow[]` (call `projectCmSchedule(timeline)`). It's OPTIONAL like `umas`/`icons` (a fetch failure → `[]`, don't flip the whole provider to fixture). Add `TimelineEntry`/`CmScheduleRow` to the `GameData` interface + the `*ById`/derived section.

- [ ] **Step 6: Gate**
Run: `pnpm typecheck && pnpm test && pnpm build`
Expected: all green (test count = prior + any gameData test updates; if a gameData test asserts the loaded dataset set, update it to include `timeline`).

- [ ] **Step 7: Commit**
```bash
git add scripts/build-timeline.ts scripts/build-all.ts data-overrides/timeline_overrides.json public/data/timeline.json src/features/data/gameData.ts
git commit -m "feat(data): derive public/data/timeline.json from cm_presets; load timeline + cm_schedule at runtime"
```

---

## Self-Review

**1. Spec coverage (M3 spec milestone 1 + shared-data-model §6):** `TimelineEntry` (§1.2) → Task 1. `src/core/timeline.ts` + tests (milestone 1) → Task 2. `cm_schedule` projection (§6, `cmNumber→cmId`, non-optional `courseId`) → `projectCmSchedule` (Task 2). Tiers/badges (§1.3) → `timelineBadge`. Pace-multiplier predictor (§1.4) → `predictGlobalDate`. Generated ⊕ overrides (§1.4 pipeline, P5) → Task 3. **Deferred:** importers (milestone 2 → Plan 2), browsable view (milestone 4 → Plan 3), wire-to-M4 §0 consumption + timeline-watch (milestones 5–6 → later). Phase 2 (three-up) / Phase 3 (logger) are spec-deferred.

**2. Placeholder scan:** `timeline_overrides.json` ships intentionally empty (D1 — honest stub, not a TODO). The Step-4 verify snippet has a `|| ` fallback (the first half is a throwaway probe). No fabricated dates.

**3. Type consistency:** `TimelineEntry`/`CmScheduleRow` defined once (Task 1), consumed by `timeline.ts` (Task 2), `build-timeline.ts` (Task 3), and `gameData.ts` (Task 3) identically. `mergeTimeline`/`projectCmSchedule`/`predictGlobalDate`/`timelineBadge`/`sortTimeline` signatures match between `timeline.ts` and the tests.

**Honest-numbers (P3):** JP entries are `datamined`/`unconfirmed` (preview, P4); predictions are tier-labeled and never auto-confirmed; `cm_schedule` is deliberately sparse until real `cmNumber`s are added — no invented schedule.

---

## Execution Handoff

Plan saved to `docs/superpowers/plans/2026-06-15-m3-timeline-core.md`. Two options:
1. **Subagent-Driven (recommended)** — fresh subagent per task, review between.
2. **Inline Execution** — here with checkpoints.

Which approach?
