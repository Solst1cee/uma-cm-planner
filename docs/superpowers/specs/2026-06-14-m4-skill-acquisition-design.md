# Module 4 — Skill Acquisition Planner: Design Spec

**Status:** APPROVED — M4 design locked (2026-06-14) · **Owner:** Sun · *(implementation plan via writing-plans deferred until M3/M1/M2 are brainstormed)*
**Origin:** Brainstorm (superpowers:brainstorming) replacing the target-centric coverage matrix shipped in Phases 0–2.
**Supersedes:** the existing M4 coverage-matrix UI (target rows × owned-card columns), which never showed what a card offers and assumed the target list as an *input*.

---

## 1. Why this redesign

The shipped M4 starts in the *middle* of how Sun actually plans. Sun's real Champions Meeting (CM) pipeline (see memory `uma-planning-pipeline-and-module-boundaries`):

1. **Track → VFalator** → find unique skills + skill sets with high **L** (length advantage / bashin) on this track.
2. Pick the **uma** — deciding whether its unique is needed *as the runner* (full power) or whether the *inherited* (weaker) version suffices.
3. Pick the **strategy** (run-style) — gated by which skills give L here AND whether the build can hit the scenario's stat thresholds.
4. Build fixed → derive the shopping list: unique + **inherited skills** (→ parents) + **skill sparks** (→ cards/parents).
5. Hunt **parents** meeting the track's stat-threshold spark totals.
6. Build the **support deck** around the parents.
7. Meta is **timeline-bound** (balance patches + releases; Global's big patch landed earlier than JP/TW).

**Key consequence:** the target skill list is an **output of steps 1–3, not an input.** The redesigned M4 owns steps 1–4 of this pipeline and produces a **named, shareable plan** that Modules 1/2/3 extend.

The trigger complaint — *"when I select a support card it should at least show what skills this card contains"* — is the smallest symptom of this: card-first discovery and L-driven discovery were both missing.

---

## 2. Scope & boundaries

**M4 IS:** the **pre-run planner for the ideal build.** It answers *"what should this build end up with, and is it reachable?"* — discovery (what's worth targeting, where to get it) + coverage (is my deck/inheritance enough). **No SP constraint.**

**M4 IS NOT** Module 2. M2 = the **post-run, real-life SP-limited min-max** (at a run's end you can usually buy more skills than you have SP for; M2 picks the optimal subset). The L-ranking here is the *discovery* engine, distinct from M2's purchase optimization.

**Build sequencing decision (Sun, 2026-06-14): ENGINE-FIRST.** Vendor the umalator simulation engine into `src/sim/` first, then build the full §0–§3 flow on top of it. The engine is shared foundation for M1/M2/M3, so it is never throwaway.

**Inheritance (decided earlier):** §3 sourcing uses support-card **hints** now (fully buildable) plus a **manual stopgap** for "skills I'll inherit / sparks I'll have." Module 1 later replaces the manual input with real parent data.

---

## 3. The Plan model (cross-module SSOT)

A **plan** is the cross-module single source of truth — the architecture's `CmPlan` (plan §10). M4 is where a plan is **created and named**; M1/M2/M3 read and extend the same object.

> **Canonical shared types** (`CmPlan`, `Stat`, `AptKey`, `CmId`, `WishlistItem`, `sparkGoals`, …) are declared in [`2026-06-15-shared-data-model.md`](2026-06-15-shared-data-model.md) — the field shapes below are superseded by that contract; cite it, don't redefine.

> **Schema change — CLEAN REPLACE (confirmed by Sun, 2026-06-14):** the shipped `CmPlan` (`src/core/types.ts`) uses `targetUmaId`, `targetSkills[]`, `scenario`, `month`, `requiredAptitudes`, `lockedDeckSlots`, `chosenParents`. This redesign **replaces** it with the fields below — **no migration** (no saved data to preserve), just a **Dexie schema version bump**. For reference, the old→new map: `targetSkills` → `wishlist`, `targetUmaId` → `umaId`, `month`/`scenario` → `cmRef`, `requiredAptitudes` → `statProfile` aptitudes, `lockedDeckSlots` → `deck`, `chosenParents` → (M1, replaces `inheritanceStopgap`).

**Unit:** one plan = **one uma build.** Plans are **freely many**, with **no uniqueness constraint** — Sun may keep two "Kitasan · Ace · Front · CM12" plans as variations, plus "Kitasan · Ace · Pace · CM12", "Nice Nature · Debuffer · Late · CM12", etc.

**Structured fields** drive an auto-suggested, editable name in this **slash order**: `Plan {n} / CM{cm} / {uma} / {role} / {strategy} / {remark}` — e.g. `Plan 2 / CM12 / Kitasan Black / Ace / Frontrunner / with groundwork`. The **remark** is free text that distinguishes otherwise-identical variations (the reason near-duplicate plans exist).

| Field | Source | Notes |
|---|---|---|
| `name` | **auto-generated in an editable name box** (slash order above); freely user-editable | inline editing is also how the remark gets added — box auto-fills from the fields but never locks |
| `planNumber` | auto-increment within a (cm, uma, role, strategy) group, editable | the "Plan 1 / Plan 2" variant index |
| `umaId` + `uniqueSkillId` | §1 Uma chart selection | unique ↔ uma; record whether unique is *native-runner* or *inherited-version* |
| `role` | user | **Ace** (main scorer) / **Debuffer** (slows rivals) / **Hybrid** (scores while carrying some debuffs) — no Pacer. Debuffer self-L isn't the right metric → §5.1 (deferred); Ace/Hybrid use self-L |
| `strategy` | §1 segmented control | **Frontrunner / Pace Chaser / Late Surger / End Closer**; aptitude-adjustable |
| `remark` | user, free text (optional) | **distinguishes near-identical plans** — e.g. "with/without groundwork skill"; typed inline in the name box |
| `statProfile` | §1, seeded per track+strategy (§5.2) | speed/stamina/power/guts/wit + aptitudes + mood; the assumed *ideal* build, editable |
| `cmRef` (CM number) | §0 | "CM12" token + reference into `cm_schedule.json` (course + conditions) |
| `wishlist[]` | §2 | `{ skillId, projectedL, source: targeted }` |
| `deck[]` | existing inventory | owned cards + limit breaks (reused from current M4) |
| `inheritanceStopgap` | manual (→ M1) | `{ inheritedSkills[], sparks[] }` |
| `dataVersion`, `server` | system | P4 server-versioning |

**Persistence:** IndexedDB via Dexie; **plan list + active-plan selector** present on every module; **JSON export/import** (P2). The **plan header is the top of M4's left "Current Uma Plan" sidebar**: an **editable name box that auto-fills** the slash-format name from the structured fields (and live-updates as uma/role/strategy/CM change), yet stays **freely user-editable** — type a remark, override anything; once the user hand-edits, auto-fill stops clobbering it. The header is a **save-state**: it tracks **dirty vs saved** (a "● unsaved" dot). **Switch** or **New** while dirty prompts **Save / Discard / Cancel** so unsaved edits aren't lost; explicit **Save** persists to Dexie.

**Cross-module contract (what consumers read):**
- **M1 (Inheritance):** `wishlist` skills flagged "needs inheriting" + `statProfile` thresholds → parent/grandparent hunt; writes back resolved parents (replacing `inheritanceStopgap`).
- **M2 (SP Optimizer):** `wishlist` + post-run available skills → SP-constrained subset.
- **M3 (Meta):** supplies `cmRef` context and meta/timeline framing.

**Plan lifecycle & list:**
- **Active plan** is persisted (last-selected `id` in Dexie/localStorage); on load the app restores it. **Zero plans** → empty state with a "Create your first plan" CTA; §1–§3 are inert until a plan exists.
- **List/selector** rows key off the plan **`id`**, not `name`, and render `planNumber` + `remark` (+ created date), so two identically-named plans stay distinguishable.
- **Staleness (P3/P4):** on load, if a plan's `dataVersion` ≠ current data version, flag its stored `projectedL` values as **stale** and offer one-click recompute; never present stale L as current.

---

## 4. Engine foundation (the "first" in engine-first)

The umalator engine is **not yet vendored** — it exists only in `spikes/repos/umalator-global/` (headless smoke-tested 2026-06-12, but `src/sim/` does not exist). This step creates it.

**Reuse (P1):** the L-charts ARE umalator's existing features — **`Uma Bassin`** (unique skills ranked by L) and **`Skill Bassin`** (normal/golden ranked by L). We port them; we do not reinvent.

**How L is computed (umalator's method, to preserve exactly):**
- `runSkillComparison(params): SkillComparisonResult` in `src/modules/simulation/simulators/skill-compare.ts`.
- Run the race **with vs without** the skill on the **same seed**; `bashin = Δposition / 2.5m`; average over Monte-Carlo samples. Output `{ results[], min, max, mean, median }`.
- **Progressive sampling** (umalator): worker yields partial results at increasing sample counts, **dropping skills measuring ≤ 0.1 L early** → this *is* the "0 L = dead-weight auto-hide" behavior, for free.
- **Strategy enters** via the runner's starting `orderRange` (Front `[1,1]`, Pace `[2,4]`, Late/End `[5,9]`) → changing strategy genuinely re-ranks.

**Inputs (`IRunnerState`):** `{ speed, stamina, power, guts, wisdom, strategy, distanceAptitude, surfaceAptitude, strategyAptitude, mood, skills[] }`. **Course (`CourseData`):** `{ courseId, distance, surface, turn(direction), corners[], straights[], slopes[] … }`. **Race (`RaceParameters`):** ground/weather/season/timeOfDay/grade.

**Vendoring scope → `src/sim/`:**
- `src/lib/sunday-tools/**` (core `Race`, `Runner`, observers, course defs, skill-condition DSL).
- Simulators: `skill-compare.ts`, `vacuum-compare.ts` (uma-vs-uma), `shared.ts` glue.
- Worker: `simulator.worker.ts` + the **pool manager** (`navigator.hardwareConcurrency`, clamped 2–16).
- Bassin-chart UI: `BasinnChart` + columns/sorting + length-difference activation bars (adapt to our design system).
- **Adaptations:** stub React `getUmaDisplayInfo` (we render our own); relocate `compare.types.ts` into the vendored tree to break a circular import; **inject our `public/data/` services** (skills/courses/umas) instead of the upstream singletons; esbuild `define:{'import.meta.env':'{"DEV":false}','import.meta.main':'true'}` for any headless/CLI use.

**Provenance:** pin jalbarrang/umalator-global v0.14.2 (`c1fa2107…` — **cross-check the exact hash against `docs/provenance.md` before vendoring**), GPL-3.0; record source + retrieval date in `docs/provenance.md`. The whole repo is already GPL-3.0 per the licensing decision.

**Performance (honest, P3):** ~15–50 ms/race; a full skill chart (~hundreds of skills × progressive samples across the worker pool) **streams a first ranking in ~1 s and refines over ~5–30 s** depending on hardware. "Refresh on strategy/stat change" = a short recompute, not an instant toggle.

**L-cache contract:** memoize under key `(courseId, strategy, hash(statProfile), skillId)`; **bucket continuous stats** (e.g. round to nearest 50) so tiny edits don't blow the cache. Invalidate on course / strategy / stat-profile change or `dataVersion` bump.

---

## 5. The flow

**Layout — 2-column app shell (VFalator-style).** A persistent **left sidebar (~25% width): "Current Uma Plan"** — one section holding the plan name (save-state), the runner summary (uma + unique + stats + strategy/mood/role), and the **Wishlist** (moved here). The **right column (~75%)** is the working area, divided into sections — **§0 Race**, **§1 Skill selection** (the only place you pick a runner/skills), **§3 Sourcing**. Picking happens on the right; the left always mirrors the current plan.

### §0 · Race
- Auto-select the **current / upcoming CM** from a **new small hand-maintained `cm_schedule.json`** (`{ date, cmId, name, courseId }`); resolve `courseId` → `course_data.json` for distance/surface/**direction** and merge `cm_presets.json` conditions (ground/weather/season/time). One click to change. **Auto-select restricts to `server:"global"` CMs** (JP presets stay preview-only per P4); if the schedule is empty or all dates are past, fall back to the latest known **Global** CM and let the user pick manually.
- **New dataset required:** `cm_schedule.json` (no schedule exists today — only 31 historical presets). Hand-maintained per P5; updated when banners are announced. (First real entry: **CM14 Gemini Cup** = Yasuda Kinen, Tokyo **1600m turf** mile.)
- Course **`turn`/direction** is read from `course_data.json` (it carries `turn`); display it as **right-handed / left-handed** (the form skills are conditioned on), **not** CW/CCW. Not added to `CmPreset` (which omits it).
- **The race-track diagram lives here (one shared track).** §0 renders the course (straights/corners/slopes, like umalator) and **always overlays the activation zone + duration of *every* wishlist skill plus the unique** — no selection needed. **Selecting / hovering a skill highlights its band** (eye-catch) but doesn't gate rendering. (Only the *spatial* activation/duration is here; the per-skill *analytical* graphs live in that skill's "show description".)

### §1 · Skill selection (pick runner + skills)
*(Right column, first section — the **selection** area: pick runner + pick skills. The chosen runner and targeted skills appear in the left "Current Uma Plan" sidebar. Runner **config** — stats/strategy/mood/role — shows in the left sidebar with the runner.)*
- **Uma chart (Uma Bassin) — the entry point, shown FIRST.** Uniques ranked by L on this track. **Clicking a row expands the unique's description to *read* it (collapsible) — it does NOT change the plan.** A separate **"Select runner"** button on the row commits that uma + unique to the plan, so browsing skills never accidentally swaps your runner. **Row icon = the uma portrait, not the skill icon** (the unique already implies the skill — you want to see *which uma*). **Each row also shows the uma's base default aptitudes** (distance · surface · strategy letters, e.g. *Mile A · Turf A · Front B*) so a glance tells whether it's usable here without heavy inheritance — plus the unique's name with **effect-summary badges**. An **aptitude filter sits next to the search bar** (filter umas by base aptitude). **Population:** umas whose track distance/surface aptitude clears a threshold (default; togglable to all 84); the shared availability toggle applies. Mark inherited-version availability separately (native-runner ≠ inherited).
- **Runner config (after a runner is picked):** **target stat profile** (default seeded per track+strategy — §5.2; fully editable, Sun's "can I hit the scenario threshold" lever) + **strategy** segmented control (Frontrunner/Pace Chaser/Late Surger/End Closer; aptitude-adjustable) + **role** (**Ace / Debuffer / Hybrid**) + race-condition inputs mirroring VFalator — **surface + distance** (from §0), **style** (strategy), **mood** (Great…Awful). **Mood scales stats, so it shifts L** — explicit input, not cosmetic. **Aptitudes live here (the real / target aptitudes):** distance / surface / strategy each **default to A** (the ideal you aim for) and are **editable**; the uma's **base default aptitudes show read-only** beside them (so you can match them for a realistic plan). The L-chart uses these *target* aptitudes.
- **Skill chart (Skill Bassin) — the single available list.** Acquirable skills ranked by L for (track + strategy + stat profile) — normal + golden, **plus inherited-unique versions** (a uma's unique, when inherited, behaves like a normal white skill and belongs here) **and scenario-specific skills** (both normal + golden). Each row is a **clean line**: icon, name (**white text = white skill, gold = golden** — rarity, not target) **+ effect-summary badges** (spd / acc / rec / heal / …), type, **L (bashin)**, **base SP cost**, **`+ target`**. *(The effect badges appear **wherever a skill is listed** — skill chart, uma-chart uniques, wishlist.)* **No separate "available" panel in §2** (that duplication was confusing); §2 shows only the selected wishlist. Streams + auto-hides dead-weight (≤0.1 L). **Re-ranks on strategy, stat, or aptitude change** — aptitudes come from the **runner config (left), defaulting to A and editable**, *not* the uma's base. So changing *uma* doesn't re-rank the normal/golden chart (only the **unique** is uma-bound, via the Uma chart); editing a **target aptitude** does.
- **Row detail — "show description" (collapsed by default, like VFalator):** a per-row **"show description"** link opens the **real mechanic** — `skillId`, **conditions** (e.g. `activate_count_heal>=3 & distance_rate>=50%`), **effects** (Speed / Accel / Recovery), **duration**, the **L estimate**, an **effectiveness rate**, and **two graphs: L vs distance and speed vs distance** (where along the race the skill actually helps). The **spatial activation zone + duration render on the §0 track** (always-on for wishlist + unique) — *not* inside the row. The Uma chart rows show the same description for uniques.
- **Filters / toggles (both skill & uma charts):**
  - **Show-every-skill toggle** — default hides ≤0.1 L dead-weight; toggling on reveals all, because **umalator can't model every skill** and some that read 0 L genuinely do something in-game. These stay **addable to the wishlist** on game knowledge.
  - **`0 L` vs `n/a` (P3)** — a skill the engine *measured* at ~0 under this strategy shows **`0 L`**; a skill the engine **can't evaluate** (effect type not simulated) shows **`n/a — not simulated`**, never a misleading `0 L`. Both are addable when "show every skill" is on.
  - **Availability — ONE shared toggle for both charts** (timeline-aware, §5.3). A single **Now / + Upcoming / + Future** control governs the uma chart *and* the skill chart at once (not one per chart). **Now** (Global ≤ today; default) · **+ Upcoming** (announced Global release within ~1–2 wk of the CM — plan around a character/card dropping 2–3 days pre-CM) · **+ Future** (all JP-ahead, preview-only — *future improvement*). Preview rows **badged**, L = projection (P4: JP-ahead never silently mixed into now-totals).
  - **Search + filter (important — both charts).** Free-text **search** by name (skill or uma). **Filters:** *skill chart* by type (speed/accel/recovery/corner/…), rarity (white·gold), category (normal · inherited-unique · scenario), status (live · 0 L · n/a), and targeted-or-not; *uma chart* by aptitude, availability, and name. Filters **compose** with the toggles above (e.g. "show every skill" + type=recovery + search "corner").
- **Read vs select (both charts).** Clicking a row **expands its description** to *read* (collapsible) — it never mutates the plan. Committing is always an explicit button: **"Select runner"** (uma chart) / **`+ target`** (skill chart). The whole §1 can also collapse (header chevron) once you've chosen, to focus on §2/§3.

  **5.1 Debuffer evaluation — DEFERRED (future improvement).** umalator's `runSkillComparison` measures *your* position delta, which is correct for **Ace / Hybrid** but not for a pure **Debuffer**, whose value is *slowing opponents*. A correct debuffer eval needs a **different flow** (e.g. measure the field's delay, or evaluate against a fixed Ace) and is **explicitly out of scope for now** (Sun, 2026-06-14). Debuffer plans can still be created, named, and given a wishlist; the skill chart simply shows self-L with a caveat that debuff value isn't yet modeled. Revisit as a future mode/module.

#### §5.2 · Stat-profile default — shortcut now, calculator later
The *correct* target stats per (track, strategy): **max speed** (almost always mandatory), **stamina + guts** sized so the uma survives the race and **hits spurt reliably**, then **pool the remaining stats** as high as possible — modulated by each track's **hidden stat thresholds** (e.g. crossing 601 wit grants bonus speed on some courses; likely encoded in the engine's `CourseData.courseSetStatus`). umalator already has the stamina-survival / spurt function needed for the stamina/guts floor.

- **Now (owner-authorized, private use only):** seed the editable default by **importing from a reliable guide site** (e.g. `uma.guide/guides/cmNN-guide`) behind a `StatTargetSource` interface — `UmaGuideImporter` now → `ManualStatTargets` / curated JSON before any public release. **Reality check (verified against the CM14 page, 2026-06-14):** the page exposes parseable **prose breakpoints** (*"at least 601 Stamina… 613 if Bad Mood"*) + recommended umas/skills/deck configs, but the **full per-stat table is an image** (`cm14-stats.png`) → the importer grabs breakpoints + reco lists, and the precise stat block is **read from the image into `cm_stat_targets.json` (OCR/manual)**. Cache one fetch per CM to that hand-editable file (which *is* the manual format), respect `robots.txt`/ToS, and credit the source (e.g. *uma.guide — catbomb*) in `docs/provenance.md` (P1).
- **Scoping note:** this is a deliberate, time-boxed exception to the standing **no-scraping rule** (Sun, 2026-06-14), scoped to *private use*; the public build swaps in `ManualStatTargets`. GameTora / ChronoGenesis remain off-limits. The seeded value is only a default; the user always edits it.
- **Future module (if time):** compute targets in-app — run umalator's survival/spurt calc for the stamina/guts floor, max speed, pool the rest, factor `courseSetStatus` threshold bonuses. Tedious but reuses the engine; tracked as a separate feature.
- **Honest caveat (P3):** real targets **vary per account** (your parents/cards cap what's reachable), so the seeded value is a *reference target*, not a promise.

#### §5.3 · Timeline & availability model
Now/Upcoming/Future need a **timeline** the data is keyed to — **current date · CM date · banner/release dates · patch version.** Every skill/card/uma already carries `server` + `dataVersion` (P4) and additionally needs a **release/availability date** (Global release; JP release for preview).
- **Now** = released on Global ≤ today. **Upcoming** = announced Global release ≤ CM date (≈1–2 wk window) → needs a hand-maintained **banner/release schedule** (from official announcements). **Future** = exists on JP with no Global date yet (preview-only).
- This timeline is **owned by Module 3 (Meta Intel)** and consumed by M4; `cm_schedule.json` (§0) is one slice of it. **Patch / balance version** matters too — meta shifts per patch and Global's big patch landed earlier than JP — so **stamp the active patch on the plan** and read L/meta against it.
- **Honesty (P3/P4):** upcoming/future L-values are **projections against possibly-unbalanced JP data** — badge them, never fold into "available-now" totals silently.

### §2 · Wishlist
- §2 is the **wishlist only**, and it **lives in the left "Current Uma Plan" sidebar** (not a right-column section) — the skills you `+ target`'d in §1's skill chart, shown as a single list with **`− target`** to prune. **The "available" side lives in §1** (the skill chart *is* the available list) — no duplicate panel here, which removes the earlier confusion. Wishlist persists to the active plan. **Every row shows the skill's name + effect-summary badges + base SP cost** beside its L. **All wishlist skills + the unique are *always* rendered on the §0 track** (zone + duration) — no selection needed; selecting a row just **highlights** its band.
- **Totals on the wishlist panel:** (a) **Σ individual skill L** — labeled as the sum of each skill measured *alone* (NOT combined-build L; skills interact, so it isn't additive, P3; optional "simulate this wishlist together" for a true number); (b) **Σ base SP cost (undiscounted)** — raw skill-point cost before hint discounts. (The *discounted* spend + optimization stays in M2.)
- **Colour = rarity, not target:** white skills render **white text**, golden skills **gold/yellow text**; "targeted" is shown by placement / checkmark, never by colouring a white skill yellow (which would read as a gold skill).

### §3 · Where do I get these? (sourcing — umalator does NOT have this)
- Per wishlist skill, a **pure data join** (no sim): **cards that hint it** (with LB/hint-level icons, reusing existing `classifyHintTier`/coverage logic) + **umas that have it innate** + **⚠ gap** when neither covers it (→ inherit, via the manual stopgap, or add a card).
- **Lives in `src/core/sourcing.ts`** as pure, unit-tested functions (P6), reusing `coverage.ts`; the feature layer only renders.
- **New indexes required:** card-hint → skill reverse index; uma → innate-skill index. (Forward card→skill hint data exists in the coverage core; needs inverting + an uma innate-skill source.)

---

## 6. Honest numbers (P3)
- L is a **streaming estimate, not a verdict** — surface "refining N/M samples" and a caveat tooltip ("simulated, RNG-dependent").
- **Validation:** reproduce a handful of VFalator L values for a known build/track within tolerance before trusting the chart (plan §12); spot-check skill deltas. Record outcomes in `docs/mechanics-notes.md`.

---

## 7. Data gaps & new artifacts
| Need | Status | Action |
|---|---|---|
| umalator engine in `src/sim/` | **missing** | vendor (§4) |
| `cm_schedule.json` | **missing** | new hand-maintained dataset (§0) |
| course direction at runtime | flattened out | expose `turn` from `course_data.json` |
| card-hint → skill reverse index | derivable | build from coverage core |
| uma → innate skills | **missing** (`umas.json` has none) | source from master.mdb / umalator; feeds §3 innate column + Uma chart |
| uma base stats + aptitude letters | **missing** (`umas.json` has none) | source from master.mdb / umalator; needed for `IRunnerState` + Uma-chart population |
| `course_data.json` in `public/data/` | **borrowed-only** | emit via scripts pipeline (only in `scripts/borrowed/` now); apply P4/P5 — also **powers the §1 track diagram** (straights/corners/slopes) |
| run-style gating fidelity | partial (DSL only) | validation item — sim emerges 0-L empirically, but confirm run-style-locked skills behave |
| `cm_stat_targets.json` (stat-profile defaults) | **missing** | `UmaGuideImporter` (private use) → manual before public; full stat block is image-bound (OCR/manual); cited (P5); §5.2 |
| skill effect / duration / force-by-position data | **not in `SkillRecord`** | the vendored engine has it (`buildSkillData`); surface engine data or extend the skills dataset — powers the §1 row-detail panel |
| banner / release-date schedule + per-record release date | **missing** | hand-maintained (official announcements); powers Now/Upcoming/Future (§5.3); shared with M3 |
| known **not-simulated** skills flag | **missing** | derive from the engine's supported effect types, or curate an `unsimulated_skills` override; drives `n/a` vs `0 L` |
| active patch / balance timeline | **missing** | stamp patch on the plan; meta/L read per patch (Global patch ≠ JP timing) |

---

## 8. Out of scope (this module/version)
- SP-budget purchase optimization → **M2**.
- Real parent/spark resolution → **M1** (manual stopgap until then).
- Meta tier-lists / timeline curation → **M3** (M4 only references `cmRef`).
- **Debuffer-specific L evaluation** → future improvement; needs a different flow (§5.1). Ace/Hybrid only for now.
- **In-app stat-target calculator** (survival/spurt + threshold bonuses) → future module; seeded from curated guide data now (§5.2).
- **"Future" (all-JP) availability toggle** → future improvement; **Upcoming** (≈CM-window Global releases) is in scope now and needs banner-date data (§5.3).

---

## 9. Risks / open questions
1. **Debuffer eval** — deferred to a future mode (§5.1); Ace/Hybrid only for now.
2. **Perf** — 5–30 s full-chart refresh; mitigate with progressive streaming + caching per (course, strategy, statProfile, skill).
3. **Run-style data fidelity** — validate empirically vs VFalator.
4. **Stat-profile defaults** — seed by importing from a guide site now (private use; uma.guide), manual before public (§5.2); in-app calculator later. Risks: the precise stat table is **image-bound** (OCR/manual read), guide-layout brittleness, per-account variance.
5. **Engine vendor surface** — adaptation effort (React stub, type relocation, data injection) is real; smoke test passed but full in-app worker wiring is unproven.
6. **Timeline data upkeep** — Now/Upcoming need hand-maintained banner/release + patch dates (§5.3); staleness mis-filters. **Not-simulated detection** — must reliably tell `n/a` from `0 L` so uncomputable-but-real skills stay addable.

---

## 10. Milestones (high-level; detailed impl plan via writing-plans later)
1. **Foundation:** vendor engine → `src/sim/`, worker pool, data injection, headless test green.
2. **§1 charts:** Skill/Uma Bassin live in-app for a fixed plan.
3. **Plan model + header:** Dexie persistence, named many-plans, export/import.
4. **§0 schedule + §2 wishlist.**
5. **§3 sourcing join.**
6. **Validation pass** vs VFalator; honest-numbers UI.

Each milestone touching `src/core/` or data lands with **passing unit tests** (P6 — 100% core coverage), not just milestone 6.

> Note: per Sun's request to **brainstorm each module before building**, the implementation plan (writing-plans) is deferred until M3/M1/M2 are also brainstormed and folded into one engine-first plan.

---

## 11. Slice 1 — reconciled build scope (2026-06-15)

**Context:** the engine-first M4 above was specced 2026-06-14 but **never implemented** — the running `/` is still the pre-engine coverage MVP this spec supersedes (§Supersedes). Since then the **engine is vendored** (`src/sim/`, working), **M3 owns the timeline** (`cmSchedule`), and **`CmPlan` is reconciled** to the canonical model. A recon (2026-06-15) verified what's buildable *today* vs. what's gated by missing data. Sun signed off on building the **first vertical slice** and replacing `/`.

**Verified feasibility (the unblockers):**
- `evalSkillDelta(build, race, skillId, nsamples, seed)` computes per-skill L from a `SimBuild` that needs **only raw stats + strategy + aptitudes** — *no uma required*.
- **Course geometry is embedded in the vendored bundle** — `resolveCourse('10906')` works with zero external data (no `course_data.json` needed for the sim).
- Reuse: `SimClient` / `makeDeltaCache` / adapter (`src/sim`), `coverage.ts` (`classifyHintTier`/`tierForCardSkill`), `cost.ts` (`effectiveSpCost`), `useActivePlan`/`useGameData`, CSS primitives. M2's `rankBaskets.ts` is the call-pattern reference (M4 chart = a *flatter* loop, no basket/diversity branching).

### 11.1 In scope (all verified buildable now)
- **2-column shell, route `/` replaced.** LEFT "Current Uma Plan" sidebar: plan name + save-state (reuse `PlanHeaderPanel` logic), CM picker (from M3 `cmSchedule`/`cmPresets`), **runner config** (editable `statProfile.stats`, `strategy`, target aptitudes → `sparkGoals.pink` defaulting to `A`, `statProfile.mood`), and the **wishlist** (per-skill L + base SP). RIGHT: **§0 Race** (course summary + conditions, *form only — no track diagram*), **§1 Skill chart**, **§3 Sourcing**.
- **§1 Skill chart** — acquirable skills (white/gold/scenario; **exclude JP per P4**, exclude uniques) ranked by individual **L** via `evalSkillDelta` over `SimClient`, **progressive streaming** (first ranking fast, refine), **`0 L` auto-hide + "show every skill" toggle**, **`0 L` vs `n/a`** where the engine can't evaluate, filters (type/rarity/search/targeted), **base SP cost**, **`+ target`**, and a **row-detail** = `skillId` + raw `conditions` DSL + L (mean with min/max + sample count, honest-numbers P3). Colour = rarity (white text / gold text), never "targeted".
- **§3 Sourcing** — new pure `src/core/sourcing.ts`: card-hint **reverse index** (skill→cards, derived from `support_cards.json`) + `sourcingJoin` → per wishlist skill, the **cards that hint it** (tier/LB via coverage) + **⚠ gap** when none. *Uma-innate column omitted this slice* (data-gated).
- **New tested core (P6):** `rankSkillChart` (streaming orchestrator over the catalog, injectable sim dep, ≤0.1 L threshold) + `sourcing.ts`. Feature layer renders.

### 11.2 Deferred — each with its named dependency (not hand-waving)
- **Effect-summary badges + duration + L-vs-distance / speed graphs** → `SkillRecord` lacks effect-type & duration data; the engine has it (`SkillType`/`baseDuration`) but it isn't surfaced. Needs a build-time extraction from the bundle's `skillsService` — **verify feasibility first**, then a fast-follow increment.
- **§1 Uma chart + "usable here" filter + §3 uma-innate column** → `umas.json` has no base stats / aptitude letters / innate skills / unique-skill id (only `umaId/charaId/nameEn/epithet`). Needs a master.mdb/umalator data-sourcing task.
- **§0 race-track diagram (SVG activation zones)** → engine `CourseData` has geometry, but rendering it is later-milestone work.
- **§5.2 stat-target auto-seed** (`cm_stat_targets.json`) → user hand-enters stats for now.
- **Now/Upcoming/Future availability toggle** → needs per-record release dates; "Now" only for the slice.
- **Debuffer L** → self-L with caveat (Ace/Hybrid honest); per §5.1.

### 11.3 Honesty (P3) for the slice
L is a streaming estimate — show "refining N/M samples" + an RNG caveat; never present `n/a` (unmodeled effect) as `0 L`; JP-ahead skills excluded from the Now chart. Validate a few values vs VFalator before trusting (record in `mechanics-notes.md`).
