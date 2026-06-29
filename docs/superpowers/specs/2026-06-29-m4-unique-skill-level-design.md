# M4 — Unique-skill level (Lv1–6) control + level-aware sim

**Status:** design • **Date:** 2026-06-29 • **Module:** M4 (Skill Acquisition Planner) • **Route:** `/` (CM planner sidebar)

## 1. Goal

Let the user set the **level (Lv1–6)** of a plan's unique skill and have that level **actually scale the unique skill's effect** everywhere it's simulated — the unique-skill chart, the mini-sim, and any future full-sim. Surface it on the unique-skill plate in the planner sidebar as a `−/Lv N/+` stepper plus the projected `+L` (バ身) gain, matching the in-game "value on the right of the plate" affordance.

Today the engine simulates **every** skill at its base (Lv1) value and has no level concept at all. This feature adds honest, datamined per-level scaling.

## 2. Decisions (locked in brainstorming)

- **Accuracy:** real datamined values (not an approximation). Numbers must be honest (P3).
- **Range:** Lv1–6 (in-game cap). **Default 5** for user plans; legacy plans without the field are treated as Lv5 in the app.
- **Plate layout:** stepper first, then `+L` → `⟨ − Lv5 + ⟩ +3.95`. Transparent container + 1px border.
- **`+L` recompute triggers:** **strategy change, level change, course change** only — *not* on the plan's stat / mood / wishlist edits. Rationale: the `+L` must **match the unique-skill chart**, which uses a fixed reference build; tying it to the plan's live stats would diverge from the chart.
- **Reuse verdict:** author the scaling ourselves. No community tool (uma-skill-tools, kachi-uma-tools, umalator-global, TheCing, …) applies level→modifier scaling at sim time; `skill_level` in the share format is always discarded. Patching our vendored engine is acceptable and is the established pattern (cf. `engine-patches/2026-06-22-multifire.patch`).

## 3. The scaling formula & provenance

```
effective_modifier(ability_type, level) = base_modifier × coef(ability_type, level) / 10000
```

- `coef` comes from master.mdb's `skill_level_value(id, ability_type, level, float_ability_value_coef)`, keyed by **`(ability_type, level)`** (not per-skill). `coef(_, 1) = 10000` (×1.0) for every type; it scales **up** for higher levels. Uniques cap at **Lv6**.
- **Duration is not scaled** by level (only the magnitude `modifier`).
- Worked example — **Shooting Star** (skill `100011`, Special Week's unique):

  | Effect | ability_type | Base (Lv1) | coef Lv6 | Lv6 value | engine units (÷1e4) Lv1→Lv6 |
  |---|---|---|---|---|---|
  | Speed | 27 (TargetSpeed) | 3500 | 11300 | 3955 | +0.3500 → **+0.3955 m/s** |
  | Accel | 31 (Accel) | 1000 | 11000 | 1100 | +0.1000 → **+0.1100 m/s²** |

- **Provenance to record** (`docs/provenance.md`): schema from master.mdb `skill_level_value` (verbatim in `spikes/repos/umamusu-utils/misc/queries.txt:40,75,101`); behavior corroborated by umareference.com unique-skills guide (recovery +2%/level; others +1% first level then +3%/level → exactly `coef/10000`).

### 3.1 Verification guard (avoid double-scaling)

The engine's embedded modifier **must be the Lv1 base** (e.g. Shooting Star = 3500, matching `scripts/borrowed/skills.json`). The implementation includes an assertion/spot-check that the embedded base equals the Lv1 value so multiplying by `coef(level)/10000` is a pure up-scale, never a double-count. If any skill's embedded value turns out to be a higher level, document and adjust before shipping.

## 4. Architecture

Data flow (new pieces **bold**):

```
CmPlan.uniqueSkillLevel (1–6)
  → SimBuild.skillLevels { [skillId]: level }        (app: src/sim, src/core/simBuild)
    → adapter → IRunnerState.skillLevels             (engine boundary)
      → [ENGINE PATCH] effect builder multiplies modifier by coef(ability_type, level)/10000
        using the baked coef table; absent level ⇒ Lv1 ⇒ unchanged (fidelity backstop)
```

### 4.1 Coef table asset (engine-side)

- Extract `skill_level_value` from master.mdb into a compact constant keyed by `ability_type → level → coef`, generated during patch prep and embedded in the **vendored engine source** (it must be available at engine runtime, like the multifire logic). Small (~241 rows / ≤10 types we care about). Levels 1–6 retained (7–10 exist for inherited/support edge cases; out of scope, retained harmlessly).
- This is generated game data; record the generator command in the patch notes / provenance.

### 4.2 Engine patch

- Extend the runner state with optional per-skill levels: `skillLevels?: { [skillId: string]: number }` (generic map; future-proofs evolved skills). Widen `src/sim/vendor/umalator.bundle.d.mts` accordingly.
- At the point where a skill's effects are constructed from skill data (effect-builder / `RaceSolverBuilder.addSkill` path — **not** inside the hot `RaceSolver` loop), if the runner specifies a level for that skill and the effect's `ability_value_level_usage` flag is set, multiply that effect's `modifier` by `coef(ability_type, level)/10000`.
- **Default behavior unchanged:** no `skillLevels` entry (or level 1) ⇒ coef 1.0 ⇒ byte-identical to upstream. This preserves the fidelity backstop.
- Capture as `engine-patches/2026-06-29-skill-level-scaling.patch`; rebuild via `pnpm sim:build`; commit the regenerated bundle. (Engine source is the gitignored vendored clone, per existing workflow.)

### 4.3 App types & plumbing

- `CmPlan.uniqueSkillLevel?: 1|2|3|4|5|6` in `src/core/types.ts`. **No Dexie bump** — non-indexed optional field (Dexie versions only index changes). `makeDefaultPlan` seeds `5`. Reads use `plan.uniqueSkillLevel ?? 5` (legacy plans → Lv5).
- `SimBuild.skillLevels?: Record<string, number>` (`src/sim/types.ts`); `toRunnerState` maps it into the runner state (`src/sim/adapter.ts`).
- `planToOverlayBuild` (`src/core/simBuild.ts`) sets `skillLevels: { [plan.uniqueSkillId]: plan.uniqueSkillLevel ?? 5 }`. All engine entrypoints that build runners (`evalSkillDelta`, `runVacuumCompare`, `runRaceCompare`, `runSkillTrace`, `skillImpact`) thread `skillLevels` through unchanged. `simulatableBase` preserves it (dropping unknown ids as today).

### 4.4 Unique-skill chart parity

- `rankUmaChart` / `useUmaChart` become **level-aware**: the `skillDelta(referenceBuild, …, uniqueSkillId)` call passes `skillLevels: { [uniqueSkillId]: level }` where `level = plan.uniqueSkillLevel ?? 5`, applied to **all rows** (one level governs the whole chart). The `referenceBuild` reference stats/mood/aptitudes are otherwise unchanged. LRU sig gains `level`.
- Result: the current uma's chart row equals the plate's `+L` by construction.

### 4.5 Plate `+L` value + recompute

- A small hook `useUniqueSkillL(uma, strategy, level, course)` reuses the chart's single-uma ranking (reference build) and returns the projected バ身 for the current uma. Memoized; recomputes only when `(uma, strategy, level, course)` change — **not** on stat/mood/wishlist edits (satisfies §2).
- Runs through the existing worker/`SimClient` path like the chart (async; shows nothing / a dash until first result).

### 4.6 Plate UI

- In `PlannerSidebar.tsx`, the unique `SkillDetailDisclosure` gains a `side` node:
  `⟨ − Lv N + ⟩  +X.XX` — the stepper (transparent bg, 1px border, `Lv N` between `−`/`+`, clamped 1–6) followed by the `+L` span (same `.L` styling wishlist skills use).
- Buttons `stopPropagation` so they don't toggle the disclosure. Changing level calls the plan's edit path (`onChange`/`editPlan`), persisting via the normal autosave.
- New CSS in `cm-planner.css` for the stepper (`.cmp-skill-level-stepper` etc.): transparent container + border, sized to sit in `cmp-skill-summary-side`.

## 5. Components & boundaries

| Unit | Responsibility | Depends on |
|---|---|---|
| coef-table asset | static `(ability_type, level)→coef` lookup | master.mdb (build-time) |
| engine effect-builder patch | scale modifier by coef when level given | coef table, runner state `skillLevels` |
| `SimBuild.skillLevels` + adapter | carry level across the engine boundary | engine `.d.mts` |
| `planToOverlayBuild` | derive `skillLevels` from the plan | `CmPlan.uniqueSkillLevel` |
| `rankUmaChart` (level-aware) | chart parity with the plate | `skillDelta` w/ levels |
| `useUniqueSkillL` | plate `+L` for current uma | chart ranking logic, SimClient |
| plate stepper UI | edit level, show `+L` | `useUniqueSkillL`, plan edit path |

## 6. Testing

- **Core/coef:** `coef(27,1)=10000`, `coef(27,6)=11300`; `effective_modifier` for Shooting Star: Lv1 speed=3500/accel=1000, Lv6 speed=3955/accel=1100 (cited fixtures).
- **Engine:** a Lv6 unique yields strictly larger バ身 than Lv1 on a course where it fires; **absent-level path is byte-identical** to pre-patch (fidelity). `fidelity.test.ts` pins Lv1 (no `skillLevels`) and keeps meanBashin 0.2202 on the `cooldownReactivation:false` path.
- **Double-scaling guard:** assert embedded base modifier == Lv1 value for a sampled unique.
- **Plumbing:** `planToOverlayBuild` emits `skillLevels` with `?? 5`; `simulatableBase` preserves levels and still drops unknown ids.
- **Chart parity:** chart row L for the current uma == `useUniqueSkillL` output for same (uma, strategy, level, course).
- **UI:** stepper clamps 1–6, writes `plan.uniqueSkillLevel`, `stopPropagation` (disclosure stays toggled as-is), `+L` recompute fires on strategy/level/course and NOT on stat/wishlist edits.

## 7. Out of scope

- Levels for white/gold/wishlist skills (fixed-value in-game; the generic `skillLevels` map supports them later but no UI).
- Levels 7–10 (inherited/support edge cases).
- Duration scaling by level (game does not scale duration).
- Velocity-window chart multi-level overlay (the velocity chart's first-activation limitation is pre-existing and unchanged).

## 8. Risks / open items

- **Double-scaling** if any embedded modifier isn't Lv1 — mitigated by §3.1 guard.
- **Bundle rebuild** required (`pnpm sim:build`); engine source is the gitignored vendored clone — follow the multifire workflow (edit clone → apply/refresh patch → rebuild → commit bundle).
- **Recovery skills** scale at a different rate (+2%/level) — but that's already encoded per-`ability_type` in the coef table, so no special-casing needed; just verify a recovery unique against the table.
