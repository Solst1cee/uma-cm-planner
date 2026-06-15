# M4 Slice 1 — Engine-driven Skill Chart + Sourcing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. Pure-core tasks give complete code; UI tasks give the exact interface, key logic, CSS classes, and test assertions — fill standard markup following `src/features/skill-planner/PlanHeaderPanel.tsx` as the panel template.

**Goal:** Replace the pre-engine coverage M4 at `/` with the engine-first **2-column Skill Acquisition Planner** (Slice 1): an editable runner config that drives a **§1 Skill chart** ranking acquirable skills by simulated **L (bashin)**, plus a **§3 sourcing** join (which cards hint each wishlist skill). Per spec `docs/superpowers/specs/2026-06-14-m4-skill-acquisition-design.md` §11.

**Architecture:** Pure core (`src/core/`) computes everything testably — `planToSimBuild` (CmPlan→SimBuild), `acquirableSkills` (catalog filter), `rankSkillChart` (streaming L-rank with an injected sim dep), `sourcing` (card-hint reverse index). A `useSkillChart` hook drives the vendored engine via `SimClient` (Web Worker, off main thread, streaming). Feature components render. The new `SkillAcquisitionPage` mounts at `/`, replacing `SkillPlannerPage`.

**Tech Stack:** TypeScript strict (`noUncheckedIndexedAccess`, `verbatimModuleSyntax`), React 19, Vitest + @testing-library/react, vendored umalator engine (`src/sim`). Path alias `@/*`→`src/*`.

---

## Contracts (verified — do not redefine; import from these)

```ts
// @/sim — types.ts + index
interface SimBuild { umaId: string; stats: Record<Stat, number>; strategy: Strategy;
  aptitudes: { distance: Grade; surface: Grade; strategy: Grade }; skills: string[]; mood?: Mood }
interface SimRaceParams { courseId: string; ground?: number; weather?: number; season?: number; time?: number; grade?: number }
interface BashinStats { mean: number; median: number; min: number; max: number; nsamples: number; results: number[] }
// evalSkillDelta(build, race, skillId, nsamples, seed?) => BashinStats   — SYNC (engine direct)
//   IMPORTANT: a non-simulatable skill returns nsamples===0 (this is the "n/a" signal).
// class SimClient { skillDelta(build, race, skillId, n, seed?): Promise<BashinStats>; dispose() }   — async via worker

// @/core/types
type Stat='spd'|'sta'|'pow'|'gut'|'wit'; type Strategy='front'|'pace'|'late'|'end';
type Grade='G'|'F'|'E'|'D'|'C'|'B'|'A'|'S'; type Mood=-2|-1|0|1|2;
type AptKey = {kind:'distance';key:'short'|'mile'|'medium'|'long'} | {kind:'surface';key:'turf'|'dirt'} | {kind:'strategy';key:Strategy};
type SkillRarity='white'|'gold'|'unique'|'inherited_unique';
interface SkillRecord { skillId; nameEn; nameJp; baseSpCost; rarity:SkillRarity; iconId; prereqSkillId?; scenarioId?; conditions:string; server:Server; dataVersion }
interface CmPlan { id; name; cmRef:{cmId;cmNumber;courseId;surface:'turf'|'dirt';distance;season?;condition?}; umaId; strategy:Strategy;
  statProfile:{stats:Record<Stat,number>;mood:Mood}; sparkGoals:{pink:Array<{aptKey:AptKey;target:Grade}>;blue:Partial<Record<Stat,number>>};
  wishlist:WishlistItem[]; /* …+ name/role/patch/server */ }
interface WishlistItem { skillId; priority:1|2|3; source:'targeted'; projectedL?; projectedLStale?; … }
interface SupportCardRecord { cardId; nameEn; charName; rarity; type; perLevel:CardPerLevel[]; skills:Array<{skillId;sourceType;hintLevels?}>; hintPoolSize }

// @/core/coverage  — classifyHintTier(card,lb): 'hint_strong'|'hint_weak'; tierForCardSkill(card,lb): Tier; tierRank(tier): number
// @/core/cost      — effectiveSpCost(skill, level, opts?): number
// @/app/ActivePlanContext — useActivePlan(): { plan: CmPlan|null; setPlan(next); flushPendingSave; loadError }
// @/features/data/gameData — useGameData(): { status; skills:SkillRecord[]; cards:SupportCardRecord[]; cmPresets; cmSchedule; skillById:Map; cardById:Map; … }
```

---

## Task 1: `planToSimBuild` + aptitude helpers (`src/core/simBuild.ts`)

**Files:** Create `src/core/simBuild.ts`, `src/core/simBuild.test.ts`

- [ ] **Step 1: Write the failing test** — `src/core/simBuild.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { CmPlan } from '@/core/types';
import { distanceClass, planToSimBuild, simAptitudes, setTargetAptitude } from './simBuild';

function plan(over: Partial<CmPlan> = {}): CmPlan {
  return {
    id: 'p', name: 'p', planNumber: 1, cmRef: { cmId: 'CM15', cmNumber: 15, courseId: '10906', surface: 'turf', distance: 2200 },
    umaId: '100101', uniqueSkillId: '', role: 'ace', strategy: 'pace',
    statProfile: { stats: { spd: 1200, sta: 900, pow: 800, gut: 400, wit: 600 }, mood: 0 },
    sparkGoals: { pink: [], blue: {} }, wishlist: [], lockedDeckSlots: [], parents: {},
    patch: { version: 't' }, server: 'global', dataVersion: 't', ...over,
  } as CmPlan;
}

describe('distanceClass', () => {
  it('buckets by distance', () => {
    expect(distanceClass(1200)).toBe('short');
    expect(distanceClass(1600)).toBe('mile');
    expect(distanceClass(2200)).toBe('medium');
    expect(distanceClass(3000)).toBe('long');
  });
});

describe('simAptitudes', () => {
  it('defaults every aptitude to A when no spark goals set', () => {
    expect(simAptitudes(plan())).toEqual({ distance: 'A', surface: 'A', strategy: 'A' });
  });
  it('reads target grades from sparkGoals.pink by the course/strategy keys', () => {
    const p = plan({ sparkGoals: { pink: [
      { aptKey: { kind: 'distance', key: 'medium' }, target: 'S' },
      { aptKey: { kind: 'surface', key: 'turf' }, target: 'B' },
      { aptKey: { kind: 'strategy', key: 'pace' }, target: 'C' },
    ], blue: {} } });
    expect(simAptitudes(p)).toEqual({ distance: 'S', surface: 'B', strategy: 'C' });
  });
});

describe('setTargetAptitude', () => {
  it('upserts the matching pink goal keyed by course/strategy', () => {
    const p = setTargetAptitude(plan(), 'distance', 'S');
    expect(p.sparkGoals.pink).toContainEqual({ aptKey: { kind: 'distance', key: 'medium' }, target: 'S' });
    const p2 = setTargetAptitude(p, 'distance', 'B'); // replace, not duplicate
    expect(p2.sparkGoals.pink.filter((g) => g.aptKey.kind === 'distance')).toHaveLength(1);
    expect(simAptitudes(p2).distance).toBe('B');
  });
});

describe('planToSimBuild', () => {
  it('maps stats/strategy/mood/aptitudes and uses an empty skill base (chart vacuum)', () => {
    const b = planToSimBuild(plan());
    expect(b.stats).toEqual({ spd: 1200, sta: 900, pow: 800, gut: 400, wit: 600 });
    expect(b.strategy).toBe('pace');
    expect(b.mood).toBe(0);
    expect(b.aptitudes).toEqual({ distance: 'A', surface: 'A', strategy: 'A' });
    expect(b.skills).toEqual([]);
    expect(b.umaId).toBe('100101');
  });
});
```

- [ ] **Step 2: Run red** — `pnpm vitest run src/core/simBuild.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement** — `src/core/simBuild.ts`:

```ts
/**
 * CmPlan → engine SimBuild (M4 §1). The skill chart measures each skill's
 * marginal L on a FIXED base build with no owned skills (vacuum), so skills:[].
 * Target aptitudes live in sparkGoals.pink (shared-data-model); default A.
 */
import type { CmPlan, Grade } from '@/core/types';
import type { SimBuild } from '@/sim';

export type AptDim = 'distance' | 'surface' | 'strategy';

export function distanceClass(distance: number): 'short' | 'mile' | 'medium' | 'long' {
  if (distance < 1400) return 'short';
  if (distance <= 1800) return 'mile';
  if (distance <= 2400) return 'medium';
  return 'long';
}

/** The AptKey used to store a plan's target aptitude for each dimension. */
function aptKeyFor(plan: CmPlan, dim: AptDim) {
  if (dim === 'distance') return { kind: 'distance' as const, key: distanceClass(plan.cmRef.distance) };
  if (dim === 'surface') return { kind: 'surface' as const, key: plan.cmRef.surface };
  return { kind: 'strategy' as const, key: plan.strategy };
}

/** Read the three SimBuild aptitude grades from sparkGoals.pink, default A. */
export function simAptitudes(plan: CmPlan): { distance: Grade; surface: Grade; strategy: Grade } {
  const read = (dim: AptDim): Grade => {
    const want = aptKeyFor(plan, dim);
    const hit = plan.sparkGoals.pink.find(
      (g) => g.aptKey.kind === want.kind && g.aptKey.key === want.key,
    );
    return hit?.target ?? 'A';
  };
  return { distance: read('distance'), surface: read('surface'), strategy: read('strategy') };
}

/** Upsert a target aptitude grade for a dimension (keyed by course/strategy). Returns a new plan. */
export function setTargetAptitude(plan: CmPlan, dim: AptDim, grade: Grade): CmPlan {
  const want = aptKeyFor(plan, dim);
  const pink = plan.sparkGoals.pink.filter(
    (g) => !(g.aptKey.kind === want.kind && g.aptKey.key === want.key),
  );
  pink.push({ aptKey: want, target: grade });
  return { ...plan, sparkGoals: { ...plan.sparkGoals, pink } };
}

export function planToSimBuild(plan: CmPlan): SimBuild {
  return {
    umaId: plan.umaId,
    stats: plan.statProfile.stats,
    strategy: plan.strategy,
    aptitudes: simAptitudes(plan),
    skills: [],
    mood: plan.statProfile.mood,
  };
}
```

- [ ] **Step 4: Run green** — `pnpm vitest run src/core/simBuild.test.ts` → PASS.
- [ ] **Step 5: Typecheck + commit** — `pnpm typecheck`; then:
```bash
git add src/core/simBuild.ts src/core/simBuild.test.ts
git commit -m "feat(m4): planToSimBuild + target-aptitude helpers"
```

---

## Task 2: Acquirable-skill catalog (`src/core/skillCatalog.ts`)

**Files:** Create `src/core/skillCatalog.ts`, `src/core/skillCatalog.test.ts`

- [ ] **Step 1: Write the failing test** — `src/core/skillCatalog.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { SkillRecord } from '@/core/types';
import { acquirableSkills, skillCategory } from './skillCatalog';

function sk(over: Partial<SkillRecord> & { skillId: string }): SkillRecord {
  return { nameEn: over.skillId, nameJp: '', baseSpCost: 100, rarity: 'white', iconId: '1',
    conditions: '', server: 'global', dataVersion: 't', ...over } as SkillRecord;
}

describe('acquirableSkills', () => {
  const all = [
    sk({ skillId: 'w', rarity: 'white' }),
    sk({ skillId: 'g', rarity: 'gold' }),
    sk({ skillId: 'iu', rarity: 'inherited_unique' }),
    sk({ skillId: 'u', rarity: 'unique' }),               // native runner unique → excluded
    sk({ skillId: 'jp', rarity: 'white', server: 'jp' }), // P4 → excluded for a global plan
  ];
  it('keeps white/gold/inherited_unique on the matching server, drops native uniques + JP', () => {
    expect(acquirableSkills(all, 'global').map((s) => s.skillId)).toEqual(['w', 'g', 'iu']);
  });
});

describe('skillCategory', () => {
  it('classifies normal / scenario / inherited', () => {
    expect(skillCategory(sk({ skillId: 'a' }))).toBe('normal');
    expect(skillCategory(sk({ skillId: 'b', scenarioId: 4 }))).toBe('scenario');
    expect(skillCategory(sk({ skillId: 'c', rarity: 'inherited_unique' }))).toBe('inherited');
  });
});
```

- [ ] **Step 2: Run red.**
- [ ] **Step 3: Implement** — `src/core/skillCatalog.ts`:

```ts
/** The acquirable-skill catalog for the §1 chart: purchasable + inherited-unique
 *  skills on the plan's server (P4: never mix JP into a Global chart). Native
 *  runner uniques (rarity 'unique') belong to the Uma chart, not here. */
import type { Server, SkillRecord } from '@/core/types';

const CHART_RARITIES = new Set(['white', 'gold', 'inherited_unique']);

export function acquirableSkills(skills: SkillRecord[], server: Server): SkillRecord[] {
  return skills.filter((s) => s.server === server && CHART_RARITIES.has(s.rarity));
}

export type SkillCategory = 'normal' | 'scenario' | 'inherited';

export function skillCategory(skill: SkillRecord): SkillCategory {
  if (skill.rarity === 'inherited_unique') return 'inherited';
  if (skill.scenarioId !== undefined) return 'scenario';
  return 'normal';
}
```

- [ ] **Step 4: Run green. Step 5: typecheck + commit** `feat(m4): acquirable-skill catalog filter`.

---

## Task 3: `rankSkillChart` streaming orchestrator (`src/core/rankSkillChart.ts`)

**Files:** Create `src/core/rankSkillChart.ts`, `src/core/rankSkillChart.test.ts`

- [ ] **Step 1: Write the failing test** — `src/core/rankSkillChart.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import type { BashinStats, SimBuild, SimRaceParams } from '@/sim';
import { rankSkillChart, DEAD_L } from './rankSkillChart';

const build = {} as SimBuild;
const race = { courseId: '10906' } as SimRaceParams;
function stats(mean: number, nsamples = 200): BashinStats {
  return { mean, median: mean, min: mean, max: mean, nsamples, results: [] };
}

describe('rankSkillChart', () => {
  it('ranks live skills by L desc, flags 0 L vs n/a, sorts dead/na last', async () => {
    const deltas: Record<string, BashinStats> = {
      a: stats(2.1), b: stats(0.4), z: stats(0.02), n: stats(0, 0), // n = nsamples 0 → n/a
    };
    const dep = vi.fn((_b, _r, id: string) => deltas[id]!);
    const rows = await rankSkillChart(build, race, ['z', 'a', 'n', 'b'], { skillDelta: dep, nsamples: 200 });
    expect(rows.map((r) => r.skillId)).toEqual(['a', 'b', 'z', 'n']);
    expect(rows[0]).toMatchObject({ skillId: 'a', status: 'live', L: 2.1 });
    expect(rows.find((r) => r.skillId === 'z')).toMatchObject({ status: 'zero', L: 0.02 });
    expect(rows.find((r) => r.skillId === 'n')).toMatchObject({ status: 'na', L: null });
  });

  it('streams progress via onRow as each skill resolves', async () => {
    const dep = vi.fn(() => stats(1));
    const seen: string[] = [];
    await rankSkillChart(build, race, ['a', 'b'], { skillDelta: dep, nsamples: 50 }, (row) => seen.push(row.skillId));
    expect(seen.sort()).toEqual(['a', 'b']);
  });

  it('DEAD_L threshold is 0.1', () => { expect(DEAD_L).toBe(0.1); });
});
```

- [ ] **Step 2: Run red.**
- [ ] **Step 3: Implement** — `src/core/rankSkillChart.ts`:

```ts
/** Streaming L-rank of acquirable skills (M4 §1). Each skill's marginal L is the
 *  engine bashin delta on the fixed base build. nsamples===0 ⇒ the engine can't
 *  evaluate it → 'na' (never a misleading 0 L, P3). mean ≤ DEAD_L ⇒ 'zero'. */
import type { BashinStats, SimBuild, SimRaceParams } from '@/sim';

export const DEAD_L = 0.1;

export interface SkillChartRow {
  skillId: string;
  /** mean bashin; null when not simulatable ('na'). */
  L: number | null;
  status: 'live' | 'zero' | 'na';
  nsamples: number;
}

export interface RankSkillChartDeps {
  /** Injected sim — evalSkillDelta or SimClient.skillDelta (sync or async both work). */
  skillDelta: (b: SimBuild, r: SimRaceParams, skillId: string, n: number, seed?: number)
    => BashinStats | Promise<BashinStats>;
  nsamples?: number;
  seed?: number;
}

function rowFrom(skillId: string, s: BashinStats): SkillChartRow {
  if (s.nsamples === 0) return { skillId, L: null, status: 'na', nsamples: 0 };
  const status = s.mean > DEAD_L ? 'live' : 'zero';
  return { skillId, L: s.mean, status, nsamples: s.nsamples };
}

function rankValue(r: SkillChartRow): number {
  // live/zero rank by L; na sorts last.
  return r.status === 'na' ? -Infinity : (r.L ?? 0);
}

/** Resolve each skill's L (streaming via onRow), return rows sorted L desc (na last). */
export async function rankSkillChart(
  build: SimBuild,
  race: SimRaceParams,
  skillIds: string[],
  deps: RankSkillChartDeps,
  onRow?: (row: SkillChartRow) => void,
): Promise<SkillChartRow[]> {
  const n = deps.nsamples ?? 200;
  const rows: SkillChartRow[] = [];
  for (const skillId of skillIds) {
    const s = await deps.skillDelta(build, race, skillId, n, deps.seed);
    const row = rowFrom(skillId, s);
    rows.push(row);
    onRow?.(row);
  }
  return rows.sort((a, b) => rankValue(b) - rankValue(a));
}
```

- [ ] **Step 4: Run green. Step 5: typecheck + commit** `feat(m4): rankSkillChart streaming L-rank (0 L vs n/a)`.

---

## Task 4: `useSkillChart` hook (`src/features/skill-acq/useSkillChart.ts`)

**Files:** Create `src/features/skill-acq/useSkillChart.ts`, `src/features/skill-acq/useSkillChart.test.tsx`

Drives the engine via a SimClient over the worker, streaming rows into state as they resolve. SimClient is injectable for tests (default = real). Re-runs when the SimBuild key (course/strategy/stats/aptitudes) changes.

- [ ] **Step 1: Failing test** — `useSkillChart.test.tsx`. Render a tiny probe component with `renderHook`-style or a wrapper; inject a fake `skillDelta` returning fixed stats for 3 skills; assert: status goes `running`→`done`, rows stream in (length grows), final rows sorted L desc, and changing the build re-runs. Use a fake dep:

```tsx
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { BashinStats, SimBuild, SimRaceParams } from '@/sim';
import { useSkillChart } from './useSkillChart';

afterEach(cleanup);
const S = (m: number, n = 200): BashinStats => ({ mean: m, median: m, min: m, max: m, nsamples: n, results: [] });

function Probe({ dep }: { dep: (b: SimBuild, r: SimRaceParams, id: string, n: number) => BashinStats }) {
  const build = { umaId: '', stats: { spd: 1, sta: 1, pow: 1, gut: 1, wit: 1 }, strategy: 'pace',
    aptitudes: { distance: 'A', surface: 'A', strategy: 'A' }, skills: [] } as SimBuild;
  const race = { courseId: '10906' } as SimRaceParams;
  const { rows, status, done, total } = useSkillChart(build, race, ['a', 'b', 'c'], { skillDelta: dep, nsamples: 10 });
  return <div><span data-testid="status">{status}</span><span data-testid="prog">{done}/{total}</span>
    <ol>{rows.map((r) => <li key={r.skillId}>{r.skillId}:{r.L ?? 'na'}</li>)}</ol></div>;
}

describe('useSkillChart', () => {
  it('streams rows and finishes sorted by L', async () => {
    const dep = vi.fn((_b, _r, id: string) => ({ a: S(0.5), b: S(2.0), c: S(0.9) }[id]!));
    render(<Probe dep={dep} />);
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('done'));
    expect(screen.getByTestId('prog')).toHaveTextContent('3/3');
    const order = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(order).toEqual(['b:2', 'c:0.9', 'a:0.5']);
  });
});
```

- [ ] **Step 2: Run red.**
- [ ] **Step 3: Implement** — `useSkillChart.ts`. Contract:

```ts
export interface UseSkillChartDeps {
  skillDelta: (b, r, id, n, seed?) => BashinStats | Promise<BashinStats>;
  nsamples?: number;
}
export interface SkillChartState { rows: SkillChartRow[]; status: 'idle'|'running'|'done'; done: number; total: number }
export function useSkillChart(build: SimBuild, race: SimRaceParams, skillIds: string[], deps?: UseSkillChartDeps): SkillChartState
```

Logic:
- Default deps: lazily create one module-level `SimClient` (`let client; function realDeps(){ client ??= new SimClient(); return { skillDelta: client.skillDelta.bind(client) } }`). Guard `typeof Worker !== 'undefined'`; in tests deps are injected so the worker is never constructed.
- A `useEffect` keyed on `JSON.stringify([race.courseId, build.strategy, build.stats, build.aptitudes, skillIds.length, deps?.nsamples])` (the cache-relevant inputs): set status 'running', reset rows/done, then call `rankSkillChart(build, race, skillIds, mergedDeps, onRow)` where `onRow` pushes into state (functional `setRows((p)=>[...p, row])` + `setDone`). On finish set the SORTED rows + status 'done'. Use a `cancelled` ref so a re-run/unmount discards stale streamed rows (check before each setState).
- Keep streamed rows in arrival order while running; on completion replace with the sorted array from `rankSkillChart`'s return.
- `total = skillIds.length`.

- [ ] **Step 4: Run green. Step 5: typecheck + commit** `feat(m4): useSkillChart streaming hook`.

---

## Task 5: Runner-config panel (`src/features/skill-acq/RunnerConfigPanel.tsx`)

**Files:** Create `RunnerConfigPanel.tsx` + `.test.tsx`. Edits the plan; left sidebar.

Props: `{ plan: CmPlan; onChange: (next: CmPlan) => void }`.
Renders inside a `<section className="panel" aria-labelledby="runner-cfg-h">` with `<h2 id="runner-cfg-h">Runner</h2>`:
- **5 stat number inputs** (spd/sta/pow/gut/wit) labelled, value `plan.statProfile.stats[k]`, onChange writes `onChange({...plan, statProfile:{...plan.statProfile, stats:{...stats,[k]:Number(v)||0}}})`.
- **Strategy** segmented control (front/pace/late/end) → `onChange({...plan, strategy})`. Reuse the `.miniseg`/segmented pattern (buttons with `aria-pressed`).
- **Mood** select −2…2 (labels Awful…Great) → `statProfile.mood`.
- **3 aptitude `<select>`** (Distance/Surface/Strategy), each Grade G..S, value `simAptitudes(plan)[dim]`, onChange `onChange(setTargetAptitude(plan, dim, grade))` (import from `@/core/simBuild`). `aria-label` e.g. "Distance aptitude".

- [ ] **Test** asserts: editing a stat input calls onChange with the new `statProfile.stats.spd`; clicking strategy "Front" sets `strategy:'front'`; changing the Distance aptitude select to "S" produces a plan where `simAptitudes(next).distance === 'S'`. (Render with a fixture plan; `onChange = vi.fn()`; assert `onChange.mock.lastCall[0]`.)
- [ ] TDD red→green→typecheck→commit `feat(m4): runner-config panel (stats/strategy/mood/aptitudes)`.

---

## Task 6: Skill-chart panel (`src/features/skill-acq/SkillChartPanel.tsx`)

**Files:** Create `SkillChartPanel.tsx` + `.test.tsx` + `src/features/skill-acq/skill-acq.css`.

Props: `{ plan: CmPlan; onChange: (next: CmPlan) => void; deps?: UseSkillChartDeps }` (deps passthrough for tests).
- Build `race={courseId: plan.cmRef.courseId}` and `build=planToSimBuild(plan)`; catalog = `acquirableSkills(useGameData().skills, plan.server)`; ids = catalog skillIds.
- `const { rows, status, done, total } = useSkillChart(build, race, ids, deps)`.
- Header: `<h2>Skill chart</h2>` + when `status==='running'` show `refining {done}/{total}…` + an RNG caveat `<p className="muted small">Simulated estimate — RNG-dependent.</p>` (P3).
- **Controls:** search `<input aria-label="Search skills">`; rarity filter chips (all/white/gold); a **"Show every skill"** checkbox (`aria-label`) — default OFF hides `status==='zero'` AND `status==='na'`; ON shows all.
- **Rows** (`skillById` for names): one button-row per skill in `rows` order, filtered. Each row: name (`className={skill.rarity==='gold'?'sk-gold':'sk-white'}`), the **L badge** — `status==='live'||'zero'` → `+{L.toFixed(2)}` (zero rows get `.muted`), `status==='na'` → `n/a` (`.na`, title "engine can't simulate this effect"); **SP cost** `effectiveSpCost(skill, 0)`; a **`+ target`** button → `onChange` appends a `WishlistItem {skillId, priority:1, source:'targeted'}` (skip if already in wishlist → show ✓ disabled); a **"details"** toggle revealing the raw `skill.conditions` + `L mean (n={nsamples})`.
- Only render rows whose skill is in the catalog map (guard).

- [ ] **Test** (mock `@/features/data/gameData` with a fixture skills list of ~3 skills incl. a gold + a JP one; inject `deps` returning fixed stats incl. one nsamples-0): assert the chart renders the live skills ranked, the gold skill has class `sk-gold`, the n/a skill shows `n/a` only when "show every skill" is on, clicking `+ target` calls onChange adding the wishlist item, and the JP skill never appears (P4). Use `await waitFor` for streaming completion.
- [ ] TDD red→green→typecheck→commit `feat(m4): skill chart panel (L-rank, filters, +target)`.

---

## Task 7: Sourcing core (`src/core/sourcing.ts`)

**Files:** Create `src/core/sourcing.ts` + `.test.ts`.

- [ ] **Step 1: Failing test** — covers: `buildCardHintIndex(cards)` returns `Map<skillId, Array<{cardId; sourceType}>>` from each card's `skills[]`; `sourcingForSkill(skillId, index, cardById, lb=4)` returns `{ skillId, cardHints: Array<{cardId; cardName; tier}>, gap: boolean }` where tier = `tierForCardSkill(card, lb)`, sorted by `tierRank`, and `gap===true` when no card hints it.

```ts
import { describe, expect, it } from 'vitest';
import type { SupportCardRecord } from '@/core/types';
import { buildCardHintIndex, sourcingForSkill } from './sourcing';

function card(id: string, skills: Array<{ skillId: string; sourceType: 'hint_pool'|'chain' }>): SupportCardRecord {
  return { cardId: id, nameEn: 'Card ' + id, charName: 'c', rarity: 'SSR', type: 'speed',
    perLevel: [{ limitBreak: 4, hintFrequency: 30, hintLevels: 2, specialtyPriority: 0 }],
    skills, hintPoolSize: skills.length, server: 'global', dataVersion: 't' };
}

describe('sourcing', () => {
  const cards = [card('1', [{ skillId: 'sx', sourceType: 'hint_pool' }]), card('2', [{ skillId: 'sx', sourceType: 'chain' }])];
  const byId = new Map(cards.map((c) => [c.cardId, c]));
  it('indexes skill → cards and joins a sourcing row', () => {
    const idx = buildCardHintIndex(cards);
    expect(idx.get('sx')!.map((h) => h.cardId).sort()).toEqual(['1', '2']);
    const row = sourcingForSkill('sx', idx, byId, 4);
    expect(row.gap).toBe(false);
    expect(row.cardHints.map((h) => h.cardId)).toContain('1');
  });
  it('flags a gap when no card hints the skill', () => {
    expect(sourcingForSkill('nope', buildCardHintIndex(cards), byId, 4)).toMatchObject({ gap: true, cardHints: [] });
  });
});
```

- [ ] **Step 3: Implement** `src/core/sourcing.ts` — `buildCardHintIndex` iterates `cards`, for each `card.skills` pushes `{cardId, sourceType}` into `Map<skillId, ...>`. `sourcingForSkill` looks up the index, maps each entry through `cardById` → `{cardId, cardName: card.nameEn, tier: tierForCardSkill(card, lb)}`, sorts by `tierRank(tier)`, `gap = cardHints.length === 0`. Import `tierForCardSkill, tierRank` from `@/core/coverage`. Define `SourcingRow` type. (Uma-innate omitted this slice — leave a `// TODO(slice-1b): uma-innate column when umas.json carries innate skills`.)
- [ ] Run green; typecheck; commit `feat(m4): sourcing core (card-hint reverse index + join)`.

---

## Task 8: Sourcing panel (`src/features/skill-acq/SourcingPanel.tsx`)

**Files:** Create `SourcingPanel.tsx` + `.test.tsx`.
Props `{ plan: CmPlan }`. Uses `useGameData()` (`cards`, `cardById`, `skillById`). Builds the index once (`useMemo`), then for each `plan.wishlist` item renders a row: skill name + the `sourcingForSkill` result — card-hint chips (reuse a tier chip: `<span className={\`badge tier-${tier}\`}>` + label) and a **⚠ gap** marker when `gap`. Empty wishlist → "Add target skills to see where to get them." Note (P3 honesty) a `muted small` line: "Uma-innate sources land in a later slice."
- [ ] **Test**: fixture wishlist with one skill hinted by a card and one with no source → first row shows the card chip, second shows ⚠ gap. TDD; commit `feat(m4): sourcing panel (§3 where do I get this)`.

---

## Task 9: 2-column page + route swap (`src/features/skill-acq/SkillAcquisitionPage.tsx`)

**Files:** Create `SkillAcquisitionPage.tsx` + `.test.tsx`; modify `src/app/App.tsx`.

- [ ] **Page** — `<div className="page m4-grid">` with a CSS 2-col grid (`.m4-grid{display:grid;grid-template-columns:minmax(280px,26%) 1fr;gap:1rem;align-items:start}` + a `@media(max-width:820px){grid-template-columns:1fr}` in `skill-acq.css`). Guards: `useGameData().status==='loading' || plan===null` → "Loading…"; `loadError` → error. Layout:
  - **LEFT** `<aside className="m4-left">`: reuse `<PlanHeaderPanel plan={plan} onChange={setPlan} />` (plan name + CM + wishlist add) + `<RunnerConfigPanel plan={plan} onChange={setPlan} />`.
  - **RIGHT** `<div className="m4-right">`: a §0 race summary `<section className="panel">` showing `plan.cmRef` (CM number, course, surface/distance, condition) — form/text only; then `<SkillChartPanel plan={plan} onChange={setPlan} />`; then `<SourcingPanel plan={plan} />`.
- [ ] **Wire route** in `App.tsx`: replace the import + the `/` route element:
  - `import { SkillAcquisitionPage } from '@/features/skill-acq/SkillAcquisitionPage';` (remove the `SkillPlannerPage` import).
  - `<Route path="/" element={<SkillAcquisitionPage />} />`.
  - Keep the nav label "Skill Planner".
- [ ] **Test** (`SkillAcquisitionPage.test.tsx`): mock `gameData` (fixture skills/cards) + wrap in `ActivePlanProvider` OR mock `useActivePlan` to return a fixture plan; render and assert the three section headings exist ("Runner", "Skill chart", and the §0/race + sourcing). Inject `deps` into SkillChartPanel via a prop default isn't available through the page — so for the page test, mock the worker by mocking `useSkillChart`'s deps path: simplest is to `vi.mock('./useSkillChart', () => ({ useSkillChart: () => ({ rows: [], status: 'idle', done: 0, total: 0 }) }))` so the page test doesn't touch the engine. Assert layout + that no console errors.
- [ ] Typecheck; commit `feat(m4): 2-column Skill Acquisition page at / (replaces coverage UI)`.

Note: the old `SkillPlannerPage` + coverage/deck/contingency components are now unreferenced by `/` but remain in the tree (their tests still pass). Do NOT delete them in this task — a later cleanup removes or repurposes them; leaving them keeps this slice's diff focused and green.

---

## Task 10: Full verification

- [ ] `pnpm typecheck` → clean.
- [ ] `pnpm test` → all pass (new core + feature tests + the untouched existing suite). Expected ≥ baseline + the new tests. If a pre-existing test imported the old `/` behavior via App, fix minimally (the old `SkillPlannerPage` test file itself still renders the component directly and stays green).
- [ ] `pnpm build` → typecheck + vite build succeed (the worker bundles; chunk-size warning is pre-existing/benign).
- [ ] Commit any test fixups: `test(m4): keep suite green after route swap`.

---

## Self-Review (after all tasks)

- **Spec §11.1 coverage:** 2-col shell + route swap (T9) ✓; runner config writing statProfile/strategy/mood/aptitudes (T5, T1) ✓; §1 Skill chart L-ranked via engine, streaming, 0 L auto-hide + show-all, n/a-vs-0L, search/rarity filters, SP cost, +target, row-detail conditions+L (T6, T3, T2, T4) ✓; §3 card-hint sourcing + gap (T7, T8) ✓; honesty caveats + JP excluded (T2, T6) ✓.
- **Deferred (per §11.2), not in this plan:** effect badges/duration/graphs, Uma chart, uma-innate column, track diagram, stat-target seed, availability toggle — none referenced.
- **Type consistency:** `planToSimBuild`/`simAptitudes`/`setTargetAptitude` (T1) used by T5/T6; `SkillChartRow`/`rankSkillChart` (T3) consumed by `useSkillChart` (T4) and rendered by T6; `acquirableSkills` (T2) feeds T6; `sourcingForSkill` (T7) feeds T8. Sim contract matches `@/sim` exactly.
- **No placeholders** in core tasks; UI tasks specify interface + key logic + exact test assertions.

---

## Execution Handoff

Subagent-driven, one fresh subagent per task, TDD, two-stage review. The Skill chart is demonstrable after Task 6 (core+hook+panel) — a natural mid-checkpoint. After Task 10, finish via finishing-a-development-branch (merge to main). `App.tsx` may collide on merge if another branch touched the `/` route — keep the `SkillAcquisitionPage` route.
