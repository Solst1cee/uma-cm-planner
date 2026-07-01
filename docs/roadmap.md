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

---

## Sidelists (parallel, non-blocking)

### S1 — Engine update `v0.14.2 → v0.18.0` + data refresh
Our pin is ~7 releases behind upstream `jalbarrang/umalator-global` (incl. the 2026-06-10 Global patch data and a "non-full spurts" engine fix). Tracked as its own checklist, gated behind a `fidelity.test.ts` re-baseline. **Full todo: [engine-update-todo.md](engine-update-todo.md).** Not a blocker for any fidelity phase; do it whenever convenient, but before relying on post-2026-06-05 skill/course data.

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

- 🟧 **M1.0 — Core math.** *Landed (logic) 2026-06-25:* `winBonus.ts` (2.0 G1-only +3), `lineageAffinity.ts` adapter, `spark.ts` per-member affinity resolver (de-approximates), `Parent.wonRaces`, rental target-tier helper. **Live pending** the UmaExtractor `wonRaces` import (follow-on) + the S1 base-relation refresh. Spec/plan 2026-06-25.
- ✅ **M1.1 — Route + workbench shell + Plan-context header.** *Landed 2026-06-26.* Un-stubbed `/inheritance` (nav + route); `src/features/inheritance/` with the 3-col grid (`minmax(290,320) 1fr minmax(290,320)`, collapses <1120px → 1col) of labeled placeholder panels (M1.2–M1.8 replace them); the top plan-context bar (`PLAN #N`, name, "From CM Planner · {track} Racecourse", surface/distance/strategy chips) reading `uma1Plan` — track name resolved via lazy `courseCatalog` (injectable `deps` for tests), distance chip via core `distanceClass` (game-correct, NOT the mockup's loose label). Pure `planContextView` + presentational `PlanContextHeaderView` (`…View` suffix avoids the Windows case-FS clash with `planContextHeader.ts`). **880 tests.** Plan: [2026-06-26-m1-1-workbench-shell.md](superpowers/plans/2026-06-26-m1-1-workbench-shell.md).
- ✅ **M1.2 — "Uma plan" card + inventory popover.** *Landed 2026-06-26.* A `cmp-plan-card` with an **"Uma plan"** header: portrait + name/epithet + the plan's three active aptitude chips (`umaPlanAptChips` = distance/surface/strategy via `currentAptitudeKeys`+`targetAptitude`, so all three always show + follow the selected plan — e.g. "Medium S · Turf A · Late A"). A bigger **inventory-icon** button in the header pops the **shared `PlanInventoryCard`** as a **dismiss-on-outside popover anchored to the icon** (top-right corner at the icon's bottom border). Clicking a row loads that plan as current (uma1) and closes the popover; the inventory's **1/2 slot badges** and **settings sub-card** are hidden via new `hideSlotBadges`/`hideSettings` props (default off → M4 unchanged). (Iterated on feedback: search-card → inventory-card-in-column → icon-anchored popover; chips fixed from race-derived → plan pink-target grades.) **870 tests** (after the parallel deck-suggester removal). Plan: [m1-2-uma-plan-card](superpowers/plans/2026-06-26-m1-2-uma-plan-card.md) (early version; UI iterated past it).
- ✅ **M1.3 — "Plan targets" card.** *Landed + iterated 2026-06-26 (shipped in PR #12).* Collapsible `cmp-plan-card` (left column): **blue** stat sparks (`sparkGoals.blue`) as chips with `−/+`/`×`/add-stat, capped at a **shared 18★ total across all stats** (`+` disabled when full); **pink** as **required career-start stars matching the planner sidebar** — `pinkSparkRows` scans every targeted aptitude (`planAptKeys`, not just the race's active keys — the off-race-target bug), an 18★ budget with an inline over-budget ⚠, a `midRunSparkRows` "Mid-run spark" readout, and a `pinkComputable` guard; **wishlist** = planner-style skill plates (`SkillDetailDisclosure` w/o `traceContext`) that are **editable + addable** (per-plate `×` + a `SkillPicker`). M1 edits **auto-save** (`editPlan` = `setPlan` + `saveCurrentPlan`). Pure helpers `planTargets.ts` (TDD); presentational `PlanTargetsCard` stays provider-free (page passes inventory/plates/picker as nodes). **893 tests.**
- ✅ **M1.4 — "Inheritance" card.** *Built on `feat/m1-4-inheritance-card`, landing via PR (2026-07-01).* Parent 1 & 2 (Parent 2 **Rental** toggle → M1.4b stub), lineage spark chips (blue/pink/**green-unique**/white; gold=own / grey=GP), selection → `CmPlan.parents.{a,b}`. **UmaExtractor importer** (`UploadDataButton`/`useRoster`/`umaExtractor`/`factorDecode` → Dexie `parents`, `data.json` help popup). **Picker modal** with the **"Star Tracks" spark filter** (STAT/APTITUDE/UNIQUE category cards, gold-legacy + total star meters under the ≤9★/≤3-member budget, unique-skill search w/ keyboard nav, sticky match-summary) + 2-column veteran tiles (pedigree rail + affinity + **◎/○/△ compatibility mark**). **Same-character parent guard** (by `charaId`, any outfit). **Find-candidates** heuristic pre-rank. **1056 tests.** *Deferred → M1.4b:* Parent-2 rental builder + search-link; green 9xxxxx + saddle→G1 `wonRaces` reconciliation (M1.7).
- ✅ **M1.5 — "Deck" card.** *Built + landed on main 2026-06-26 (re-targeted via `feat/m1-5-land-on-main`; PR #11 had merged it into the `feat/m1-inheritance-workbench` feature branch, which never propagated to main — a 3-way merge brought it onto main keeping M1.3).* 6-slot drag-drop deck (HTML5 DnD `text/card-id`) + per-slot 4-diamond LB stepper + remove/clear, in CM-planner card-head grammar. **Deck state is browser-local & plan-independent** (`scb_deck` / `scb_deck_active` / `scb_profiles`) — NOT `CmPlan.lockedDeckSlots`, NOT per-plan. Templates use an **autosave combobox** (no Save/Load buttons): name = active template (autosaves into it live), caret dropdown loads / **New** / per-row **×** delete; seeds a **Default** on first load, **New survives reloads**, typing an existing name switches (no overwrite), unnamed work is preserved as `Untitled`. The drag *source* / "+ Add" arrive with M1.6 (`addCardToDeck` seam + drop target built). **947 tests on main.** Spec/plan: [2026-06-26-m1-5-your-deck-card](superpowers/plans/2026-06-26-m1-5-your-deck-card.md).
- ⬜ **M1.6 — "Support cards" card.** Pool + filters (Rarity/Type/Skill/Stats) + **Icon / Art / Plot** views + Matches/Effect sort + Add/drag. *(Large; may sub-split per view.)*
- ⬜ **M1.7 — "Obtainable vs. wishlist" card.** Coverage **matrix** (`Innate ‖ Parent | G.parent ‖ Chain | Random`, inherit %, uncovered red stripe) + **bonus** list (obtainable, not on wishlist) + Matrix/Coverage toggle. *(Synthesis — reads M1.0 + .4 + .5 + .6.)*
- ⬜ **M1.8 — "Target spark" card.** Right rail: the **blue/pink/white sparks a parent/rental still needs** to complete the plan + rental search link. *(Synthesis.)*

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
| S1 Engine update | ⬜ not started | v0.14.2 → v0.18.0; see engine-update-todo.md |
| S2 Public data swap | ⬜ parked | only when public release is a goal |
| S3 M4 polish + mechanics | ⬜ not started | projectedL refresh, accel label/plate readability, hint-button polish, rushed/struggle/dueling stamina review, provenance |
| A1 inline effect-chips | ⬜ future | deferred from P2; opportunistic |
| P1 Design system | ✅ done | PR #9 — tokens (light+dark) + ds-* + /styleguide + theme toggle; 862 tests, zero light regression |
| **M1 Inheritance workbench** | **🟧 active** | **from the 2026-06-25 handoff; built card-by-card M1.0–M1.8 (see section). M1.0–M1.3 (PR #12) + M1.5 deck (re-targeted from PR #11) on main; M1.4 inheritance card (parents + UmaExtractor importer + Star-Tracks picker + affinity marks + same-character guard) landing via PR (2026-07-01), 1056 tests. Next: M1.6 support pool, M1.7 coverage matrix (+ green 9xxxxx / saddle→G1 reconciliation).** |
| P2 M4 fidelity | ⏸ paused | resumes after M1; §3 sourcing dropped (→ M1), A1 → future, A2 (card migration) first when resumed |
| P3 Data tasks | ⬜ not started | skill duration, innate skills, release dates |
| P4 M2/M3 fidelity | ⬜ not started | M1 promoted out to its own track |

Legend: ⬜ not started · 🟧 in progress · ⏸ paused · ✅ done
