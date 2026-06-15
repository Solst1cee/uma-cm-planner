# Module 4 — Skill Acquisition Planner

> **The detailed living doc for M4.** A session working on M4 should load this + the lean [CLAUDE.md](../../CLAUDE.md), not the whole repo. Full design rationale is in the spec; this doc is the **current build + how it fits together**.

- **Route:** `/` (the app's home page)
- **Status:** **Slice 1 shipped 2026-06-15** — engine-driven skill chart + runner config + sourcing.
- **Spec:** [docs/superpowers/specs/2026-06-14-m4-skill-acquisition-design.md](../superpowers/specs/2026-06-14-m4-skill-acquisition-design.md) — design locked; **§11 is the Slice 1 reconciled build scope** (read this for what's in/out).
- **Plan:** [docs/superpowers/plans/2026-06-15-m4-slice1-skill-chart.md](../superpowers/plans/2026-06-15-m4-slice1-skill-chart.md)
- **⚠️ Mockup = the visual spec:** [docs/mockups/m4-current.html](../mockups/m4-current.html) (committed — open in a browser). **Current fidelity ~25%** — the build ranks skills but lacks the design system, §0 track diagram, Uma chart, effect badges, left-panel runner/wishlist cards, skill-detail graphs, and the sourcing table. Build *to the mockup*; see CLAUDE.md → *Design fidelity* for the full gap (most of it needs no new data).

## Purpose & boundary

M4 is the **pre-run planner for the ideal build** — *"what should this build end up with, and is it reachable?"*. Discovery (what skills are worth targeting, ranked by real simulated length advantage) + sourcing (where to get them). **No SP constraint.**

It is **not** Module 2: M2 is the post-run, SP-limited min-max (pick the optimal affordable subset at a run's end). M4's L-ranking is the *discovery* engine; M2 does *purchase* optimization. See the [pipeline/boundary memory](../../CLAUDE.md) and spec §2.

The target skill list is an **output** of discovery, not an input — that's the core redesign vs. the old coverage-matrix UI this supersedes (spec §1).

## What's live (Slice 1)

2-column shell (`SkillAcquisitionPage`): a left **"Current Uma Plan"** sidebar mirrors the plan; the right column is the working area.

- **§1 Skill chart** — ranks the acquirable catalog (477 white/gold/inherited-unique skills, **Global only**) by **real simulated L** (length advantage / bashin) from the vendored engine. Streams top rows first, `0 L` vs `n/a` distinguished, gold ★ markers, base SP cost, search/rarity/"show every" filters, `+ target` to the wishlist, expandable row detail (conditions DSL + L mean/sample count).
- **Runner config** (left sidebar) — editable stats (spd/sta/pow/gut/wit), strategy, mood, and target aptitudes (distance/surface/strategy, default `A`).
- **§0 Race** — course summary + conditions (form only; **no track diagram** yet).
- **§3 Sourcing** — per wishlist skill, the support **cards that hint it** (tier/LB via coverage) + **⚠ gap** when none covers it.

## Architecture / file map

**Pure core (`src/core/`, unit-tested — P6):**
| File | Responsibility |
|---|---|
| [rankSkillChart.ts](../../src/core/rankSkillChart.ts) | Streaming L-rank orchestrator over the catalog (injectable sim dep). `DEAD_L=0.1`, `DISCOVERY_NSAMPLES=30`. Per-skill try/catch → `n/a`. Sorts L desc, `n/a` last. |
| [simBuild.ts](../../src/core/simBuild.ts) | `planToSimBuild(plan)` / `simAptitudes(plan)` — `CmPlan` → engine `SimBuild` (raw stats + strategy + aptitudes from `sparkGoals.pink`). |
| [skillCatalog.ts](../../src/core/skillCatalog.ts) | `acquirableSkills(skills, server)` — white/gold/inherited-unique on the matching server (excludes `unique` + JP). |
| [sourcing.ts](../../src/core/sourcing.ts) | Card-hint reverse index + per-skill `sourcingForSkill` join (reuses `coverage.ts` tiering). |
| [cost.ts](../../src/core/cost.ts) (shared) | `effectiveSpCost(skill, level, sparkRates)`. |

**Feature layer (`src/features/skill-acq/`, thin renderers):**
| File | Responsibility |
|---|---|
| [SkillAcquisitionPage.tsx](../../src/features/skill-acq/SkillAcquisitionPage.tsx) | 2-col shell; guards load/error. |
| [SkillChartPanel.tsx](../../src/features/skill-acq/SkillChartPanel.tsx) | §1 chart UI + filters; guards `spd > 0` before simming. |
| [useSkillChart.ts](../../src/features/skill-acq/useSkillChart.ts) | Hook driving `rankSkillChart` via the `SimClient` worker; streams rows; cancels on input change. |
| [RunnerConfigPanel.tsx](../../src/features/skill-acq/RunnerConfigPanel.tsx) | Stat/strategy/mood/aptitude editors (writes `sparkGoals.pink` via `setTargetAptitude`). |
| [SourcingPanel.tsx](../../src/features/skill-acq/SourcingPanel.tsx) | §3 card-hint chips + gap. |

Reused: `PlanHeaderPanel`/`SkillPicker` (from `skill-planner/`), `useActivePlan`, `useGameData`, `src/sim` (`SimClient`/`evalSkillDelta`/`makeDeltaCache`).

**Data flow:** `CmPlan` → `planToSimBuild` → `useSkillChart` → `SimClient` worker → `evalSkillDelta` (with-vs-without race on one seed) → streamed `SkillChartRow[]` → `SkillChartPanel`.

## Key mechanics & decisions

- **L = `evalSkillDelta(build, race, skillId, nsamples, seed?)`** — runs the race with vs. without the skill on the same seed; `bashin = Δposition / 2.5m`, averaged over Monte-Carlo samples. Returns `BashinStats {mean, median, min, max, nsamples, results}`.
- **`DISCOVERY_NSAMPLES = 30`** — discovery trades precision for speed. Measured: 200 samples ≈ 3.3 min for the full chart; 30 ≈ 36 s with top rows streaming in ~1–2 s. (M2 sets its own higher count for precision.) TODO(1b): progressive refine of the surviving top-N.
- **`0 L` vs `n/a` (P3)** — `nsamples === 0` ⇒ the engine **can't** evaluate it → `n/a` (never a misleading `0 L`). `mean ≤ DEAD_L (0.1)` ⇒ `zero`. Both addable when "show every skill" is on.
- **Default stats seeded** — `makeDefaultPlan` seeds `spd 1000 / sta 600 / pow 600 / gut 400 / wit 400`. The engine **throws `firstPositionInLateRace` on a 0-speed runner**; the chart also guards `spd > 0` and shows a "enter your stats" prompt otherwise.
- **Aptitudes** read from `sparkGoals.pink` (default `A`), not `statProfile`.
- **Course geometry is embedded in the engine bundle** — `resolveCourse(courseId)` needs no external `course_data.json` for the sim.

## Deferred (Slice 1b+) — each gated on a named data dependency

| Deferred | Blocked on |
|---|---|
| Effect-summary badges + duration + L-vs-distance / speed graphs | `SkillRecord` lacks effect-type & duration; the engine has it (`SkillType`/`baseDuration`) but it's unsurfaced — needs a build-time extraction from the bundle's `skillsService`. |
| §1 **Uma chart** + "usable here" filter + §3 **uma-innate column** | `umas.json` has no base stats / aptitude letters / innate skills / unique id — needs a master.mdb/umalator sourcing task. |
| §0 race-track diagram (SVG activation zones) | Engine `CourseData` has geometry; rendering is later-milestone work. |
| §5.2 stat-target auto-seed (`cm_stat_targets.json`) | User hand-enters stats for now. |
| Now / Upcoming / Future availability toggle | Needs per-record release dates (shared with M3). "Now" only for the slice. |
| Debuffer-specific L | Self-L with caveat (Ace/Hybrid honest) for now — spec §5.1. |

**Slice 1b is the natural next M4 step** and is gated primarily on sourcing uma stats/aptitudes/innate-skills + skill effect/duration data into the datasets.

## Gotchas (M4-specific)

- **0-speed runner throws** `firstPositionInLateRace` — never feed `evalSkillDelta` an all-zero build. `makeDefaultPlan` seeds non-zero stats; the chart guards `spd > 0`.
- **Pre-fix plans show the "enter stats" prompt** — any plan created before the default-stats seed has all-zero stats, so `/` shows *"Enter your runner's stats (Speed is required)"* instead of ranking. Fix: enter stats in the Runner panel, or create a new plan.
- **Old coverage UI removed (2026-06-15)** — the pre-engine `SkillPlannerPage` + `src/features/coverage/` + `src/features/inventory/` clusters (+ the `iconRetrofit` integration test that only exercised them) were deleted once the engine chart replaced them. `PlanHeaderPanel`/`SkillPicker` stayed (shared by the new page). Recover the coverage-matrix/inventory pattern from git history if Slice 1b needs it.

## Honest numbers (P3)

L is a **streaming estimate, not a verdict** — show "refining N/M samples" + an RNG caveat; never present `n/a` as `0 L`; JP-ahead skills are excluded from the Now chart (P4). Validate a few values vs VFalator before trusting (record in [docs/mechanics-notes.md](../mechanics-notes.md)).
