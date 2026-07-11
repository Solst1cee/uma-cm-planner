# Module 2 — SP Purchase Optimizer

> Brief module doc. Expand into a detailed living doc (like [M4's](module-4-skill-acquisition.md)) when the next M2 work starts.

- **Route:** `/sp-optimizer`
- **Status:** **Optimizer Tab 1 at handoff fidelity (2026-07-11).** A two-tab workbench (**Optimize basket** / **Compare vs veteran** — the latter an F2 placeholder) replaces the old 3-bare-cards MVP. Tab 1: a Build & SP card (source control + build chips + editable SP + Load-uma-plan lock-prefill scaffold), an interactive **buyable-skills table** (lock toggle · Type chip · Δ L · editable SP cost with hint-reprice via `cost.ts` · L-per-SP · hint-level segmented control, buy/cut/lock tints once analyzed), a result banner (EXACT/ESTIMATE mode + vs-greedy comparison), and 3 selectable "Basket #k" cards (mean L + honest spread descriptor only — P3, no fabricated win% or phase profile). Edits mark the result **stale**; re-running is an explicit Re-analyze (M4's Run/stale pattern). Memory-capture import (UmaPostrunExtractor / raw career-capture JSON) and Copy-from-M4-wishlist both seed the workbench.
- **Spec:** [docs/superpowers/specs/2026-06-14-m2-sp-optimizer-design.md](../superpowers/specs/2026-06-14-m2-sp-optimizer-design.md) + F1 [2026-06-15-m2-f1-ocr-assist-design.md](../superpowers/specs/2026-06-15-m2-f1-ocr-assist-design.md) + **[2026-07-11-m2-optimizer-ui-fidelity-design.md](../superpowers/specs/2026-07-11-m2-optimizer-ui-fidelity-design.md)** (Tab-1 fidelity rebuild).
- **Plan:** [docs/superpowers/plans/2026-06-15-m2-sp-optimizer-mvp.md](../superpowers/plans/2026-06-15-m2-sp-optimizer-mvp.md) + **[2026-07-11-m2-optimizer-ui-fidelity.md](../superpowers/plans/2026-07-11-m2-optimizer-ui-fidelity.md)**.
- **⚠️ Mockup = the visual spec:** [docs/mockups/m2-sp-optimizer.html](../mockups/m2-sp-optimizer.html) (committed — open in a browser). Tab 1 is now close to the "Option 1a" handoff (`docs/handoff/design_handoff_m2_sp_optimizer/`); remaining gaps are the F2 sim-lab tab and F1.5 source-control polish (below). See CLAUDE.md → *Design fidelity*.

## Purpose & boundary

The **post-run, SP-limited min-max**: at a run's end you can usually afford fewer skills than are available — M2 picks the optimal affordable subset by **simulated combined Δ-L**. Distinct from M4's discovery (M4 = the ideal build, no SP constraint).

## Shipped (MVP)

- **[src/core/spOptimizer.ts](../../src/core/spOptimizer.ts)** — adaptive hybrid: prereq-closed enumeration / Δ-L knapsack shortlist / diversity-band / exact-vs-shortlist.
- **[src/features/sp-optimizer/](../../src/features/sp-optimizer/)** — `rankBaskets` orchestrator, manual form → `CaptureBundle` → 3 ranked cards, save/load/delete; captures Dexie **v3** store; real-engine validation gate (`rankBaskets.validation.test.ts`). Validated the production `?worker` build path.
- Contract: [docs/capture-bundle-contract.md](../capture-bundle-contract.md).

## Next (F1–F4, F1.5)

- **F1** — CaptureBundle import + Copy-from-M4-wishlist (merged); the OCR assist was re-architected to a **separate native companion** (F1 OCR + companion remain).
- **F1.5** — source-control actions (manual/import/wishlist explicit switcher) + Load-plan auto-lock prefill are stubbed in `BuildSpCard` today (no-op handlers) — wire them up.
- **F2** — the sim-lab: basket / veteran / custom / draft compare lanes behind the "Compare vs veteran" tab (currently `ComparePlaceholder`). `runPlannerCompare` already exists in the engine.
- **F3** — see the [m2-design-locked memory](../../CLAUDE.md) and spec.

## Gotchas

- `makeDeltaCache` keys single-skill deltas on a **fixed** base build → basket sims must scope their own cache (the MVP uses a per-(owned-skill-set, course) Map).
- `cost.ts` **gold ×2 premium** is a documented TODO (`mechanics-notes.md §10 item 8`).
- **Any `RankResult` consumer must handle BOTH `candidates` and `greedyScore`** — the two fields the 2026-07-11 fidelity rebuild added alongside `mode`/`baskets`. `candidates: CandidateRow[]` ΔL/L-per-SP are measured vs the **owned-only** base (pin-independent — pinning doesn't shift the table's numbers, only which basket sims run); a naive last-write consumer that destructures only `{mode, baskets}` will silently drop the table + banner data.
- **The buyable-skills table's editable fields (cost/hint/pin) must always derive from the LIVE working bundle, not a frozen `result.candidates` snapshot** — a snapshot fights the controlled cost `<input>` on every keystroke and never reflects new pins/hint edits until the next Re-analyze. `SpOptimizerPage` merges live candidate fields with `result`-derived analysis fields (ΔL/L-per-SP/baseSpCost) by `skillId`.
- **A hint-edited skill's screenSpCost reprices via the single-skill `effectiveSpCost`, NOT the bundled `purchaseSpCost`.** M2's table is one row per on-screen skill — a gold's white prereq already has its own row + its own cost — so bundling the white into the gold's reprice double-counts it.
