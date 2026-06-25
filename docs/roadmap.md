# uma-cm-planner — Roadmap

> **Created 2026-06-24.** Living document — update phase status as work lands.
> Authoritative *plan* is still [uma-cm-planner-plan.md](../uma-cm-planner-plan.md); authoritative *current state* is [CLAUDE.md](../CLAUDE.md). This file is the **sequencing layer** on top of them.

## Driver & spine

**Optimize for: design-system + mockup fidelity.** The built module UIs are functional skeletons far below [docs/mockups/](mockups/) (fidelity audit: M4 ~25%, M3 ~25%, M2 ~20%, M1 ~8%). The mockups are the spec. The fastest way to close ~80% of that gap is to build the **one shared visual grammar** the four mockups already agree on, then apply it module by module.

**Sequence: system-first, then M4 deep.** Build the design system as a deliberate foundation → take M4 (flagship, furthest along) to full fidelity to prove it end-to-end → ripple to M2 → M3 → M1. Two **sidelists** run in parallel, independent of the main fidelity track.

This roadmap was set after a competitive analysis (2026-06-24) of hakuraku / UmaTools / TheCing-uma-tools. Conclusion: **fork nothing, keep our umalator engine + 4-module architecture, harvest hakuraku's inheritance math for M1 and mine UmaTools UX for fidelity.** See [hakuraku-m1-harvest.md](hakuraku-m1-harvest.md).

**Update (2026-06-24) — M4 main-page redesign landed (merged to main).** A pre-roadmap restructure of `/` into a **3-column dual-build flip-card planner** with a tabbed working panel (Unique · Stamina · Accel · Skills · Mini-sim), engine-derived **stamina + accel checkers**, and a Mini-sim tab (retiring `RaceSimCard`). It **seeded the Phase-1 design tokens** (`:root --cmp-*` in `cm-planner.css`) and **built the two UX-harvest framings** the §Cross-cutting / Phase-2 notes called for (stamina viability + accel timing). Spec/plan: [design](superpowers/specs/2026-06-24-m4-main-page-redesign-design.md) · [plan](superpowers/plans/2026-06-24-m4-main-page-redesign.md). Phase 1 (the full shared `design-system.css`) and Phase 2 (M4 to full mockup fidelity) still stand on top of this.

**Update (2026-06-25) — M4 inventory + sidebar UX refinements landed (merged to main).** A follow-on polish pass on the dual-build planner: per-row **uma1/uma2 slot-pick badges + collision auto-duplicate**, an inventory **edit-mode gate**, the outline **backpack icon** + square collapsed sliver, **uma2 Save/Save As/auto-save unified with uma1** (never writes `activePlanId`), a **centered track-change confirm dialog** (over a greyed-out track, names the slot), the `StatInput` field fix, and **full red `--uma-accent` theming** across the sidebar inputs/tiles/toggles. Still **pre-Phase-1 M4 hardening** — no shared design-system extraction yet (that's Phase 1). Spec/plan: [design](superpowers/specs/2026-06-24-m4-inventory-sidebar-refinements-design.md) · [plan](superpowers/plans/2026-06-24-m4-inventory-sidebar-refinements.md). **824 tests.**

**Update (2026-06-25) — Phase 1 design-system foundation landed.** Themeable (light default + dark) semantic tokens in `src/styles/design-system/`, `ds-*` component classes, a `/styleguide` route, and a Light/Dark/System toggle in settings. Existing token names kept (271 usages untouched); M4 + app shell verified in both themes with no light regression. Spec [design](superpowers/specs/2026-06-25-design-system-foundation-design.md) · [plan](superpowers/plans/2026-06-25-design-system-foundation.md).

---

## Sidelists (parallel, non-blocking)

### S1 — Engine update `v0.14.2 → v0.18.0` + data refresh
Our pin is ~7 releases behind upstream `jalbarrang/umalator-global` (incl. the 2026-06-10 Global patch data and a "non-full spurts" engine fix). Tracked as its own checklist, gated behind a `fidelity.test.ts` re-baseline. **Full todo: [engine-update-todo.md](engine-update-todo.md).** Not a blocker for any fidelity phase; do it whenever convenient, but before relying on post-2026-06-05 skill/course data.

### S2 — Public-release data swap *(only if/when sharing publicly)*
Swap private-feed defaults → `ManualStatTargets` / curated JSON before any public deploy (per the scraping-exception posture). Parked until a public release is an actual goal.

### S3 — M4 chart/UI polish + mechanics review + provenance *(surfaced 2026-06-25)*
Small, non-blocking follow-ups from the inventory/sidebar refinements pass. Do opportunistically or fold into Phase 2 (M4 fidelity).
- **Recompute wishlist `projectedL` on every chart run** — the accel/skill chart should refresh each wishlist skill's projected バ身 (L) per run so the sidebar totals stay current.
- **Polish the per-tab hint ("?") buttons** — the help/explainer popups on the WorkingTabs (Stamina · Accel · Skills · Mini-sim, + the skill-detail "?" popup): clearer copy, consistent styling/placement/dismiss.
- **Accel-tab / Position-column label readability** — replace the `≥`/`≤` notation with exact/range forms: exact `CM = 6 · LoH = 8`; ranges `CM 5–6 · LoH 6–8` (instead of `CM ≤6 · LoH ≤8` / `CM ≥5 · LoH ≥6`).
- **Cap skill-plate max width in the charts** — the skill-name plate runs too long; set a sensible max-width / truncation.
- **Verify stamina mechanics for rushed (かかり), position-struggle, and dueling** — how each state affects HP/stamina consumption (engine vs in-game); cross-check + record in [docs/mechanics-notes.md](mechanics-notes.md) §10.
- **Add provenance/attribution per submodule for adopted tools** — per **P1 (REUSE FIRST)**: record source URL + retrieval date in code comments **and** [docs/provenance.md](provenance.md) wherever an algorithm/dataset/UX pattern was borrowed from a community tool.

---

## Phase 1 — Design-system foundation

**Goal:** one shared `design-system.css` (or token module) extracted from the four mockup HTMLs, re-skinning all modules' shared primitives.

**Work:**
- Audit `docs/mockups/*.html` for the shared grammar (it is *identical across all four*).
- Define CSS custom-property **tokens**: color (the dark palette), spacing, radius, shadow, typographic scale.
- Build the **component classes**: badge, chip, **effect-chip**, **card** (generalize M4's existing `cmp-plan-card` / `cmp-plan-card-head` / `cmp-collapse-head` into the system), track styling, swimlane.
- A small `/styleguide` route that renders every primitive (the living reference + visual-regression anchor).

**UX references — study alongside the mockups (the mockups are still the spec; these are real, shipped tools showing interaction patterns static HTML can't convey):**
- **[hakuraku](https://hakuraku.moe/)** *(MIT — its component code is readable, not just the rendered UI)* — a strong, polished UX example: data-dense roster tables, calculator/optimizer panels, **drill-down detail modals** (e.g. spark-proc breakdown), inline friend-code lookup, and a power-user **data browser**. Its polish comes from **React-Bootstrap + ECharts** (`echarts-for-react`), *not* a custom token system. **Stack tension to decide here:** do we hand-build `design-system.css` from the dark mockups (current plan) + keep hand-rolled SVG charts, or lean on a themed component library + a charting lib the way hakuraku does? Resolve before building the tokens — it changes what Phase 1 produces.
- **[UmaTools](https://daftuyda.moe)** — breadth/feature-presentation ideas (optimizer UI, hint finder, rating ladder); see Cross-cutting.

**Exit:** styleguide renders all primitives; M4's existing cards re-expressed via the system with **no visual regression**; `pnpm build` + `pnpm typecheck` + `pnpm test` green.

---

## Phase 2 — M4 to full mockup fidelity (`/`)

**Goal:** bring the flagship to the mockup, proving the design system end-to-end.

**Work:**
- Apply the design system to every M4 surface (sidebar, charts, race-setup, track overlay, skill detail).
- Close the M4 fidelity gap items:
  - **§3 card-hint sourcing** ("Where to get it") on the acquirable-skill chart.
  - **Skill duration labels** in the effect/detail viewer.
  - **Now / Upcoming / Future** release tiers (needs per-record release dates — see Phase 3).
  - **Uma innate-skill / usable-here** columns/filters (shared with M1 — see Phase 3).
- **Velocity-chart multi-fire** — *narrowed (engine multi-fire + §0 overlay + ×1/×2 breakdown shipped 2026-06-22):* the only piece left is that the **windowed velocity chart** + `peakImpactPosition` still use only the **first** activation. Widen the window to span all procs, or keep first-fire + a caveat.
- **Engine-derived build-viability cues** (UX framings confirmed worth borrowing from UmaTools after a source-level review — computed from our *own* per-frame trace, zero of their code/data):
  - **Stamina viability badge** — a green/red "can this build finish?" read straight from the HP trace (does HP reach 0 before the line?); also feeds an **M2** over/under-invest-in-stamina hint.
  - **Per-skill accel-timing label** — tag accel skills *"fires in final straight (optimal)"* vs *"fires too early"* from `runSkillTrace` / `skillImpact` activation positions.

**Exit:** M4 ≈ the M4 mockup (~90%+); design system proven reusable; tests green.

---

## Phase 3 — Data-gated tasks M4 surfaces

**Goal:** the non-CSS items M4 fidelity needs.

**Work:**
- **Skill duration** data into `skills.json` (build-script + overrides).
- **Uma innate skills + usable-here** filters (shared M4/M1).
- **Per-record release dates** → Now / Upcoming / Future tiering.
- Keep `server` / `dataVersion` tagging maintained; `data:build` regenerates cleanly.

**Exit:** M4 shows real data for the above; the data pipeline regenerates without hand-editing generated files (P5).

---

## Phase 4 — M2 → M3 → M1 fidelity passes (reuse the system)

### M2 — SP Optimizer (`/sp-optimizer`)
- **Results table + Compare-vs-Veteran** (`runPlannerCompare` already exists — UI only).
- Design-system skin.
- F1–F4 follow-ups as they fit (see [module-2](modules/module-2-sp-optimizer.md)).

### M3 — Meta Intel (`/meta-intel`)
- **Grid-with-month-columns** layout.
- **Banner + patch timeline** lanes (fill the empty swimlanes).
- Phase-2 three-up (prior / observed / calculation).
- Design-system skin.

### M1 — Inheritance *(currently a stub, no route — the biggest functional win)*
Build the UI **and** land the **hakuraku harvest** (full detail in [hakuraku-m1-harvest.md](hakuraku-m1-harvest.md)):
1. **M1 Plan 3** — nested `Parent` / `ParentSparks` model migration (needed for per-factor source-slot attribution).
2. **New `src/core/sparkChance.ts`** — base-chance tables + `calculateSparkChance` = `min(100, base·(1 + individualAffinity/100))` + the proc-odds DP (single / full-run). Validate vs the BourBon_Polaris dataset. *(top new capability)*
3. **Refine `src/core/affinity.ts`** — exact race/win-bonus algorithm (`+1` per shared `win_saddle_id` per grandparent, variant-ID non-overlap quirk) + same-chara grandparent guard in `aff3`. Lock with the Seiun Sky / McQueen `54 + 18 = 72` fixture.
4. **`rankParents`** (factor optimizer, cap 4) as a fast pre-rank; fix hakuraku's ascending-sort bug; `runVacuumCompare` as the tiebreaker (honors P3 — heuristic ranks, sim decides).
5. **Generation rates** → `docs/mechanics-notes.md` (reference, not code).
6. **Pedigree + goal-builder + compare-all** UI, design-system-skinned; add the `/inheritance` route (trim `STUB_MODULES` in `src/app/App.tsx`).

**Exit:** all four modules at target fidelity; M1 functional (affinity + spark chance + compare) and **validated vs umamily.moe / Ice's sheet**.

---

## Cross-cutting (ongoing — not a phase)

- **UX mining (re-implement patterns, don't lift):**
  - **hakuraku** *(MIT)* — the primary UX reference (see Phase 1). Mine its information architecture and interaction patterns: data-dense tables, drill-down detail modals, ECharts data-viz, inline lookups, the transparent data browser. Since it's MIT and React, its component code is a legitimate study source — but re-derive in our stack/visual language, don't paste.
  - **UmaTools** — breadth/feature presentation: skill-optimizer UI, support-hint finder, rating-ladder. **No LICENSE file exists** (GPL-3.0 claimed only in README/UI) → treat as effectively unlicensed: clean-room reimplement concepts only, never copy code. Do **not** pull its GameTora data path (its hint data is GameTora-scraped). Source-level review (2026-06-24) found its **hint finder / stamina / accel checkers redundant with our engine** — the only worthwhile harvest is the **two UX framings** in Phase 2 (stamina badge, accel-timing label), derived from our own trace.
- **Honest numbers (P3)** — surface caveats in every estimate-bearing UI; spark-chance per-parent split is theory-validated, not Cygames-confirmed; the factor optimizer is a heuristic pre-rank, not a verdict.
- **Keep the Resource Map (plan §3) alive** — log every useful resource found.

---

## Status tracker

| Phase | Status | Notes |
|---|---|---|
| S1 Engine update | ⬜ not started | v0.14.2 → v0.18.0; see engine-update-todo.md |
| S2 Public data swap | ⬜ parked | only when public release is a goal |
| S3 M4 polish + mechanics | ⬜ not started | wishlist projectedL refresh, accel label/plate readability, per-tab hint-button polish, rushed/struggle/dueling stamina review, per-submodule provenance |
| P1 Design system | ✅ done | tokens (light+dark) + ds-* components + /styleguide + Light/Dark/System settings toggle; M4 + shell verified both themes, zero light regression. Spec/plan 2026-06-25. |
| P2 M4 fidelity | ⬜ not started | flagship; proves the system |
| P3 Data tasks | ⬜ not started | duration, innate, release dates |
| P4 M2/M3/M1 fidelity | ⬜ not started | M1 folds in hakuraku harvest |

Legend: ⬜ not started · 🟧 in progress · ✅ done
