# M4 Skill Chart — Wishlist Baseline + Stamina Warning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the acquirable skill chart rank each candidate marginally on top of the user's already-targeted wishlist skills (instead of a vacuum), and warn — with a user-adjustable, locally-persisted survival threshold — when the build runs out of stamina.

**Architecture:** A new pure-core `chartBaselineBuild` puts the targeted wishlist skill ids into the engine `SimBuild`; an engine-side `simulatableBase` filter drops ids the engine can't simulate (the only crash vector). A one-shot vacuum probe reads the engine's authoritative `aStaminaSurvival`; a `localStorage`-backed threshold hook drives an amber banner. Already-targeted skills are excluded from the ranked sims and shown as "in build" rows with their stamped `projectedL`.

**Tech Stack:** TypeScript + Vite + React 19, Vitest (jsdom for components, `// @vitest-environment node` for engine), vendored umalator engine via `SimClient` Web Worker.

## Global Constraints

- **No `pnpm sim:build` rebuild** — use only existing engine exports (`evalSkillDelta`, `runVacuumCompare`, `SimClient.vacuum`, `skillsService.isSimulatable`).
- **Honest numbers (P3):** show the real survival percentage; never fabricate.
- **Local-first (P2):** the threshold persists in `localStorage`, independent of the plan.
- **Keep the engine lazy:** UI modules import `SimClient` from `@/sim/client` (NOT the `@/sim` barrel) and types from `@/sim`. Engine-side code (`run.ts`, `adapter.ts`) may import the bundle directly.
- **`planToSimBuild` is shared and stays vacuum** — do not change it (legacy page + sidebar trace depend on it).
- **Backward compatible:** an empty wishlist must produce identical behavior to today.
- **Vitest gotcha:** constructing `SimClient` in jsdom spawns a real Worker and throws — component tests must never trigger a real client; inject deps or rely on the probe's try/catch fallback.
- Commit message trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/core/simBuild.ts` | + `chartBaselineBuild(plan, skillById)` — pure: vacuum build with targeted wishlist ids as `skills`. |
| `src/sim/run.ts` | + `simulatableBase(build)` — engine-side filter of `build.skills` to simulatable ids; applied in `evalSkillDelta` + `runVacuumCompare`. |
| `src/features/cm-planner/useStaminaWarnThreshold.ts` | New — `localStorage`-backed warn-threshold hook (default 0.95, clamp `[0,1]`). |
| `src/features/cm-planner/useStaminaProbe.ts` | New — one-shot vacuum probe exposing `survival`; degrades to null without a worker. |
| `src/features/cm-planner/SkillChartPanel.tsx` | Swap baseline to `chartBaselineBuild`; fire probe on Run; render banner + threshold control; exclude targeted from sims and render them as "in build" rows. |
| `src/features/cm-planner/skill-chart.css` | Banner, threshold-control, and in-build-badge styles. |

---

## Task 1: `chartBaselineBuild` (pure core)

**Files:**
- Modify: `src/core/simBuild.ts`
- Test: `src/core/simBuild.test.ts`

**Interfaces:**
- Consumes: `planToSimBuild(plan)` (existing, same file), `wishlistSkillId(skillId, skillById)` from `@/features/skill-planner/skillFamilies`.
- Produces: `chartBaselineBuild(plan: CmPlan, skillById: ReadonlyMap<string, SkillRecord>): SimBuild` — identical to `planToSimBuild(plan)` except `skills` = de-duplicated resolved engine ids of the targeted wishlist skills.

- [ ] **Step 1: Write the failing test**

Add to `src/core/simBuild.test.ts` (the `plan()` factory already exists in this file):

```typescript
import { chartBaselineBuild } from './simBuild';
import type { SkillRecord } from '@/core/types';

function skill(over: Partial<SkillRecord> & { skillId: string }): SkillRecord {
  return {
    nameEn: 'S', rarity: 'white', baseSpCost: 100, server: 'global',
    dataVersion: 't', iconId: '0', ...over,
  } as SkillRecord;
}

describe('chartBaselineBuild', () => {
  const white = skill({ skillId: '200332', rarity: 'white' });
  const skillById = new Map<string, SkillRecord>([[white.skillId, white]]);

  it('matches planToSimBuild but injects targeted wishlist ids as skills', () => {
    const p = plan({ wishlist: [{ skillId: '200332', priority: 1, source: 'targeted' }] });
    const b = chartBaselineBuild(p, skillById);
    expect(b.skills).toEqual(['200332']);
    // everything else identical to the vacuum build
    const { skills: _s, ...rest } = b;
    const { skills: _v, ...vac } = planToSimBuild(p);
    expect(rest).toEqual(vac);
  });

  it('is vacuum-equivalent for an empty wishlist (no regression)', () => {
    expect(chartBaselineBuild(plan(), skillById).skills).toEqual([]);
  });

  it('de-duplicates repeated wishlist ids', () => {
    const p = plan({ wishlist: [
      { skillId: '200332', priority: 1, source: 'targeted' },
      { skillId: '200332', priority: 1, source: 'targeted' },
    ] });
    expect(chartBaselineBuild(p, skillById).skills).toEqual(['200332']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/core/simBuild.test.ts`
Expected: FAIL — `chartBaselineBuild` is not exported.

- [ ] **Step 3: Write minimal implementation**

In `src/core/simBuild.ts`, add the import and function (place the function directly below `planToSimBuild`):

```typescript
import type { AptKey, CmPlan, Grade, SkillRecord, Strategy } from '@/core/types';
import { wishlistSkillId } from '@/features/skill-planner/skillFamilies';

// ...existing planToSimBuild above...

/**
 * Chart baseline: the vacuum build PLUS the user's already-targeted wishlist skills,
 * so each ranked candidate's L is its marginal value on top of what's already picked
 * (recovery → re-run → speed skills show their true value). Resolves each wishlist id
 * to its engine id; the engine-side `simulatableBase` filter later drops any the engine
 * can't simulate (e.g. inherited-unique 9… ids). Empty wishlist ⇒ today's vacuum.
 */
export function chartBaselineBuild(
  plan: CmPlan,
  skillById: ReadonlyMap<string, SkillRecord>,
): SimBuild {
  const skills = [...new Set(plan.wishlist.map((it) => wishlistSkillId(it.skillId, skillById)))];
  return { ...planToSimBuild(plan), skills };
}
```

> NOTE: `@/core/types` is already imported in this file for `AptKey/CmPlan/Grade/Strategy` — extend that existing import with `SkillRecord` rather than adding a second import line. Add the `wishlistSkillId` import at the top with the other imports.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/core/simBuild.test.ts`
Expected: PASS (all three new tests + the existing suite).

- [ ] **Step 5: Commit**

```bash
git add src/core/simBuild.ts src/core/simBuild.test.ts
git commit -m "feat(m4): chartBaselineBuild — rank on top of targeted wishlist skills

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Engine-side simulatable-baseline filter

**Files:**
- Modify: `src/sim/run.ts`
- Test: `src/sim/run.test.ts`

**Why:** The engine throws `"bad skill ID …"` on an *unknown* id in a runner's deck (umalator.bundle.mjs:115538), but `skillsService.isSimulatable` returns `false` (never throws) for unknown ids. A targeted wishlist skill may resolve to an id the pinned engine doesn't know (inherited-unique `9…`, JP-only). Filter the baseline before building runners.

**Interfaces:**
- Consumes: `skillsService` (already imported in `run.ts`).
- Produces: `simulatableBase(build: SimBuild): SimBuild` (exported) — `build` with `skills` filtered to `skillsService.isSimulatable`. Applied inside `evalSkillDelta` and `runVacuumCompare`.

- [ ] **Step 1: Write the failing test**

Add to `src/sim/run.test.ts` (this file is `// @vitest-environment node` and uses the real engine):

```typescript
import { simulatableBase } from './run';

describe('simulatableBase', () => {
  const base = {
    umaId: '100201', stats: { spd: 1150, sta: 800, pow: 1000, gut: 500, wit: 850 },
    strategy: 'pace' as const, aptitudes: { distance: 'A', surface: 'A', strategy: 'A' } as const,
    skills: [],
  };

  it('drops ids the engine cannot simulate (no throw on unknown ids)', () => {
    const out = simulatableBase({ ...base, skills: ['zzz-bogus-id'] });
    expect(out.skills).toEqual([]);
  });

  it('removes a bogus baseline id while leaving the rest of the build intact', () => {
    const out = simulatableBase({ ...base, skills: ['200332', 'zzz-bogus-id'] });
    expect(out.skills).not.toContain('zzz-bogus-id');
    expect(out.stats).toEqual(base.stats);
    expect(out.strategy).toBe('pace');
  });
});

describe('evalSkillDelta with a non-simulatable baseline skill', () => {
  it('does not throw — a bogus baseline id is filtered out before the sim runs', () => {
    const build = {
      umaId: '100201', stats: { spd: 1150, sta: 800, pow: 1000, gut: 500, wit: 850 },
      strategy: 'pace' as const, aptitudes: { distance: 'A', surface: 'A', strategy: 'A' } as const,
      skills: ['zzz-bogus-id'],
    };
    expect(() => evalSkillDelta(build, { courseId: '10101' }, '200332', 4, 1)).not.toThrow();
  });
});
```

> NOTE: `evalSkillDelta` is already imported at the top of `run.test.ts`. If it is not, add it to the existing `import { … } from './run'` line.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/sim/run.test.ts`
Expected: FAIL — `simulatableBase` is not exported (and, before the filter is wired, `evalSkillDelta` throws `bad skill ID zzz-bogus-id`).

- [ ] **Step 3: Write minimal implementation**

In `src/sim/run.ts`, add the helper near the top (below the `EMPTY` const) and apply it in the two chart-facing entry points:

```typescript
/** Drop baseline skills the engine can't simulate. The engine THROWS on an unknown
 *  id in a runner's deck, but isSimulatable returns false (no throw) for unknown ids,
 *  so this neutralizes the only crash vector (e.g. inherited-unique 9… ids). */
export function simulatableBase(build: SimBuild): SimBuild {
  return { ...build, skills: build.skills.filter((id) => skillsService.isSimulatable(id)) };
}
```

In `evalSkillDelta`, replace the two `toRunnerState` lines:

```typescript
  const base = simulatableBase(build);
  const runnerA = toRunnerState(base);
  const runnerB = toRunnerState({ ...base, skills: [...base.skills, skillId] });
```

In `runVacuumCompare`, filter both runners:

```typescript
    uma1: toRunnerState(simulatableBase(a)),
    uma2: toRunnerState(simulatableBase(b)),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/sim/run.test.ts`
Expected: PASS. (Filtering is behavior-neutral for known skills — the engine already skips known-but-non-simulatable deck skills internally — so existing `run.test.ts` numeric assertions are unaffected.)

- [ ] **Step 5: Commit**

```bash
git add src/sim/run.ts src/sim/run.test.ts
git commit -m "fix(sim): filter non-simulatable baseline skills before runner build (no throw on unknown ids)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: `useStaminaWarnThreshold` hook (localStorage)

**Files:**
- Create: `src/features/cm-planner/useStaminaWarnThreshold.ts`
- Test: `src/features/cm-planner/useStaminaWarnThreshold.test.ts`

**Interfaces:**
- Produces:
  - `DEFAULT_STAMINA_WARN_THRESHOLD = 0.95`
  - `clampThreshold(n: number): number` — finite → clamp to `[0,1]`; non-finite → default.
  - `useStaminaWarnThreshold(): [number, (n: number) => void]` — value persisted under `localStorage` key `cmp.staminaWarnThreshold`.

- [ ] **Step 1: Write the failing test**

Create `src/features/cm-planner/useStaminaWarnThreshold.test.ts`:

```typescript
import { afterEach, describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  DEFAULT_STAMINA_WARN_THRESHOLD,
  clampThreshold,
  useStaminaWarnThreshold,
} from './useStaminaWarnThreshold';

const KEY = 'cmp.staminaWarnThreshold';
afterEach(() => localStorage.clear());

describe('clampThreshold', () => {
  it('clamps to [0,1] and falls back to default for non-finite input', () => {
    expect(clampThreshold(1.5)).toBe(1);
    expect(clampThreshold(-0.2)).toBe(0);
    expect(clampThreshold(0.8)).toBe(0.8);
    expect(clampThreshold(Number.NaN)).toBe(DEFAULT_STAMINA_WARN_THRESHOLD);
  });
});

describe('useStaminaWarnThreshold', () => {
  it('defaults to 0.95 when nothing is stored', () => {
    const { result } = renderHook(() => useStaminaWarnThreshold());
    expect(result.current[0]).toBe(0.95);
  });

  it('persists a new value to localStorage', () => {
    const { result } = renderHook(() => useStaminaWarnThreshold());
    act(() => result.current[1](0.8));
    expect(result.current[0]).toBe(0.8);
    expect(localStorage.getItem(KEY)).toBe('0.8');
    // a fresh mount reads the stored value back
    const { result: r2 } = renderHook(() => useStaminaWarnThreshold());
    expect(r2.current[0]).toBe(0.8);
  });

  it('clamps a malformed / out-of-range stored value back to default or range', () => {
    localStorage.setItem(KEY, 'not-a-number');
    expect(renderHook(() => useStaminaWarnThreshold()).result.current[0]).toBe(0.95);
    localStorage.setItem(KEY, '5');
    expect(renderHook(() => useStaminaWarnThreshold()).result.current[0]).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/cm-planner/useStaminaWarnThreshold.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `src/features/cm-planner/useStaminaWarnThreshold.ts`:

```typescript
/** Local-first (P2) warn-threshold for the skill-chart stamina banner. Stored as a
 *  0–1 survival fraction under one localStorage key; clamped + default-guarded so a
 *  hand-edited / corrupt value can never break the chart. */
import { useState } from 'react';

export const DEFAULT_STAMINA_WARN_THRESHOLD = 0.95;
const STORAGE_KEY = 'cmp.staminaWarnThreshold';

export function clampThreshold(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_STAMINA_WARN_THRESHOLD;
  return Math.min(1, Math.max(0, n));
}

function read(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw == null) return DEFAULT_STAMINA_WARN_THRESHOLD;
    const n = Number(raw);
    return Number.isFinite(n) ? clampThreshold(n) : DEFAULT_STAMINA_WARN_THRESHOLD;
  } catch {
    return DEFAULT_STAMINA_WARN_THRESHOLD;
  }
}

export function useStaminaWarnThreshold(): [number, (n: number) => void] {
  const [value, setValue] = useState<number>(read);
  const set = (n: number) => {
    const c = clampThreshold(n);
    setValue(c);
    try { localStorage.setItem(STORAGE_KEY, String(c)); } catch { /* storage unavailable */ }
  };
  return [value, set];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/features/cm-planner/useStaminaWarnThreshold.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/cm-planner/useStaminaWarnThreshold.ts src/features/cm-planner/useStaminaWarnThreshold.test.ts
git commit -m "feat(m4): useStaminaWarnThreshold — localStorage-backed warn threshold (default 95%)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: `useStaminaProbe` hook

**Files:**
- Create: `src/features/cm-planner/useStaminaProbe.ts`
- Test: `src/features/cm-planner/useStaminaProbe.test.ts`

**Interfaces:**
- Consumes: `SimClient` from `@/sim/client` (lazy real dep); `VacuumResult`, `SimBuild`, `SimRaceParams` from `@/sim`.
- Produces:
  - `PROBE_NSAMPLES = 30`
  - `UseStaminaProbeDeps { vacuum: (a, b, race, n, seed?) => VacuumResult | Promise<VacuumResult>; nsamples?: number }`
  - `StaminaProbeState { survival: number | null; status: 'idle' | 'running' | 'done'; probe: () => void }`
  - `useStaminaProbe(build, race, deps?): StaminaProbeState` — `probe()` runs `vacuum(build, build, race, n)` once and stores `aStaminaSurvival`. Without injected deps it lazily constructs a `SimClient`; if that throws (jsdom — no Worker) it silently no-ops (`survival` stays null).

- [ ] **Step 1: Write the failing test**

Create `src/features/cm-planner/useStaminaProbe.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { SimBuild, SimRaceParams, VacuumResult } from '@/sim';
import { useStaminaProbe } from './useStaminaProbe';

const build = { stats: { spd: 1200 }, strategy: 'pace', skills: [] } as unknown as SimBuild;
const race: SimRaceParams = { courseId: '10906' };
const vac = (survival: number): VacuumResult => ({
  mean: 0, median: 0, min: 0, max: 0, nsamples: 30, results: [],
  aFirstPlaceRate: 0, bFirstPlaceRate: 0, aStaminaSurvival: survival, bStaminaSurvival: survival,
});

describe('useStaminaProbe', () => {
  it('starts idle with no survival and does not call vacuum before probe()', () => {
    const vacuum = vi.fn(async () => vac(0.5));
    const { result } = renderHook(() => useStaminaProbe(build, race, { vacuum }));
    expect(result.current.survival).toBeNull();
    expect(result.current.status).toBe('idle');
    expect(vacuum).not.toHaveBeenCalled();
  });

  it('probe() stores aStaminaSurvival from a build-vs-itself vacuum run', async () => {
    const vacuum = vi.fn(async () => vac(0.42));
    const { result } = renderHook(() => useStaminaProbe(build, race, { vacuum }));
    act(() => result.current.probe());
    await waitFor(() => expect(result.current.survival).toBe(0.42));
    expect(result.current.status).toBe('done');
    expect(vacuum).toHaveBeenCalledWith(build, build, race, 30, undefined);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/cm-planner/useStaminaProbe.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `src/features/cm-planner/useStaminaProbe.ts`:

```typescript
/** One-shot stamina probe for the skill chart. Runs the baseline build vs itself and
 *  reads the engine's authoritative survival rate (aStaminaSurvival, 0–1). Without
 *  injected deps it lazily builds a SimClient; if that throws (jsdom has no Worker)
 *  it no-ops so component tests never spawn a real worker. */
import { useRef, useState } from 'react';
import type { SimBuild, SimRaceParams, VacuumResult } from '@/sim';
import { SimClient } from '@/sim/client';

export const PROBE_NSAMPLES = 30;

export interface UseStaminaProbeDeps {
  vacuum: (a: SimBuild, b: SimBuild, race: SimRaceParams, n: number, seed?: number)
    => VacuumResult | Promise<VacuumResult>;
  nsamples?: number;
}
export interface StaminaProbeState {
  survival: number | null;
  status: 'idle' | 'running' | 'done';
  probe: () => void;
}

let client: SimClient | null = null;
function realDeps(): UseStaminaProbeDeps {
  client ??= new SimClient();
  return { vacuum: client.vacuum.bind(client) };
}

export function useStaminaProbe(
  build: SimBuild,
  race: SimRaceParams,
  deps?: UseStaminaProbeDeps,
): StaminaProbeState {
  const [survival, setSurvival] = useState<number | null>(null);
  const [status, setStatus] = useState<'idle' | 'running' | 'done'>('idle');
  const depsRef = useRef(deps);
  depsRef.current = deps;
  const token = useRef(0);

  const probe = () => {
    const t = (token.current += 1);
    let d: UseStaminaProbeDeps;
    try {
      d = depsRef.current ?? realDeps();
    } catch {
      return; // no worker (jsdom) — leave survival null, no banner
    }
    setStatus('running');
    Promise.resolve(d.vacuum(build, build, race, d.nsamples ?? PROBE_NSAMPLES))
      .then((r) => {
        if (token.current === t) { setSurvival(r.aStaminaSurvival); setStatus('done'); }
      })
      .catch(() => { if (token.current === t) setStatus('idle'); });
  };

  return { survival, status, probe };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/features/cm-planner/useStaminaProbe.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/cm-planner/useStaminaProbe.ts src/features/cm-planner/useStaminaProbe.test.ts
git commit -m "feat(m4): useStaminaProbe — one-shot vacuum survival probe (jsdom-safe)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Wire baseline + stamina banner + threshold control into the panel

**Files:**
- Modify: `src/features/cm-planner/SkillChartPanel.tsx`
- Modify: `src/features/cm-planner/skill-chart.css`
- Test: `src/features/cm-planner/SkillChartPanel.test.tsx`

**Interfaces:**
- Consumes: `chartBaselineBuild` (Task 1), `useStaminaProbe` + `UseStaminaProbeDeps` (Task 4), `useStaminaWarnThreshold` (Task 3).
- Produces: `SkillChartPanelDeps` gains optional `vacuum?: UseStaminaProbeDeps['vacuum']`. Run now also fires the probe; the banner renders when `survival != null && survival < threshold`.

- [ ] **Step 1: Write the failing test**

Add to `src/features/cm-planner/SkillChartPanel.test.tsx` (inside the existing `describe('SkillChartPanel')`). The hoisted `h` already exposes `skillDelta`, `skills`, `skillById`; add a `vacuum` stub inline:

```typescript
  it('shows a stamina-out banner with the survival % when survival is below the threshold', async () => {
    const vacuum = vi.fn(async () => ({
      mean: 0, median: 0, min: 0, max: 0, nsamples: 30, results: [],
      aFirstPlaceRate: 0, bFirstPlaceRate: 0, aStaminaSurvival: 0.5, bStaminaSurvival: 0.5,
    }));
    render(<SkillChartPanel courseId="10906" plan={basePlan} onChange={vi.fn()} deps={{ skillDelta: h.skillDelta, vacuum }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Run' }));
    expect(await screen.findByText(/survives only 50% of runs/i)).toBeInTheDocument();
  });

  it('hides the banner when the user lowers the threshold below the survival rate (no re-run)', async () => {
    const vacuum = vi.fn(async () => ({
      mean: 0, median: 0, min: 0, max: 0, nsamples: 30, results: [],
      aFirstPlaceRate: 0, bFirstPlaceRate: 0, aStaminaSurvival: 0.5, bStaminaSurvival: 0.5,
    }));
    render(<SkillChartPanel courseId="10906" plan={basePlan} onChange={vi.fn()} deps={{ skillDelta: h.skillDelta, vacuum }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Run' }));
    await screen.findByText(/survives only 50% of runs/i);
    const calls = vacuum.mock.calls.length;
    // drop warn threshold to 40% → 50% survival no longer triggers
    fireEvent.change(screen.getByLabelText('Stamina warning threshold (%)'), { target: { value: '40' } });
    expect(screen.queryByText(/survives only 50% of runs/i)).not.toBeInTheDocument();
    expect(vacuum.mock.calls.length).toBe(calls); // pure re-evaluate, no extra probe
  });
```

> Add `fireEvent` to the existing `@testing-library/react` import in this test file. `basePlan` (empty wishlist) and the `renderPanel`/`render` pattern already exist in the file.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/cm-planner/SkillChartPanel.test.tsx`
Expected: FAIL — no banner text / no threshold control.

- [ ] **Step 3: Write minimal implementation**

In `src/features/cm-planner/SkillChartPanel.tsx`:

(a) Imports — add:

```typescript
import { chartBaselineBuild } from '@/core/simBuild';
import { useStaminaProbe, type UseStaminaProbeDeps } from './useStaminaProbe';
import { useStaminaWarnThreshold } from './useStaminaWarnThreshold';
```

…and remove the now-unused `planToSimBuild` import.

(b) Deps type — extend:

```typescript
export interface SkillChartPanelDeps {
  skillDelta?: (b: SimBuild, r: SimRaceParams, id: string, n: number, seed?: number) => BashinStats | Promise<BashinStats>;
  vacuum?: UseStaminaProbeDeps['vacuum'];
  nsamples?: number;
}
```

(c) Baseline + probe + threshold — replace the `build` memo and add the hooks (the `build` memo currently reads `planToSimBuild(plan)`):

```typescript
  const build = useMemo(() => chartBaselineBuild(plan, skillById), [plan, skillById]);
  const race = useMemo<SimRaceParams>(() => ({ courseId }), [courseId]);

  const [warnThreshold, setWarnThreshold] = useStaminaWarnThreshold();
  const probeDeps = deps?.vacuum ? { vacuum: deps.vacuum, nsamples: deps.nsamples } : undefined;
  const { survival, probe } = useStaminaProbe(build, race, probeDeps);
  const staminaOut = survival != null && survival < warnThreshold;
```

(d) Fire the probe alongside the rank. The header Run button calls `run()`; change its handler to also probe:

```typescript
          onClick={(e) => { e.stopPropagation(); if (status === 'running') stop(); else { run(); probe(); } }}
```

(e) Render the banner + threshold control. Inside `<div className="cmp-skill-body">`, right after the `<p className="cmp-skill-caption …">…</p>` and before the `{status !== 'idle' && (` block, add:

```tsx
              {staminaOut && (
                <p className="cmp-stamina-warn small" role="status">
                  ⚠ Build survives only {Math.round((survival ?? 0) * 100)}% of runs (stamina-out).
                  Recovery is inflated and speed skills undervalued — secure stamina/recovery, then Re-run.
                </p>
              )}
```

Then add the threshold control into the existing `<div className="cmp-uma-toolbar">` (after the "show upcoming" label):

```tsx
                    <label className="cmp-stamina-thresh small" title="Warn when the build's stamina survival is below this percentage.">
                      warn&nbsp;&lt;&nbsp;
                      <input
                        type="number" min={0} max={100} step={5}
                        aria-label="Stamina warning threshold (%)"
                        value={Math.round(warnThreshold * 100)}
                        onChange={(e) => setWarnThreshold(Number(e.target.value) / 100)}
                      />
                      %
                    </label>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/features/cm-planner/SkillChartPanel.test.tsx`
Expected: PASS (new banner tests + all existing tests — existing tests inject no `vacuum`, so the probe no-ops via its try/catch and never shows a banner).

- [ ] **Step 5: Add CSS**

In `src/features/cm-planner/skill-chart.css`, append:

```css
.cmp-stamina-warn {
  margin: 0 0 0.5rem;
  padding: 0.4rem 0.6rem;
  border: 1px solid var(--warn-border, #b9892a);
  border-radius: 8px;
  background: var(--warn-bg, rgba(185, 137, 42, 0.12));
  color: var(--warn-fg, #e7c074);
}
.cmp-stamina-thresh { display: inline-flex; align-items: center; gap: 0.15rem; white-space: nowrap; }
.cmp-stamina-thresh input { width: 3.2rem; }
```

- [ ] **Step 6: Verify + commit**

Run: `pnpm vitest run src/features/cm-planner/SkillChartPanel.test.tsx` then `pnpm typecheck`
Expected: PASS / no type errors.

```bash
git add src/features/cm-planner/SkillChartPanel.tsx src/features/cm-planner/skill-chart.css src/features/cm-planner/SkillChartPanel.test.tsx
git commit -m "feat(m4): wishlist baseline + stamina-out banner with adjustable threshold

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: "In build" rows for already-targeted skills

**Files:**
- Modify: `src/features/cm-planner/SkillChartPanel.tsx`
- Modify: `src/features/cm-planner/skill-chart.css`
- Test: `src/features/cm-planner/SkillChartPanel.test.tsx`

**Why:** With the wishlist baseline, a targeted skill's fresh marginal L ≈ 0 (it's already in the baseline). Exclude targeted skills from the ranked sims and render them as non-simmed "in build" rows showing their stamped `projectedL`.

**Interfaces:**
- Consumes: `isTargeted(rep)` + `reps` + `plan.wishlist` (all existing in the panel), `SkillChartRow` (`@/core/rankSkillChart`).
- Produces: `RowView` gains `inBuild?: boolean`; `ids` excludes targeted reps; the rendered list concatenates synthesized in-build views with the ranked views.

- [ ] **Step 1: Write the failing test**

Add to `src/features/cm-planner/SkillChartPanel.test.tsx`. Use a plan whose wishlist already targets one of the catalog skills (the hoisted `h.skills`/`h.skillById` define the catalog; reuse an existing catalog id — the file's other tests reference these, e.g. the ids in `h.skills`). Replace `TARGET_ID`/`TARGET_NAME` with the first catalog skill's id/name as defined in this test file's `h`:

```typescript
  it('excludes a targeted skill from the ranked sims and shows it as an "in build" row', async () => {
    const targetedPlan = {
      ...basePlan,
      wishlist: [{ skillId: TARGET_ID, priority: 1, source: 'targeted', projectedL: 1.23 }],
    } as typeof basePlan;
    render(<SkillChartPanel courseId="10906" plan={targetedPlan} onChange={vi.fn()} deps={{ skillDelta: h.skillDelta }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Run' }));
    await waitFor(() => expect(screen.getByLabelText('Acquirable skill ranking')).toBeInTheDocument());
    // the targeted skill was NOT re-simmed
    expect(h.skillDelta.mock.calls.map((c) => c[2])).not.toContain(TARGET_ID);
    // …but it is shown, badged "in build", with its stamped L
    const row = within(screen.getByLabelText('Acquirable skill ranking')).getByText(TARGET_NAME).closest('li')!;
    expect(within(row).getByText(/in build/i)).toBeInTheDocument();
    expect(within(row).getByText(/\+1\.23/)).toBeInTheDocument();
  });
```

> Add `within`/`waitFor` to the test file's `@testing-library/react` import if not already present. Define `const TARGET_ID = h.skills[0].skillId;` and `const TARGET_NAME = h.skills[0].nameEn;` near the top of the `describe`, matching the catalog the hoisted mock builds.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/cm-planner/SkillChartPanel.test.tsx`
Expected: FAIL — the targeted skill is still simmed / has no "in build" badge.

- [ ] **Step 3: Write minimal implementation**

In `src/features/cm-planner/SkillChartPanel.tsx`:

(a) Exclude targeted reps from the ranked ids (the `ids` memo currently maps every rep):

```typescript
  const ids = useMemo(
    () => (hasSpeed ? reps.filter((s) => !isTargeted(s)).map((s) => s.skillId) : []),
    [reps, hasSpeed, plan.wishlist, skillById],
  );
```

> `isTargeted` is defined below `ids` today — move the `isTargeted` definition above the `ids` memo so it is in scope (it is a plain function of `plan.wishlist` + `skillById`, no other deps).

(b) Add `inBuild` to `RowView`:

```typescript
interface RowView {
  row: SkillChartRow;
  skill: SkillRecord;
  sp: number | null;
  eff: number | null;
  targeted: boolean;
  inBuild?: boolean;
}
```

(c) Synthesize in-build views and prepend them. Just before the existing `const views: RowView[] = rows` block, build the targeted views:

```typescript
  const inBuildViews: RowView[] = reps
    .filter((rep) => isTargeted(rep))
    .map((rep): RowView => {
      const item = plan.wishlist.find((it) => {
        const rec = wishlistSkillRecord(it.skillId, skillById);
        return rec ? areSkillVariants(rec, rep) : it.skillId === rep.skillId;
      });
      const L = item?.projectedL ?? null;
      const sp = sparkRates ? effectiveSpCost(rep, 0, sparkRates) : null;
      const eff = L != null && sp != null && sp > 0 ? (100 * L) / sp : null;
      const row: SkillChartRow = { skillId: rep.skillId, L, min: null, max: null, median: null, status: 'live', nsamples: 0 };
      return { row, skill: rep, sp, eff, targeted: true, inBuild: true };
    });
```

Then concat in-build views ahead of the ranked rows by changing `const views: RowView[] = rows` to map over `rows` into a local, and combine. Concretely, rename the existing computed list to `rankedViews` and add:

```typescript
  const views: RowView[] = [...inBuildViews, ...rankedViews]
    .filter((v) => {
      if (!showUpcoming && v.skill.server === 'jp') return false;
      if (!showAll && v.row.status === 'inactive') return false;
      if (!matchesFilter(v.skill.rarity, filter)) return false;
      if (q && !v.skill.nameEn.toLowerCase().includes(q)) return false;
      return true;
    })
    .sort((a, b) => {
      const av = rawMetric(a, sortMetric);
      const bv = rawMetric(b, sortMetric);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return sortDir === 'desc' ? bv - av : av - bv;
    });
```

…where `rankedViews` is the prior `rows.map(...).filter(non-null)` WITHOUT the trailing `.filter`/`.sort` (those now run on the combined list):

```typescript
  const rankedViews: RowView[] = rows
    .map((row): RowView | null => {
      const skill = skillById.get(row.skillId);
      if (!skill) return null;
      const sp = sparkRates ? effectiveSpCost(skill, 0, sparkRates) : null;
      const eff = row.L != null && sp != null && sp > 0 ? (100 * row.L) / sp : null;
      return { row, skill, sp, eff, targeted: isTargeted(skill) };
    })
    .filter((v): v is RowView => v !== null);
```

(d) Render the "in build" badge in the row. In the `views.map((v) => …)` row body, add the badge next to the L number — change the L `<span>` to include it:

```tsx
                      <span className={`cmp-uma-num ${sortMetric === 'L' ? 'is-sort' : ''}`.trim()}>
                        {v.inBuild && <span className="cmp-inbuild">in build</span>}
                        {v.row.status === 'na' ? 'n/a' : v.row.status === 'inactive' ? '—' : signed(v.row.L ?? 0)}
                      </span>
```

> The existing `+`/`✓` target button still works for in-build rows (they are `targeted`), so the user can un-target. Add `wishlistSkillRecord` + `areSkillVariants` to the existing `@/features/skill-planner/skillFamilies` import if not already present (the panel already imports `areSkillVariants`, `wishlistSkillRecord` from there).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/features/cm-planner/SkillChartPanel.test.tsx`
Expected: PASS (new in-build test + all existing — `basePlan` has an empty wishlist so `inBuildViews` is empty and the existing "called 4 times" / ordering assertions are unchanged).

- [ ] **Step 5: Add CSS**

In `src/features/cm-planner/skill-chart.css`, append:

```css
.cmp-inbuild {
  display: inline-block;
  margin-right: 0.4rem;
  padding: 0 0.35rem;
  font-size: 0.7rem;
  border-radius: 6px;
  border: 1px solid var(--accent, #5b8def);
  color: var(--accent, #5b8def);
  vertical-align: middle;
}
```

- [ ] **Step 6: Verify + commit**

Run: `pnpm vitest run src/features/cm-planner/SkillChartPanel.test.tsx` then `pnpm typecheck`
Expected: PASS / no type errors.

```bash
git add src/features/cm-planner/SkillChartPanel.tsx src/features/cm-planner/skill-chart.css src/features/cm-planner/SkillChartPanel.test.tsx
git commit -m "feat(m4): show already-targeted skills as non-simmed 'in build' rows

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Final verification (after all tasks)

- [ ] `pnpm typecheck` — no errors.
- [ ] `pnpm vitest run src/core/simBuild.test.ts src/sim/run.test.ts src/features/cm-planner/useStaminaWarnThreshold.test.ts src/features/cm-planner/useStaminaProbe.test.ts src/features/cm-planner/SkillChartPanel.test.tsx` — all green.
- [ ] `pnpm build` — typecheck + vite build succeed (race-free per CLAUDE.md).
- [ ] Manual sanity (optional, `pnpm dev`): on a stamina-short build the banner shows the survival %; targeting the gold recovery skill + Re-run clears the banner and raises the other gold skills' L; targeted skills appear as "in build" rows; the warn-% control persists across reload.

## Self-review notes (traceability to spec)

- Spec Piece 1 (wishlist baseline) → Tasks 1 (core), 2 (engine filter), 5 (wire).
- Spec Piece 2 (stamina banner, adjustable + persisted threshold) → Tasks 3 (threshold), 4 (probe), 5 (banner + control).
- Spec Piece 3 (in-build display) → Task 6.
- Robustness (non-simulatable / unknown baseline ids) → Task 2 (`simulatableBase`, with the engine-throws-on-unknown evidence).
- Backward-compat (empty wishlist == vacuum) → asserted in Tasks 1 and implicitly preserved by existing panel tests (empty `basePlan` wishlist).
- Non-goals (no `sim:build`, `planToSimBuild` untouched, sidebar velocity graphs unchanged, legacy page untouched) → respected; no task edits those.
