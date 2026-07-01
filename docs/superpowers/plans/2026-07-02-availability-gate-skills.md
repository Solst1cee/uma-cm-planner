# Availability Gate — JP-ahead Skills — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Emit the ~1,174 source-backed JP-ahead skills as `server:'jp'` `SkillRecord`s whose Global `releaseDate` is derived (min-over-sources) from the JP cards/umas that grant them, then light up the two skill charts and add a gated `show upcoming` toggle to the wishlist `SkillPicker`.

**Architecture:** A pure `resolveJpSkillDate` computes each skill's date from card/uma date maps; `buildJpSkills` (in `scripts/build-skills.ts`) mirrors `buildJpCards`/`buildJpUmas`, building records from gametora-only fields and running as a post-pass after cards+umas in `build-all.ts`. The charts already gate; the picker gains an optional `asOfISO` prop; other consumers safe-exclude.

**Tech Stack:** TypeScript, Vitest (jsdom), tsx build scripts, React 19. No new deps. No `sim:build`.

## Global Constraints

- **Reuse:** date entries come from the already-built `jpCards`/`jpUmas` (their `releaseDate`/`releaseDatePredicted`); the `cal` in `build-all.ts` is already computed by slice 2a — do not recompute. Gate via `isReleasedBy` (`@/core/availability`). CM-date derivation mirrors `SkillChartPanel` (`cmEntry = timeline.find(type==='cm' && cm.cmNumber===cmNumber)`; `asOfISO = cmEntry?.dates.start ?? cmEntry?.dates.finals ?? today`).
- **No `sim:build` / engine change:** JP skill effects come from the engine bundle keyed by id; `skills.json` display fields come from gametora.
- **Emission set = all 1,174 source-backed JP skills** (incl. 596 evolution variants). Drop skills with no dated source (spec decision E).
- **gametora `rarity` → `SkillRarity`:** `1 → 'white'`, `2 → 'gold'`, `3 | 4 | 5 | 6 → 'unique'`.
- **`baseSpCost`** = gametora `cost` when present, else `0`.
- **P3/P4:** JP skills are `server:'jp'`; projected dates carry `releaseDatePredicted:true`; a surface shows a JP skill only when it opts in AND `isReleasedBy(s, asOfISO)`. Default behaviour (toggles off) is unchanged.
- **Windows/case-FS + `noUncheckedIndexedAccess` on:** guard array indexing; component files that have a pure-helper sibling must not collide by case.
- **Git:** stage only each task's explicit files; never `git add -A/./-u`; one commit per task; commit body ends with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` (use `git commit -F -`).

---

### Task 1: `resolveJpSkillDate` pure helper

**Files:**
- Create: `scripts/lib/jpSkillDate.ts`
- Test: `scripts/lib/jpSkillDate.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface DateEntry { date: string; predicted: boolean }
  export function resolveJpSkillDate(
    cardIds: readonly string[],
    umaIds: readonly string[],
    cardDates: ReadonlyMap<string, DateEntry>,
    umaDates: ReadonlyMap<string, DateEntry>,
  ): { releaseDate?: string; predicted: boolean };
  ```

- [ ] **Step 1: Write the failing test** `scripts/lib/jpSkillDate.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { resolveJpSkillDate, type DateEntry } from './jpSkillDate';

const cardDates = new Map<string, DateEntry>([
  ['30275', { date: '2026-09-01', predicted: true }],
  ['30100', { date: '2026-07-15', predicted: false }],
]);
const umaDates = new Map<string, DateEntry>([
  ['100301', { date: '2026-08-10', predicted: true }],
]);

describe('resolveJpSkillDate', () => {
  it('takes the earliest date across card + uma sources', () => {
    // card 30100 (2026-07-15, announced) is earliest → wins
    const r = resolveJpSkillDate(['30275', '30100'], ['100301'], cardDates, umaDates);
    expect(r.releaseDate).toBe('2026-07-15');
    expect(r.predicted).toBe(false);
  });
  it('propagates the predicted flag from the earliest source', () => {
    const r = resolveJpSkillDate(['30275'], ['100301'], cardDates, umaDates);
    // uma 100301 (2026-08-10) is earlier than card 30275 (2026-09-01)
    expect(r.releaseDate).toBe('2026-08-10');
    expect(r.predicted).toBe(true);
  });
  it('prefers an announced source over a predicted one on an equal date', () => {
    const cd = new Map<string, DateEntry>([
      ['a', { date: '2026-07-15', predicted: true }],
      ['b', { date: '2026-07-15', predicted: false }],
    ]);
    const r = resolveJpSkillDate(['a', 'b'], [], cd, new Map());
    expect(r.releaseDate).toBe('2026-07-15');
    expect(r.predicted).toBe(false);
  });
  it('returns undefined when no source resolves to a dated entry', () => {
    const r = resolveJpSkillDate(['999'], ['888'], cardDates, umaDates);
    expect(r.releaseDate).toBeUndefined();
    expect(r.predicted).toBe(false);
  });
  it('handles empty source lists', () => {
    const r = resolveJpSkillDate([], [], cardDates, umaDates);
    expect(r.releaseDate).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run scripts/lib/jpSkillDate.test.ts`
Expected: FAIL — `resolveJpSkillDate` not exported.

- [ ] **Step 3: Implement** `scripts/lib/jpSkillDate.ts`:

```ts
/** Shared shape: a source's Global availability + whether it's a projection. */
export interface DateEntry {
  date: string;
  predicted: boolean;
}

/**
 * Earliest Global availability of a JP skill = the minimum date across its
 * source cards + umas. Ties resolve to the announced (non-predicted) entry.
 * Returns { predicted: false } with no releaseDate when no source is dated.
 */
export function resolveJpSkillDate(
  cardIds: readonly string[],
  umaIds: readonly string[],
  cardDates: ReadonlyMap<string, DateEntry>,
  umaDates: ReadonlyMap<string, DateEntry>,
): { releaseDate?: string; predicted: boolean } {
  const entries: DateEntry[] = [];
  for (const id of cardIds) {
    const e = cardDates.get(id);
    if (e) entries.push(e);
  }
  for (const id of umaIds) {
    const e = umaDates.get(id);
    if (e) entries.push(e);
  }
  if (entries.length === 0) return { predicted: false };
  // Earliest date wins; on a tie, announced (predicted:false) beats projected.
  entries.sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : Number(a.predicted) - Number(b.predicted),
  );
  const best = entries[0]!;
  return { releaseDate: best.date, predicted: best.predicted };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run scripts/lib/jpSkillDate.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/jpSkillDate.ts scripts/lib/jpSkillDate.test.ts
git commit -F - <<'EOF'
feat(availability): resolveJpSkillDate — min-over-sources date helper

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 2: `buildJpSkills` + build wiring

**Files:**
- Modify: `scripts/lib/upstream-types.ts` (extend `GtSkill` + `GtLocEn`)
- Modify: `scripts/build-skills.ts` (add `mapGtRarity` + `buildJpSkills`)
- Modify: `scripts/build-all.ts` (build date maps, run `buildJpSkills` after umas, merge into `skills`)
- Modify: `scripts/outputs.test.ts` (skill count)
- Test: `scripts/build-skills.jp.test.ts`

**Interfaces:**
- Consumes: `resolveJpSkillDate` + `DateEntry` (Task 1); module-local `flattenIds`/`globalField`/`serializeConditions` (already in `build-skills.ts`).
- Produces:
  ```ts
  export function buildJpSkills(inputs: {
    gametora: GtSkill[];
    masterSkillIds: ReadonlySet<string>;
    cardDates: ReadonlyMap<string, DateEntry>;
    umaDates: ReadonlyMap<string, DateEntry>;
    dataVersion: string;
  }): SkillRecord[];
  ```

- [ ] **Step 1: Extend `GtSkill` + `GtLocEn`** in `scripts/lib/upstream-types.ts`. Add to `GtLocEn` (after `condition_groups?`):

```ts
  /** Global-localized display name (present once the skill localizes). */
  name?: string;
```

Add to `GtSkill` (after `jpname?`):

```ts
  /** gametora rarity: 1=white, 2=gold, 3/4/5=unique, 6=evolution (→unique). */
  rarity?: number;
  /** SP shop cost; absent for uniques/evolution skills (→ 0). */
  cost?: number;
  /** Shared skill-icon id. */
  iconid?: number;
  /** English display name (fan/official). */
  name_en?: string;
  /** Fallback English name field seen on some records. */
  enname?: string;
  /** Same-family variant skill ids. */
  versions?: number[];
```

- [ ] **Step 2: Write the failing test** `scripts/build-skills.jp.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildJpSkills } from './build-skills';
import type { GtSkill } from './lib/upstream-types';
import type { DateEntry } from './lib/jpSkillDate';

const cardDates = new Map<string, DateEntry>([['30275', { date: '2026-09-01', predicted: true }]]);
const umaDates = new Map<string, DateEntry>([['100301', { date: '2026-08-10', predicted: true }]]);

const gametora: GtSkill[] = [
  // white skill from a JP card → server:jp, dated from the card
  { id: 203441, rarity: 2, cost: 170, iconid: 20042, name_en: 'Gold Skill A', jpname: 'ゴールドA', sup_e: [[30275], []] },
  // uma-sourced unique → dated from the uma, cost 0
  { id: 100301011, rarity: 5, iconid: 10030, name_en: 'Uma Unique', jpname: 'ユニーク', char: [100301] },
  // already in the Global master → skipped
  { id: 200011, rarity: 1, cost: 120, iconid: 20001, name_en: 'Global White' },
  // sourceless → dropped
  { id: 209999, rarity: 1, cost: 100, iconid: 20003, name_en: 'Orphan' },
];

describe('buildJpSkills', () => {
  const out = buildJpSkills({
    gametora,
    masterSkillIds: new Set(['200011']),
    cardDates,
    umaDates,
    dataVersion: 'test',
  });
  const byId = new Map(out.map((s) => [s.skillId, s]));

  it('emits source-backed JP skills as server:jp, skips master + sourceless', () => {
    expect(byId.has('203441')).toBe(true);
    expect(byId.has('100301011')).toBe(true);
    expect(byId.has('200011')).toBe(false); // in master
    expect(byId.has('209999')).toBe(false); // no source
    expect(byId.get('203441')!.server).toBe('jp');
  });
  it('maps rarity + cost + date from gametora/sources', () => {
    const gold = byId.get('203441')!;
    expect(gold.rarity).toBe('gold');
    expect(gold.baseSpCost).toBe(170);
    expect(gold.releaseDate).toBe('2026-09-01');
    expect(gold.releaseDatePredicted).toBe(true);
    expect(gold.nameEn).toBe('Gold Skill A');
    const uniq = byId.get('100301011')!;
    expect(uniq.rarity).toBe('unique');
    expect(uniq.baseSpCost).toBe(0); // no cost → 0
    expect(uniq.releaseDate).toBe('2026-08-10');
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm vitest run scripts/build-skills.jp.test.ts`
Expected: FAIL — `buildJpSkills` not exported.

- [ ] **Step 4: Implement `mapGtRarity` + `buildJpSkills`** in `scripts/build-skills.ts`. Add the imports at the top (with the other imports):

```ts
import { resolveJpSkillDate, type DateEntry } from './lib/jpSkillDate';
```

Add, after the `buildSkills` function:

```ts
/** gametora rarity → our SkillRarity (empirically derived; 6 = evolution → unique). */
function mapGtRarity(gtRarity: number | undefined): SkillRarity {
  if (gtRarity === 1) return 'white';
  if (gtRarity === 2) return 'gold';
  return 'unique'; // 3/4/5/6 (+ undefined) → unique
}

/** English display name from gametora, most-localized first. */
function jpSkillNameEn(gt: GtSkill): string {
  return gt.loc?.en?.name ?? gt.name_en ?? gt.enname ?? gt.jpname ?? `Skill ${gt.id}`;
}

/**
 * JP-ahead skills: gametora skills absent from the Global master that have a
 * dated card/uma source (server:'jp'). Display fields come from gametora; the
 * sim effect comes from the engine bundle keyed by id. Undated → dropped.
 */
export function buildJpSkills(inputs: {
  gametora: GtSkill[];
  masterSkillIds: ReadonlySet<string>;
  cardDates: ReadonlyMap<string, DateEntry>;
  umaDates: ReadonlyMap<string, DateEntry>;
  dataVersion: string;
}): SkillRecord[] {
  const { gametora, masterSkillIds, cardDates, umaDates, dataVersion } = inputs;
  const records: SkillRecord[] = [];
  for (const gt of gametora) {
    const skillId = String(gt.id);
    if (masterSkillIds.has(skillId)) continue; // Global skill
    const cardIds = [
      ...flattenIds(globalField(gt, 'sup_hint')),
      ...flattenIds(globalField(gt, 'sup_e')),
    ].map(String);
    const umaIds = [
      ...(globalField(gt, 'char') ?? []),
      ...(globalField(gt, 'char_e') ?? []),
    ].map(String);
    const { releaseDate, predicted } = resolveJpSkillDate(cardIds, umaIds, cardDates, umaDates);
    if (releaseDate === undefined) continue; // undatable → drop (spec decision E)
    const groups = gt.loc?.en?.condition_groups ?? gt.condition_groups;
    const record: SkillRecord = {
      skillId,
      nameEn: jpSkillNameEn(gt),
      nameJp: gt.jpname ?? '',
      baseSpCost: gt.cost ?? 0,
      rarity: mapGtRarity(gt.rarity),
      iconId: String(gt.iconid ?? ''),
      conditions: groups !== undefined && groups.length > 0 ? serializeConditions(groups) : '',
      server: 'jp',
      releaseDate,
      dataVersion,
    };
    if (predicted) record.releaseDatePredicted = true;
    const variants = (gt.versions ?? []).map(String).filter((id) => id !== skillId);
    if (variants.length > 0) record.variantSkillIds = variants;
    records.push(record);
  }
  records.sort((a, b) => Number(a.skillId) - Number(b.skillId));
  return records;
}
```

Note: `globalField(gt, 'char')` returns `gt.loc?.en?.char ?? gt.char` (verify the helper handles `char`/`char_e` — it is typed for all four keys per `build-skills.ts:50`). `flattenIds` handles the `number[][] | number[]` shape of `sup_hint`/`sup_e`.

- [ ] **Step 5: Run the JP-skill test to verify it passes**

Run: `pnpm vitest run scripts/build-skills.jp.test.ts`
Expected: PASS.

- [ ] **Step 6: Wire into `scripts/build-all.ts`.** After the `jpUmas` are built (around line 124–125) and BEFORE the `writeJsonDeterministic(..., 'skills.json', skills)` call (line 175), add:

```ts
import { buildJpSkills } from './build-skills';
import type { DateEntry } from './lib/jpSkillDate';
// … after jpCards (line 110) and jpUmas (line 124) exist:
const cardDates = new Map<string, DateEntry>();
for (const c of jpCards) {
  if (c.releaseDate) cardDates.set(c.cardId, { date: c.releaseDate, predicted: c.releaseDatePredicted === true });
}
const umaDates = new Map<string, DateEntry>();
for (const u of jpUmas) {
  if (u.releaseDate) umaDates.set(u.umaId, { date: u.releaseDate, predicted: u.releaseDatePredicted === true });
}
const jpSkills = buildJpSkills({
  gametora: readBorrowedJson<GtSkill[]>('gametora/skills.json'),
  masterSkillIds: releasedSkillIds,
  cardDates,
  umaDates,
  dataVersion: DATA_VERSION,
});
console.log(`build-skills: emitted ${jpSkills.length} JP-ahead skill(s) (${jpSkills.filter((s) => s.releaseDatePredicted).length} date-projected)`);
skills = [...skills, ...jpSkills].sort((a, b) => Number(a.skillId) - Number(b.skillId));
```

(`skills` is the `let` from line 57; `releasedSkillIds` is the Set from line 55; `GtSkill` is imported from `./lib/upstream-types` — add to the existing import if not present. Confirm `readBorrowedJson` is already imported.)

- [ ] **Step 7: Rebuild + update the count.**

Run: `pnpm data:build` (borrowed inputs already present from prior slices; if missing, `pnpm data:fetch` first)
Expected: logs `build-skills: emitted ~1174 JP-ahead skill(s)` + the final skills total. Read the emitted count + new total from the output. Then fix `scripts/outputs.test.ts` — the current block (lines ~22–26) asserts three things that break with JP skills present:

```ts
    expect(skills).toHaveLength(587);                                   // → new total
    expect(skills.every((s) => s.server === 'global')).toBe(true);      // → BREAKS: split into subsets
    expect(skills.every((s) => s.dataVersion === 'global-76214c82')).toBe(true); // stays true (JP records share DATA_VERSION)
```

Change to (using the real new total from the build log):

```ts
    expect(skills).toHaveLength(<NEW_TOTAL>);
    const global = skills.filter((s) => s.server === 'global');
    const jp = skills.filter((s) => s.server === 'jp');
    expect(global).toHaveLength(587);
    expect(jp).toHaveLength(<JP_COUNT>);
    expect(jp.every((s) => s.releaseDate !== undefined)).toBe(true);    // every JP skill is dated
    expect(skills.every((s) => s.dataVersion === 'global-76214c82')).toBe(true);
```

(Adjust the test's `it(...)` title, which says "587 Global-released skills, all server=global", to reflect the Global + JP split.)

- [ ] **Step 8: Full gate + commit**

Run: `pnpm typecheck && pnpm test`
Expected: PASS.

```bash
git add scripts/lib/upstream-types.ts scripts/build-skills.ts scripts/build-skills.jp.test.ts scripts/build-all.ts scripts/outputs.test.ts public/data/skills.json
git commit -F - <<'EOF'
feat(availability): emit JP-ahead skills (server:jp, source-derived dates)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 3: Wishlist `SkillPicker` gate

**Files:**
- Modify: `src/features/skill-planner/SkillPicker.tsx`
- Modify: `src/features/cm-planner/PlannerSidebar.tsx` (pass `asOfISO` — it already derives it)
- Modify: `src/features/inheritance/InheritancePage.tsx` (derive + pass `asOfISO`)
- Test: `src/features/skill-planner/SkillPicker.test.tsx` (create or extend)

**Interfaces:**
- Consumes: `isReleasedBy` (`@/core/availability`), the `SkillRecord.server`/`releaseDate`/`releaseDatePredicted` fields (Task 2).
- Produces: `SkillPicker` gains an optional `asOfISO?: string` prop.

- [ ] **Step 1: Write the failing test** `src/features/skill-planner/SkillPicker.test.tsx` (create if absent; match the codebase's `useGameData` stub pattern — mock `@/features/data/gameData` with a Global white skill + a JP white skill dated before/after the CM date):

```tsx
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

const skills = [
  { skillId: '200011', nameEn: 'Global White', nameJp: '', baseSpCost: 120, rarity: 'white', iconId: '20001', conditions: '', server: 'global', dataVersion: 't' },
  { skillId: '203441', nameEn: 'JP White', nameJp: '', baseSpCost: 100, rarity: 'white', iconId: '20042', conditions: '', server: 'jp', releaseDate: '2026-06-01', releaseDatePredicted: true, dataVersion: 't' },
];
vi.mock('@/features/data/gameData', () => ({
  useGameData: () => ({ status: 'ready', skills, skillById: new Map(skills.map((s) => [s.skillId, s])), iconManifest: null }),
}));

import { SkillPicker } from './SkillPicker';

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('SkillPicker availability gate', () => {
  it('hides JP skills by default and shows them behind show-upcoming when released by the CM date', async () => {
    render(<SkillPicker addedSkillIds={new Set()} onPick={vi.fn()} asOfISO="2026-07-01" />);
    await userEvent.type(screen.getByRole('searchbox'), 'White');
    expect(screen.getByText('Global White')).toBeInTheDocument();
    expect(screen.queryByText('JP White')).not.toBeInTheDocument();
    await userEvent.click(screen.getByLabelText(/show upcoming/i));
    expect(screen.getByText('JP White')).toBeInTheDocument();
  });
  it('never shows JP skills when no asOfISO is provided (non-wishlist callers)', async () => {
    render(<SkillPicker addedSkillIds={new Set()} onPick={vi.fn()} />);
    await userEvent.type(screen.getByRole('searchbox'), 'White');
    expect(screen.queryByLabelText(/show upcoming/i)).not.toBeInTheDocument();
    expect(screen.queryByText('JP White')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run src/features/skill-planner/SkillPicker.test.tsx`
Expected: FAIL — no `asOfISO` prop / no `show upcoming` toggle.

- [ ] **Step 3: Implement the gate** in `src/features/skill-planner/SkillPicker.tsx`:
  - Add the import: `import { isReleasedBy } from '@/core/availability';`
  - Add `asOfISO?: string` to the props type + destructure.
  - Add `const [showUpcoming, setShowUpcoming] = useState(false);`
  - Change the filter predicate from `s.server === 'global'` to:

```ts
        (s.server === 'global' || (asOfISO !== undefined && showUpcoming && isReleasedBy(s, asOfISO)))
```

  (Keep the existing `s.rarity !== 'unique'` and the other conditions unchanged; add `showUpcoming`, `asOfISO` to the `useMemo` dep array.)
  - Render the toggle only when `asOfISO` is provided, next to the search input:

```tsx
{asOfISO !== undefined && (
  <label className="picker-upcoming small">
    <input type="checkbox" checked={showUpcoming} onChange={(e) => setShowUpcoming(e.target.checked)} /> show upcoming
  </label>
)}
```

  - In the result row, when `skill.releaseDatePredicted`, render a `~{skill.releaseDate}` badge after the SP cost:

```tsx
{skill.releaseDatePredicted && <span className="muted small">~{skill.releaseDate}</span>}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run src/features/skill-planner/SkillPicker.test.tsx`
Expected: PASS. (Re-run once if a UI test flakes.)

- [ ] **Step 5: Wire the wishlist callers.**
  - **`src/features/cm-planner/PlannerSidebar.tsx`:** it already derives `asOfISO` (added in slice 2b). Find its `<SkillPicker … />` usage and pass `asOfISO={asOfISO}`. (Grep `SkillPicker` in the file; if `asOfISO` is scoped away from the JSX, reuse the same `cmEntry`/`asOfISO` const.)
  - **`src/features/inheritance/InheritancePage.tsx`:** add the CM-date derivation (mirror `SkillChartPanel`): destructure `timeline` from `useGameData()`, compute `cmNumber`/`cmEntry`/`asOfISO` from the current `uma1Plan`, and pass `asOfISO={asOfISO}` to its wishlist `<SkillPicker … />`. If `InheritancePage` already has a plan CM date in scope, reuse it.

- [ ] **Step 6: Typecheck + full gate + commit**

Run: `pnpm typecheck && pnpm test`
Expected: PASS.

```bash
git add src/features/skill-planner/SkillPicker.tsx src/features/skill-planner/SkillPicker.test.tsx src/features/cm-planner/PlannerSidebar.tsx src/features/inheritance/InheritancePage.tsx
git commit -F - <<'EOF'
feat(availability): show-upcoming gate + badge in the wishlist SkillPicker

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 4: `~date` badge on the two skill charts

**Files:**
- Modify: `src/features/cm-planner/SkillChartPanel.tsx`
- Modify: `src/features/cm-planner/AccelChartPanel.tsx`
- Test: `src/features/cm-planner/SkillChartPanel.test.tsx` (extend, or add if absent)

**Interfaces:** Consumes `SkillRecord.releaseDatePredicted`/`releaseDate` (Task 2). The `showUpcoming` gate already exists in both files.

- [ ] **Step 1: Confirm the gate lights up + write the failing badge test.** Extend `SkillChartPanel.test.tsx`: mock `useGameData` with a Global skill + a JP skill released by the CM date + a `timeline` giving the plan's CM a date; assert the JP skill's `~{releaseDate}` badge is NOT present by default and IS present after toggling `show upcoming`. (Match the file's existing render + stubs; the chart runs a Worker via `useSkillTrace`-style hooks — keep those stubbed as the existing tests do.)

```tsx
it('shows a ~date badge for predicted JP skills once show-upcoming is on', async () => {
  // render with skills = [globalWhite, jpWhite{releaseDate:'2026-06-01', releaseDatePredicted:true}], timeline for the CM…
  expect(screen.queryByText(/~2026-06-01/)).not.toBeInTheDocument();
  await userEvent.click(screen.getByLabelText(/show upcoming/i));
  expect(screen.getByText(/~2026-06-01/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run src/features/cm-planner/SkillChartPanel.test.tsx`
Expected: FAIL — no badge.

- [ ] **Step 3: Implement the badge** in both `SkillChartPanel.tsx` and `AccelChartPanel.tsx`. In each skill row (where the skill name/cost renders), add, when the row's skill `releaseDatePredicted` is set:

```tsx
{skill.releaseDatePredicted && <span className="cmp-upcoming-badge">~{skill.releaseDate}</span>}
```

(Reuse the global `.cmp-upcoming-badge` class from `uma-chart.css` added in slice 2b. Bind `skill` to whatever the row's skill variable is named in each file — confirm by reading the row render.)

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run src/features/cm-planner/SkillChartPanel.test.tsx`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

```bash
pnpm typecheck
git add src/features/cm-planner/SkillChartPanel.tsx src/features/cm-planner/AccelChartPanel.tsx src/features/cm-planner/SkillChartPanel.test.tsx
git commit -F - <<'EOF'
feat(availability): ~date predicted badge on the skill + accel charts

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 5: Safe-exclude JP skills from non-gated consumers

**Files:**
- Modify: `src/features/inheritance/InheritanceCard.tsx` (white-skill green-spark options)
- Modify: the M2 optimizer candidate-skill source, if the audit finds a leak (likely under `src/features/sp-optimizer/` or `src/core/spOptimizer.ts`)
- Test: the changed consumer's test (extend) or a focused new test

**Interfaces:** Consumes `SkillRecord.server`.

- [ ] **Step 1: Audit.** Run:
  `grep -rn "\.skills\b\|useGameData().skills\|const { *skills" src/features src/core --include=*.ts --include=*.tsx | grep -viE "SkillChartPanel|AccelChartPanel|SkillPicker|\.test\."`
  Read each hit. Any consumer that **lists/iterates** skills for selection, ranking, or optimization and does NOT filter `server` will now surface JP skills ungated. Known targets: `InheritanceCard.tsx:48` (`skills.filter((s) => s.rarity === 'white')` — no server guard); the M2 SP optimizer's candidate pool (trace where `spOptimizer` gets its skill list). `ParentForm.tsx:342` already filters `server === 'global'` (leave it).

- [ ] **Step 2: Write the failing test** for `InheritanceCard.tsx` (extend `src/features/inheritance/InheritanceCard.test.tsx`): mock `useGameData().skills` with a Global white skill + a JP white skill; assert the JP white skill is NOT among the green-spark white options offered.

```tsx
it('excludes JP-ahead white skills from the green-spark options', () => {
  // render InheritanceCard with skills = [{server:'global', rarity:'white', nameEn:'Global White'}, {server:'jp', rarity:'white', nameEn:'JP White'}]
  // assert the options passed to the search picker / rendered list do not include 'JP White'
  expect(screen.queryByText('JP White')).not.toBeInTheDocument();
});
```

(Match the file's existing test seams — it mocks `useGameData`/`useUmas`; the white options feed a `SearchPicker`/`UmaPickerModal` prop. If the options aren't directly rendered, assert on the captured prop as `InheritanceCard.test.tsx` already does for `greenIcon`.)

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm vitest run src/features/inheritance/InheritanceCard.test.tsx`
Expected: FAIL — JP white skill present.

- [ ] **Step 4: Implement.** In `InheritanceCard.tsx:48`, change:

```ts
    () => skills.filter((s) => s.rarity === 'white').map((s) => ({ id: s.skillId, name: s.nameEn })),
```

to:

```ts
    // Availability gate (2c): white sparks are Global-only; JP-ahead skills are preview.
    () => skills.filter((s) => s.server === 'global' && s.rarity === 'white').map((s) => ({ id: s.skillId, name: s.nameEn })),
```

If the Step-1 audit found the M2 optimizer iterating an unfiltered skill list, apply the same `s.server === 'global'` guard at that site (with a one-line comment) and add/extend a focused test proving a JP skill is excluded from the optimizer's candidate pool.

- [ ] **Step 5: Run to verify it passes + full gate**

Run: `pnpm vitest run src/features/inheritance/InheritanceCard.test.tsx && pnpm typecheck && pnpm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/inheritance/InheritanceCard.tsx src/features/inheritance/InheritanceCard.test.tsx
# (+ the M2 optimizer file + its test IF the audit found a leak)
git commit -F - <<'EOF'
fix(availability): exclude JP-ahead skills from non-gated consumers

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

## Self-Review

**Spec coverage:**
- ✅ `resolveJpSkillDate` (min-over-sources, predicted, undatable→undefined) — Task 1.
- ✅ `buildJpSkills` (gametora-only fields, rarity/cost map, drop undated) + `GtSkill` extension + build wiring + count + date maps from `jpCards`/`jpUmas` — Task 2.
- ✅ Wishlist `SkillPicker` gate (optional `asOfISO`, toggle, badge) + wire the wishlist callers — Task 3.
- ✅ Charts `~date` badge (they already gate) — Task 4.
- ✅ Safe-exclude (`InheritanceCard` white filter + M2 audit) — Task 5.
- Decisions A–E + the amendment (evolution skills included as unique/cost 0; rarity map; date maps from jp records only) — respected.

**Type consistency:** `DateEntry`/`resolveJpSkillDate` signature identical across Tasks 1–2; `buildJpSkills` signature matches its build-all call; `asOfISO?: string` used identically in the picker gate + charts; `isReleasedBy(record, asOfISO)` reads `{ releaseDate?, server }` which `SkillRecord` provides.

**Placeholder scan:** concrete code, real gametora field names, empirically-derived rarity map, exact anchors. Run-to-read values (the emitted JP-skill count for `outputs.test.ts`; the exact SkillPicker/InheritancePage JSX call sites; the M2 optimizer skill-source location) are each called out with the grep/how-to-find, not left vague.
