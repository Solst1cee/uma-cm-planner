# Rebalance Patches 4b — Engine `skillPatches` + Horizon/Pin-Gated Sim Injection — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every M4 sim use the horizon-effective (or user-pinned) rebalance version's parameters — engine-level per-skill overrides (`skillPatches`), injected from the 4a version model, with an honest "post-patch values" marker wherever a patched result is shown.

**Architecture:** The vendored engine gains a `skillPatches?: Record<skillId, {conditions?, modifier?, duration?, cooldown?}>` runner field applied at skill construction (`buildSkillData`), exactly following the 2026-06-29 `skillLevels` precedent (identity backstop: absent ⇒ byte-identical). App-side, one pure core module (`src/core/rebalancePatches.ts`) turns `SkillRecord.rebalance` + `WishlistItem.skillVer` pins + the horizon's `cutoffISO/todayISO` into that map via 4a's `resolveVersion`/`versionPatch` seam; a small feature hook (`useSkillPatches`) computes it once per plan/horizon and every M4 sim-build construction attaches it. All sim cache/stale signatures learn about `skillPatches`. Slice spec: [2026-07-03-rebalance-patches-design.md](../specs/2026-07-03-rebalance-patches-design.md) §6–§8 (decisions D, F, H).

**Tech Stack:** TypeScript + React 19 + Vitest (jsdom + node), vendored umalator engine (esbuild bundle via `pnpm sim:build`), pnpm.

## Global Constraints

- **Branch/worktree:** all work on `feat/rebalance-patches-4b` in `.claude/worktrees/rebalance-4b` (already created; deps installed; `spikes` is a **junction** to the main repo's `spikes/` so `pnpm sim:build` works here).
- **Staging discipline:** stage ONLY the files your task names, by explicit path. NEVER `git add -A`, `git add .`, `git add -u`, `git commit -a`/`-am` **in the project repo**. (The gitignored scratch clone `spikes/repos/umalator-global` is exempt — Task 2 makes a local baseline commit there.)
- **Commit messages** end with:

  ```
  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
  ```

  Use `git commit -F -` with a heredoc (bash) so the trailer survives.
- **Identity backstop (spec §6):** with `skillPatches` absent, engine behavior is byte-identical to today. `pnpm vitest run src/sim/fidelity.test.ts` must pass UNCHANGED (meanBashin 0.2202 path) after the engine rebuild. This is non-negotiable — it gates the whole slice.
- **P3 honesty:** every surface that shows a sim result computed with a non-empty patch map must show the post-patch marker (Task 5). Predicted-only versions never inject at Current (already enforced by 4a's `effectiveVersion`; do not re-implement date logic — consume `resolveVersion`).
- **Keep the engine lazy:** UI modules import sim types from `@/sim/types` / client from `@/sim/client`, never the `@/sim` barrel.
- **Units (curated → engine):** `modifier` is the human/engine-effect unit (engine's post-`/10000` value; e.g. `0.25`); `duration` is seconds (replaces `baseDuration/10000`); `cooldown` is the base-cooldown unit `cooldownTime/10000` (the value the multifire gate scales by distance). `conditions` is the `'@'`-joined per-alternative condition-string format — the same serialization 4a's `detectCandidates`/`candidateConditions` uses.
- **Modifier limitation (documented, Task 6):** a patched `modifier` replaces the base value of **every** effect of the alternative. Curators must leave `modifier` unset for multi-effect skills — record this in `data-overrides/README.md`.
- Existing test gotchas apply: components calling `useAvailability()` need the static mock in jsdom tests (copy from `InheritancePage.test.tsx`); `useSkillTrace`/`useUniqueSkillL` must be stubbed in any test that mounts `PlannerSidebar`/`CmPlannerPage`; multi-render test files need `afterEach(cleanup)`.
- Do not commit anything under `scripts/borrowed/gametora/`. Do not touch generated `public/data/` in this slice (no data model change).
- Gates per task: the named test file(s) + `pnpm typecheck`. Full `pnpm test` + `pnpm build` at Task 6.

---

### Task 1: Core patch selection (`src/core/rebalancePatches.ts`)

**Files:**
- Create: `src/core/rebalancePatches.ts`
- Test: `src/core/rebalancePatches.test.ts`

**Interfaces:**
- Consumes (already on main from 4a): `resolveVersion(info, pinned, cutoffISO, todayISO)`, `versionPatch(v)`, `SkillPatch` from `src/core/rebalance.ts`; `SkillRecord.rebalance?: RebalanceInfo` and `WishlistItem.skillVer?: number` from `src/core/types.ts`; `wishlistSkillId(skillId, skillById)` from `@/features/skill-planner/skillFamilies` (core already imports from there — see `src/core/simBuild.ts:8`).
- Produces (used by Tasks 3–5):
  - `interface PatchCtx { skillById: ReadonlyMap<string, SkillRecord>; cutoffISO: string; todayISO: string; pins?: ReadonlyMap<string, number> }`
  - `wishlistPins(wishlist: readonly WishlistItem[], skillById): Map<string, number>`
  - `skillPatchMap(ctx: PatchCtx): Record<string, SkillPatch> | undefined` — **sorted keys**, `undefined` when empty
  - `withSkillPatches(build: SimBuild, patches: Record<string, SkillPatch> | undefined): SimBuild`
  - `skillPatchesSig(patches: Record<string, SkillPatch> | undefined): string`
  - `interface ActivePatchNote { skillId: string; name: string; ver: number; pinLag: boolean; predicted: boolean; arrival?: string; pinned: boolean }`
  - `activePatchNotes(ctx: PatchCtx): ActivePatchNote[]`

- [ ] **Step 1: Write the failing test**

```ts
// src/core/rebalancePatches.test.ts
import { describe, it, expect } from 'vitest';
import { wishlistPins, skillPatchMap, withSkillPatches, skillPatchesSig, activePatchNotes } from './rebalancePatches';
import type { RebalanceInfo, SkillRecord, WishlistItem } from './types';
import type { SimBuild } from '@/sim/types';

const TODAY = '2026-07-03';
const CM_CUTOFF = '2026-10-01';

function rec(skillId: string, rebalance?: RebalanceInfo): SkillRecord {
  return {
    skillId, nameEn: `Skill ${skillId}`, nameJp: skillId, baseSpCost: 100,
    rarity: 1, iconId: '1', conditions: 'phase>=1', server: 'global', dataVersion: 't',
    ...(rebalance ? { rebalance } : {}),
  } as SkillRecord;
}

// v2 announced + elapsed (live at Current), carries a modifier.
const CONFIRMED: RebalanceInfo = {
  globalVer: 2, jpVer: 2,
  versions: [
    { ver: 1 },
    { ver: 2, jpDate: '2025-01-01', globalDate: '2026-06-01', globalArrival: '2026-06-01', modifier: 0.5, sourceUrl: 'https://x' },
  ],
};
// v2 predicted, arrival between today and the CM cutoff (upcoming-only).
const PREDICTED: RebalanceInfo = {
  globalVer: 1, jpVer: 2,
  versions: [
    { ver: 1 },
    { ver: 2, jpDate: '2025-06-01', globalArrival: '2026-08-15', globalDatePredicted: true, conditions: 'corner==2', sourceUrl: 'https://x' },
  ],
};
// AUTO candidate — no parameterized versions, never patches.
const CANDIDATE: RebalanceInfo = {
  globalVer: 1, jpVer: 1, versions: [{ ver: 1 }],
  uncuratedCandidate: true, candidateConditions: { jp: 'a==1', global: 'b==1' },
};

function byId(...recs: SkillRecord[]): Map<string, SkillRecord> {
  return new Map(recs.map((r) => [r.skillId, r]));
}

describe('skillPatchMap', () => {
  it('returns undefined when nothing patches', () => {
    const skillById = byId(rec('100'), rec('200', CANDIDATE));
    expect(skillPatchMap({ skillById, cutoffISO: TODAY, todayISO: TODAY })).toBeUndefined();
  });

  it('pin-lag: a confirmed globalVer >= 2 patches even at Current', () => {
    const skillById = byId(rec('300', CONFIRMED));
    const map = skillPatchMap({ skillById, cutoffISO: TODAY, todayISO: TODAY });
    expect(map).toEqual({ '300': { modifier: 0.5 } });
  });

  it('predicted versions do not patch at Current but do at a CM cutoff past arrival', () => {
    const skillById = byId(rec('400', PREDICTED));
    expect(skillPatchMap({ skillById, cutoffISO: TODAY, todayISO: TODAY })).toBeUndefined();
    expect(skillPatchMap({ skillById, cutoffISO: CM_CUTOFF, todayISO: TODAY }))
      .toEqual({ '400': { conditions: 'corner==2' } });
  });

  it('a pin overrides the horizon default, even off-horizon', () => {
    const skillById = byId(rec('400', PREDICTED));
    const pins = new Map([['400', 2]]);
    expect(skillPatchMap({ skillById, cutoffISO: TODAY, todayISO: TODAY, pins }))
      .toEqual({ '400': { conditions: 'corner==2' } });
    // pin back to baseline suppresses the pin-lag patch
    const skillById2 = byId(rec('300', CONFIRMED));
    expect(skillPatchMap({ skillById: skillById2, cutoffISO: TODAY, todayISO: TODAY, pins: new Map([['300', 1]]) }))
      .toBeUndefined();
  });

  it('emits sorted keys so JSON.stringify is a stable signature', () => {
    const skillById = byId(rec('900', CONFIRMED), rec('100', CONFIRMED));
    const map = skillPatchMap({ skillById, cutoffISO: TODAY, todayISO: TODAY })!;
    expect(Object.keys(map)).toEqual(['100', '900']);
  });
});

describe('wishlistPins', () => {
  it('keys pins by the resolved engine skill id and skips unpinned items', () => {
    const skillById = byId(rec('500', CONFIRMED));
    const wl: WishlistItem[] = [
      { skillId: '500', priority: 3, source: 'targeted', skillVer: 2 },
      { skillId: '600', priority: 3, source: 'targeted' },
    ];
    const pins = wishlistPins(wl, skillById);
    expect(pins.get('500')).toBe(2);
    expect(pins.has('600')).toBe(false);
  });
});

describe('withSkillPatches / skillPatchesSig', () => {
  const build: SimBuild = {
    umaId: 'u', stats: { spd: 1, sta: 1, pow: 1, gut: 1, wit: 1 },
    strategy: 'pace', aptitudes: { distance: 'A', surface: 'A', strategy: 'A' }, skills: [],
  };
  it('attaches only when non-empty and never mutates', () => {
    expect(withSkillPatches(build, undefined)).toBe(build);
    const p = { '300': { modifier: 0.5 } };
    const out = withSkillPatches(build, p);
    expect(out.skillPatches).toEqual(p);
    expect(build.skillPatches).toBeUndefined();
  });
  it('sig is empty-string for undefined and stable for a map', () => {
    expect(skillPatchesSig(undefined)).toBe('');
    expect(skillPatchesSig({ '300': { modifier: 0.5 } })).toBe(skillPatchesSig({ '300': { modifier: 0.5 } }));
  });
});

describe('activePatchNotes', () => {
  it('labels pin-lag, predicted arrival, and pinned selections', () => {
    const skillById = byId(rec('300', CONFIRMED), rec('400', PREDICTED), rec('200', CANDIDATE));
    const atCm = activePatchNotes({ skillById, cutoffISO: CM_CUTOFF, todayISO: TODAY });
    expect(atCm).toEqual([
      { skillId: '300', name: 'Skill 300', ver: 2, pinLag: true, predicted: false, arrival: '2026-06-01', pinned: false },
      { skillId: '400', name: 'Skill 400', ver: 2, pinLag: false, predicted: true, arrival: '2026-08-15', pinned: false },
    ]);
    const pinnedNotes = activePatchNotes({ skillById: byId(rec('400', PREDICTED)), cutoffISO: TODAY, todayISO: TODAY, pins: new Map([['400', 2]]) });
    expect(pinnedNotes[0]!.pinned).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/core/rebalancePatches.test.ts`
Expected: FAIL — `Cannot find module './rebalancePatches'`.

- [ ] **Step 3: Write the implementation**

```ts
// src/core/rebalancePatches.ts
/** Availability #4b — build-facing rebalance patch selection (pure).
 *  Turns SkillRecord.rebalance + per-plan WishlistItem.skillVer pins + the
 *  horizon clock into the engine `skillPatches` map a sim build carries.
 *  All date logic lives in resolveVersion/effectiveVersion (4a) — this module
 *  only walks the catalog and shapes the result. */
import type { SkillRecord, WishlistItem } from './types';
import { effectiveVersion, resolveVersion, versionPatch, type SkillPatch } from './rebalance';
import type { SimBuild } from '@/sim/types';
import { wishlistSkillId } from '@/features/skill-planner/skillFamilies';

export interface PatchCtx {
  skillById: ReadonlyMap<string, SkillRecord>;
  cutoffISO: string;
  todayISO: string;
  /** Per-plan pins: resolved engine skill id -> pinned version (spec H). */
  pins?: ReadonlyMap<string, number>;
}

/** Resolve WishlistItem.skillVer pins to engine skill ids (family ids resolve
 *  the same way the charts/builds do). */
export function wishlistPins(
  wishlist: readonly WishlistItem[],
  skillById: ReadonlyMap<string, SkillRecord>,
): Map<string, number> {
  const pins = new Map<string, number>();
  for (const item of wishlist) {
    if (item.skillVer === undefined) continue;
    pins.set(wishlistSkillId(item.skillId, skillById), item.skillVer);
  }
  return pins;
}

/** Effective engine patches for every rebalance-annotated skill at this horizon.
 *  Keys are sorted so JSON.stringify(map) is a stable cache signature. Undefined
 *  when empty — the adapter then omits the field entirely, keeping the no-patch
 *  engine path byte-identical (spec §6 identity backstop). */
export function skillPatchMap(ctx: PatchCtx): Record<string, SkillPatch> | undefined {
  const entries: Array<[string, SkillPatch]> = [];
  for (const rec of ctx.skillById.values()) {
    const info = rec.rebalance;
    if (!info) continue;
    const v = resolveVersion(info, ctx.pins?.get(rec.skillId), ctx.cutoffISO, ctx.todayISO);
    const patch = versionPatch(v);
    if (patch) entries.push([rec.skillId, patch]);
  }
  if (entries.length === 0) return undefined;
  entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return Object.fromEntries(entries);
}

/** Attach a patch map to a build (no-op identity when there is nothing to attach). */
export function withSkillPatches(
  build: SimBuild,
  patches: Record<string, SkillPatch> | undefined,
): SimBuild {
  return patches ? { ...build, skillPatches: patches } : build;
}

/** Stable signature fragment for sim cache/stale keys (skillPatchMap emits sorted keys). */
export function skillPatchesSig(patches: Record<string, SkillPatch> | undefined): string {
  return patches ? JSON.stringify(patches) : '';
}

/** P3 marking data: which versions the current patch map represents. */
export interface ActivePatchNote {
  skillId: string;
  name: string;
  ver: number;
  /** Version is confirmed live on Global but the frozen engine data pin predates it (spec F). */
  pinLag: boolean;
  /** Arrival is a foresight projection (never live at Current unless pinned). */
  predicted: boolean;
  arrival?: string;
  /** A wishlist pin (not the horizon default) selected this version. */
  pinned: boolean;
}

export function activePatchNotes(ctx: PatchCtx): ActivePatchNote[] {
  const notes: ActivePatchNote[] = [];
  for (const rec of ctx.skillById.values()) {
    const info = rec.rebalance;
    if (!info) continue;
    const pin = ctx.pins?.get(rec.skillId);
    const v = resolveVersion(info, pin, ctx.cutoffISO, ctx.todayISO);
    if (!versionPatch(v)) continue;
    const def = effectiveVersion(info, ctx.cutoffISO, ctx.todayISO);
    notes.push({
      skillId: rec.skillId,
      name: rec.nameEn,
      ver: v.ver,
      pinLag: v.ver <= info.globalVer,
      predicted: v.globalDatePredicted === true,
      ...(v.globalArrival !== undefined ? { arrival: v.globalArrival } : {}),
      pinned: pin !== undefined && v.ver !== def.ver,
    });
  }
  notes.sort((a, b) => (a.skillId < b.skillId ? -1 : a.skillId > b.skillId ? 1 : 0));
  return notes;
}
```

Note: `SimBuild.skillPatches` does not exist until Task 2 — add a temporary structural cast ONLY if typecheck fails here, but prefer to run Task 1 and Task 2 in order and typecheck after both. If you implement strictly in order: add the `skillPatches?: Record<string, SkillPatch>;` field to `src/sim/types.ts` `SimBuild` **in this task** (one line, shown in Task 2 Step 5) so `withSkillPatches` typechecks; Task 2 then owns the engine side.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/core/rebalancePatches.test.ts`
Expected: PASS (all describes).

- [ ] **Step 5: Typecheck and commit**

Run: `pnpm typecheck`

```bash
git add src/core/rebalancePatches.ts src/core/rebalancePatches.test.ts src/sim/types.ts
git commit -F - <<'EOF'
feat(rebalance-4b): core patch selection — skillPatchMap/wishlistPins/activePatchNotes

Pure horizon+pin -> engine-patch-map layer over 4a's resolveVersion/versionPatch
seam. Sorted keys for stable cache sigs; undefined-when-empty preserves the
identity backstop.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
```

---

### Task 2: Engine `skillPatches` + sim-layer threading

**Files:**
- Modify (vendored clone — gitignored, reached via the `spikes` junction): `spikes/repos/umalator-global/src/lib/sunday-tools/common/runner.ts`, `spikes/repos/umalator-global/src/lib/sunday-tools/skills/parser/definitions.ts`, `spikes/repos/umalator-global/src/lib/sunday-tools/runner/runner.utils.ts`, `spikes/repos/umalator-global/src/modules/simulation/simulators/shared.ts`, `spikes/repos/umalator-global/src/modules/runners/components/runner-card/types.ts`
- Create: `engine-patches/2026-07-03-skill-patches.patch`
- Modify: `src/sim/types.ts` (SimBuild field, if not already added in Task 1), `src/sim/adapter.ts`, `src/sim/vendor/umalator.bundle.d.mts` (IRunnerState widening), `src/sim/vendor/umalator.bundle.mjs` (regenerated by `pnpm sim:build` — commit the regenerated file)
- Test: `src/sim/skillPatches.test.ts` (node env, mirrors `src/sim/skillLevel.test.ts`)

**Interfaces:**
- Consumes: engine `skillLevels` precedent (`engine-patches/2026-06-29-skill-level-scaling.patch` shows the exact threading spots).
- Produces: `SimBuild.skillPatches?: Record<string, SkillPatch>` honored by every engine entry (`evalSkillDelta`/`runVacuumCompare`/`runPlannerCompare`/`runSkillTrace`/`skillImpact`/`runRaceCompare` — they all go through `toRunnerState`).

- [ ] **Step 1: Baseline-commit the scratch clone** (makes the new patch file a clean `git diff`)

```bash
cd spikes/repos/umalator-global
git commit -a -m "local baseline: engine patches through 2026-06-29 applied (multifire, stamina-finalhp, skill-level)"
git log --oneline -2   # baseline commit on top of the v0.14.2 pin c1fa2107
cd -
```

(`-a` commits only modified tracked files; the untracked spike bundles stay untracked. This clone is scratch/gitignored — the project-repo staging rules don't apply to it.)

- [ ] **Step 2: Write the failing black-box test**

```ts
// src/sim/skillPatches.test.ts
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { evalSkillDelta } from './run';
import type { SimBuild, SimRaceParams } from './types';

// Shooting Star (Special Week unique) — proven to fire on 10906 (see skillLevel.test.ts).
// Its speed effect is type 27 with base modifier 0.35 (skill-level-coef provenance header).
const SKILL = '100011';
const base: SimBuild = {
  umaId: '100101',
  stats: { spd: 1400, sta: 1000, pow: 1100, gut: 600, wit: 1100 },
  strategy: 'pace',
  aptitudes: { distance: 'A', surface: 'A', strategy: 'A' },
  skills: [],
};
const race: SimRaceParams = { courseId: '10906', ground: 1, weather: 1, season: 1, time: 2, grade: 100 };

describe('engine skillPatches', () => {
  it('identity: absent, empty, and unrelated-skill patches are all byte-identical', () => {
    const plain = evalSkillDelta(base, race, SKILL, 100, 7);
    const empty = evalSkillDelta({ ...base, skillPatches: {} }, race, SKILL, 100, 7);
    const unrelated = evalSkillDelta({ ...base, skillPatches: { '999999': { modifier: 9 } } }, race, SKILL, 100, 7);
    expect(empty).toEqual(plain);
    expect(unrelated).toEqual(plain);
  });

  it('modifier override moves L (0.7 vs base 0.35 → strictly larger mean)', () => {
    const plain = evalSkillDelta(base, race, SKILL, 200, 1);
    const patched = evalSkillDelta({ ...base, skillPatches: { [SKILL]: { modifier: 0.7 } } }, race, SKILL, 200, 1);
    expect(patched.mean).toBeGreaterThan(plain.mean);
  });

  it('duration override moves L (double duration → strictly larger mean)', () => {
    const plain = evalSkillDelta(base, race, SKILL, 200, 1);
    const patched = evalSkillDelta({ ...base, skillPatches: { [SKILL]: { duration: 10 } } }, race, SKILL, 200, 1);
    expect(patched.mean).toBeGreaterThan(plain.mean);
  });

  it('conditions override changes activation (impossible condition → never fires)', () => {
    const patched = evalSkillDelta(
      { ...base, skillPatches: { [SKILL]: { conditions: 'distance_rate>=101' } } },
      race, SKILL, 100, 1,
    );
    expect(patched.activated).toBe(false);
    expect(patched.mean).toBeLessThan(0.05);
  });
});
```

(If the engine's condition parser rejects `distance_rate>=101`, use `accumulatetime>=99999` — the multifire work proved `accumulatetime` is a live token. Any always-false parseable condition is acceptable; keep the assertion `activated === false`.)

Run: `pnpm vitest run src/sim/skillPatches.test.ts`
Expected: FAIL — TypeScript rejects `skillPatches` on `SimBuild` (or, once typed, the engine ignores it and the modifier/duration/conditions tests fail).

- [ ] **Step 3: Type the app sim layer**

In `src/sim/types.ts`, add to `SimBuild` (after `skillLevels`) — skip if Task 1 already added it:

```ts
  /** Per-skill rebalance parameter overrides (availability #4b), keyed by master.mdb
   *  skill id. Absent/empty ⇒ the engine path is byte-identical to the unpatched
   *  upstream behavior (identity backstop). */
  skillPatches?: Record<string, import('@/core/rebalance').SkillPatch>;
```

In `src/sim/adapter.ts` `toRunnerState`, after the `skillLevels` spread (line 27):

```ts
    ...(build.skillPatches && Object.keys(build.skillPatches).length > 0
      ? { skillPatches: { ...build.skillPatches } }
      : {}),
```

In `src/sim/vendor/umalator.bundle.d.mts`, widen `IRunnerState` next to its `skillLevels` member:

```ts
  /** Per-skill parameter overrides (rebalance versions), keyed by base skill id. */
  skillPatches?: Record<string, { conditions?: string; modifier?: number; duration?: number; cooldown?: number }>;
```

- [ ] **Step 4: Edit the vendored engine (5 files, mirroring the skillLevels patch spots)**

Everywhere the 2026-06-29 patch added `skillLevels`, add the sibling field. The doc line for all five declaration sites:

```ts
  /** Per-skill parameter overrides (rebalance versions), keyed by base skill id. Absent => upstream values. */
  skillPatches?: Record<string, { conditions?: string; modifier?: number; duration?: number; cooldown?: number }>;
```

1. `src/lib/sunday-tools/common/runner.ts` — add the field to the `CreateRunner` type, the `RunnerProps` type, the `Runner` class (`public readonly skillPatches?: Readonly<Record<string, { conditions?: string; modifier?: number; duration?: number; cooldown?: number }>>;` + `this.skillPatches = props.skillPatches;` in the constructor next to `this.skillLevels = props.skillLevels;`), and the static `create()` pass-through (`skillPatches: props.skillPatches,` next to `skillLevels: props.skillLevels,`).
2. `src/lib/sunday-tools/skills/parser/definitions.ts` — add the field to `SkillEvalRunner` next to `skillLevels`.
3. `src/modules/simulation/simulators/shared.ts` — in `toCreateRunner`, add `skillPatches: runner.skillPatches,` next to `skillLevels: runner.skillLevels,`.
4. `src/modules/runners/components/runner-card/types.ts` — add the field to `IRunnerState` next to `skillLevels`.
5. `src/lib/sunday-tools/runner/runner.utils.ts` — apply the overrides:

`buildSkillEffects` gains a `patch` param (duration + modifier application):

```ts
export function buildSkillEffects(
  skill: SkillAlternative,
  level?: number,
  patch?: { modifier?: number; duration?: number }
) {
  const effects: Array<SkillEffect> = [];

  for (const effect of skill.effects) {
    const coef = skillLevelCoef(effect.type, level);
    // Rebalance override (availability 4b): patch.modifier is the human/engine
    // unit (post-/10000) and replaces the base value of EVERY effect of this
    // alternative — curators leave it unset for multi-effect skills. The level
    // coef still applies on top (the base modifier is the Lv1 value).
    const baseModifier = patch?.modifier !== undefined ? patch.modifier * 10000 : effect.modifier;
    effects.push({
      type: effect.type as ISkillType,
      baseDuration: patch?.duration !== undefined ? patch.duration : skill.baseDuration / 10000,
      modifier: (baseModifier * coef) / 10000,
      target: effect.target,
      valueUsage: effect.valueUsage,
      valueLevelUsage: effect.valueLevelUsage
    });
  }

  return effects;
}
```

In `buildSkillData`, right after `const level = runner.skillLevels?.[baseSkillId];`:

```ts
  // Rebalance patch (availability 4b): per-skill parameter overrides, keyed by base id.
  // conditions is the '@'-joined per-alternative format (same serialization as the
  // build-time JP-vs-Global diff): part i replaces the i-th NON-EMPTY-condition
  // alternative; missing parts leave later alternatives unchanged. Preconditions
  // are never patched.
  const patch = runner.skillPatches?.[baseSkillId];
  const patchedConditions = patch?.conditions !== undefined ? patch.conditions.split('@') : undefined;
```

Inside the alternatives loop, track the non-empty-condition index and use the (possibly patched) condition everywhere the original `skillAlternative.condition` was read — the parse AND the double-trigger regex test:

```ts
  let condIdx = -1;
  for (let i = 0; i < alternatives.length; ++i) {
    const skillAlternative = alternatives[i];

    if (skillAlternative.condition === '') {
      continue;
    }
    condIdx += 1;
    const condition = patchedConditions?.[condIdx] ?? skillAlternative.condition;
    // ... precondition block unchanged ...
    const parsedOperator = parser.parse(condition);
    // ...
    if (
      triggers.length > 0 &&
      !/is_activate_other_skill_detail|is_used_skill_id/.test(condition)
    ) {
      continue;
    }

    const effects = buildSkillEffects(skillAlternative, level, patch);
    // ...
        cooldownTime: patch?.cooldown !== undefined
          ? patch.cooldown * 10000
          : (skillAlternative.cooldownTime ?? 5000000)
```

And the never-activates fallback at the bottom of the function: `buildSkillEffects(alternatives[0], level, patch)`.

- [ ] **Step 5: Rebuild the bundle and generate the patch file**

```bash
pnpm sim:build
git -C spikes/repos/umalator-global diff > engine-patches/2026-07-03-skill-patches.patch
```

Inspect the patch file: it must contain ONLY the 4b hunks (the Step-1 baseline commit guarantees this).

- [ ] **Step 6: Run the new test + the fidelity gate**

Run: `pnpm vitest run src/sim/skillPatches.test.ts src/sim/fidelity.test.ts src/sim/skillLevel.test.ts`
Expected: ALL PASS — fidelity unchanged (0.2202 path), skillLevel unchanged, new patch behaviors verified.

- [ ] **Step 7: Typecheck and commit**

Run: `pnpm typecheck`

```bash
git add src/sim/types.ts src/sim/adapter.ts src/sim/skillPatches.test.ts src/sim/vendor/umalator.bundle.mjs src/sim/vendor/umalator.bundle.d.mts engine-patches/2026-07-03-skill-patches.patch
git commit -F - <<'EOF'
feat(rebalance-4b): engine skillPatches — per-skill condition/modifier/duration/cooldown overrides

skillLevels-precedent threading (CreateRunner/RunnerProps/Runner/SkillEvalRunner/
toCreateRunner/IRunnerState) applied at buildSkillData: '@'-split per-alternative
condition replacement, modifier (human units, level-coef composes), duration (s),
cooldown (base units x10000). Identity backstop verified: absent/empty/unrelated
patches are byte-identical; fidelity 0.2202 path unchanged. Engine source change
captured in engine-patches/2026-07-03-skill-patches.patch; bundle regenerated.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
```

---

### Task 3: Horizon/pin injection — the three skill charts

**Files:**
- Create: `src/features/cm-planner/useSkillPatches.ts`
- Modify: `src/features/cm-planner/SkillChartPanel.tsx` (~line 130), `src/features/cm-planner/AccelChartPanel.tsx` (~line 174), `src/features/cm-planner/UmaChartPanel.tsx` (~line 187 chartDeps), `src/features/cm-planner/useSkillRank.ts` (sigOf), `src/features/cm-planner/useUmaChart.ts` (sig + deps pass-through), `src/core/rankUmaChart.ts` (`RankUmaChartDeps.skillPatches` + rowFor build)
- Test: `src/features/cm-planner/useSkillPatches.test.tsx`, extend `src/core/rankUmaChart.test.ts`, extend `src/features/cm-planner/useSkillRank.test.ts` (or the panel test that covers sigOf staleness)

**Interfaces:**
- Consumes: Task 1's `skillPatchMap`/`wishlistPins`/`withSkillPatches`/`skillPatchesSig`; `useGameData().skillById`; `useAvailability().{cutoffISO,todayISO}`.
- Produces: `useSkillPatches(plan?: CmPlan | null): Record<string, SkillPatch> | undefined` (pins from `plan.wishlist` when a plan is given; pin-free horizon map when called with `null` — the uma chart's plan-independent mode); `RankUmaChartDeps.skillPatches?: Record<string, SkillPatch>`.

- [ ] **Step 1: Write the hook + failing test**

```tsx
// src/features/cm-planner/useSkillPatches.ts
/** Page-layer glue (availability #4b): the effective rebalance patch map for a
 *  plan at the current horizon. null plan => pin-free map (reference charts). */
import { useMemo } from 'react';
import type { CmPlan } from '@/core/types';
import type { SkillPatch } from '@/core/rebalance';
import { skillPatchMap, wishlistPins } from '@/core/rebalancePatches';
import { useGameData } from '@/features/data/gameData';
import { useAvailability } from '@/app/useAvailability';

export function useSkillPatches(plan?: CmPlan | null): Record<string, SkillPatch> | undefined {
  const { skillById } = useGameData();
  const { cutoffISO, todayISO } = useAvailability();
  const wishlist = plan?.wishlist;
  return useMemo(() => {
    const pins = wishlist ? wishlistPins(wishlist, skillById) : undefined;
    return skillPatchMap({ skillById, cutoffISO, todayISO, ...(pins ? { pins } : {}) });
  }, [skillById, cutoffISO, todayISO, wishlist]);
}
```

Test (`useSkillPatches.test.tsx`): render a probe component through `renderHook` (or a tiny harness component) with `vi.mock('@/features/data/gameData')` returning a `skillById` containing one confirmed-rebalance record (reuse Task 1's `CONFIRMED` fixture shape) and `vi.mock('@/app/useAvailability')` returning the static current-default mock (copy from `InheritancePage.test.tsx`, ensuring it includes `cutoffISO` and `todayISO`). Assert: (a) map contains the confirmed patch; (b) with a plan whose wishlist pins the skill to `ver 1`, the map is `undefined`.

Run: `pnpm vitest run src/features/cm-planner/useSkillPatches.test.tsx` — FAIL (module missing), then implement, then PASS.

- [ ] **Step 2: Wire the two acquirable charts**

`SkillChartPanel.tsx` (build memo at ~line 130) and `AccelChartPanel.tsx` (~line 174) — identical change:

```tsx
  const skillPatches = useSkillPatches(plan);
  const build = useMemo(
    () => withSkillPatches(chartBaselineBuild(plan, skillById), skillPatches),
    [plan, skillById, skillPatches],
  );
```

(`withSkillPatches` imported from `@/core/rebalancePatches`; the panels already import `useAvailability`/`useGameData`, and their tests already mock `useAvailability` — extend those mocks with `cutoffISO`/`todayISO` if absent.)

The tracked candidate a `skillDelta` row adds engine-side is covered automatically: patches are keyed by base skill id on the runner, so a patched candidate that is not in `build.skills` still patches when the engine constructs it.

- [ ] **Step 3: Make useSkillRank staleness patch-aware**

`src/features/cm-planner/useSkillRank.ts` `sigOf` — append the patches to the JSON array:

```ts
function sigOf(build: SimBuild, courseId: string, skillIds: string[], nsamples: number | undefined): string {
  // Includes build.skills so a baseline change (e.g. targeting a wishlist skill that isn't a
  // ranked candidate) still flips isStale — and build.skillPatches so a horizon/pin change does too.
  return JSON.stringify([courseId, build.strategy, build.stats, build.aptitudes, build.mood ?? null, build.skills, build.skillPatches ?? null, skillIds, nsamples ?? null]);
}
```

- [ ] **Step 4: Wire the uma chart**

`src/core/rankUmaChart.ts`: add to `RankUmaChartDeps`:

```ts
  /** Rebalance overrides attached to every reference build (availability #4b). */
  skillPatches?: Record<string, import('./rebalance').SkillPatch>;
```

In `rowFor`, extend the build construction:

```ts
      const build = {
        ...referenceBuild(c.outfitId, strategy),
        skillLevels: { [c.uniqueSkillId]: level },
        ...(deps.skillPatches ? { skillPatches: deps.skillPatches } : {}),
      };
```

`src/features/cm-planner/useUmaChart.ts`: pass `skillPatches: merged.skillPatches` through to `rankUmaChart`'s deps object and include `deps?.skillPatches ?? null` in the sig it hands `useStreamingRank` (read the file for the exact sig expression; the pattern matches Step 3).

`UmaChartPanel.tsx` (~line 180): `const skillPatches = useSkillPatches(null);` and add `skillPatches` to the `chartDeps` object it builds. (Pin-free by design: the uma chart is the plan-independent reference chart; wishlist pins are plan what-ifs.)

Extend `src/core/rankUmaChart.test.ts`: a fake `skillDelta` that records the builds it was called with; assert every build carries the injected `skillPatches` object when `deps.skillPatches` is set, and carries none when unset.

- [ ] **Step 5: Run the touched test files, typecheck, commit**

Run: `pnpm vitest run src/features/cm-planner/useSkillPatches.test.tsx src/core/rankUmaChart.test.ts src/features/cm-planner/SkillChartPanel.test.tsx src/features/cm-planner/AccelChartPanel.test.tsx src/features/cm-planner/UmaChartPanel.test.tsx && pnpm typecheck`
Expected: PASS.

```bash
git add src/features/cm-planner/useSkillPatches.ts src/features/cm-planner/useSkillPatches.test.tsx src/features/cm-planner/SkillChartPanel.tsx src/features/cm-planner/AccelChartPanel.tsx src/features/cm-planner/UmaChartPanel.tsx src/features/cm-planner/useSkillRank.ts src/features/cm-planner/useUmaChart.ts src/core/rankUmaChart.ts src/core/rankUmaChart.test.ts
git commit -F - <<'EOF'
feat(rebalance-4b): inject horizon/pin patches into the three skill charts

useSkillPatches (skillById x availability -> patch map, plan pins honored),
attached to chartBaselineBuild in Skill/Accel panels and to every rankUmaChart
reference build (pin-free); useSkillRank/useUmaChart staleness sigs are
patch-aware so a horizon or pin change prompts a re-run.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
```

(Also stage the panel test files if their `useAvailability` mocks needed the `cutoffISO`/`todayISO` fields added.)

---

### Task 4: Horizon/pin injection — traces, race compare, stamina, unique-L

**Files:**
- Modify: `src/features/cm-planner/PlannerSidebar.tsx` (traceCtx ~line 321 + `useUniqueSkillL` args ~line 329), `src/features/cm-planner/useUniqueSkillL.ts`, `src/features/cm-planner/useSkillTrace.ts` (sig line 83), `src/features/cm-planner/useRaceCompare.ts` (buildSig line 44), `src/features/cm-planner/useRaceCompareController.tsx`, `src/features/cm-planner/StaminaSpurtTab.tsx` (new prop + baseBuild ~line 184 + sig ~line 213), `src/features/cm-planner/CmPlannerPage.tsx` (pass the StaminaSpurtTab prop), plus every other `traceContext=`/`traceCtx` construction in `SkillChartPanel.tsx`/`AccelChartPanel.tsx`/`UmaChartPanel.tsx` (grep `traceContext` in those files — each constructed context's `build` gets `withSkillPatches(..., skillPatches)` using the panel's Task-3 map)
- Test: extend `src/features/cm-planner/useSkillTrace.test.ts`(x), `src/features/cm-planner/useRaceCompare.test.ts`(x), `src/features/cm-planner/useUniqueSkillL.test.ts`, `src/features/cm-planner/StaminaSpurtTab.test.tsx` (exact filenames may carry `.tsx` — check before writing)

**Interfaces:**
- Consumes: Task 1 helpers + Task 3's `useSkillPatches`.
- Produces: `UseUniqueSkillLArgs.skillPatches?: Record<string, SkillPatch>`; `StaminaSpurtTab` prop `skillPatches?: Record<string, SkillPatch>`; patch-aware cache sigs everywhere a `SimBuild` is a cache key.

- [ ] **Step 1: Patch-aware cache signatures (pure string changes, test-first)**

`useSkillTrace.ts` line 83 — append to the sig template:

```ts
  const sig = ctx ? `${skillId}|${ctx.race.courseId}|${ctx.build.umaId}|${ctx.build.strategy}|${ctx.build.stats.spd}/${ctx.build.stats.sta}/${ctx.build.stats.pow}/${ctx.build.stats.gut}/${ctx.build.stats.wit}|${[...ctx.build.skills].sort().join(',')}|${skillPatchesSig(ctx.build.skillPatches)}` : null;
```

`useRaceCompare.ts` `buildSig` — append `/${skillPatchesSig(b.skillPatches)}` to the returned template string. (Import `skillPatchesSig` from `@/core/rebalancePatches` in both files.)

Tests: in each hook's test file, add a case proving two contexts identical except `skillPatches` do NOT share a cache entry (the second run re-invokes the injected dep — the existing tests already inject fake deps; count invocations).

- [ ] **Step 2: useUniqueSkillL learns patches**

```ts
export interface UseUniqueSkillLArgs {
  outfitId: string;
  uniqueSkillId: string;
  strategy: Strategy;
  level: number;
  race: SimRaceParams;
  /** Rebalance overrides for the reference build (availability #4b). */
  skillPatches?: Record<string, SkillPatch>;
  deps: UniqueSkillLDeps;
}
```

- key: `` const key = `${outfitId}|${uniqueSkillId}|${strategy}|${level}|${race.courseId}|${skillPatchesSig(skillPatches)}`; ``
- build: `const build: SimBuild = { ...referenceBuild(outfitId, strategy), skillLevels: { [uniqueSkillId]: level }, ...(skillPatches ? { skillPatches } : {}) };`
- `PlannerSidebar.tsx` passes `skillPatches` (from its own `useSkillPatches(plan)` — pins-aware; add that hook call to the sidebar) into the `useUniqueSkillL` args, and wraps its traceCtx (line ~321): `build: withSkillPatches(planToSimBuild(plan), skillPatches)`.

- [ ] **Step 3: Race compare (mini-sim + overlay)**

`useRaceCompareController.tsx` — compute per-plan maps inside the hook (both plans' pins are independent):

```tsx
  const uma1Patches = useSkillPatches(uma1Plan);
  const uma2Patches = useSkillPatches(uma2Plan);
  const uma2 = uma2Plan ? withSkillPatches(planToOverlayBuild(uma2Plan), uma2Patches) : null;
  // ...ctx uma1:
      ? { uma1: withSkillPatches(planToOverlayBuild(uma1Plan), uma1Patches), uma2, race: { courseId } }
```

(`CmPlannerPage` tests already mock `@/app/useAvailability`; extend the mock object with `cutoffISO`/`todayISO` if the fields are missing.)

- [ ] **Step 4: Stamina tab (prop-injected — keeps its tests provider-free)**

`StaminaSpurtTab.tsx`:
- add prop `skillPatches?: Record<string, SkillPatch>;` to the props type,
- `baseBuild`: `() => withSkillPatches(planToOverlayBuild(plan), skillPatches)` and add `skillPatchesSig(skillPatches)` to the memo dep array,
- `sig` array (line ~213): append `skillPatches ?? null` as another element.

`CmPlannerPage.tsx`: where `<StaminaSpurtTab` is rendered, pass `skillPatches={workingPatches}` where `const workingPatches = useSkillPatches(focusedPlan ?? plan);` (match the plan object the page already hands the tab — read the render site and use the same variable).

- [ ] **Step 5: Trace contexts in the chart panels**

In `SkillChartPanel.tsx`/`AccelChartPanel.tsx`/`UmaChartPanel.tsx`, find every `traceContext=`/`traceCtx` object construction and wrap its `build` with the panel's existing patch map from Task 3 (`withSkillPatches(<existing build expr>, skillPatches)`). The disclosure's velocity/impact graphs then sim the same parameters the chart row ranked with.

- [ ] **Step 6: Run touched tests, typecheck, commit**

Run: `pnpm vitest run src/features/cm-planner/useSkillTrace.test.ts src/features/cm-planner/useRaceCompare.test.ts src/features/cm-planner/useUniqueSkillL.test.ts src/features/cm-planner/StaminaSpurtTab.test.tsx src/features/cm-planner/PlannerSidebar.test.tsx src/features/cm-planner/CmPlannerPage.test.tsx && pnpm typecheck`
Expected: PASS (fix any `useAvailability` mock objects missing `cutoffISO`/`todayISO`).

```bash
git add src/features/cm-planner/PlannerSidebar.tsx src/features/cm-planner/useUniqueSkillL.ts src/features/cm-planner/useSkillTrace.ts src/features/cm-planner/useRaceCompare.ts src/features/cm-planner/useRaceCompareController.tsx src/features/cm-planner/StaminaSpurtTab.tsx src/features/cm-planner/CmPlannerPage.tsx src/features/cm-planner/SkillChartPanel.tsx src/features/cm-planner/AccelChartPanel.tsx src/features/cm-planner/UmaChartPanel.tsx
git commit -F - <<'EOF'
feat(rebalance-4b): patches reach traces, race compare, stamina tab, unique-L

Per-plan pin-aware maps on both compare builds; prop-injected map for the
stamina tab; patch-aware LRU/stale sigs (useSkillTrace, useRaceCompare,
useUniqueSkillL key, stamina runSig) so horizon/pin flips never serve stale sims.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
```

(Also stage the test files you extended.)

---

### Task 5: "Post-patch values" marking (P3)

**Files:**
- Create: `src/features/cm-planner/PatchedSimNote.tsx`
- Modify: `src/features/cm-planner/SkillChartPanel.tsx`, `src/features/cm-planner/AccelChartPanel.tsx`, `src/features/cm-planner/UmaChartPanel.tsx`, `src/features/cm-planner/StaminaSpurtTab.tsx`, `src/features/cm-planner/MiniSimTab.tsx`, `src/features/cm-planner/PlannerSidebar.tsx` (pinned-copy string ~line 1000), `src/styles/cm-planner.css`
- Test: `src/features/cm-planner/PatchedSimNote.test.tsx`

**Interfaces:**
- Consumes: Task 1's `activePatchNotes`/`ActivePatchNote`; each surface's patch map (Tasks 3–4) to decide relevance.
- Produces: `PatchedSimNote({ notes }: { notes: ActivePatchNote[] })` — renders `null` for `[]`.

- [ ] **Step 1: Component + failing test**

```tsx
// src/features/cm-planner/PatchedSimNote.tsx
/** P3 marker (availability #4b): which rebalance versions a sim ran with.
 *  Renders nothing when no patch was active — the default, honest-silent state. */
import type { ActivePatchNote } from '@/core/rebalancePatches';

function label(n: ActivePatchNote): string {
  if (n.pinLag) return `Δ ${n.name}: simmed with v${n.ver} — confirmed patch, engine pin pending`;
  const arrival = n.arrival ? ` — arrives ${n.predicted ? '~' : ''}${n.arrival}` : '';
  return `Δ ${n.name}: simmed with v${n.ver}${n.pinned ? ' (pinned)' : ''}${arrival}`;
}

export function PatchedSimNote({ notes }: { notes: ActivePatchNote[] }) {
  if (notes.length === 0) return null;
  return (
    <div className="cmp-patched-note small" role="note">
      {notes.map((n) => (
        <span key={n.skillId} className="cmp-patched-chip">{label(n)}</span>
      ))}
    </div>
  );
}
```

Test cases: `[]` renders nothing; a pin-lag note carries "confirmed patch, engine pin pending"; a predicted note shows `~` before the arrival; a pinned note shows "(pinned)".

CSS (`cm-planner.css`, tokens only — amber family matching the 4a `Δ` badge):

```css
.cmp-patched-note { display: flex; flex-wrap: wrap; gap: 0.3rem; margin-top: 0.3rem; }
.cmp-patched-chip {
  border: 1px solid var(--warn-border, var(--border));
  background: var(--warn-bg, var(--bg-2));
  color: var(--warn-fg, var(--fg));
  border-radius: 999px;
  padding: 0.05rem 0.5rem;
}
```

(Check the actual 4a `.rebalance-badge` rule and reuse its exact token names for the amber family.)

- [ ] **Step 2: Per-surface placement (filter to the ids that surface actually sims)**

Each surface computes notes once and filters to relevance:

```tsx
  const patchNotes = useMemo(() => {
    const all = activePatchNotes({ skillById, cutoffISO, todayISO, ...(pins ? { pins } : {}) });
    return all.filter((n) => relevantIds.has(n.skillId));
  }, [skillById, cutoffISO, todayISO, pins, relevantIds]);
```

To avoid recomputing pins per surface, add a companion export to `useSkillPatches.ts` in this task:

```tsx
export function usePatchNotes(plan: CmPlan | null | undefined, relevantIds: ReadonlySet<string>): ActivePatchNote[] {
  const { skillById } = useGameData();
  const { cutoffISO, todayISO } = useAvailability();
  const wishlist = plan?.wishlist;
  return useMemo(() => {
    const pins = wishlist ? wishlistPins(wishlist, skillById) : undefined;
    return activePatchNotes({ skillById, cutoffISO, todayISO, ...(pins ? { pins } : {}) })
      .filter((n) => relevantIds.has(n.skillId));
  }, [skillById, cutoffISO, todayISO, wishlist, relevantIds]);
}
```

Placements (render `<PatchedSimNote notes={patchNotes} />`):
- `SkillChartPanel` / `AccelChartPanel`: under the chart status/caption row (next to the existing italic caption); `relevantIds` = the ranked candidate id set ∪ `build.skills`.
- `UmaChartPanel`: same spot; `relevantIds` = the candidates' `uniqueSkillId`s; plan = `null` (pin-free, matching Task 3).
- `StaminaSpurtTab`: under the run-status row; `relevantIds` = `new Set(baseBuild.skills)`. Since the tab is provider-free, pass `patchNotes` in as a prop `patchNotes?: ActivePatchNote[]` (default `[]`) computed in `CmPlannerPage` beside the Task-4 `skillPatches` prop — do NOT call the hooks inside the tab.
- `MiniSimTab`: beside the compare summary; `relevantIds` = union of both overlay builds' skills. Read `MiniSimTab.tsx` first: if it receives the controller's ctx, derive the id set from `ctx.uma1.skills`/`ctx.uma2.skills`; if it is provider-connected already, use `usePatchNotes` directly.
- `PlannerSidebar` pinned copy (~line 1000): change `` `Pinned — sims will use v${item.skillVer} parameters (arrives with 4b)` `` to `` `Pinned — sims use v${item.skillVer} parameters` ``. Grep the repo for any other `"arrives with 4b"`/`"with 4b"` copy and update it the same way.

- [ ] **Step 3: Run touched tests, typecheck, commit**

Run: `pnpm vitest run src/features/cm-planner/PatchedSimNote.test.tsx src/features/cm-planner/SkillChartPanel.test.tsx src/features/cm-planner/AccelChartPanel.test.tsx src/features/cm-planner/UmaChartPanel.test.tsx src/features/cm-planner/StaminaSpurtTab.test.tsx src/features/cm-planner/MiniSimTab.test.tsx src/features/cm-planner/PlannerSidebar.test.tsx && pnpm typecheck`
Expected: PASS.

```bash
git add src/features/cm-planner/PatchedSimNote.tsx src/features/cm-planner/PatchedSimNote.test.tsx src/features/cm-planner/useSkillPatches.ts src/features/cm-planner/SkillChartPanel.tsx src/features/cm-planner/AccelChartPanel.tsx src/features/cm-planner/UmaChartPanel.tsx src/features/cm-planner/StaminaSpurtTab.tsx src/features/cm-planner/MiniSimTab.tsx src/features/cm-planner/CmPlannerPage.tsx src/features/cm-planner/PlannerSidebar.tsx src/styles/cm-planner.css
git commit -F - <<'EOF'
feat(rebalance-4b): post-patch values marker on every patched sim surface

PatchedSimNote chips (pin-lag "confirmed patch, engine pin pending" / upcoming
"arrives ~date" / "(pinned)") on the three charts, stamina tab, and mini-sim,
filtered to the ids each surface actually sims; sidebar pinned copy updated
now that sims honor the pin.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
```

(Also stage extended test files.)

---

### Task 6: Orphan-skillId fail-loud guard + docs + full gates

**Files:**
- Modify: `scripts/lib/rebalances.ts` (`bakeRebalances`), `scripts/build-all.ts` (pass known ids), `data-overrides/README.md` (4b semantics notes), `docs/data-refresh-runbook.md` (§4 note that sims now consume versions)
- Test: `scripts/lib/rebalances.test.ts` (extend)

**Interfaces:**
- Consumes: existing `bakeRebalances({ candidates, curated, cal })` (read `scripts/lib/rebalances.ts` for the exact current signature) and its `scripts/build-all.ts` call site, where the full skill list is in scope.
- Produces: `bakeRebalances` accepts `knownSkillIds?: ReadonlySet<string>` and throws on a curated entry whose `skillId` is not in the set.

- [ ] **Step 1: Failing test**

Add to `scripts/lib/rebalances.test.ts` (match the file's existing fixture style):

```ts
it('throws on a curated skillId that matches no skill record (fail-loud, P5)', () => {
  const curated = [{ skillId: '999999', globalVer: 1, versions: [{ ver: 1 }] }];
  expect(() =>
    bakeRebalances({ candidates: [], curated, cal, knownSkillIds: new Set(['200012']) }),
  ).toThrowError(/999999/);
});

it('does not throw when knownSkillIds is omitted (back-compat) or the id exists', () => {
  const curated = [{ skillId: '200012', globalVer: 1, versions: [{ ver: 1 }] }];
  expect(() => bakeRebalances({ candidates: [], curated, cal })).not.toThrow();
  expect(() => bakeRebalances({ candidates: [], curated, cal, knownSkillIds: new Set(['200012']) })).not.toThrow();
});
```

Run: `pnpm vitest run scripts/lib/rebalances.test.ts` — FAIL (unknown option / no throw).

- [ ] **Step 2: Implement the guard**

In `bakeRebalances`, accept the optional `knownSkillIds?: ReadonlySet<string>`; before baking, validate:

```ts
  if (opts.knownSkillIds) {
    const orphans = curated.filter((e) => !opts.knownSkillIds!.has(e.skillId)).map((e) => e.skillId);
    if (orphans.length > 0) {
      throw new Error(
        `rebalances.json: curated skillId(s) match no skill record: ${orphans.join(', ')} — ` +
        'a typo here would silently drop the badge and sim patch (P5: fail loudly).',
      );
    }
  }
```

In `scripts/build-all.ts`, at the existing `bakeRebalances` call, pass `knownSkillIds: new Set(skills.map((s) => s.skillId))` (the variable holding the full merged skill list at that point — read the surrounding code and use the in-scope name).

Run: `pnpm vitest run scripts/lib/rebalances.test.ts` — PASS.

- [ ] **Step 3: Docs**

`data-overrides/README.md` — append to the `rebalances.json` schema section:

```markdown
### 4b sim semantics (engine `skillPatches`)

As of slice 4b the sims USE the effective version's parameters:

- `conditions` is the `'@'`-joined per-alternative format (the same
  serialization as `candidateConditions`): part *i* replaces the *i*-th
  non-empty-condition alternative; omitted parts leave later alternatives
  unchanged; preconditions are never patched.
- `modifier` is the human/engine effect unit (e.g. `0.25`) and replaces the
  base value of **every** effect of the alternative — per-effect overrides are
  not supported, so **leave `modifier` unset for multi-effect skills**.
- `duration` is seconds. `cooldown` is the base-cooldown unit
  (`cooldownTime/10000` — the value the multifire gate scales by distance).
- Version selection: `effectiveVersion` per horizon (predicted arrivals never
  activate at Current); a plan's `WishlistItem.skillVer` pin overrides it.
  Confirmed `globalVer ≥ 2` parameters apply even at Current ("engine pin
  pending" — the pin-lag path).
- A curated `skillId` that matches no skill record **fails the build**.
```

`docs/data-refresh-runbook.md` §4 ("Record a skill rebalance") — add one closing line: after confirmation + `pnpm data:build`, sims at Current immediately use the confirmed version's parameters (pin-lag path); no engine rebuild is needed — `skillPatches` is data-driven.

- [ ] **Step 4: Full gates and commit**

Run: `pnpm test` then `pnpm build`
Expected: full suite green (count grows from 1258), typecheck + vite build green.

```bash
git add scripts/lib/rebalances.ts scripts/lib/rebalances.test.ts scripts/build-all.ts data-overrides/README.md docs/data-refresh-runbook.md
git commit -F - <<'EOF'
feat(rebalance-4b): orphan curated-skillId fails the build + 4b curation semantics docs

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
```

---

## Out of scope (noted follow-ups)

- **M2 optimizer sims** (`rankBaskets`' `evalSkillDelta`/`runPlannerCompare` calls) do not attach patches — M2 already hard-gates `server:'jp'` wishlist skills (#29); when M2 learns the horizon it should route through `useAvailability()` + `useSkillPatches` in one pass.
- Per-effect `modifier` overrides (blocked on a richer curated schema; documented limitation instead).
- The skill-detail **Rebalance history** readout is 4a's and unchanged; a per-disclosure "this trace used v{N}" line can ride a later polish pass (the surface-level `PatchedSimNote` already covers the honesty requirement wherever results render).

## Self-review notes

- Spec coverage: §6 engine `skillPatches` = Task 2; §7 horizon-gated injection incl. pin-lag = Tasks 1, 3, 4 (pin-lag falls out of `resolveVersion`: confirmed `globalVer ≥ 2` versions carry `versionPatch` fields and are selected at Current); §8 marking = Task 5; decision H (pins in sims) = `wishlistPins` (Task 1) consumed at every plan-scoped surface; review-logged hardening (orphan skillId) = Task 6.
- Type consistency: `SkillPatch` is 4a's export from `src/core/rebalance.ts` and is the single shape used by core, sim types, adapter, engine, and deps everywhere above.
- Identity: `skillPatchMap` returns `undefined` when empty → `withSkillPatches` returns the same object → adapter omits the field → engine reads `undefined` → upstream path. Task 2's identity test + the untouched fidelity test pin it.
