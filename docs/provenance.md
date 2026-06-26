# Provenance

Where every dataset, algorithm, and external dependency comes from. Per plan §2 P1: every ported algorithm and borrowed dataset records its source URL and retrieval date here. Keep this file updated whenever something new is borrowed.

All findings below: **Phase 0 spikes, retrieved/verified 2026-06-12** unless dated otherwise. Local scratch clones live in `spikes/repos/` (gitignored; re-clone shallowly if absent).

---

## 1. Simulation engine — jalbarrang/umalator-global

- **Source:** https://github.com/jalbarrang/umalator-global ("Torena Sim"), **pin: tag `v0.14.2` = commit `c1fa2107b6a7be6283bf6414ebb7a23ea0c095ca`** (2026-06-05, latest of 19 release tags).
- **Data pin bumped 2026-06-19 → `v0.16.1` = commit `76214c821a2573a532657c90cb406f3f5fe65f3e`** (`DATA_VERSION` `global-76214c82`). This advances the *borrowed JSON only* (`scripts/fetch-borrowed.ts` → `public/data/*.json`): 587 skills / 222 support cards / 87 umas (60 chars) / 31 cm presets. The new pin caught up to the three 2026-06-11 banner SSRs (30102/30103/30104), so `data-overrides/card_additions.json` was emptied. **The vendored engine bundle (`src/sim/`) stays at v0.14.2** — not rebuilt. Two upstream changes handled: (a) `db/extract/` was removed at v0.16.0, so the `relation.json` / `relation_member.json` succession tables (never published on raw.githubusercontent.com; from the Phase-0 mdb extract) are now marked `localOnly` in `fetch-borrowed.ts` and reused from the committed `scripts/borrowed/` copy; (b) the Tachyons-lab `hints_table` pin (2026-06-09) predates the newest cards, so `build-cards.ts` defaults their `hint_pool` levels to 1 (the verified Global invariant). The Tachyons-lab pin itself is unchanged (`2ce0c8fe…` is still the newest commit touching `front/src/app/data/data.json`, re-verified 2026-06-19).
- **Local modification (2026-06-22):** cooldown-aware multi-fire skill activation — short-cooldown `all_corner_random`/`straight_random` skills re-fire per a distance-scaled cooldown (`(cooldownTime/10000)·(distance/1000)` s; engine flag `cooldownReactivation`, default ON; OFF reproduces upstream single-fire). Source diff captured in `engine-patches/2026-06-22-multifire.patch` (apply to the pinned source before `pnpm sim:build`). Spec: `docs/superpowers/specs/2026-06-22-m4-engine-multifire-cooldown-activation-design.md`. Still GPL-3.0-only.
- **Lineage:** alpha123/uma-skill-tools (pecan, 2022) → VFalator fork → jalbarrang. Engine heavily rewritten: lives in `src/lib/sunday-tools/` ("sunday-tools", renamed from uma-skill-tools); `Race`/`Runner` classes replace the old `RaceSolver`/`RaceSolverBuilder`.
- **Why this one (vs alternatives):** alpha123 upstream uses JP-server data/mechanics and the older architecture; kachi-dev/uma-tools fork is older RaceSolver architecture with Preact UI, checked-in bundles, and (in our clone) a dangling `EnhancedHpPolicy` import. umalator-global has the modern Global data pipeline and proven headless usage in-repo (`scripts/run-skill-compare.ts` runs under Bun with no DOM; 4 web workers run it off-main-thread).

### Entry points for our use case
| Path (in upstream) | Use |
|---|---|
| `src/modules/simulation/simulators/skill-compare.ts` | **Primary:** `runSkillComparison` / `runSampling` — per-skill bashin deltas via Monte Carlo (two single-runner `Race` instances, identical per-sample seeds, bashin = positionDiff/2.5) |
| `src/modules/simulation/simulators/vacuum-compare.ts` | `runComparison` — two-build compare (umalator classic mode) |
| `src/lib/sunday-tools/common/race.ts` | `Race` core class (`prepareRound(masterSeed)` → `run()` ticks at 1/15s) |
| `src/lib/sunday-tools/common/runner.ts` | `Runner`, `CreateRunner` input type (stats, strategy, aptitudes, skill id list) |
| `src/lib/sunday-tools/common/race-observer.ts` | Output collectors (`BassinCollector`, `SkillCompareDataCollector`, per-frame data) |
| `src/modules/simulation/simulators/shared.ts` | Glue: `createInitializedRace`, `toCreateRunner`, `toSundayRaceParameters` |
| `src/lib/sunday-tools/runner/runner.utils.ts` | `buildSkillData` — skill condition DSL → simulation triggers (main data-injection seam) |

### Known coupling caveats (verified by source reading; smoke test see §1.1)
- Pervasive `@/*` tsconfig path alias (cheapest fix: replicate alias in our Vite/tsconfig).
- Module-scope data singletons (`skillsService`, `coursesService`) statically import JSON — works headless but hard-codes the data source; prefer converting to injected params or precomputed merged JSON.
- `common/runner.ts:43` imports `getUmaDisplayInfo` (pulls React into the closure; display-name only at line 1474) — stub when vendoring.
- `common/race-observer.ts` imports from `modules/simulation` (circular engine↔app boundary) — relocate `compare.types.ts` into the vendored tree.
- `import.meta.env?.DEV` Vite-ism in `runner/runner.utils.ts:68` (optional-chained, non-fatal).
- Module-level mutable registry `registerAllDynamicConditions()`; `Race.onInitialize()` calls it — keep import side-effect ordering.
- Runtime deps to carry: `prando`, `es-toolkit`. ES2023 array methods assumed (`src/polyfills.ts` pattern).
- No DOM/window/fetch anywhere in `src/lib/sunday-tools` (verified by grep).

### Vendor list (when Phase 4 lands)
`src/lib/sunday-tools/**` (drop tests) + the simulator/glue files (incl. `skill-planner-compare.ts` / `runPlannerComparison` for combined-L + basket eval — see shared-data-model §7) + either the loader chain or (preferred) a build-time merged `skills.json` + `course_data.json` + `umas.json`. Also vendor `scripts/master-data/**` and `scripts/data-extract/{extract-skills,extract-course-data,extract-uma-info,gametora-client,sync-gametora}.ts` as our data-refresh pipeline (runs on Bun, hits the Global CDN).

### 1.1 Headless-import smoke test — **PASSED** (adversarial verification, 2026-06-12)
`runSkillComparison` executed end-to-end under plain Node v24 with no DOM: bundled via esbuild (`platform:'node'`, `define:{'import.meta.env':'{"DEV":false}'}`) and produced correct deterministic bashin output. Findings:
- **The only real blocker** is `src/config/env.ts:1` (module-level `import.meta.env`, fatal under plain Node; fine under Bun/Vite — the repo's own `bun scripts/run-skill-compare.ts` needs zero shims). Exactly 3 `import.meta.env` sites in src/; the other two are dead-in-engine-graph or optional-chained.
- The `@/*` alias caveat did NOT materialize under tsx (resolves tsconfig paths out of the box).
- For the CLI/data pipeline under Node, also define `'import.meta.main': 'true'` or Bun-style CLI entries never run.
- Repro artifacts: `spikes/repos/umalator-global/scripts/adversarial-smoke.ts` (+ `.bundle.cjs`).

### Fidelity caveat (P3)
Compare mode replaces multi-runner interactions (blocking, order conditions) with statistical distributions (`conditions/aproximate-conditions.ts`, upstream README disclaimers). Good for **relative** skill ranking; absolute bashin vs in-game behavior is unvalidated. Surface this in the UI.

### 1.2 Racetrack UI layers — SOURCE vendor (added 2026-06-16)

The static race-track visualisation for M4 §0 is vendored as **source** (not a bundle) into `src/features/planner/racetrack/vendor/` — same upstream repo, same pin (v0.14.2 / commit `c1fa2107`), GPL-3.0-only. No new licence obligation beyond what §1 already carries.

Three SVG layer/primitive components were copied verbatim and then adapted:
- `d3` removed from the x-axis tick calculation (replaced by a local tick helper).
- `@/i18n` import replaced by a local label shim (`src/features/planner/racetrack/shims/`).
- `CourseService.phaseStart` and the `CourseData` type replaced by local shims in the same directory.
- `// @ts-nocheck` applied to the three vendored files that trip `noUncheckedIndexedAccess` (our tsconfig is stricter than upstream's).

---

## 2. Licensing

**Decision input (plan §14.1): adopt GPL-3.0. Confirmed safe — no unlicensed link in the chain.**

| Repo | License | Evidence |
|---|---|---|
| alpha123/uma-skill-tools | **GPL-3.0-or-later**, Copyright (C) 2022 pecan | LICENSE (verbatim GPLv3), package.json, README GPL notice |
| alpha123/uma-tools | GPL-3.0-or-later (author pecan) | LICENSE, package.json |
| kachi-dev/uma-tools | GPL-3.0-or-later (retains upstream LICENSE byte-identical) | LICENSE, package.json |
| jalbarrang/umalator-global | **GPL-3.0-only** | LICENSE, package.json `"license": "GPL-3.0-only"` |

- umalator-global demonstrably vendors alpha123 code (near-verbatim `ActivationSamplePolicy.ts` incl. comments) — legal: or-later code may be redistributed under v3-only. We inherit **GPL-3.0-only** if we vendor from jalbarrang.
- Obligations when we distribute (a deployed static site = conveying): full GPLv3 text in LICENSE; NOTICE/CREDITS naming pecan/alpha123 (© 2022), VFalator contributors, jalbarrang, GameTora; modification notices on vendored files we change; published, buildable source.
- **Game data is NOT covered by anyone's GPL grant** — master.mdb-derived JSON and icons are Cygames property; upstream can't license what they don't own. Keep data/assets outside our GPL grant; carry a Cygames fair-use disclaimer modeled on umalator-global README lines 118–128. Do not vendor uma-tools' 415MB icon dump wholesale.
- GameTora-scraped JSON has no license statement; attribution + polite, hash-gated snapshot reuse (see §4) is the community norm. Open question: ask GameTora before long-term redistribution in our repo.

### 2.1 Image assets — curated WebP icon bundle (added 2026-06-13)

**Decision (plan §4 "Image assets"; do not relitigate):** in-game imagery is sourced by **bundling a curated, Global-only WebP icon subset** into git-tracked `public/data/icons/` — NOT hotlinked (P2: a hotlink shows broken images offline) and NOT the 415 MB wholesale dump §2 warns against. The curated subset is ~360 files / ~4.7 MB WebP-q80 (5.3% of the dump it replaces); a deliberate, recorded posture distinct from the wholesale dump. Research: `spikes/image-ui-research.json`.

- **Source dump (gitignored build input):** `spikes/repos/uma-tools/icons/` (the 415 MB uma-tools icon dump, present only on a local dev machine — see §7). `scripts/build-icons.ts` reads from `skill/`, `support/`, `chara/` and converts to WebP via **sharp, quality 80** (`effort:4`, deterministic — two runs are byte-identical). The icons are **Cygames game art**, included under the existing fair-use / asset-exclusion notice (NOTICE.md), **outside the GPL grant** — upstream can't license what it doesn't own (§2).
- **Output layout + contract (`public/data/icons/`, git-tracked, generated — never hand-edit, P5):**
  - `skill/<iconId>.webp` (56 — deduped by `iconId`; ~56 distinct icons cover all 578 skills). Source: `skill/utx_ico_skill_<iconId.padStart(5,'0')>.png`. `iconId` comes from `SkillRecord.iconId` (upstream skills.json, the build's existing `master` input — NOT skill_meta.json, which lacks 5 Global skills).
  - `support/<cardId>.webp` (220). Source: `support/support_card_s_<cardId>.png` (256 px, carries the rarity badge — the GameTora-style chip). ⚠ cards **30024** and **30061** ship in the dump ONLY as uppercase `Support_card_s_<id>.png`; `supportSourceFile()` resolves the capital-S source and output is always lowercased `<cardId>.webp` (case-sensitive-host 404 hazard on GitHub Pages/Linux).
  - `uma/<umaId>.webp` (84). Source: `chara/trained_chr_icon_<charaId>_<iconAssetId>_02.png` (gold frame) when present, else fallback to `chara/chr_icon_<charaId>.png` (base portrait; `charaId = floor(umaId/100)`). Most `iconAssetId` values equal `umaId`; 17 Global alt outfits use the vendored umalator asset-id override map in `scripts/build-icons.ts`.
  - `icon-manifest.json` = `{ dataVersion, format:"webp", skill:string[], card:string[], uma:string[], _fallbackUmas:string[] }`, all id arrays numeric-sorted for determinism; `dataVersion` = the same `global-c1fa2107` the other builders use.
- **17 alt-outfit icon asset-id overrides** (Global `umaId` differs from the trained icon filename id; all resolve to outfit-specific gold-frame icons in the local dump): `100402` Maruzensky (Hot☆Summer Night), `100502` Fuji Kiseki (Succès Étoilé), `101402` El Condor Pasa (Kukulkan Warrior), `101502` T.M. Opera O (New Year, Same Radiance!), `101702` Symboli Rudolf (Archer by Moonlight), `101802` Air Groove (Quercus Civilis), `102002` Seiun Sky (Soirée des Chatons), `102202` Fine Motion (Titania), `102402` Mayano Top Gun (Sunlight Bouquet), `102602` Mihono Bourbon (CODE: ICING), `103702` Eishin Flash (Precise Chocolatier), `103802` Curren Chan (Ma Chérie of the New Moon), `104502` Super Creek (Chiffon-Wrapped Mummy), `105202` Haru Urara (New Year ♪ New Urara!), `105602` Matikanefukukitaru (Lucky Tidings), `106002` Nice Nature (Run & Win), `106102` King Halo (Cheerleader in Noble White). `_fallbackUmas` is retained for true future gaps; the current regenerated manifest has no chr_icon fallbacks.
- **Build wiring + CI guard:** `buildIcons` runs LAST in `scripts/build-all.ts`, after `skills.json`/`support_cards.json`/`umas.json` are written (it reads their id lists). **If the gitignored source dump is absent (e.g. CI), it LOGS a warning and SKIPS regeneration**, leaving the committed `public/data/icons/` intact — `pnpm data:build`'s other 5 outputs still build. **CI/Pages use the committed icons; regeneration needs the local dump** (run `pnpm data:build -- --from-spikes` on a machine that has it). Pure source-filename resolvers (`skillSourceFile` / `supportSourceFile` incl. the case-variant / `umaSourceFile` incl. the fallback) are unit-tested in `scripts/build-icons.test.ts`; the sharp conversion itself is not.

---

## 3. Game datasets (skills / courses / umas / support cards)

**Decision confirmed: borrow, don't self-extract** (plan §3 "Data sources"). Best single source: **umalator-global's `src/modules/data/json/`** — two-layer model: master.mdb extract = "released on Global" cutover; `gametora/*.json` = full JP+Global catalog with per-server release dates.

| Need | Source file (umalator-global unless noted) | Notes |
|---|---|---|
| Skills (conditions, effects) | `json/skills.json` (578 released) + `json/gametora/skills.json` (1802 catalog) | Condition DSL strings parsed by the engine. ⚠ ADR-0002: **101 skills have different activation conditions JP vs Global** — never assume JP conditions for Global sim |
| Skill SP base cost | `skills.json` `baseCost` (also uma-tools `skill_meta.json`: `{baseCost, groupId, score, order}`) | = master.mdb `single_mode_skill_need_point`. Uniques are 0. Upstream even ships an SP cost calculator (`skill-planner/cost-calculator.ts`): hint discounts {1:10%,2:20%,3:30%,4:35%,5:40%}, Fast Learner ×0.9, ceil-after-sum, gold-bundles-white |
| Rarity / gold↔white links | `skills.json` `versions`/`family` arrays; `skill-relationships.ts` documents family-ID patterns; inherited uniques = 9xxxxx ids, `gene_version`/`unique_version` fields | rarity: 1=white, 2=gold, 3–5=unique |
| Courses | `json/course_data.json` (107 Global) | surface 1=Turf 2=Dirt; distanceType 1–4; corners/straights/slopes; `courseSetStatus` = stat-bonus stats |
| Umas | `json/umas.json` (cutover) + `gametora/character-cards.json` (254, full: aptitude letters, base stats, growth %, skills) | aptitude ints: 1=G..7=A, 8=S |
| Support cards | `json/support-cards.json` (217 Global: 93 SSR/46 SR/78 R) + `gametora/support-cards.json` (536 catalog with per-level passive matrices) | passive effect ids via `gametora/support-effects.json`: **17=Hint Levels, 18=Hint Frequency, 19=Specialty Priority**, 33=Hint Quantity Bonus |
| EN names | All Global extracts carry official EN (master.mdb text_data); `name_en` (official, 517) vs `enname` (fan TL, all 1802) in gametora skills | JP-only content has fan-EN fallback only |
| CM race definitions | `src/store/race/cm-presets.json` (31 presets: name/date/courseId/season/ground/weather/time); uma-skill-tools `cmdefs/*.cmdef.json` format (18 JP CMs, incl. presupposedSkills per strategy) | Direct input for our CmPlan race picker |

### Regeneration pipeline (vendor in Phase 1 as `scripts/`)
- `bun run db:fetch` → downloads **Global master.mdb from the official CDN** `assets-umamusume-en.akamaized.net` (manifest chain; version via `https://uma.moe/api/ver`).
- `bun run extract:all` → SQL over master.mdb → skills/courses/umas/support-cards JSON.
- `bun run sync:data` → snapshots GameTora's manifest API `https://gametora.com/data/manifests/umamusume.json` → `gametora/*.json` (hash-gated, cached, identifying UA).

### Known data gaps (drive `data-overrides/`)
1. ~~Scenario-exclusive tagging~~ **RESOLVED 2026-06-12** — see §3.1 below; encode the scenario map as a small hand-maintained data file (it changes ~2×/year).
2. ~~Support-card passive matrix semantics~~ **RESOLVED 2026-06-12** — confirmed against live Global master.mdb, byte-identical for all 220 cards; per-LB derivation rule in `docs/mechanics-notes.md` §9.
3. Per-event hint *levels* granted (e.g. "hint +1/+3") are embedded in `support-events.json` reward display strings — needs parsing (choice-level data also in Tachyons-lab). *Partial progress 2026-06-12: per-skill **training-hint-pool** levels (`hint_value_2`) now ship as `CardSkill.hintLevels` via Tachyons-lab `hints_table` (§4.1) — all 1282 Global rows are currently 1. Per-EVENT reward levels (the "+1/+3" strings on chain/date hints) remain unparsed.*
4. **Effect 30 (Skill Point Bonus) — DELIBERATE Phase-1 omission (noted 2026-06-12).** The Global extract has 33 type-30 rows (mechanics-notes §9 lists it as a hint-model input), but `CardPerLevel` carries only effects 17/18/19 — Module 4 coverage doesn't use SP bonus. Module 2 (SP Purchase Optimizer, plan §8) must add `CardPerLevel.skillPointBonus` + the pipeline support (same §9 level-cap evaluation; see the dated comment in `scripts/lib/lerp.ts`).

### 3.1 Scenario id map (resolved 2026-06-12)

⚠ **Two numbering systems exist — never mix them:**
- **Game-internal** `single_mode_scenario.id` (master.mdb; use this for `CmPlan.scenario.id`): **id 3 does not exist** (data skips 2→4).
- **GameTora release-order numbering (GT#)** used by `sce_e` and `evo[].scenario_id` in gametora JSON: contiguous 1–13.

| Internal id | GT# | Scenario | Global status (2026-06-12) |
|---|---|---|---|
| 1 | 1 | URA Finale ("The Beginning: URA Finale") | ✅ launch 2025-06-26 |
| 2 | 2 | Aoharu Hai ("Unity Cup: Shine On, Team Spirit!") | ✅ 2025-11-06 |
| 4 | 3 | Make a New Track!! / Climax ("Trackblazer: Start of the Climax") | ✅ 2026-03-12 — **current Global default (latest)** |
| 5* | 4 | Grand Live | ❌ (likely next; ~4-month cadence → ~Jul 2026, speculative) |
| 6* | 5 | Grand Masters | ❌ |
| 7* | 6 | Project L'Arc ("Reach for the stars" — the perl list's "RFTS") | ❌ |
| 8* | 7 | U.A.F. Ready GO! | ❌ |
| 9* | 8 | Great Food Festival | ❌ |
| 10* | 9 | Run! Mecha Umamusume | ❌ |
| 11* | 10 | The Twinkle Legends | ❌ |
| 12* | 11 | 無人島へようこそ (Design Your Island) | ❌ |
| 13* | 12 | ごくらく♪ゆこま温泉郷 | ❌ |
| 14* | 13 | Beyond Dreams (Breeders' Cup) | ❌ |

\* Internal ids ≥5 inferred (GT#+1, single gap at 3) — verify against a JP master.mdb before hardcoding. Sources: Global master.mdb `single_mode_scenario` + `text_data` cats 119/237 (ids 1/2/4 authoritative); GameWith scenario timeline https://gamewith.jp/uma-musume/article/show/317671; skill-id anchors per scenario (evidence in `spikes/` agent output ae523ce1).

**`sce_e` semantics** (inferred from membership): skill obtainable from that scenario's training events; multi-valued lists occur (e.g. `[1,8]`). UAF (GT#7) has zero entries in the current snapshot — unexplained, treat UAF skills via overrides if ever needed.

**`l_0..l_3` tags decoded — NOT scenario-related:** they are race-phase filter tags (l_0 Opening Leg/phase 0, l_1 Middle Leg, l_2 Final Leg, l_3 Last Spurt) — established by condition-string correlation (e.g. 492/508 l_1 skills have `phase==1`-family conditions). Other tags in the same taxonomy: sho/mil/med/lng distance, run/ldr/btw/cha strategy, str/cor/f_s/f_c/slo geometry, dir/tur surface, dbf debuff.

### 3.2 Upstream pin lag — card additions (added 2026-06-12)

The umalator pin (c1fa2107, data tag 2026-06-05) ships **217** support cards, but Global went to **220** on 2026-06-11 (banner SSRs 30102 El Condor Pasa / 30103 Matikanetannhauser / 30104 Zenno Rob Roy — proven by the live master.mdb extract `spikes/.../db/extract/scd.json` v10006400 and GameTora `release_en`; Phase 1 review, major finding). Cards released between the upstream's data refresh and ours will recur on every banner, so the gap has a standing mechanism:

- **`data-overrides/card_additions.json`** holds full `SupportCardRecord` entries, schema-validated (`scripts/lib/card-additions.ts`) and inserted **before** overrides; entries carry `dataVersion: "global-mdb-<resource_version>"` (currently `global-mdb-10006400`) so their distinct origin stays visible (P3/P4).
- Records are generated by the documented one-off **`scripts/extract-card-additions.ts`** (`pnpm exec tsx scripts/extract-card-additions.ts`): names/type/hint pools + `hint_value_2` via node:sqlite over the spikes Global master.mdb (§6b); passives from `db/extract/hint-effects.json` under the mechanics-notes §9 level-cap rule; event skills from the **pinned** GameTora eventData (`event-skill-sources.json` covers the full 532-card JP+Global catalog, and these cards shipped on JP long ago — so no live GameTora fetch was needed). Caveat inherited from that source (see §4.1): chain skill-CHOICES/date events of these 3 cards would be missing — acceptable for stat-type SSRs; re-verify when the pin catches up.
- When the upstream pin is bumped past a card, the duplicate-id check **fails the build**, forcing the stale addition to be diffed against the freshly generated record and deleted.

### 3.3 CM preset server tagging (added 2026-06-12)

Upstream `cm-presets.json` mixes the JP CM history with the rounds umalator-global tracked since Global launch (Phase 1 review finding). `CmPreset` now carries `server` + `dataVersion` (P4). **Derivation rule** (`scripts/build-cm-presets.ts`): `date >= 2025-06-26` (Global launch, §3.1) → `global` (5 rounds: 2025-07-25 … 2026-01-22), earlier → `jp` (26 rounds incl. the 2025-06-21 CLASSIC, which predates launch by 5 days). ⚠ Verification status (P3): rule is date-derived; the review's GameTora live checks support the split, but a quick news search (uma.guide CM schedule, namu.wiki CM list, 2026-06-12) suggests Global may ALSO reuse zodiac cup names — the preset *names* are the upstream author's labels, so trust the dates, not the names. Re-verify per-round against the in-game news archive when a preset is actually used for a plan; correct via a `cm_presets` override if a round is mis-tagged.

### 3.4 umas.json — parents-entry picker dataset (added 2026-06-13)

`public/data/umas.json` (= `UmaRecord[]`, built by `scripts/build-umas.ts`) ships one record per **Global-released playable outfit**: 84 outfits / 59 characters at the c1fa2107 pin.

- **Released-set source:** umalator-global cutover `json/umas.json` (master.mdb extract, same pin) — presence there = released on Global. `nameEn` and the epithet come from this extract (official EN, master.mdb text_data per the §3 "EN names" row). Epithets are stored bracket-free + trimmed ("Special Dreamer", not "[Special Dreamer]").
- **Cross-check + fallback:** `json/gametora/character-cards.json` (254-outfit JP+Global catalog, NEW borrowed file added to `scripts/fetch-borrowed.ts` at the same pin; raw URL verified 200 on 2026-06-13). Its `title_en_gl` is also official Global EN — the build **fails** if the two sources disagree on an epithet (drift oracle, same philosophy as `assertTachyonsParity`). Its `name_en` is GameTora *house style* and is deliberately NOT used ("TM Opera O" vs official "T.M. Opera O"); the fan-TL `title` field is never read, so **no fan translations are used** (all 84 released outfits carry `title_en_gl`).
- **ID convention (provenance §5):** `umaId` = master.mdb `card_data` id as string, one per outfit — identical to what the UmaExtractor importer maps `card_id` → `Parent.umaId`; `charaId` = `floor(umaId/100)` as string, enforced at build time. Deterministic sort by numeric `umaId`.
- Override-targetable as `_target: "umas"` keyed by `umaId` (build-all wiring; no overrides file exists yet — create `data-overrides/umas_overrides.json` when first needed, P5).

---

## 4. Support-card skill sourceType (chain / hint_pool / random_event)

**Solved — no bulk hand-curation needed.** master.mdb provably contains NO event-reward→skill relation (exhaustive negative result: umalator-global `docs/data-extraction/support-card-skill-sources.md`); hint pools come from master.mdb `single_mode_hint_gain`.

- **Primary dataset:** `umalator-global/src/modules/data/json/gametora/event-skill-sources.json` — 532 cards → `{chain_event_skills, random_event_skills}` (GameTora per-card eventData: "arrows" = chain, "random" = random). Covers 213/217 Global cards (4 missing are R [Tracen Academy] cards with zero event skills). Refreshed 2026-06-05; re-runnable via `scripts/fetch-event-skill-sources.ts`.
- **Runtime model to mirror:** upstream `attach-support-sources.ts` already tags skills `'hint' | 'chain-event' | 'random-event'` with a consistency test suite.
- **Cross-validation oracle:** jechto/Tachyons-lab `front/src/app/data/data.json` (GPL-3.0, 217 Global cards, `all_events.{chain_events,random_events,dates}` + hints_table, updated 2026-06-09; local copy `spikes/tachyons-data.json`). All three pipelines agree on the Kitasan 30028 ground-truth trace (chain "We Walk Together" → skill 200331).
- **Overrides workload estimate: ~15–20 card entries** — 14 Global cards where GameTora's flat event list disagrees with chain∪random (mostly friend/group cards: Tazuna, Aoi Kiryuin, Riko, Sasami, Team Sirius — their "date events" are neither chain nor random) + the dual-listed-skill card. Open product question: add a fourth sourceType (`date_event`) for friend/group cards.
- Volume context: Global cards average 5.8 hint skills (1,263 rows) and 2.3 event skills (494 rows: 276 chain / 225 random).
- Ruled out: urarawin/pretty-derby (flat lists, JP), umapyoi.net (redirects to GameTora), SimpleSandman API (inherits master.mdb gap).

### 4.1 Event-skill derivation v2 — Tachyons-lab promoted to primary source (2026-06-12)

**Why:** the Phase 1 adversarial review (critical finding) proved the §4 model under-reported Global skills on ~11 cards (7 golds among them): upstream `fetch-event-skill-sources.ts` parses only GameTora eventData categories `arrows`/`random` and only `sk` rewards, silently dropping **chain-finale skill choices** (`sr`), **date-event skills** (`dates`/`dates_random`) and **direct skill grants** (`sg`). The old `card_source_overrides.json` "no further overrides needed" analysis was circular — both diffed sides shared the parser blind spot.

**Fix:** `jechto/Tachyons-lab front/src/app/data/data.json` is now a **borrowed build input**, not just a validation oracle.

- **Pin:** commit `2ce0c8fe4af685d2a3cf5d5fd8f80fe60c6115de` (latest touching the file as of 2026-06-12; data updated 2026-06-09; GPL-3.0). Fetched by `pnpm data:fetch`; `--from-spikes` uses the Phase-0 local copy `spikes/tachyons-data.json`, **sha256-verified byte-identical** to the pinned raw file on 2026-06-12 (`2b7e1f3f…540b`).
- **Derivation (scripts/build-cards.ts):** event skills = union of master flat `eventSkills` ∪ GameTora `chain/random` ∪ Tachyons-lab `all_events` (`chain_events`→`chain`, `dates`→`date_event`, `random_events`→`random_event`), taking reward types `Skill Hint`/`Skill Choice`/`sg`. Precedence when a skill appears in several categories: **chain > date_event > random_event**.
- **Direct grants (`sg`) — DECISION: included**, classified by containing event category. They are genuinely obtainable skills on the card (learned outright, no SP). Known instances: Sasami 10074/30080 debuff trio 200283 Wallflower / 200353 Corner Recovery × / 200521 Running Idle (random events) and Bamboo Memory 30042's 200521 (chain). Coverage only reports skills the user targets, so listing debuffs is honest, not noisy. Caveat: `SkillSourceType` has no separate "grant" kind — a grant displays as its event tier; revisit if Module 2 ever costs these (they cost 0 SP).
- **Residual hand-curation:** Tachyons-lab `special_events` (bond-line events, e.g. "A Bond with Tazuna") are NOT auto-classified; those skills reach the generator only via the master flat list, default to `random_event`, and `card_source_overrides.json` re-types the 9 known entries to `date_event` (each entry now cites its event).
- **Hint levels:** `CardSkill.hintLevels` (hint_pool only) comes from Tachyons-lab `hints_table.hint_level` = master.mdb `single_mode_hint_gain.hint_value_2`. Verified equal on all 1,263 pool rows of the 217 pinned cards (and =1 on all 1,282 live-mdb rows), so no separate generated override file was needed — the borrowed file alone keeps the build reproducible.
- **Build-time oracle:** `assertTachyonsParity` (scripts/build-cards.ts, run in `pnpm data:build` after overrides — deliberately in the build, not vitest, so a data refresh cannot ship without it) asserts every Global-released Tachyons-attributed skill appears on the emitted record with a compatible sourceType, and hint pools + hint levels match exactly. Result on this pin pair: **0 problems**; the recompute also surfaced one extra chain choice the review missed (30011 Ines Fujin +201282).
- Net data delta vs v1: +27 event entries / 2 re-typings across 217 cards, all spot-verified against GameTora live by the review; the 16 review-named entries all land (asserted in `scripts/outputs.test.ts`).

---

## 5. UmaExtractor roster import (Module 1/3 input)

- **Tool:** https://github.com/xancia/UmaExtractor (v2.1; uma.guide team; fork of rockisch/umadump). Frida-attaches to the running Global client on the Veteran List screen, memory-scans for the msgpack `trained_chara_array`, dumps `data.json` = **the game API's own trained-chara schema, raw master.mdb IDs, untransformed** (top-level `viewer_id`/`owner_viewer_id` scrubbed).
- **Per-veteran fields:** `card_id`, stats (`speed/stamina/power/guts/wiz`), `rank` + `rank_score`, aptitudes as ints 1–8 (G..S; `proper_distance_*`, `proper_ground_*`, `proper_running_style_*`), `skill_array [{skill_id, level}]` (= master.mdb skill ids, same id-space as simulator data), `factor_id_array` (sparks), `succession_chara_array` (full legacy tree: position_id 10/11/12 = parent1+its parents, 20/21/22 = parent2 side).

### Factor (spark) ID encoding — verified vs master.mdb succession_factor/_effect
- Last 1–2 digits = star count (1–3), rest classifies:
  - 3-digit `101–503`: **blue** stat spark; hundreds digit 1–5 = spd/sta/pow/gut/wit.
  - 4-digit: **pink** aptitude; group 11/12 = turf/dirt, 21–24 = front/pace/late/end, 31–34 = sprint/mile/medium/long.
  - 7-digit `1xxxxSS`: race spark (G1 win); `2xxxxSS`: **white skill spark**; `3xxxxSS`: scenario spark.
  - 8-digit: **green** unique-skill spark; floor(id/100) = source card_id.
- **Factor→skillId join (lookup table needed):** master.mdb `succession_factor.factor_group_id` → `succession_factor_effect` rows with `target_type=41`, `value_1` = granted skill id (white: ≈ group×10+2, the ○ variant; green: the **9xxxxx inherited-unique** id — store that + sourceCardId). Race sparks grant stats AND a lv1 skill; scenario sparks stats only. Table dumps: Apolexian/clairvoyance `masterdb_readable` (local: `spikes/repos/clairvoyance-masterdb/`); schemas: SimpleSandman/UmaMusumeAPI C# models.
- **Format drift:** 2021 sample uses `factor_id_array` (flat ints) on parents; current Global export gives parents `factor_info_array` (objects) — importer must accept both (reference consumer: TheCing/uma-parent-viewer `enrich_data.py`).

### Mapping → our `Parent` record
`id ← trained_chara_id` (synthesize for legacy-tree nodes) · `umaId ← card_id` · `blueSpark/pinkSpark/greenSpark/whiteSparks ←` decoded factors per above · `grandparents ←` succession positions 10/20 (11/12/21/22 available if model ever extends) · `stats ← {spd:speed,…,wit:wiz}` · `rating ←` letter via single_mode_rank ladder (12=B+, 13=A …), keep `rank_score` · `source ← 'mine'` (export is always the player's own list) · `importSource ← 'umaextractor'`.

**Gaps:** `affinityHint` not in export (computable later from `succession_relation`/`_member` tables — out of scope v1, manual entry per plan); mine-vs-rental not distinguishable for tree nodes; race/scenario sparks don't fit `whiteSparks` (product decision: extend model or drop with documented loss — they grant stats at inheritance); no name strings (master-data lookups; ready-made maps in uma-parent-viewer `data/*_global.json`).

### Schema lock (adversarial follow-up, 2026-06-12 — corrections to the above)
Five converging sources pin the **current v2.1 Global format** (Werseter's metadata-validated client layouts, UmamusumeResponseAnalyzer's Gallop response classes, uma.guide RosterViewer production bundle, uma.moe ingest service, hakuraku types):
- Parents carry `factor_info_array` **in addition to** (not instead of) `factor_id_array`; entry shape exactly `{factor_id: int, level: int}` (level often 0; stars stay redundantly in `factor_id % 100`).
- **No top-level `chara_id`** exists (the xancia README claim is a documentation error).
- Nested `owner_viewer_id` / `succession_history_array[].viewer_id`/`rental_viewer_id` are **NOT scrubbed** — real friend viewer IDs survive (privacy note for any share feature; also a possible mine-vs-rental signal). Per xancia issue #1, a borrowed parent from the current run can appear in the extraction (mine-vs-rental noise).
- Consumer acceptance rules to mirror (from uma.guide's bundle): accept bare array OR `{trained_chara_array: [...]}`; prefer `factor_info_array` with `factor_id_array` fallback at both veteran and parent levels; treat `level` outside 1–9 as absent; `pow/power` + `wiz/wisdom` key dualities.
- JP-side future drift to watch: JP has already dropped `factor_id_array` and added `factor_extend_array` (+ a `hisotry_type` typo key); Global had not as of the May-2026 client layout.

**Sample exports:** the umadump repo-root sample (`spikes/repos/umadump/data.json`, 180 veterans) is actually **Global-launch-era 2025-06-29** (not 2021 JP as first assessed) — it simply predates Global adding `factor_info_array` (added between Jul and Nov 2025). Two current-format Global fixtures recovered: `spikes/samples/werseter-umadump-rawdump-global-2025-11.json` and `spikes/samples/werseter-umadump2-memreader-global-2026-06.json` (the latter partially reconstructed/zero-filled).

**✅ Schema CONFIRMED against the user's own current export (2026-06-12):** `spikes/samples/sun-umaextractor-global-2026-06.json` (4.2 MB, 235 veterans, bare array). Matches the locked spec exactly: top-level `viewer_id`/`owner_viewer_id` scrubbed; no `chara_id`; both `factor_id_array` + `factor_info_array {factor_id, level}` at veteran AND parent levels; succession positions 10/20/11/12/21/22; **`history_type` spelled correctly** (JP's `hisotry_type` typo absent); no `factor_extend_array` (Global has not adopted the JP format drift). Previously uncatalogued fields present: `arrive_route_race_id`, `owner_trained_chara_id`, `single_mode_chara_id` (importer should ignore unknown keys). ⚠ Privacy confirmed: parent `owner_viewer_id` and `succession_history_array[].viewer_id`/`rental_viewer_id` carry real friend IDs — **this file stays in gitignored `spikes/`, and any future share/export feature must strip these fields.**

---

## 6. Rental-site deep links (Module 1)

**All three sites are deep-linkable.** Two-stage verification 2026-06-12: static bundle analysis, then **real-browser confirmation** (Playwright/Chromium: drive filter UI → capture URL → reload in fresh context → confirm filter rehydration). The Residual-Spec → pre-filled-search-URL feature (plan §7.4) is viable everywhere.

| Site | Template | Verified behavior & caveats |
|---|---|---|
| ChronoGenesis | `https://chronogenesis.net/friend_search?query=<encodeURIComponent(base64(urlencoded inner querystring))>` | URL written on Search/pagination click (not live-synced); fresh-context reload restores spark buckets, counts, trainee portrait. Inner keys (browser-observed): spark buckets `leg_/sla_/slb_/tot_` + mode suffix `All\|Any\|Excl`, values = `factorId*10+stars`; plus `card_id, common_count, common_legacy_count, skill_count, g1_count, blue_count, race_bonus, page`. Factor IDs shared with uma.moe (Speed=10, Turf=110, Long=340…). Search execution gated by Cloudflare Turnstile for humans (sitekey in bundle) though headless automation saw no widget — deep links are for humans anyway. |
| pure-db | `https://uma.pure-db.com/{locale}/search?searchInfo=<encodeURIComponent(base64(JSON))>` (also `/advanced-search`) | **Deep-linkable by design**: copy-share-link button + live `history.replaceState` sync. ⚠ Old `uma-global.pure-db.com/#/search` URLs are DEAD (301 → `uma.pure-db.com/{locale}/…`) — plan §3 link updated. Payload keys: `gameServerCode, partnerCardIds, supportCardId, blueFactors/redFactors/greenFactors/…` ; factor entries `{groupId, count(1-3), searchType:0\|1\|2, enabled}`; blue groupIds 1–5, red banded 11-12/21-24/31-34. Locales: en-us, ja-jp, ko-kr, zh-cn, zh-tw. |
| uma.moe | `https://uma.moe/database?filters=<encodeURIComponent(base64(JSON))>[&page=N][&trainer_id=…]` | `/inheritance` client-redirects to `/database` **preserving** the param. Compact keys: `{"b":[[10,2,9]],"p":[[340,1,9]],"g":[[0,1,9]],"lb":4}` — triplets `[factorId, minStars, maxStars]`. Entire site open-source (uma-moe/umamoe-frontend → authoritative serialization spec) and has a JSON API (`/api/v3/search`, `/api/v4/...`) third parties already call. Custom anti-bot "browser check" can empty result rows in headless, but filter restoration still works. |

- **ChronoGenesis API posture CONFIRMED verbatim** (footer bundle): no public API; scrapers blocked after an abuse incident; *"If you need any future datasets for your own use case, please email me and we'll see whether they can be provided"* — contact: **chronogenesis.net@protonmail.com**. → Plan §14.5 action: send that email early.
- Build note: generate links with the sites' own value encodings above; for pure-db, links generated by its own copy button are the canonical form (hand-constructed payloads render but weren't fully verifiable server-side).

---

## 6b. Live GLOBAL master.mdb + supplementary extractions (2026-06-12)

Fetched via umalator-global's own pipeline (`scripts/master-data/fetch-master-db.ts` + esbuild workaround): **resource_version 10006400, app 1.22.1** (updated 2026-06-11), 13.25 MB SQLite at `spikes/repos/umalator-global/db/master.mdb`; extractions in `db/extract/*.json` (hint effects, unique effects, succession factor/effect, white-spark skill map, relation tables, chara names). Key confirmations recorded in `docs/mechanics-notes.md` §8–§9 (GameTora effects-matrix semantics byte-identical for all 220 cards; rarity level-cap convention; factor→skill join with the 29-group shortcut-failure list; full affinity algorithm validated against Ice's sheet). Tested extraction SQL for the Phase 1 pipeline is in `spikes/phase0-completion-results.json` (follow-up 4, last finding).

---

## 7. Local spike artifacts (gitignored)

| Path | What |
|---|---|
| `spikes/repos/{umalator-global, uma-tools, uma-skill-tools, kachi-uma-tools}` | Shallow clones, 2026-06-12 |
| `spikes/repos/uma-tools/icons/` | **415 MB icon dump — build input for `scripts/build-icons.ts`** (curated WebP subset → `public/data/icons/`, §2.1). Cygames art, never committed. |
| `spikes/repos/{UmaExtractor, umadump, uma-parent-viewer, clairvoyance-masterdb}` | Cloned/downloaded during spikes |
| `spikes/repos/umalator-global/db/` | **Live GLOBAL master.mdb v10006400 + `extract/*.json`** (fetched 2026-06-12) |
| `spikes/samples/werseter-*.json` | Current-format Global UmaExtractor fixtures (2025-11 raw dump; 2026-06 memreader) |
| `spikes/tachyons-data.json`, `spikes/urarawin-db.json` | Downloaded validation datasets |
| `spikes/phase0-results.json`, `spikes/phase0-completion-results.json` | Full structured findings of all Phase 0 spike + verification agents |
| `spikes/repos/umalator-global/scripts/adversarial-smoke.ts` | Headless engine smoke-test repro |
| `spikes/ocr/` | OCR skill-screen spike (tesseract.js + sharp), 2026-06-15 — see §8.2 |

---

## 8. Brainstorm-session research (2026-06-14/15)

Module design specs in `docs/superpowers/specs/` (M4/M3/M1/M2); decisions also in memory + plan §3. New external findings + borrowed deps, per P1:

### 8.1 M2 input — post-run skill screen is NOT file-extractable (verified ON-DISK, 2026-06-15)
Direct inspection of the Global client's local data (`%USERPROFILE%\AppData\LocalLow\Cygames\Umamusume`): the only save `d/SaveData.db` is a single **211-row obfuscated key-value `AppSetting` table** (~35 KB) — settings only; `master\master.mdb` is the 338-table static game DB; `dat/` are content-addressed asset bundles. **No veteran/run/skill-menu state on disk.** **Re-verified after a completed run (2026-06-15): no new file or table appeared; `SaveData.db` is still the 211-row `AppSetting` store (only ~900 B of updated setting values), confirming a finished run persists NO skill-screen state.** Packet tools (CarrotJuicer → ResponseAnalyzer/hakuraku/UmaLauncher) are DMM/JP-only; Steam/Global adds **CrackProof** kernel anti-cheat. **UmaExtractor** (live process-memory scan, works on Global) yields only the *finished-uma* record (→ M1 roster), not the in-career menu. ⇒ M2 input = Carry-from-M4 + manual; OCR deferred.

### 8.2 OCR spike (deferred M2 path) — `spikes/ocr/` (built 2026-06-15)
**New dep:** `tesseract.js` (Apache-2.0) in `spikes/ocr/` (isolated; `sharp` already a root dep). Approach: OCR the skill **name** → fuzzy-match (Sørensen–Dice bigrams) to the 578-skill dataset → **cost from the dataset, not OCR'd digits**; only available-SP is read + human-confirmed. **Validated on 16 real Global Steam screenshots of the in-career "Learn" screen (1573×855, 2026-06-15):** available-SP **16/16 correct** (`2285`, 96% conf) via a dedicated SP-pill crop (greyscale → `threshold(185)` → PSM 6 + digit whitelist — plain greyscale fails on orange-on-white); skill **names matched across the whole scrollable list** (high/med tier, incl. `◎`/`○` aptitude variants). Crops are **proportional** (fractions of W/H) so they track resolution; full-image OCR without cropping invents false rows (the right-panel "Item Request" button → "Restart"). Matcher 10/10 on mangled names; pipeline 5/5 on a synthetic screen earlier. **Resolved by a verification workflow (vs live `master.mdb`, 2026-06-15):** our `baseSpCost` is **CORRECT** (`single_mode_skill_need_point` = 160/200/200, matches our dataset). Whites reconcile at ×0.8 because **Fast Learner is active** (hint 10% + FL 10%, applied *additively* — refuting umalator's multiplicative ×0.81). Gold Radiant Star's stored 200 is the white-equivalent base; its 320 on-screen is the gold 2× premium (umalator bundles the white prereq). Two real, non-data follow-ups → `mechanics-notes §7/§10`: (i) make Fast Learner additive in our cost model, (ii) apply the gold premium in `coverage.ts` cost derivation. Reference patterns (NOT vendored): UmaTools (GPL-3.0) preprocess + fuzzy-matcher; Magody/Umaplay (PaddleOCR+YOLO — automation/ToS); `lt900ed/receipt_factor` = inspiration only (JP-hardcoded, unlicensed, reads factors not skills).

### 8.3 M1 rental-parent search feasibility (researched 2026-06-14)
**uma.moe inheritance API** (`/api/v3/search` + `/api/v4/user/profile/{id}`) — the only live, CORS-open, residual-spec-matching rental-parent source (per-color spark filters, server-side affinity, `follower_num=999`=open; spark int = `factorId×10+star`). **Auth-gated** (per-user `X-API-Key` or Turnstile; no self-serve key → operator email). Backend open-source but **AGPL-3.0** → port affinity (`affinity.py`) with attribution, don't vendor. P3: a record ≠ a borrowable rental. ⇒ M1 v1 = paste-parser + deep-links; native search deferred. ChronoGenesis = email-invite only (bot-blocked); Pure-DB = deep-link only.

### 8.4 M3 timeline sources (researched 2026-06-14)
Full classified list in plan §3 ("Timeline / schedule / banner / patch sources"). Authority = `umamusume.com/news/` (cite the `/news/<id>/` permalink). Auto-import forecasts: Game8 Upcoming Banners, SoulEC/Phoenix Google-Sheets CSV exports, uma.guide CM schedule. GameTora (Foresight Timeline / CM Viewer / Gacha History) = cite-only (ToS). Datamined via vendored umalator `sync:data` (server='jp' preview, P4).

**CM-schedule synthesis (added 2026-06-15):** `scripts/build-timeline.ts` appends *predicted* upcoming CMs via `synthesizeUpcomingCms` (`src/core/cmSynthesis.ts`). Cup name + track geometry come from `cm_tracks.json` (uma.guide, https://uma.guide/cm-schedule/, index = Global CM#); dates by **monthly cadence** from the latest confirmed CM (`addMonths`, horizon 3). Predictions carry `tier:'prediction'`, `status:'unconfirmed'`, **no `courseId`** → excluded from M4's `projectCmSchedule`. Overrides in `timeline_overrides.json` win (a present CM# is never re-predicted). Regenerate timeline-only with `pnpm timeline:rebuild` (reads committed `public/data` inputs; no `scripts/borrowed/` needed). The JP→Global pace multiplier (`predictGlobalDate`, 1.422) is NOT used for CM dates — CMs are monthly, not pace-driven; that predictor is reserved for future banner/patch forecasting.

### 8.5 Affinity — refinements (verified; `mechanics-notes.md` §3)
+3 affinity per G1 won by **both** members of a compared pair (post-2nd-anniversary; G2/G3 now 0), `dataVersion`-gated. Grandparent weakness is **emergent** from a smaller per-member score (no flat ×0.5 — myth). Never feed the ◎/◯/△ rank or the displayed *sum* into the proc formula — use each member's individual score. Cross-ref uma-moe `affinity.py`.

---

## 9. uma-tiers support-card scorer (M1.6)

### uma-tiers support-card scorer (M1.6)
- Source: https://github.com/Euophrys/umamusume-tierlist (branch `main`), **MIT** (LICENSE vendored).
- Pinned commit: `cb459aaad7d45c0ebc9eaaeca21a87c9a8905fb1`; retrieved 2026-06-26.
- Vendored verbatim: `src/components/tierlist-calc.js`, `src/cards/gl.js`, `src/card-events.js`, `src/scenarios.js` → `src/vendor/uma-tiers/`.
- Use: the M1.6 support-card pool's "Effect" score (URA-scenario training power). **Off-axis caveat:** scores career-training power, not inheritance/CM wishlist value — surfaced as an estimate alongside the primary "Matches" axis. Re-pull on euophrys' Global updates.
