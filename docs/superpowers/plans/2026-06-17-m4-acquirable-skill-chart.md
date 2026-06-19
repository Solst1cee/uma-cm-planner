# M4 Acquirable-Skill Chart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an engine-ranked acquirable-skill chart to the `/` planner page — a collapsible `cmp-plan-card` ranking white/gold/inherited skills by marginal length (L) on the user's plan build, with SP cost + efficiency columns, run-on-demand, family-collapsed rows, and `+ target` that feeds the sidebar's L total.

**Architecture:** A new panel (`SkillChartPanel`) + run-on-demand hook (`useSkillRank`) mirror the existing Unique-skill chart (`UmaChartPanel`/`useUmaChart`), reusing the pure `rankSkillChart` core (enriched), the `skillFamilies` variant system, `SkillDetailDisclosure`, and the `cmp-plan-card` card grammar. `/legacy` is untouched.

**Tech Stack:** TypeScript, React 19, Vitest (jsdom), vendored umalator engine via `SimClient` worker.

**Spec:** [docs/superpowers/specs/2026-06-17-m4-acquirable-skill-chart-design.md](../specs/2026-06-17-m4-acquirable-skill-chart-design.md)

**Branch:** `feat/m4-skill-chart` (already created).

---

## Conventions for every task

- **TDD:** write the failing test, run it (watch it fail), implement minimally, run it (watch it pass), commit.
- **Test runner is flaky against a live dev server** (CLAUDE.md): if a UI test fails with `Cannot read properties of null (reading 'useState')`, stop any `pnpm dev`, re-run the single file, and trust `pnpm typecheck`/`pnpm build`.
- Run a single test file with: `pnpm vitest run <path>`.
- After the last task, run the full suite: `pnpm test` and `pnpm build`.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `src/core/rankSkillChart.ts` | Pure L-rank of skill ids; row now carries distribution + cancellation + exported comparator | Modify (additive) |
| `src/core/rankSkillChart.test.ts` | Core tests | Modify |
| `src/features/skill-planner/skillFamilies.ts` | Add `familyRepresentatives` (one strongest variant per family) | Modify (additive) |
| `src/features/skill-planner/skillFamilies.test.ts` | Family-rep tests | Modify (create if absent) |
| `src/features/cm-planner/useSkillRank.ts` | Run-on-demand hook around `rankSkillChart` | Create |
| `src/features/cm-planner/useSkillRank.test.tsx` | Hook tests | Create |
| `src/features/cm-planner/SkillChartPanel.tsx` | The chart card UI | Create |
| `src/features/cm-planner/skill-chart.css` | Chart-specific grid/cells | Create |
| `src/features/cm-planner/SkillChartPanel.test.tsx` | Panel tests | Create |
| `src/features/cm-planner/CmPlannerPage.tsx` | Mount the panel | Modify |
| `docs/modules/module-4-skill-acquisition.md` | Doc the new chart | Modify |

---

## Task 1: Enrich `rankSkillChart` (distribution + cancellation + comparator)

**Files:**
- Modify: `src/core/rankSkillChart.ts`
- Test: `src/core/rankSkillChart.test.ts`

- [ ] **Step 1: Add failing tests**

Append these tests inside the existing `describe('rankSkillChart', …)` block in `src/core/rankSkillChart.test.ts` (the file already defines `build`, `race`, and `stats(mean, nsamples)`):

```ts
  it('carries the engine distribution (min/max/median) on live rows; null on n/a', async () => {
    const dep = vi.fn((_b: SimBuild, _r: SimRaceParams, id: string): BashinStats =>
      id === 'n'
        ? { mean: 0, median: 0, min: 0, max: 0, nsamples: 0, results: [] }
        : { mean: 1.5, median: 1.4, min: 0.9, max: 2.2, nsamples: 30, results: [] },
    );
    const rows = await rankSkillChart(build, race, ['a', 'n'], { skillDelta: dep, nsamples: 30 });
    expect(rows.find((r) => r.skillId === 'a')).toMatchObject({ min: 0.9, max: 2.2, median: 1.4 });
    expect(rows.find((r) => r.skillId === 'n')).toMatchObject({ min: null, max: null, median: null });
  });

  it('stops early when shouldContinue() returns false', async () => {
    const seen: string[] = [];
    const dep = vi.fn((_b: SimBuild, _r: SimRaceParams, id: string): BashinStats => {
      seen.push(id);
      return stats(1);
    });
    await rankSkillChart(build, race, ['a', 'b', 'c'], { skillDelta: dep, nsamples: 10 }, undefined, () => seen.length < 2);
    expect(seen).toEqual(['a', 'b']); // 'c' never evaluated
  });

  it('compareSkillChartRows is NaN-safe when both rows are n/a', () => {
    const na = { skillId: 'x', L: null, min: null, max: null, median: null, status: 'na' as const, nsamples: 0 };
    expect(Number.isNaN(compareSkillChartRows(na, { ...na, skillId: 'y' }))).toBe(false);
  });
```

Update the import at the top of the test file:

```ts
import { rankSkillChart, compareSkillChartRows, DEAD_L } from './rankSkillChart';
```

- [ ] **Step 2: Run the tests — verify they fail**

Run: `pnpm vitest run src/core/rankSkillChart.test.ts`
Expected: FAIL — `compareSkillChartRows` is not exported; rows have no `min`/`max`/`median`.

- [ ] **Step 3: Implement**

Rewrite `src/core/rankSkillChart.ts` to:

```ts
/** Streaming L-rank of acquirable skills (M4 §1). Each skill's marginal L is the
 *  engine bashin delta on the fixed base build. nsamples===0 ⇒ the engine can't
 *  evaluate it → 'na' (never a misleading 0 L, P3). mean ≤ DEAD_L ⇒ 'zero'. */
import type { BashinStats, SimBuild, SimRaceParams } from '@/sim';

export const DEAD_L = 0.1;

/**
 * Default sample count for the DISCOVERY chart. The chart ranks the whole
 * acquirable catalog serially on one worker; discovery trades precision for speed
 * (rows are badged "refining / RNG estimate", P3). M2's purchase optimizer sets
 * its own higher count for precision.
 * TODO(slice-1b): progressive refine — re-sim the surviving top-N at higher samples.
 */
export const DISCOVERY_NSAMPLES = 30;

export interface SkillChartRow {
  skillId: string;
  /** mean bashin; null when not simulatable ('na'). */
  L: number | null;
  /** engine distribution; null when 'na'. */
  min: number | null;
  max: number | null;
  median: number | null;
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
  if (s.nsamples === 0) {
    return { skillId, L: null, min: null, max: null, median: null, status: 'na', nsamples: 0 };
  }
  const status = s.mean > DEAD_L ? 'live' : 'zero';
  return { skillId, L: s.mean, min: s.min, max: s.max, median: s.median, status, nsamples: s.nsamples };
}

/** Finite sentinel (not -Infinity) so comparing two 'na' rows never yields NaN. */
const NA_RANK = Number.MIN_SAFE_INTEGER;
function rankValue(r: SkillChartRow): number {
  return r.status === 'na' ? NA_RANK : (r.L ?? 0);
}

/** Sort comparator: L desc, na last; NaN-safe for na-vs-na. */
export function compareSkillChartRows(a: SkillChartRow, b: SkillChartRow): number {
  return rankValue(b) - rankValue(a);
}

/** Resolve each skill's L (streaming via onRow), return rows sorted L desc (na last).
 *  shouldContinue (optional) is checked before each skill so callers can cancel. */
export async function rankSkillChart(
  build: SimBuild,
  race: SimRaceParams,
  skillIds: string[],
  deps: RankSkillChartDeps,
  onRow?: (row: SkillChartRow) => void,
  shouldContinue?: () => boolean,
): Promise<SkillChartRow[]> {
  const n = deps.nsamples ?? DISCOVERY_NSAMPLES;
  const rows: SkillChartRow[] = [];
  for (const skillId of skillIds) {
    if (shouldContinue && !shouldContinue()) break;
    let s: BashinStats;
    try {
      s = await deps.skillDelta(build, race, skillId, n, deps.seed);
    } catch {
      // The engine can't evaluate this skill on this build (unmodeled effect or a
      // degenerate runner) — surface it as not-simulatable rather than crashing the
      // whole chart stream (P3).
      s = { mean: 0, median: 0, min: 0, max: 0, nsamples: 0, results: [] };
    }
    const row = rowFrom(skillId, s);
    rows.push(row);
    onRow?.(row);
  }
  return rows.sort(compareSkillChartRows);
}
```

- [ ] **Step 4: Run the tests — verify they pass**

Run: `pnpm vitest run src/core/rankSkillChart.test.ts`
Expected: PASS (all old + 3 new tests).

- [ ] **Step 5: Verify the legacy consumer still typechecks**

Run: `pnpm typecheck`
Expected: PASS. (`src/features/skill-acq/useSkillChart.ts` calls `rankSkillChart` without the new optional `shouldContinue` arg and only reads `L`/`status`/`nsamples` — additive change, no break.)

- [ ] **Step 6: Commit**

```bash
git add src/core/rankSkillChart.ts src/core/rankSkillChart.test.ts
git commit -m "feat(m4): enrich rankSkillChart with distribution, cancellation, comparator"
```

---

## Task 2: `familyRepresentatives` helper

**Files:**
- Modify: `src/features/skill-planner/skillFamilies.ts`
- Test: `src/features/skill-planner/skillFamilies.test.ts` (create if it does not exist)

- [ ] **Step 1: Write the failing test**

If `src/features/skill-planner/skillFamilies.test.ts` does not exist, create it with this content; otherwise append the `describe` block:

```ts
import { describe, expect, it } from 'vitest';
import type { SkillRecord } from '@/core/types';
import { familyRepresentatives } from './skillFamilies';

function skill(over: Partial<SkillRecord> & { skillId: string }): SkillRecord {
  return {
    skillId: over.skillId,
    nameEn: over.nameEn ?? `Skill ${over.skillId}`,
    nameJp: '',
    baseSpCost: over.baseSpCost ?? 100,
    rarity: over.rarity ?? 'white',
    iconId: '1',
    conditions: '',
    server: 'global',
    dataVersion: 't',
    ...over,
  };
}

describe('familyRepresentatives', () => {
  it('keeps one row per family (the strongest variant) and passes singletons through', () => {
    const white = skill({ skillId: '100', rarity: 'white', baseSpCost: 90, variantSkillIds: ['101'] });
    const gold = skill({ skillId: '101', rarity: 'gold', baseSpCost: 170, variantSkillIds: ['100'] });
    const solo = skill({ skillId: '200', rarity: 'white' });
    const skillById = new Map([white, gold, solo].map((s) => [s.skillId, s]));

    const reps = familyRepresentatives([white, gold, solo], skillById);

    // gold outranks white (skillVariantRank: gold +3000) → family collapses to '101'
    expect(reps.map((s) => s.skillId)).toEqual(['101', '200']);
  });

  it('restricts the representative to members present in the input set', () => {
    const white = skill({ skillId: '100', rarity: 'white', baseSpCost: 90, variantSkillIds: ['101'] });
    const gold = skill({ skillId: '101', rarity: 'gold', baseSpCost: 170, variantSkillIds: ['100'] });
    const skillById = new Map([white, gold].map((s) => [s.skillId, s]));

    // only the white is in the chart's input; the gold must NOT become the rep
    const reps = familyRepresentatives([white], skillById);
    expect(reps.map((s) => s.skillId)).toEqual(['100']);
  });
});
```

- [ ] **Step 2: Run the test — verify it fails**

Run: `pnpm vitest run src/features/skill-planner/skillFamilies.test.ts`
Expected: FAIL — `familyRepresentatives` is not exported.

- [ ] **Step 3: Implement**

Append to `src/features/skill-planner/skillFamilies.ts` (it already imports `SkillRecord` and exports `skillVariantOptions`):

```ts
/**
 * Collapse a skill list to one representative per variant family — the highest
 * `skillVariantRank` member that is ALSO present in the input set (so the chart
 * never promotes a variant it isn't ranking). Order-stable on first appearance.
 */
export function familyRepresentatives(
  skills: SkillRecord[],
  skillById: ReadonlyMap<string, SkillRecord>,
): SkillRecord[] {
  const inSet = new Set(skills.map((s) => s.skillId));
  const out: SkillRecord[] = [];
  const claimed = new Set<string>();
  for (const skill of skills) {
    if (claimed.has(skill.skillId)) continue;
    const family = skillVariantOptions(skill, skillById).filter((m) => inSet.has(m.skillId));
    const rep = family[0] ?? skill; // skillVariantOptions is sorted best-first
    out.push(rep);
    for (const member of family) claimed.add(member.skillId);
    claimed.add(skill.skillId);
  }
  return out;
}
```

- [ ] **Step 4: Run the test — verify it passes**

Run: `pnpm vitest run src/features/skill-planner/skillFamilies.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/skill-planner/skillFamilies.ts src/features/skill-planner/skillFamilies.test.ts
git commit -m "feat(m4): familyRepresentatives — collapse variant families to one rep"
```

---

## Task 3: `useSkillRank` run-on-demand hook

**Files:**
- Create: `src/features/cm-planner/useSkillRank.ts`
- Test: `src/features/cm-planner/useSkillRank.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/features/cm-planner/useSkillRank.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { BashinStats, SimBuild } from '@/sim';
import { useSkillRank } from './useSkillRank';

const bs = (mean: number): BashinStats => ({ mean, median: mean, min: mean, max: mean, nsamples: 30, results: [] });
const build = { stats: { spd: 1200 }, strategy: 'end' } as unknown as SimBuild;

describe('useSkillRank', () => {
  it('does not simulate until run() is called', () => {
    const skillDelta = vi.fn(async () => bs(1));
    renderHook(() => useSkillRank(build, { courseId: '10906' }, ['a'], { skillDelta }));
    expect(skillDelta).not.toHaveBeenCalled();
  });

  it('run() simulates, streams rows sorted, and finishes', async () => {
    const skillDelta = vi.fn(async (_b: SimBuild, _r: unknown, id: string) => bs(id === 'a' ? 2 : 1));
    const { result } = renderHook(() => useSkillRank(build, { courseId: '10906' }, ['b', 'a'], { skillDelta }));
    expect(result.current.status).toBe('idle');
    act(() => result.current.run());
    await waitFor(() => expect(result.current.status).toBe('done'));
    expect(result.current.rows.map((r) => r.skillId)).toEqual(['a', 'b']); // L desc
  });

  it('flips isStale when the build changes after a run, without recomputing', async () => {
    const skillDelta = vi.fn(async () => bs(1));
    const { result, rerender } = renderHook(
      ({ b }) => useSkillRank(b, { courseId: '10906' }, ['a'], { skillDelta }),
      { initialProps: { b: build } },
    );
    act(() => result.current.run());
    await waitFor(() => expect(result.current.status).toBe('done'));
    const callsAfterRun = skillDelta.mock.calls.length;
    rerender({ b: { stats: { spd: 800 }, strategy: 'end' } as unknown as SimBuild });
    expect(result.current.isStale).toBe(true);
    expect(skillDelta.mock.calls.length).toBe(callsAfterRun); // no auto recompute
  });
});
```

- [ ] **Step 2: Run the test — verify it fails**

Run: `pnpm vitest run src/features/cm-planner/useSkillRank.test.tsx`
Expected: FAIL — module `./useSkillRank` not found.

- [ ] **Step 3: Implement**

Create `src/features/cm-planner/useSkillRank.ts`:

```ts
/** Run-on-demand hook driving rankSkillChart (M4 §1 acquirable-skill chart).
 *  Nothing simulates until run(); rows stream in kept-sorted, then are replaced by
 *  the sorted result. isStale flags that the build/course changed since the last run
 *  (so the panel can prompt a re-run without recomputing). Default deps reuse a
 *  module-shared SimClient imported from '@/sim/client' (NOT the '@/sim' barrel) so
 *  the engine bundle stays out of this module's import graph. */
import { useEffect, useRef, useState } from 'react';
import type { BashinStats, SimBuild, SimRaceParams } from '@/sim';
import { SimClient } from '@/sim/client';
import { rankSkillChart, compareSkillChartRows, type SkillChartRow } from '@/core/rankSkillChart';

export interface UseSkillRankDeps {
  skillDelta: (b: SimBuild, r: SimRaceParams, id: string, n: number, seed?: number) => BashinStats | Promise<BashinStats>;
  nsamples?: number;
}
export interface SkillRankState {
  rows: SkillChartRow[];
  status: 'idle' | 'running' | 'done';
  done: number;
  total: number;
  isStale: boolean;
  run: () => void;
}

let client: SimClient | null = null;
function realDeps(): UseSkillRankDeps {
  client ??= new SimClient();
  return { skillDelta: client.skillDelta.bind(client) };
}

function sigOf(build: SimBuild, courseId: string, skillIds: string[], nsamples: number | undefined): string {
  return JSON.stringify([courseId, build.strategy, build.stats, build.aptitudes, build.mood ?? null, skillIds, nsamples ?? null]);
}

export function useSkillRank(
  build: SimBuild,
  race: SimRaceParams,
  skillIds: string[],
  deps?: UseSkillRankDeps,
): SkillRankState {
  const [rows, setRows] = useState<SkillChartRow[]>([]);
  const [status, setStatus] = useState<'idle' | 'running' | 'done'>('idle');
  const [done, setDone] = useState(0);
  const [runSig, setRunSig] = useState<string | null>(null);

  const depsRef = useRef(deps);
  depsRef.current = deps;
  const runToken = useRef(0);

  // Cancel any in-flight run if the component unmounts.
  useEffect(() => () => { runToken.current += 1; }, []);

  const run = () => {
    const token = (runToken.current += 1);
    const merged = depsRef.current ?? realDeps();
    setStatus('running');
    setRows([]);
    setDone(0);
    setRunSig(sigOf(build, race.courseId, skillIds, depsRef.current?.nsamples));
    void rankSkillChart(
      build,
      race,
      skillIds,
      { skillDelta: merged.skillDelta, nsamples: merged.nsamples },
      (row) => {
        if (runToken.current === token) {
          setRows((p) => [...p, row].sort(compareSkillChartRows));
          setDone((d) => d + 1);
        }
      },
      () => runToken.current === token,
    ).then((sorted) => {
      if (runToken.current === token) {
        setRows(sorted);
        setStatus('done');
      }
    });
  };

  const currentSig = sigOf(build, race.courseId, skillIds, depsRef.current?.nsamples);
  const isStale = status !== 'idle' && runSig !== null && currentSig !== runSig;

  return { rows, status, done, total: skillIds.length, isStale, run };
}
```

- [ ] **Step 4: Run the test — verify it passes**

Run: `pnpm vitest run src/features/cm-planner/useSkillRank.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/cm-planner/useSkillRank.ts src/features/cm-planner/useSkillRank.test.tsx
git commit -m "feat(m4): useSkillRank — run-on-demand hook for the skill chart"
```

---

## Task 4: `SkillChartPanel` + CSS

**Files:**
- Create: `src/features/cm-planner/SkillChartPanel.tsx`
- Create: `src/features/cm-planner/skill-chart.css`
- Test: `src/features/cm-planner/SkillChartPanel.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/features/cm-planner/SkillChartPanel.test.tsx`:

```tsx
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import type { BashinStats, SimBuild } from '@/sim';
import type { CmPlan, SkillRecord } from '@/core/types';

const h = vi.hoisted(() => {
  const mk = (over: Partial<SkillRecord> & { skillId: string }): SkillRecord => ({
    skillId: over.skillId, nameEn: over.nameEn ?? `Skill ${over.skillId}`, nameJp: '',
    baseSpCost: over.baseSpCost ?? 100, rarity: over.rarity ?? 'white', iconId: '1',
    conditions: '', server: 'global', dataVersion: 't', ...over,
  });
  const white = mk({ skillId: '100', nameEn: 'Corner Adept', rarity: 'white', baseSpCost: 90, variantSkillIds: ['101'] });
  const gold = mk({ skillId: '101', nameEn: 'Corner Adept ◎', rarity: 'gold', baseSpCost: 170, variantSkillIds: ['100'] });
  const solo = mk({ skillId: '200', nameEn: 'Straightaway Spurt', rarity: 'white', baseSpCost: 120 });
  const skills = [white, gold, solo];
  const skillById = new Map(skills.map((s) => [s.skillId, s]));
  const bs = (mean: number): BashinStats => ({ mean, median: mean, min: mean, max: mean, nsamples: 30, results: [] });
  // gold family (101) stronger than the solo (200)
  const skillDelta = vi.fn(async (_b: SimBuild, _r: unknown, id: string) => bs(id === '101' ? 2.0 : 1.0));
  return { skills, skillById, skillDelta };
});

vi.mock('@/features/data/gameData', () => ({
  useGameData: () => ({ status: 'ready', skills: h.skills, skillById: h.skillById, sparkRates: {}, umas: [], umaById: new Map(), iconManifest: null }),
}));
vi.mock('./skillTechnicalDetails', () => ({
  loadSkillTechnicalDetail: vi.fn(async () => null),
  skillRecordToSummary: (s: unknown) => s,
}));
vi.mock('@/core/simBuild', () => ({ planToSimBuild: () => ({ stats: { spd: 1200 }, strategy: 'end' }) }));

import { SkillChartPanel } from './SkillChartPanel';

const basePlan = {
  server: 'global',
  strategy: 'end',
  statProfile: { stats: { spd: 1200, sta: 1000, pow: 1000, gut: 1000, wit: 1000 }, mood: 2 },
  wishlist: [],
} as unknown as CmPlan;

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('SkillChartPanel', () => {
  it('collapses variant families to one row and ranks by L on Run', async () => {
    render(<SkillChartPanel courseId="10906" plan={basePlan} onChange={vi.fn()} deps={{ skillDelta: h.skillDelta }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Run' }));
    // wait for the stream to finish (2 family reps → 2 rows)
    await waitFor(() =>
      expect(within(screen.getByLabelText('Acquirable skill ranking')).getAllByRole('listitem')).toHaveLength(2),
    );
    const rows = within(screen.getByLabelText('Acquirable skill ranking')).getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('Corner Adept ◎'); // gold rep, L 2.0, ranks first
    // family collapsed to 2 reps → exactly 2 sims (100+101 collapse to one; 200 stands alone)
    expect(h.skillDelta).toHaveBeenCalledTimes(2);
  });

  it('+ target adds the family rep with its projectedL and flips to the targeted mark', async () => {
    const onChange = vi.fn();
    render(<SkillChartPanel courseId="10906" plan={basePlan} onChange={onChange} deps={{ skillDelta: h.skillDelta }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Run' }));
    await waitFor(() =>
      expect(within(screen.getByLabelText('Acquirable skill ranking')).getAllByRole('listitem')).toHaveLength(2),
    );
    const rows = within(screen.getByLabelText('Acquirable skill ranking')).getAllByRole('listitem');
    await userEvent.click(within(rows[0]!).getByRole('button', { name: /target/i }));
    const next = onChange.mock.calls[0]![0] as CmPlan;
    expect(next.wishlist).toHaveLength(1);
    expect(next.wishlist[0]).toMatchObject({ skillId: '101', projectedL: 2.0, projectedLStale: false });
  });

  it('shows the speed-required prompt and never sims when spd is 0', () => {
    const noSpeed = { ...basePlan, statProfile: { stats: { spd: 0, sta: 0, pow: 0, gut: 0, wit: 0 }, mood: 2 } } as unknown as CmPlan;
    render(<SkillChartPanel courseId="10906" plan={noSpeed} onChange={vi.fn()} deps={{ skillDelta: h.skillDelta }} />);
    expect(screen.getByText(/Speed is required/i)).toBeInTheDocument();
    expect(h.skillDelta).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test — verify it fails**

Run: `pnpm vitest run src/features/cm-planner/SkillChartPanel.test.tsx`
Expected: FAIL — module `./SkillChartPanel` not found.

- [ ] **Step 3: Implement the panel**

Create `src/features/cm-planner/SkillChartPanel.tsx`:

```tsx
/**
 * M4 §1 — collapsible "Skill chart" (VFalator-style table). Ranks acquirable
 * skills (white/gold/inherited) by marginal bashin L on the user's plan build
 * (planToSimBuild), with SP cost + efficiency (L per 100 SP). Runs ONLY on Run.
 * Variant families collapse to one row (strongest variant); + target adds via the
 * family-aware addOrReplaceWishlistSkill and stamps projectedL so the sidebar's L
 * total moves. Reuses GameIcon + SkillDetailDisclosure (effect-chips on expand).
 */
import './skill-chart.css';
import { useMemo, useState } from 'react';
import type { CmPlan, SkillRecord } from '@/core/types';
import type { BashinStats, SimBuild, SimRaceParams } from '@/sim';
import type { SkillChartRow } from '@/core/rankSkillChart';
import { acquirableSkills } from '@/core/skillCatalog';
import { effectiveSpCost } from '@/core/cost';
import { planToSimBuild } from '@/core/simBuild';
import {
  addOrReplaceWishlistSkill,
  areSkillVariants,
  familyRepresentatives,
  wishlistSkillId,
  wishlistSkillRecord,
} from '@/features/skill-planner/skillFamilies';
import { useGameData } from '@/features/data/gameData';
import { SkillDetailDisclosure } from './SkillDetailDisclosure';
import { skillRecordToSummary } from './skillTechnicalDetails';
import { useSkillRank } from './useSkillRank';

type RarityFilter = 'all' | 'white' | 'gold';
type SortMetric = 'L' | 'sp' | 'eff';
const COLUMNS: ReadonlyArray<{ key: SortMetric; label: string }> = [
  { key: 'L', label: 'L' },
  { key: 'sp', label: 'SP' },
  { key: 'eff', label: 'L/100SP' },
];

export interface SkillChartPanelDeps {
  skillDelta?: (b: SimBuild, r: SimRaceParams, id: string, n: number, seed?: number) => BashinStats | Promise<BashinStats>;
  nsamples?: number;
}

interface RowView {
  row: SkillChartRow;
  skill: SkillRecord;
  sp: number | null;
  eff: number | null;
  targeted: boolean;
}

// All columns sort descending; null/na metrics sort last (finite sentinel = NaN-safe).
function metricOf(v: RowView, m: SortMetric): number {
  if (m === 'L') return v.row.L ?? Number.MIN_SAFE_INTEGER;
  if (m === 'sp') return v.sp ?? Number.MIN_SAFE_INTEGER;
  return v.eff ?? Number.MIN_SAFE_INTEGER;
}

export function SkillChartPanel({ courseId, plan, onChange, deps }: {
  courseId: string;
  plan: CmPlan;
  onChange: (next: CmPlan) => void;
  deps?: SkillChartPanelDeps;
}) {
  const { skills, skillById, sparkRates } = useGameData();
  const [open, setOpen] = useState(true);
  const [query, setQuery] = useState('');
  const [rarity, setRarity] = useState<RarityFilter>('all');
  const [showAll, setShowAll] = useState(false);
  const [sortMetric, setSortMetric] = useState<SortMetric>('L');

  const hasSpeed = plan.statProfile.stats.spd > 0;
  const reps = useMemo(
    () => familyRepresentatives(acquirableSkills(skills ?? [], plan.server), skillById),
    [skills, skillById, plan.server],
  );
  const ids = useMemo(() => (hasSpeed ? reps.map((s) => s.skillId) : []), [reps, hasSpeed]);
  const build = useMemo(() => planToSimBuild(plan), [plan]);
  const race = useMemo<SimRaceParams>(() => ({ courseId }), [courseId]);

  const chartDeps = deps?.skillDelta ? { skillDelta: deps.skillDelta, nsamples: deps.nsamples } : undefined;
  const { rows, status, done, total, isStale, run } = useSkillRank(build, race, ids, chartDeps);

  const targetSkill = (rep: SkillRecord, L: number | null) => {
    const wl = addOrReplaceWishlistSkill(plan.wishlist, rep.skillId, skillById);
    const resolvedId = wishlistSkillId(rep.skillId, skillById);
    const patch = L != null ? { projectedL: L, projectedLStale: false } : {};
    onChange({ ...plan, wishlist: wl.map((it) => (it.skillId === resolvedId ? { ...it, ...patch } : it)) });
  };

  const isTargeted = (rep: SkillRecord): boolean =>
    plan.wishlist.some((it) => {
      const rec = wishlistSkillRecord(it.skillId, skillById);
      return rec ? areSkillVariants(rec, rep) : it.skillId === rep.skillId;
    });

  const q = query.trim().toLowerCase();
  const views: RowView[] = rows
    .map((row): RowView | null => {
      const skill = skillById.get(row.skillId);
      if (!skill) return null;
      const sp = sparkRates ? effectiveSpCost(skill, 0, sparkRates) : null;
      const eff = row.L != null && sp != null && sp > 0 ? (100 * row.L) / sp : null;
      return { row, skill, sp, eff, targeted: isTargeted(skill) };
    })
    .filter((v): v is RowView => v !== null)
    .filter((v) => {
      if (!showAll && v.row.status !== 'live') return false;
      if (rarity !== 'all' && v.skill.rarity !== rarity) return false;
      if (q && !v.skill.nameEn.toLowerCase().includes(q)) return false;
      return true;
    })
    .sort((a, b) => metricOf(b, sortMetric) - metricOf(a, sortMetric));

  return (
    <section className="cmp-plan-card cmp-skill-chart">
      <header
        className="cmp-plan-card-head cmp-collapse-head"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen((o) => !o); }
        }}
      >
        <span className="cmp-skill-chart-title">Skill chart</span>
        <button
          type="button"
          className="cmp-run-btn"
          disabled={!hasSpeed || status === 'running'}
          onClick={(e) => { e.stopPropagation(); run(); }}
        >
          {status === 'idle' ? 'Run' : 'Re-run'}
        </button>
        {status === 'running' && <span className="muted small cmp-uma-progress" role="status">ranking {done}/{total}</span>}
        {isStale && status !== 'running' && <span className="cmp-stale small">re-run</span>}
        <span className="cmp-collapse-caret" data-open={open || undefined} aria-hidden="true" />
      </header>

      {open && (
        <div className="cmp-skill-body">
          {!hasSpeed ? (
            <p className="muted small">Enter your runner&apos;s stats (Speed is required) in the sidebar to rank skills.</p>
          ) : status === 'idle' ? (
            <p className="muted small">
              Run to rank acquirable skills by length on your build (a simulated estimate, P3). Sort by L / SP /
              efficiency; expand a skill for its effects and conditions.
            </p>
          ) : (
            <>
              <div className="cmp-uma-toolbar">
                <input
                  className="search"
                  type="search"
                  placeholder="search skill…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Search skills"
                />
                {(['all', 'white', 'gold'] as const).map((r) => (
                  <button key={r} type="button" className="chip" aria-pressed={rarity === r} onClick={() => setRarity(r)}>
                    {r}
                  </button>
                ))}
                <label className="cmp-showall small">
                  <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> show all
                </label>
              </div>

              <div className="cmp-skill-table">
                <div className="cmp-skill-thead" aria-hidden="true">
                  <span>Skill</span>
                  {COLUMNS.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      className={`cmp-uma-sort ${sortMetric === c.key ? 'is-sort' : ''}`.trim()}
                      onClick={() => setSortMetric(c.key)}
                      title={`Sort by ${c.label.toLowerCase()}`}
                    >
                      {c.label}
                    </button>
                  ))}
                  <span />
                </div>

                <ul className="cmp-skill-rows" aria-label="Acquirable skill ranking">
                  {views.map((v) => (
                    <li key={v.skill.skillId} className={`cmp-skill-row ${v.row.status === 'live' ? '' : 'is-dim'}`.trim()}>
                      <SkillDetailDisclosure
                        skill={skillRecordToSummary(v.skill)}
                        showCost={false}
                        className="cmp-uma-plate"
                        technicalHeaderSide={
                          v.row.L != null
                            ? <span className="muted small">L +{v.row.L.toFixed(2)} · min {(v.row.min ?? 0).toFixed(2)} · max {(v.row.max ?? 0).toFixed(2)} · med {(v.row.median ?? 0).toFixed(2)} · n={v.row.nsamples}</span>
                            : undefined
                        }
                      />
                      <span className={`cmp-uma-num ${sortMetric === 'L' ? 'is-sort' : ''}`.trim()}>
                        {v.row.status === 'na' ? 'n/a' : `+${(v.row.L ?? 0).toFixed(2)}`}
                      </span>
                      <span className={`cmp-uma-num ${sortMetric === 'sp' ? 'is-sort' : ''}`.trim()}>
                        {v.sp ?? '—'}
                      </span>
                      <span className={`cmp-uma-num ${sortMetric === 'eff' ? 'is-sort' : ''}`.trim()}>
                        {v.eff != null ? v.eff.toFixed(2) : '—'}
                      </span>
                      <button
                        type="button"
                        className="cmp-small-btn cmp-uma-select"
                        aria-pressed={v.targeted}
                        aria-label={v.targeted ? `${v.skill.nameEn} targeted` : `Add ${v.skill.nameEn} to target`}
                        onClick={() => targetSkill(v.skill, v.row.L)}
                      >
                        {v.targeted ? '✓' : '+'}
                      </button>
                    </li>
                  ))}
                  {views.length === 0 && (
                    <li className="muted small">No skills to show{!showAll ? ' (try “show all”)' : ''}.</li>
                  )}
                </ul>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Create the CSS**

Create `src/features/cm-planner/skill-chart.css`:

```css
/* M4 §1 Skill chart — collapsible VFalator-style table.
   Reuses page tokens + shared chart classes (.cmp-run-btn / .cmp-stale /
   .cmp-uma-progress / .cmp-uma-toolbar / .cmp-showall / .cmp-uma-sort /
   .cmp-uma-num / .cmp-uma-select / .cmp-uma-plate from uma-chart.css, which is
   always loaded on this page) + the .cmp-plan-card / .cmp-collapse-head grammar
   from cm-planner.css. Only the column grid is chart-specific. */

.cmp-skill-chart {
  padding: 0;
  overflow: hidden;
}
.cmp-skill-chart-title {
  font-size: 0.82rem;
  font-weight: 700;
}
.cmp-skill-body {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.6rem 0.75rem 0.7rem;
}

/* table: thead + scrollable rows share the same fixed grid so columns align.
   skill (grows) | L | SP | L/100SP | target */
.cmp-skill-thead,
.cmp-skill-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 3.6rem 3.2rem 4.4rem 2.6rem;
  gap: 0.4rem;
}
.cmp-skill-table {
  max-height: 30rem;
  overflow-y: auto;
  scrollbar-gutter: stable;
  border: 1px solid var(--border);
  border-radius: 8px;
}
.cmp-skill-thead {
  position: sticky;
  top: 0;
  z-index: 1;
  align-items: center;
  justify-items: center;
  padding: 0.3rem 0.4rem;
  background: var(--bg-2);
  border-bottom: 1px solid var(--border);
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--fg-muted);
}
.cmp-skill-thead > :first-child {
  justify-self: start;
}
.cmp-skill-rows {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}
.cmp-skill-row {
  align-items: start;
  padding: 0.1rem 0.4rem;
}
.cmp-skill-row:hover {
  background: var(--bg-2);
}
.cmp-skill-row.is-dim {
  opacity: 0.55;
}
.cmp-skill-row .cmp-skill-detail > summary {
  justify-content: flex-start;
}
.cmp-skill-row .cmp-skill-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

- [ ] **Step 5: Run the test — verify it passes**

Run: `pnpm vitest run src/features/cm-planner/SkillChartPanel.test.tsx`
Expected: PASS (3 tests). If you hit `Cannot read properties of null (reading 'useState')`, stop `pnpm dev` and re-run.

- [ ] **Step 6: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/cm-planner/SkillChartPanel.tsx src/features/cm-planner/skill-chart.css src/features/cm-planner/SkillChartPanel.test.tsx
git commit -m "feat(m4): SkillChartPanel — acquirable-skill chart (L/SP/efficiency, family-collapsed)"
```

---

## Task 5: Mount on the planner page + doc

**Files:**
- Modify: `src/features/cm-planner/CmPlannerPage.tsx`
- Modify: `src/features/cm-planner/CmPlannerPage.test.tsx` (only if the new panel breaks it)
- Modify: `docs/modules/module-4-skill-acquisition.md`

- [ ] **Step 1: Mount the panel**

In `src/features/cm-planner/CmPlannerPage.tsx`, add the import alongside the other panel imports:

```tsx
import { SkillChartPanel } from './SkillChartPanel';
```

Then add the panel directly after `<UmaChartPanel … />` inside `.cmp-main`:

```tsx
          <UmaChartPanel
            courseId={selection.courseId}
            plan={plan}
            onSelectRunner={(umaId, uniqueSkillId) => setPlan({ ...plan, umaId, uniqueSkillId })}
          />
          <SkillChartPanel courseId={selection.courseId} plan={plan} onChange={setPlan} />
```

- [ ] **Step 2: Run the page test — verify it still passes**

Run: `pnpm vitest run src/features/cm-planner/CmPlannerPage.test.tsx`
Expected: PASS. The panel is idle by default (no sim) and guards `skills ?? []`, so it renders a card + Run button without extra mock data. If the test's `useGameData` mock omits `skills`/`skillById`/`sparkRates` and the panel throws, add them to that mock:

```tsx
// inside the existing vi.mock('@/features/data/gameData', …) return object:
skills: [], skillById: new Map(), sparkRates: {},
```

- [ ] **Step 3: Update the module doc**

In `docs/modules/module-4-skill-acquisition.md`, under the current-state / chart section, add a bullet (place it next to the Unique-skill chart entry):

```markdown
- **Skill chart (acquirable)** — `/` planner, below the Unique-skill chart. `SkillChartPanel` +
  `useSkillRank` + `rankSkillChart`: ranks white/gold/inherited skills by marginal L on the
  **plan build** (run-on-demand), with **SP cost** + **efficiency (L/100SP)** columns, sortable;
  variant families collapse to one row (`familyRepresentatives`); `+ target` adds via
  `addOrReplaceWishlistSkill` and stamps `projectedL` so the sidebar's L total moves; effect-chips
  on expand. `/legacy` keeps the original engine skill chart. Spec:
  [2026-06-17-m4-acquirable-skill-chart-design.md](../superpowers/specs/2026-06-17-m4-acquirable-skill-chart-design.md).
  Always-visible skill-type tag is a separate handoff
  ([2026-06-17-skill-plate-type-tag-handoff.md](../superpowers/specs/2026-06-17-skill-plate-type-tag-handoff.md)).
```

- [ ] **Step 4: Full suite + build**

Run: `pnpm test`
Expected: PASS (existing + new tests).

Run: `pnpm build`
Expected: PASS (typecheck + vite build).

- [ ] **Step 5: Commit**

```bash
git add src/features/cm-planner/CmPlannerPage.tsx src/features/cm-planner/CmPlannerPage.test.tsx docs/modules/module-4-skill-acquisition.md
git commit -m "feat(m4): mount SkillChartPanel on the planner page + doc"
```

---

## Done criteria

- `/` shows a collapsible "Skill chart" card under the Unique-skill chart.
- Run ranks acquirable skills by L on the plan build; columns L / SP / L-per-100SP are sortable; rows collapse to one per variant family.
- `+ target` adds the family rep with `projectedL` set, the sidebar's "individual L" total moves, and the button shows the targeted mark when any family member is targeted.
- Effect-chips + conditions + activation routes show on expand.
- `spd === 0` shows the Speed-required prompt and never sims.
- `pnpm test` + `pnpm build` green; `/legacy` unchanged.

## Out of scope (separate work)

Always-visible skill-type tag (handoff), L-vs-distance duration graphs, card-hint sourcing (§3), uma innate/release columns, HP/velocity track zones, the shared `useRankChart` DRY merge.
