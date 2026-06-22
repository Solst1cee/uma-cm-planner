# M4 — Engine multi-fire / cooldown-aware skill activation (design)

**Status:** design / awaiting implementation
**Date:** 2026-06-22
**Module:** M4 (Skill Acquisition) — vendored sim engine (`src/sim/`, source `spikes/repos/umalator-global` @ v0.14.2 `c1fa210`)
**Supersedes/relates:** the multi-fire limitation tracked in GitHub issue #4 and the "first activation only" caveats in [docs/modules/module-4-skill-acquisition.md]; builds on the two-build race-compare overlay ([2026-06-20-m4-two-build-race-compare-track-overlay-design.md](2026-06-20-m4-two-build-race-compare-track-overlay-design.md)).

---

## 1. Problem

Some skills re-fire during a single race in the live game — e.g. **Professor of Curvature** (`all_corner_random==1`) fires twice on Hanshin 3200m. The vendored umalator engine does **not** model this: `AllCornerRandomPolicy.placeTriggers` computes up to four candidate corner triggers but `return`s only `triggers[0]`, with the comment `// TODO support multiple triggers for skills with cooldown`, and `runner.ts` fires exactly one trigger per skill per round. As a result `runComparison` (the race-compare overlay's data source) records a single activation per skill, so the on-track overlay can only ever draw one marker for a skill that really fires twice.

This is an **engine modelling gap**, not an app-side bug: the collector and overlay already render every distinct activation; the engine simply never produces a second one. Empirically confirmed (probe, Hanshin 3200m, course `10811`): the engine fires Prof exactly **once** per race (`{"1": 400}` over 400 samples with a correct single-copy deck); the "twice" seen earlier was a probe artifact from accidentally adding the skill to the deck twice.

## 2. Goal & non-goals

**Goal:** model cooldown-based re-activation so re-firing skills are simulated firing the correct, **per-course** number of times, and the race-compare overlay surfaces every fire — generally, so current and future short-cooldown skills are handled without per-skill code.

**Non-goals (explicitly out of scope for v1):**
- **Continuous-condition skills** (`infront_near_lane_time` / `behind_near_lane_time`: Slipstream, Playtime's Over!, See Ya Later!, No Stopping Me!, Nimble Navigator). They depend on live opponent lane positions re-evaluated each tick; `runComparison` runs each runner in a **vacuum** with no real opponents, so a faithful re-fire model isn't possible. **Deferred, not designed out** — the engine mechanism extends to them via a second recurrence source (§12); the blocker is faithfulness (the vacuum sim has no opponents), not the cooldown machinery.
- **Per-proc L attribution.** The engine measures only *total* バ身 (end-position difference). We will not fabricate a per-fire L breakdown (see §7).
- **Matching upstream v0.14.2 numbers when the feature is ON.** Multi-fire intentionally diverges; fidelity is preserved via the OFF fallback (§6).

## 3. Research findings (the basis for the model)

### 3.1 Which skills can multi-fire
`cooldownTime` is populated in the engine skill master (`src/modules/data/json/skills.json`). Its distribution:

| `cooldownTime` | meaning | # skills |
|---|---|---|
| `0` | passive/green (no activation cooldown) | 114 |
| `300000` | **30s base — short** | 19 |
| `5000000` | 500s base ≈ once-per-race | 445 |

A short cooldown is **necessary but not sufficient** — the *condition* must also recur. Of the 19 `cd=300000` skills:

- **Recurring, static course geometry (in scope):** `all_corner_random` ×6 (Prof of Curvature, Corner Adept ○/×, Corner Connoisseur, Corner Acceleration ○/×) and `straight_random` ×4 (Beeline Burst, Straightaway Adept, Rushing Gale!, Straightaway Acceleration). **10 skills.**
- **Recurring, continuous/opponent-relative (out of scope, §2):** near-lane ×5 (Slipstream, Playtime's Over!, See Ya Later!, No Stopping Me!, Nimble Navigator).
- **Single-occurrence condition → fires once *despite* the 30s cd:** Defeatist (`last_straight_random`), Reckless (`remain_distance==200`), It's On!/Ramp Up (`phase==1…onetime`). They have only one eligible window, so they fire once whether or not they fall in the eligible set (§5.2) — no per-skill handling required.

### 3.2 The cooldown mechanic
Confirmed against community documentation (two independent sources): **base cooldown is defined per 1000m and scales with race distance** — a 30s base becomes 60s at 2000m. Re-activation also requires a fresh **Wit check**, which the engine's firing loop already performs per activation.

```
effective_cooldown_seconds = (cooldownTime / 10000) × (raceDistance / 1000)
```

The `/10000` unit factor is consistent with `baseDuration` (`24000` → 2.4s); the engine's frame time (`accumulateTime.t`) is already in seconds (verified: ~166s for a 3200m run). The exact unit handling must mirror however the engine already converts `baseDuration`, and is pinned by the §8 spot-checks.

### 3.3 Per-course verification (model predicted by hand from real traces)
Using each course's real time-at-position trace + the formula, greedy "fire ASAP" ceiling:

| Course | Race time | Eff. cd | Straights → max fires | Corners → max fires |
|---|---|---|---|---|
| Mile 1600m | 75s | 48s | **1** | **1** |
| Medium 2000m | 95s | 60s | **2** | **1** |
| Long 2400m | 117s | 72s | **2** | **1** |
| Long 3200m | 166s | 96s | **2** | **2** (= Prof twice ✓) |

Confirms: the count is **per-course** (corners double on 3200m but not on this 2000/2400m course with clustered corners), the Hanshin-3200 anchor reproduces (corners = 2), and straights can double on long courses (justifying their inclusion). "Max fires" is a ceiling; the random first-fire position makes the real result a *distribution* (sometimes 1, sometimes 2) — which the dynamic model produces.

### 3.4 L is truncated at the finish (no over-crediting)
The engine is a per-frame physics sim; L is always the measured final position difference, never a flat per-proc value. Probe — forcing a proc at descending distances from the finish on Hanshin 3200m:

| Proc position | To finish | Mean L |
|---|---|---|
| 2850m | 350m | 0.029 |
| 3000m | 200m | 0.005 |
| 3100m+ | ≤100m | 0.000 |

L collapses to zero near the line. **Total L for a multi-fire skill is therefore automatically correct** — a late 2nd proc contributes only its truncated value; nothing sums per-proc amounts.

## 4. Approach

**Approach 2 — dynamic cooldown gate** (chosen over static distance-filtering). Cooldown is enforced during the race tick against **real sim time**, so no velocity estimate or calibration knob is needed. Flag-gated, default ON, with a byte-identical OFF fallback.

Structurally the feature is **two parts**: a *recurrence source* that yields a skill's repeat fire opportunities, and a *shared cooldown gate* that decides which of them actually fire. The gate is policy- and condition-agnostic; v1 ships one recurrence source (static course-geometry windows), and further sources (e.g. continuous opponent-relative conditions) plug into the same gate later without changing it (§12).

## 5. Design

### 5.1 The flag
Add `cooldownReactivation: boolean` to the engine's `SimulationSettings` (`src/lib/sunday-tools/common/race.ts`), defaulted `true` in `createCompareSettings` (`simulators/shared.ts`). Threaded through an `options.cooldownReactivation` override on the compare entrypoints (mirroring the existing `allowRushedUma1` etc.), so our adapter (`src/sim/run.ts`) owns the default and can flip it OFF for A/B and fidelity checks. **OFF ⇒ every path below short-circuits to today's exact behavior.**

### 5.2 Eligibility (blast-radius isolation)
A skill gets multi-fire handling iff **both**:
1. its sample policy is `AllCornerRandomPolicy` **or** `StraightRandomPolicy` (static course-geometry windows the vacuum sim knows exactly), **and**
2. `cooldownTime` is in the short class (`> 0 && < 5000000`).

With current data this is exactly the 10 skills in §3.1. Everything else (passive, once-per-race, continuous) is untouched **even when the flag is ON** — so the `cd=5000000` straight skills (Mile Straightaways, etc.) keep their exact current single-random-window behavior. Future short-cd corner/straight skills qualify automatically with no code change.

A condition that resolves to a **single** window (e.g. `last_straight_random`, which may share `StraightRandomPolicy`) surfaces one candidate and therefore fires once — eligibility is harmless for these; the per-course window count, not the eligibility flag, decides the fire count.

### 5.3 Mechanism — three engine touch points
1. **Policies surface candidates.** `AllCornerRandomPolicy` already places up to four ordered random-corner candidates per sample — add a method that returns the *full set* (keep the existing single-trigger method for OFF / ineligible skills). `StraightRandomPolicy` currently picks one random straight — add an analogous multi-candidate method (place a trigger per straight, preserving its existing per-straight randomness). The first-fire randomness of each policy is preserved as closely as possible; correctness is validated by §8, not by upstream parity.
2. **Runner emits one pending trigger per candidate.** In the trigger-consumption block (`runner.ts` ~L1822), when the skill is eligible and the flag is ON, emit one `pendingSkill` per candidate window (all sharing the skill id) instead of just `samples[round]`.
3. **Firing loop gates by real-time cooldown.** In `processSkillActivations` (`runner.ts` ~L548), add a per-round `skillLastFireTime: Map<skillId, number>`. When a pending trigger is about to activate (after position-in-window, `extraCondition`, and the existing Wit check), additionally require `currentTime − lastFire[skillId] ≥ effectiveCooldown`; if still cooling down, **suppress** the activation (consume the trigger without firing). On a successful fire, record `lastFire[skillId] = currentTime`. Triggers only fire when position reaches them, so they are processed in course order and the gate applies chronologically for free. Reset the map each round (`prepareRound`).

`effectiveCooldown` is computed from the skill's `cooldownTime` and `race.course.distance` per §3.2; `cooldownTime` must be threaded onto the per-skill trigger data (it lives on `SkillAlternative`).

### 5.4 Downstream — no change required
`reconcileActiveEffects` (`race-observer.ts`) already opens a fresh activation log each time an effect re-activates (distinct start position), and the app's `allActivationRegions` (`src/sim/run.ts`) groups by start and emits one `RaceActivation` per distinct start. So two fires ⇒ two logs ⇒ two overlay markers, with **zero app-side change**. Verifying this end-to-end (engine produces two logs → overlay draws two markers) is **implementation step 1**.

## 6. Fidelity & rollout
- Default **ON** (accuracy is the goal); the `cooldownReactivation` flag gives a byte-identical OFF fallback.
- **Fidelity gate:** with the flag OFF, `meanBashin` over the standard fixture must reproduce the validated baseline **0.2202** exactly (the OFF path is the untouched code). With the flag ON, the shift is measured and reported, not constrained.
- Blast radius is the 10 eligible skills only (§5.2); all other skills are identical in both flag states.

## 7. L semantics (what we will and won't show)
- **Total L / バ身-gap:** correct automatically — the whole-race sim integrates every proc and truncates at the finish (§3.4). The overlay's gap band and the skill-detail summary's total `meanL` need no change.
- **Per-fire L:** **not** available (engine measures only the total) and **not** faked. The overlay shows each fire's *position* as a marker; we do not label a marker with an individual L. This is the same "first activation only" boundary already documented for the skill-detail velocity chart, which remains out of scope here.

## 8. Validation & testing
- **Pure logic unit tests:** the `effectiveCooldown` formula and the cooldown-gate selection (given window entry-times + cd → fire set), as a pure helper.
- **Engine integration (node tests):** flag ON — Prof (`200331`) on Hanshin 3200m (`10811`) fires **2×**; on a mile course fires **1×**. Flag OFF — fires **1×** everywhere (today's behavior). A straight skill (e.g. Straightaway Adept `200362`) doubles on a long course, single on a mile — spot-checked against the §3.3 predictions.
- **Fidelity:** flag OFF reproduces `meanBashin` 0.2202.
- **In-game spot-check (owner):** confirm a handful of skill × course fire counts against the live game (cd-data + spot-check ground-truth chosen during design).
- **App-side:** `runRaceCompare` on a 2-fire build yields two `RaceActivation`s for the skill; the existing `RaceOverlay` test extended to assert two markers.

## 9. Build & integration
- Edit engine source under `spikes/repos/umalator-global`, then `pnpm sim:build` (regenerates `src/sim/vendor/umalator.bundle.mjs`).
- Widen `src/sim/vendor/umalator.bundle.d.mts` for the new `options.cooldownReactivation` field; thread it from `src/sim/run.ts` (default ON).
- **Working-directory note:** the engine source (`spikes/`) is gitignored and lives only in the primary checkout, so engine edits + `pnpm sim:build` happen there (or via a symlink into the feature worktree); the regenerated bundle + app-side changes are committed on the feature branch.

## 10. Risks & open questions
- **The firing loop is hot and shared by every skill.** The gate is additive and only branches for eligible + flag-ON skills, but this is where fidelity verification concentrates (the OFF-baseline gate in §6 is the backstop).
- **`baseDuration` distance-scaling:** confirm whether the engine already scales effect durations by distance, and apply the *same* convention to the cooldown so the unit handling is consistent (pinned by §8 spot-checks).
- **First-fire randomness under multi-candidate:** surfacing candidates changes which window the first fire lands on vs the single-pick path; acceptable because the feature intentionally changes eligible-skill behavior and is validated against in-game observation, but worth confirming the distribution looks sane (not always the earliest window).
- **`cooldownTime` plumbing:** verify `buildSkillData`'s per-skill trigger object carries (or can cheaply look up) `cooldownTime`.

## 11. Scope summary
**In:** `all_corner_random` + `straight_random` short-cd skills (10), dynamic cooldown gate, distance-scaled cooldown, flag-gated default-ON, overlay surfaces all fires (no app change), total-L correctness.
**Out (v1):** continuous near-lane skills (deferred but architecturally accommodated — §12), per-proc L attribution, skill-detail velocity-chart multi-fire, matching upstream numbers when ON.

## 12. Extensibility — future recurrence sources

The cooldown gate (§5.3 step 3) is the reusable primitive: policy- and condition-agnostic, it decides *which* of a skill's fire opportunities actually fire. v1 supplies opportunities from one **recurrence source** — static course-geometry windows (corner/straight policies). Other multi-fire skills are added by supplying a new recurrence source feeding the **same** gate, with no gate changes:

- **Continuous opponent-relative skills** (near-lane: Slipstream, Playtime's Over!, See Ya Later!, No Stopping Me!, Nimble Navigator). Mechanism: instead of consuming the pending trigger on fire, keep the skill **armed** and re-evaluate its `extraCondition` each tick, gated by the same distance-scaled cooldown — small, localized engine work. **The real blocker is faithfulness, not the mechanism:** `runComparison` runs each runner in a vacuum with no opponents, so `infront/behind_near_lane_time` can't be observed truthfully; enabling these needs opponent modelling (or a principled lane-proximity proxy) — a separate, larger effort. Until then they correctly remain single-fire.
- **Other future short-cd recurring conditions.** Any new condition whose recurrence the sim can observe (geometry- or self-state-based) slots in identically: add its recurrence source, reuse the gate. The §5.2 eligibility predicate is intended to grow, not a fixed list.

v1 is deliberately structured as the first of N recurrence sources behind one shared gate, so the deferred categories are an **additive** change rather than a redesign.
