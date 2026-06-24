# uma-cm-planner — Roadmap

> **Created 2026-06-24.** Living document — update phase status as work lands.
> Authoritative *plan* is still [uma-cm-planner-plan.md](../uma-cm-planner-plan.md); authoritative *current state* is [CLAUDE.md](../CLAUDE.md). This file is the **sequencing layer** on top of them.

## Driver & spine

**Optimize for: design-system + mockup fidelity.** The built module UIs are functional skeletons far below [docs/mockups/](mockups/) (fidelity audit: M4 ~25%, M3 ~25%, M2 ~20%, M1 ~8%). The mockups are the spec. The fastest way to close ~80% of that gap is to build the **one shared visual grammar** the four mockups already agree on, then apply it module by module.

**Sequence: system-first, then M4 deep.** Build the design system as a deliberate foundation → take M4 (flagship, furthest along) to full fidelity to prove it end-to-end → ripple to M2 → M3 → M1. Two **sidelists** run in parallel, independent of the main fidelity track.

This roadmap was set after a competitive analysis (2026-06-24) of hakuraku / UmaTools / TheCing-uma-tools. Conclusion: **fork nothing, keep our umalator engine + 4-module architecture, harvest hakuraku's inheritance math for M1 and mine UmaTools UX for fidelity.** See [hakuraku-m1-harvest.md](hakuraku-m1-harvest.md).

---

## Sidelists (parallel, non-blocking)

### S1 — Engine update `v0.14.2 → v0.18.0` + data refresh
Our pin is ~7 releases behind upstream `jalbarrang/umalator-global` (incl. the 2026-06-10 Global patch data and a "non-full spurts" engine fix). Tracked as its own checklist, gated behind a `fidelity.test.ts` re-baseline. **Full todo: [engine-update-todo.md](engine-update-todo.md).** Not a blocker for any fidelity phase; do it whenever convenient, but before relying on post-2026-06-05 skill/course data.

### S2 — Public-release data swap *(only if/when sharing publicly)*
Swap private-feed defaults → `ManualStatTargets` / curated JSON before any public deploy (per the scraping-exception posture). Parked until a public release is an actual goal.

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
- Resolve the open **velocity-chart multi-fire** question (currently the windowed velocity chart + `peakImpactPosition` only use the first activation; widen window to span all procs, or leave first-fire + caveat).

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
  - **UmaTools** — breadth/feature presentation: skill-optimizer UI, support-hint finder, rating-ladder. **Read its actual LICENSE first** (GPL unconfirmed). Do **not** pull its GameTora data path (cite/deep-link only). Vanilla JS → re-implement in React.
- **Honest numbers (P3)** — surface caveats in every estimate-bearing UI; spark-chance per-parent split is theory-validated, not Cygames-confirmed; the factor optimizer is a heuristic pre-rank, not a verdict.
- **Keep the Resource Map (plan §3) alive** — log every useful resource found.

---

## Status tracker

| Phase | Status | Notes |
|---|---|---|
| S1 Engine update | ⬜ not started | v0.14.2 → v0.18.0; see engine-update-todo.md |
| S2 Public data swap | ⬜ parked | only when public release is a goal |
| P1 Design system | ⬜ not started | the one-time re-skin foundation |
| P2 M4 fidelity | ⬜ not started | flagship; proves the system |
| P3 Data tasks | ⬜ not started | duration, innate, release dates |
| P4 M2/M3/M1 fidelity | ⬜ not started | M1 folds in hakuraku harvest |

Legend: ⬜ not started · 🟧 in progress · ✅ done
