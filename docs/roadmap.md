# uma-cm-planner — Roadmap

> **Created 2026-06-24.** Living document — update phase status as work lands.
> Authoritative *plan* is still [uma-cm-planner-plan.md](../uma-cm-planner-plan.md); authoritative *current state* is [CLAUDE.md](../CLAUDE.md). This file is the **sequencing layer** on top of them.

## Driver & spine

**Optimize for: design-system + mockup/handoff fidelity.** The built module UIs are functional skeletons far below their design references (fidelity audit: M4 ~25%, M3 ~25%, M2 ~20%, M1 ~8%). The references are the spec. The fastest way to close ~80% of that gap was to build the **one shared visual grammar** the four mockups agree on (Phase 1 ✅), then apply it module by module.

**Sequence: system-first, then deep per module.** Phase 1 (design system) shipped. **Amended 2026-06-25:** a high-fidelity design handoff for the **M1 Inheritance workbench** then landed, so **M1 jumps ahead of M4-Phase-2** — it is now the active build (see *M1 — Inheritance workbench* below). M4-Phase-2 is **paused**. Two **sidelists** run in parallel, independent of the fidelity track.

This roadmap was set after a competitive analysis (2026-06-24) of hakuraku / UmaTools / TheCing-uma-tools. Conclusion: **fork nothing, keep our umalator engine + 4-module architecture, harvest hakuraku's inheritance math for M1 and mine UmaTools UX for fidelity.** See [hakuraku-m1-harvest.md](hakuraku-m1-harvest.md).

**Update (2026-06-24) — M4 main-page redesign landed (merged to main).** A pre-roadmap restructure of `/` into a **3-column dual-build flip-card planner** with a tabbed working panel (Unique · Stamina · Accel · Skills · Mini-sim), engine-derived **stamina + accel checkers**, and a Mini-sim tab (retiring `RaceSimCard`). It **seeded the Phase-1 design tokens** (`:root --cmp-*` in `cm-planner.css`) and **built the two UX-harvest framings** the §Cross-cutting / Phase-2 notes called for (stamina viability + accel timing). Spec/plan: [design](superpowers/specs/2026-06-24-m4-main-page-redesign-design.md) · [plan](superpowers/plans/2026-06-24-m4-main-page-redesign.md).

**Update (2026-06-25) — M4 inventory + sidebar UX refinements landed (merged to main).** A follow-on polish pass on the dual-build planner: per-row **uma1/uma2 slot-pick badges + collision auto-duplicate**, an inventory **edit-mode gate**, the outline **backpack icon** + square collapsed sliver, **uma2 Save/Save As/auto-save unified with uma1**, a **centered track-change confirm dialog**, the `StatInput` field fix, and **full red `--uma-accent` theming**. Spec/plan: [design](superpowers/specs/2026-06-24-m4-inventory-sidebar-refinements-design.md) · [plan](superpowers/plans/2026-06-24-m4-inventory-sidebar-refinements.md). **824 tests.**

**Update (2026-06-25) — Phase 1 design-system foundation landed (PR #9).** Themeable (light default + dark) semantic tokens in `src/styles/design-system/`, `ds-*` component classes, a `/styleguide` route, and a Light/Dark/System toggle in settings. Existing token names kept (271 usages untouched); M4 + app shell verified in both themes with no light regression. **862 tests.** Spec [design](superpowers/specs/2026-06-25-design-system-foundation-design.md) · [plan](superpowers/plans/2026-06-25-design-system-foundation.md).

**Update (2026-06-25) — pivoted to the M1 Inheritance workbench.** A high-fidelity claude.ai/design handoff (**Support Card Builder + Parent Picker**) landed at [docs/modules/design_handoff_support_card_builder/](modules/design_handoff_support_card_builder/) (README + 7 screenshots + the `.dc.html` prototype + the bundled `_ds` design system). It **becomes the M1 build** (un-stub `/inheritance`), **supersedes** the 2026-06-14 M1 spec by expanding it into one dense workbench that also absorbs the **coverage matrix + support-card deck builder** (the UI removed 2026-06-15), and **subsumes the M4 §3 card-hint sourcing** (just the Chain/Random columns of M1's matrix) — so that item is **dropped from P2**. M1 is built **card-by-card** in small phases (M1.0–M1.8 below). M4-Phase-2 is **paused**. See *M1 — Inheritance workbench*.

**Update (2026-07-01→02) — Availability epic shipped (PRs #25–#28 + planning-horizon branch).** A new track that interleaved with M1: **foresight** (rolling JP→Global date projection, #25) → **JP-ahead content baked in** (317 cards #26, 170 umas #27, 962 skills + 170 inherited-uniques #28+horizon; all `server:'jp'` with projected/announced Global dates) → the **app-wide planning horizon** (`Current | CM ▾ | All JP` header lens; one `useAvailability().visible()` predicate across every availability site; tier chips; foresight readout; hypothetical banner at All-JP). This **completes the P3 "release dates" data task and M4's "Now/Upcoming/Future" deferred item** ahead of schedule. Merged as **PR #30**; a follow-on senior review (**PR #29**) fixed the M2 jp-wishlist gate, cross-server variant families, and unified the calibration clock. Remaining in the track: **availability #4 — rebalance patches** (model JP balance changes for Global previews) + the [followups list](superpowers/plans/2026-07-02-planning-horizon-followups.md).

**Update (2026-07-10) — M2 post-run capture companion built + validated (branch `docs/m2-capture-method`, docs-only, unmerged).** A design + spike track that realizes M2's F1 "native companion" as a **memory-reader** (the F1 spec had left the producer OCR-only). Decision: **CarrotJuicer-style packet interception is rejected for Global** (JP/DMM-only); the Global-compatible path is **UmaExtractor-style memory reading**. Built in gitignored `spikes/m2-capture/`: **`capture_full.py`** (Frida + IL2CPP — heap-scans for the `WorkSingleModeCharaData` object to read final **stats/aptitudes/SP** hook-free, + a `UpdateSkillPoint` hook to read the **purchasable skills with real discounted costs + hint levels**) → **`career-capture.json`** → **`map_to_bundle.mjs`** → a valid **`CaptureBundle`** (verified against the app's own `parseCaptureBundle`). One clean `A→B→C→D` game flow (post-run page → skill-purchase screen), **no freeze/stutter**, nothing typed by hand. Memory-**read only**, private-use (same posture as the M1 UmaExtractor importer). Spec: [2026-07-05-m2-post-run-capture-method-design.md](superpowers/specs/2026-07-05-m2-post-run-capture-method-design.md) (Appendices A–L = full journey + gotchas). **Remaining:** a **UmaExtractor-style GUI** ([handoff](superpowers/plans/2026-07-10-m2-capture-gui-handoff.md)) + wiring the import into `/sp-optimizer` as the one-click **F1.5 in-app adapter** (reads the plan's course → resolves aptitudes automatically).

**Update (2026-07-03) — Availability epic CLOSED: rebalance patches shipped (PRs #31–#32).** The epic's last sub-project. **4a** (PR #31): each rebalanced skill becomes a **version-set** (`SkillRecord.rebalance`) — an AUTO gametora JP-vs-Global condition diff surfaces 88 uncurated candidates, a HAND-curated `data-overrides/rebalances.json` (ships empty) promotes real versions with dates/values/sources, `effectiveVersion`/`resolveVersion` pick the horizon-effective (or user-pinned, `WishlistItem.skillVer?`) version, badges + a skill-detail history section + an M3 timeline patch lane surface it. **4b** (PR #32): the engine gained `skillPatches` (condition/modifier/duration/cooldown overrides, threaded like the `skillLevels` precedent, **identity-backstopped — fidelity 0.2202 unchanged**), injected into every M4 sim surface via `src/core/rebalancePatches.ts`, with patch-aware cache signatures throughout and a `PatchedSimNote` honesty marker (incl. honest per-uma attribution in the mini-sim compare, fixed during final review). **1299 tests.** Spec/plans: [design](superpowers/specs/2026-07-03-rebalance-patches-design.md) · [4a plan](superpowers/plans/2026-07-03-rebalance-patches-4a.md) · [4b plan](superpowers/plans/2026-07-03-rebalance-patches-4b.md). **The availability epic (#25 → #26 → #27 → #28 → #29 → #30 → #31 → #32) is now fully complete** — the only open thread is real curated `rebalances.json` entries, which need JP patch-note research whenever a specific rebalance should be modeled.

---

## Sidelists (parallel, non-blocking)

### S1 — Engine re-platform TS bundle → Rust/WASM (v0.27.0) ✅ DONE (2026-07-10)
**Superseded the old "bump v0.14.2 → v0.18.0" plan** — upstream re-platformed off TypeScript to a Rust core compiled to WebAssembly, so the right move was to re-platform onto the wasm pkg (v0.27.0, pin `484539f5`), not a TS pin bump. Done across an 11-task SDD plan: wasm build pipeline, multi-fire Rust port + determinism sort + upstream settings-thread fix (`engine-patches/2026-07-10-multifire-rust.patch`), wasm adapter, worker loader, fidelity re-baseline, one-pin data+engine bump, old-bundle deletion. **One pin now covers engine + data**; `ENGINE_DATA_DATE` gates rebalance pin-lag (July-1 95-skill patch is in-pin, no chips). 1536 tests. **P3 cutover:** every simulated number shifts (13 releases of upstream physics + fresh data) — expected and desirable, not a regression. Spec: [design](superpowers/specs/2026-07-10-sim-engine-wasm-replatform-design.md) · [plan](superpowers/plans/2026-07-10-sim-engine-wasm-replatform.md); fidelity + determinism-sort adjudication in [mechanics-notes §12](mechanics-notes.md). `docs/engine-update-todo.md` was **deleted** (premise void).

**Unlocked follow-ups** (spec §10 — the Rust engine natively exposes what the old TS bundle couldn't): (1) `runContestedCompare` real-opponent fields → the deferred **near-lane skills** (Slipstream) + a dedicated **full race-sim page**; (2) **`forcedPositions`/`forcedRank` UI** (VFalator-style "force at meter" — now natively honored, the old spike's blocker is gone); (3) surface **position-keep / Power Conservation / rushed / dueling** telemetry in charts + overlays; (4) `runRaceSim` event-log-driven overlay upgrades.

**Open maintainer items** (from the merge — see [PR #51](https://github.com/Solst1cee/uma-cm-planner/pull/51)): interactive full-app smoke (start with M2's first Analyze click + the Stamina tab); deployed-site parity eyeball (mechanics-notes §12.3); the no-chip visual check on "The Duty of Dignity Calls"; cold-clone `pnpm sim:build` reproduction run (flow documented in `src/sim/vendor/README.md`, not yet executed end-to-end).

### S2 — Public-release data swap *(only if/when sharing publicly)*
Swap private-feed defaults → `ManualStatTargets` / curated JSON before any public deploy (per the scraping-exception posture). Parked until a public release is an actual goal.

### S3 — M4 chart/UI polish + mechanics review + provenance *(surfaced 2026-06-25)*
Small, non-blocking follow-ups from the inventory/sidebar refinements pass. Do opportunistically or fold into M4-Phase-2 (when it resumes).
- **Recompute wishlist `projectedL` on every chart run** so the sidebar totals stay current.
- **Polish the per-tab hint ("?") buttons** — clearer copy, consistent styling/placement/dismiss.
- **Accel-tab / Position-column label readability** — exact/range forms (`CM = 6 · LoH = 8`; `CM 5–6 · LoH 6–8`) instead of `≥`/`≤`.
- **Cap skill-plate max width in the charts.**
- **Verify stamina mechanics for rushed (かかり), position-struggle, and dueling** — cross-check engine vs in-game; record in [docs/mechanics-notes.md](mechanics-notes.md) §10.
- **Add provenance/attribution per submodule for adopted tools** — per **P1 (REUSE FIRST)**: record source URL + retrieval date in code comments **and** [docs/provenance.md](provenance.md).

### A1 (future improvement) — inline effect-chips across M4
Render colored effect-chips (SPD/ACC/REC/HEAL/DBF, from `skills.json` effect data) inline next to *every* skill name on M4 (sidebar wishlist, both chart panels, skill detail) — mockup-grammar polish using P1's `.ds-efb`. Deferred from P2; do opportunistically.

---

## Phase 1 — Design-system foundation ✅ DONE (2026-06-25, PR #9)

One shared, themeable (light default + dark) token system + `ds-*` component classes + `/styleguide` + a Light/Dark/System settings toggle. Existing token names kept (271 usages untouched); M4 + app shell verified in both themes, zero light regression; 862 tests. Spec/plan dated 2026-06-25.

---

## M1 — Inheritance workbench  🟧 ACTIVE BUILD (from the 2026-06-25 design handoff)

**The Inheritance module (M1) is now the active build, ahead of M4-Phase-2.** Source of truth = the handoff at [docs/modules/design_handoff_support_card_builder/](modules/design_handoff_support_card_builder/) (`README.md` is a near-complete spec; `Support Card Builder.dc.html` holds the canonical data-model + computations; 7 screenshots anchor the visuals). It is a single dense **workbench** that sits **downstream of the CM Planner** (consumes the active `CmPlan`) and answers *"how do I actually obtain all of this?"* — unifying inheritance parents, a support-card deck builder, and a skill coverage/sourcing matrix.

**Route:** un-stub `/inheritance` (trim `STUB_MODULES` in `src/app/App.tsx`). Built on *our* design system (handoff is light-theme → dark-capable for free via P1).

**Build order — small phases, ONE card/panel each.** Per P6 (pure core before UI). Each phase gets its own spec → plan → subagent-driven build, design-system-skinned, and (where math is involved) **validated vs umamily.moe / Ice's sheet**:

- ✅ **M1.0 — Core math.** *Landed (logic) 2026-06-25; LIVE 2026-07-05.* `winBonus.ts` (2.0 G1-only +3), `lineageAffinity.ts` adapter, `spark.ts` per-member affinity resolver (de-approximates), `Parent.wonRaces`, rental target-tier helper. The UmaExtractor `wonRaces` import shipped with M1.4 (`umaExtractor.ts` maps `win_saddle_id_array`, persisted + threaded into both affinity paths); the G1 saddle-id gate closed 2026-07-05 → **win-bonus is now live end-to-end**. Remaining: the S1 base-relation-points refresh (post-2.0 `master.mdb`) auto-arrives via a data build. Spec/plan 2026-06-25.
- ✅ **M1.1 — Route + workbench shell + Plan-context header.** *Landed 2026-06-26.* Un-stubbed `/inheritance` (nav + route); `src/features/inheritance/` with the 3-col grid (`minmax(290,320) 1fr minmax(290,320)`, collapses <1120px → 1col) of labeled placeholder panels (M1.2–M1.8 replace them); the top plan-context bar (`PLAN #N`, name, "From CM Planner · {track} Racecourse", surface/distance/strategy chips) reading `uma1Plan` — track name resolved via lazy `courseCatalog` (injectable `deps` for tests), distance chip via core `distanceClass` (game-correct, NOT the mockup's loose label). Pure `planContextView` + presentational `PlanContextHeaderView` (`…View` suffix avoids the Windows case-FS clash with `planContextHeader.ts`). **880 tests.** Plan: [2026-06-26-m1-1-workbench-shell.md](superpowers/plans/2026-06-26-m1-1-workbench-shell.md).
- ✅ **M1.2 — "Uma plan" card + inventory popover.** *Landed 2026-06-26.* A `cmp-plan-card` with an **"Uma plan"** header: portrait + name/epithet + the plan's three active aptitude chips (`umaPlanAptChips` = distance/surface/strategy via `currentAptitudeKeys`+`targetAptitude`, so all three always show + follow the selected plan — e.g. "Medium S · Turf A · Late A"). A bigger **inventory-icon** button in the header pops the **shared `PlanInventoryCard`** as a **dismiss-on-outside popover anchored to the icon** (top-right corner at the icon's bottom border). Clicking a row loads that plan as current (uma1) and closes the popover; the inventory's **1/2 slot badges** and **settings sub-card** are hidden via new `hideSlotBadges`/`hideSettings` props (default off → M4 unchanged). (Iterated on feedback: search-card → inventory-card-in-column → icon-anchored popover; chips fixed from race-derived → plan pink-target grades.) **870 tests** (after the parallel deck-suggester removal). Plan: [m1-2-uma-plan-card](superpowers/plans/2026-06-26-m1-2-uma-plan-card.md) (early version; UI iterated past it).
- ✅ **M1.3 — "Plan targets" card.** *Landed + iterated 2026-06-26 (shipped in PR #12).* Collapsible `cmp-plan-card` (left column): **blue** stat sparks (`sparkGoals.blue`) as chips with `−/+`/`×`/add-stat, capped at a **shared 18★ total across all stats** (`+` disabled when full); **pink** as **required career-start stars matching the planner sidebar** — `pinkSparkRows` scans every targeted aptitude (`planAptKeys`, not just the race's active keys — the off-race-target bug), an 18★ budget with an inline over-budget ⚠, a `midRunSparkRows` "Mid-run spark" readout, and a `pinkComputable` guard; **wishlist** = planner-style skill plates (`SkillDetailDisclosure` w/o `traceContext`) that are **editable + addable** (per-plate `×` + a `SkillPicker`). M1 edits **auto-save** (`editPlan` = `setPlan` + `saveCurrentPlan`). Pure helpers `planTargets.ts` (TDD); presentational `PlanTargetsCard` stays provider-free (page passes inventory/plates/picker as nodes). **893 tests.**
- ✅ **M1.4 — "Inheritance" card.** *Merged (M1.4 core 2026-07-01; 4th SKILL filter PR #39 2026-07-03).* Parent 1 & 2 (Parent 2 **Owned/Draft/Rental** 3-mode slot — Draft/Rental shipped in M1.4b below), lineage spark chips (blue/pink/**green-unique**/white; gold=own / grey=GP), selection → `CmPlan.parents.{a,b}`. **UmaExtractor importer** (`UploadDataButton`/`useRoster`/`umaExtractor`/`factorDecode` → Dexie `parents`, `data.json` help popup). **Picker modal** with the **"Star Tracks" spark filter** — **four category cards STAT/APTITUDE/UNIQUE/SKILL(white)**, gold-legacy + total star meters under the ≤9★/≤3-member budget, keyboard-nav skill search for the green (unique) + white (skill) cards (independent `SkillSearch` state), sticky match-summary — + 2-column veteran tiles (pedigree rail + affinity + **◎/○/△ compatibility mark**). **Same-character parent guard** (by `charaId`, any outfit). **Find-candidates** heuristic pre-rank. *Deferred → M1.4b (now shipped):* Parent-2 rental builder + search-link; green 9xxxxx + saddle→G1 `wonRaces` reconciliation shipped with M1.7.
- ✅ **M1.5 — "Deck" card.** *Built + landed on main 2026-06-26 (re-targeted via `feat/m1-5-land-on-main`; PR #11 had merged it into the `feat/m1-inheritance-workbench` feature branch, which never propagated to main — a 3-way merge brought it onto main keeping M1.3).* 6-slot drag-drop deck (HTML5 DnD `text/card-id`) + per-slot 4-diamond LB stepper + remove/clear, in CM-planner card-head grammar. **Deck state is browser-local & plan-independent** (`scb_deck` / `scb_deck_active` / `scb_profiles`) — NOT `CmPlan.lockedDeckSlots`, NOT per-plan. Templates use an **autosave combobox** (no Save/Load buttons): name = active template (autosaves into it live), caret dropdown loads / **New** / per-row **×** delete; seeds a **Default** on first load, **New survives reloads**, typing an existing name switches (no overwrite), unnamed work is preserved as `Untitled`. The drag *source* / "+ Add" arrive with M1.6 (`addCardToDeck` seam + drop target built). **947 tests on main.** Spec/plan: [2026-06-26-m1-5-your-deck-card](superpowers/plans/2026-06-26-m1-5-your-deck-card.md).
- ✅ **M1.6 — "Support cards" card.** *Built — 2026-06-26 (rebased onto main 2026-06-27).* Pool panel in the center column: **Icon / Art / Plot** views, filters (Rarity / Type / Skill / free-text), Matches · Effect sort (hidden in Plot). euophrys training-power score vendored (`src/vendor/uma-tiers/`, MIT) — per-type scoring, `DEFAULT_SCENARIO` = MANT + bondPerDay:10, weights persisted to `scb_score_weights`. Cards without a euophrys row show `—` / omitted in Plot (P3 honesty). Tiles draggable + `+ Add` fills the deck at the tile's LB; Icon view is an accordion (icon + LB collapsed); **bundled in-game square card icons + stat-type badges**. **Known gap:** Stats filter + per-tile stat-line + tall full art deferred. **978 tests.** Spec/plan: [m1-6 design](superpowers/specs/2026-06-26-m1-6-support-card-pool-design.md) · [plan](superpowers/plans/2026-06-26-m1-6-support-card-pool.md).
- ✅ **M1.7 — "Obtainable vs. wishlist" card.** *Merged to main 2026-07-04 (PR #38).* Coverage **matrix** (`Innate | Event ‖ Parent | G.parent ‖ Hint | Chain | Random`, real per-member inherit-%, uncovered badge) + **bonus** list + Matrix/Coverage toggle. `greenSparkReconcile.ts` + `g1Saddle.ts` + `coverageMatrix.ts` + `CoverageMatrixCard` wired in `InheritancePage`. **Family-aware `○≡◎` matching** across all columns (gold/× separate); **Innate = the uma's non-unique kit from the engine bundle** (`loadInnateSkillsByUmaId`, white/gold — obviated the gametora innate pipeline); career training-**Event** column + event-detail popup (GameTora path B, private-use). **Data gate CLOSED 2026-07-05:** `g1_saddle_ids.json` (+ in-src copy) populated with the authoritative 34-id G1 whitelist derived from `master.mdb.single_mode_wins_saddle` (`win_saddle_type==3` ⇔ `race.grade==100`); win-bonus is now live (verified +3/shared-G1 on Sun's real roster). Derivation in mechanics-notes §3 + provenance §5.
- ✅ **M1.8 — "Target spark" card.** *Built 2026-07-04, landing via **PR #40**.* Right rail: the **blue/pink/white sparks a parent/rental still needs** to complete the plan *(synthesis)*. BLUE/PINK = plan goals verbatim (M1.3's `blueSparkRows`/`pinkSparkRows`); WHITE = M1.7's uncovered wishlist skills, live from `coverageResult` (family-aware `○≡◎`), with a defensive `'pending'` state and a green "✓ all obtainable" clear-state. Pure `buildTargetSpark()` (`targetSpark.ts`) = the reusable `{blue, pink, white}` seeding contract for **M1.4b's** rental "Load from Target spark"; provider-free `TargetSparkCard`. The last workbench `Placeholder` is gone — **every M1 card (M1.0–M1.8) is now built**. **1418 tests.** Spec: [design](superpowers/specs/2026-07-01-m1-8-target-spark-design.md) · [plan](superpowers/plans/2026-07-01-m1-8-target-spark.md).
- ✅ **M1.4b — Parent-2 rental builder + search-link.** *Landed 2026-07-06 (`feat/m1-4b-rental-builder`), closing M1.4's last deferral.* Parent 2 is a **3-mode slot** (`parent2Mode`, default `'owned'`): **Draft** (`RentalDraft` = a `SparkFilter[]` search spec + forced ◎/○/△ affinity tier, `RentalDraftPanel` reusing the M1.4 picker's Star Tracks filter via the extracted `useSparkFilterState` hook; a "Load from Target spark" seed button; three rental-search deep-links — `src/core/rentalSearch.ts` — **encoding ALL four spark colours (blue/pink/green/white) + ChronoGenesis `anyBlue`, LIVE-VERIFIED byte-exact against ~24 real working URLs** the maintainer captured (green/white factorIds reverse-engineered; provenance §6)) and **Rental** (`RentalParentEditor` — manual full veteran-shape `Parent` entry; UmaExtractor can't read a friend's *considered* rental, only your own trained roster, so manual entry is the v1). `resolveParent2(plan, rosterById)` is the one resolution point every Parent-2 consumer routes through; `InheritancePage`'s coverage `useMemo` now resolves Parent 2 through it, gating `planLineageAffinity` to `owned`/`rental` only (a draft's synthetic parent, `umaId:''`, never reaches lineage math) and passing M1.7's live uncovered-skill ids into `InheritanceCard`. All-additive/optional plan fields — no Dexie bump. **Post-build polish (2026-07-06):** M1.7 coverage chips labelled by member (**P1 / P2 / "Draft parent (P2)" / merged P1+P2**); Deck / Support / Coverage cards **collapsible**; icon-button card heads normalised to the 2.6rem text-head height; **cold-load CSS fix** — `InheritancePage` now imports `cm-planner.css` (the reused M4 card grammar was stranded in the lazy `/` chunk, so a deep-link/refresh to `/inheritance` rendered unstyled). **1499 tests.** Manual UI smoke done live with the maintainer. Spec/plan: [design](superpowers/specs/2026-07-06-m1-4b-rental-builder-design.md) · [plan](superpowers/plans/2026-07-06-m1-4b-rental-builder.md).

**Reuse:** M1 Plans 1–2 done (`CmPlan` SSOT + `affinity.ts`); `core/coverage.ts`/`sourcing.ts` exist (old removed UI's core); the handoff's data-model + `detailFor()` map onto them; recover the old coverage-matrix UI from git history (removed 2026-06-15) where useful; `SearchPicker` + DS classes from the bundled `_ds`. **Note (2026-06-25):** the old `core/deck.ts` greedy locked-slot **suggester** + `CmPlan.lockedDeckSlots` + `inheritanceStopgap` were **deleted** — M1 builds its own deck/coverage model from the handoff (not the old suggester), and its `parents` model replaces the inheritance stopgap. The per-skill card-hint sourcing already shipped on M4 (`SourcingSection`) — its `core/sourcing.ts` join feeds M1.7's Chain/Random columns.

**Honesty (P3):** placeholder spark/stat formulas replaced with validated math; inherit % is theory-validated, not Cygames-confirmed → caveat in the UI; `Find candidates`/`rankParents` is a heuristic pre-rank, not a verdict.

**Exit:** `/inheritance` is the live workbench at handoff fidelity; spark-chance + coverage validated; reactive matrix + target-spark correct; tests green.

---

## Phase 2 — M4 to full mockup fidelity (`/`)  ⏸ PAUSED (2026-06-25, resumes after the M1 workbench)

**Goal:** apply the design system to every M4 surface + close the remaining buildable gaps, proving the system on the flagship. **§3 card-hint sourcing is DROPPED** (subsumed by M1's coverage matrix). Inline effect-chips (the old "A1") moved to the **A1 future-improvement** sidelist. The internal `cmp-plan-card → ds-card` markup migration ("A2") is the first thing to do when P2 resumes.

**Work (when resumed):**
- **A2** — migrate M4's `cmp-plan-card`/one-off chips → the P1 `ds-card`/`ds-band`/value-text classes (removes P1's deferred parallel-definition).
- **Velocity-chart multi-fire** — the windowed velocity chart + `peakImpactPosition` still use only the **first** activation; widen to span all procs (or keep first-fire + caveat).
- Data-gated items below move to Phase 3.

**Exit:** M4 surfaces fully on the design system; tests green.

---

## Phase 3 — Data-gated tasks (shared M4 / M1)

**Goal:** the items that need a data-pipeline change first.

**Work:**
- **Skill duration** data into `skills.json` (build-script + overrides) → duration labels in the M4 detail viewer.
- **Uma innate skills + usable-here** filters (shared M4 / M1; also the M1 matrix's "Innate uma" column).
- **Per-record release dates** → Now / Upcoming / Future tiering.
- Keep `server` / `dataVersion` tagging maintained; `data:build` regenerates cleanly.

**Exit:** real data for the above; the pipeline regenerates without hand-editing generated files (P5).

---

## Phase 4 — M2 → M3 fidelity passes (reuse the system)

*(M1 was promoted out of Phase 4 to its own active track above.)*

### M2 — SP Optimizer (`/sp-optimizer`)
- **Results table + Compare-vs-Veteran** (`runPlannerCompare` already exists — UI only).
- Design-system skin.
- **Post-run capture companion (built 2026-07-10, branch `docs/m2-capture-method`):** memory-reader `capture_full.py` + `map_to_bundle.mjs` → valid `CaptureBundle`, validated end-to-end. **Next:** GUI ([handoff](superpowers/plans/2026-07-10-m2-capture-gui-handoff.md)) + **F1.5 in-app import adapter** (`/sp-optimizer` reads `career-capture.json` directly, resolves aptitudes from the plan's course). See the [capture spec](superpowers/specs/2026-07-05-m2-post-run-capture-method-design.md).
- F1–F4 follow-ups as they fit (see [module-2](modules/module-2-sp-optimizer.md)).

### M3 — Meta Intel (`/meta-intel`)
- **Grid-with-month-columns** layout.
- **Banner + patch timeline** lanes (fill the empty swimlanes).
- Phase-2 three-up (prior / observed / calculation).
- Design-system skin.

**Exit:** M2 + M3 at target fidelity; all four modules consistent on the design system.

---

## Cross-cutting (ongoing — not a phase)

- **UX mining (re-implement patterns, don't lift):**
  - **hakuraku** *(MIT)* — primary UX reference + the source of the M1 inheritance math (M1.0). Mine its information architecture: data-dense tables, drill-down detail modals, ECharts data-viz, inline lookups, the transparent data browser. MIT + React → a legitimate study source, but re-derive in our stack/visual language.
  - **UmaTools** — breadth/feature presentation. **No LICENSE file** (GPL-3.0 claimed only in README/UI) → effectively unlicensed: clean-room concepts only, never copy code. Do **not** pull its GameTora data path. Source-level review (2026-06-24): its hint/stamina/accel checkers are redundant with our engine; only the two UX framings (stamina badge, accel-timing label) were worth harvesting (now shipped).
- **Honest numbers (P3)** — surface caveats in every estimate-bearing UI; spark-chance per-parent split is theory-validated, not Cygames-confirmed; the factor optimizer is a heuristic pre-rank, not a verdict.
- **Keep the Resource Map (plan §3) alive** — log every useful resource found.

---

## Status tracker

| Phase | Status | Notes |
|---|---|---|
| S1 Engine re-platform | ✅ done (2026-07-10) | TS bundle → Rust/WASM v0.27.0 (pin `484539f5`); one pin engine+data; 1536 tests; P3 number cutover expected. Unlocked follow-ups: near-lane/full-race-sim, force-activation UI, position-keep/Power-Conservation telemetry. `engine-update-todo.md` deleted |
| S1b Pin bump v0.27→v0.37 (dirt tracks) | ✅ done (2026-07-23) | one pin `271be4dc`: 119 courses / 15 tracks (Kawasaki/Funabashi/Morioka + Longchamp), dirt skills (1743 skills), upstream pacing fixes + value scaling; multifire patch re-ported (`engine-patches/2026-07-23-multifire-rust.patch`, determinism sort absorbed upstream), vacuum compare re-paired for the v0.37 single-primary contract, fidelity re-baselined (mechanics-notes §12.5). 1543 tests. [handoff](superpowers/plans/2026-07-23-dirt-tracks-pin-bump-handoff.md) |
| S2 Public data swap | ⬜ parked | only when public release is a goal |
| S3 M4 polish + mechanics | ⬜ not started | projectedL refresh, accel label/plate readability, hint-button polish, rushed/struggle/dueling stamina review, provenance |
| A1 inline effect-chips | ⬜ future | deferred from P2; opportunistic |
| P1 Design system | ✅ done | PR #9 — tokens (light+dark) + ds-* + /styleguide + theme toggle; 862 tests, zero light regression |
| **Availability epic (foresight + JP-ahead + horizon + rebalance patches)** | ✅ **done** (2026-07-03) | #25 foresight · #26 cards · #27 umas · #28 skills · #29 review-fix · #30 horizon · #31 rebalance data/preview · #32 rebalance engine sim. 1299 tests. Open: [followups](superpowers/plans/2026-07-02-planning-horizon-followups.md) (minor) + real curated `rebalances.json` entries (needs patch-note research) |
| **M1 Inheritance workbench** | **🟧 active** | **from the 2026-06-25 handoff; built card-by-card M1.0–M1.8 (see section). On main: M1.0–M1.8; every M1 card is built. Data gates CLOSED 2026-07-05: G1 saddle-id whitelist populated (win-bonus live) + wonRaces import confirmed shipped with M1.4. M1.4b rental builder + search-link built + polished 2026-07-06 (Draft search-spec + all-4-colour deep-links live-verified on all 3 sites, Rental manual veteran editor, `resolveParent2` wired into affinity + coverage, coverage P1/P2 chip labels, collapsible cards, cold-load CSS fix; 1499 tests), landing via `feat/m1-4b-rental-builder` PR. Remaining M1 work: the S1 base-relation-points refresh, then Plans 3–5 (roster migration, search-builder + compare, pedigree view).** |
| P2 M4 fidelity | ⏸ paused | resumes after M1; §3 sourcing dropped (→ M1), A1 → future, A2 (card migration) first when resumed |
| P3 Data tasks | ⬜ not started | skill duration, innate skills, release dates |
| P4 M2/M3 fidelity | ⬜ not started | M1 promoted out to its own track. **M2 post-run capture companion built + validated 2026-07-10** (branch `docs/m2-capture-method`, docs-only unmerged): memory-reader `capture_full.py` + mapper → valid `CaptureBundle`. Next: capture GUI ([handoff](superpowers/plans/2026-07-10-m2-capture-gui-handoff.md)) + F1.5 in-app import adapter |

Legend: ⬜ not started · 🟧 in progress · ⏸ paused · ✅ done
