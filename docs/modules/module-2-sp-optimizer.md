# Module 2 — SP Purchase Optimizer

> Brief module doc. Expand into a detailed living doc (like [M4's](module-4-skill-acquisition.md)) when the next M2 work starts.

- **Route:** `/sp-optimizer`
- **Status:** **MVP shipped 2026-06-15.** Follow-ups F1–F4 remain.
- **Spec:** [docs/superpowers/specs/2026-06-14-m2-sp-optimizer-design.md](../superpowers/specs/2026-06-14-m2-sp-optimizer-design.md) + F1 [2026-06-15-m2-f1-ocr-assist-design.md](../superpowers/specs/2026-06-15-m2-f1-ocr-assist-design.md).
- **Plan:** [docs/superpowers/plans/2026-06-15-m2-sp-optimizer-mvp.md](../superpowers/plans/2026-06-15-m2-sp-optimizer-mvp.md).

## Purpose & boundary

The **post-run, SP-limited min-max**: at a run's end you can usually afford fewer skills than are available — M2 picks the optimal affordable subset by **simulated combined Δ-L**. Distinct from M4's discovery (M4 = the ideal build, no SP constraint).

## Shipped (MVP)

- **[src/core/spOptimizer.ts](../../src/core/spOptimizer.ts)** — adaptive hybrid: prereq-closed enumeration / Δ-L knapsack shortlist / diversity-band / exact-vs-shortlist.
- **[src/features/sp-optimizer/](../../src/features/sp-optimizer/)** — `rankBaskets` orchestrator, manual form → `CaptureBundle` → 3 ranked cards, save/load/delete; captures Dexie **v3** store; real-engine validation gate (`rankBaskets.validation.test.ts`). Validated the production `?worker` build path.
- Contract: [docs/capture-bundle-contract.md](../capture-bundle-contract.md).

## Next (F1–F4)

- **F1** — CaptureBundle import + Copy-from-M4-wishlist (merged); the OCR assist was re-architected to a **separate native companion** (F1 OCR + companion remain).
- **F2 / F3** — see the [m2-design-locked memory](../../CLAUDE.md) and spec.

## Gotchas

- `makeDeltaCache` keys single-skill deltas on a **fixed** base build → basket sims must scope their own cache (the MVP uses a per-(owned-skill-set, course) Map).
- `cost.ts` **gold ×2 premium** is a documented TODO (`mechanics-notes.md §10 item 8`).
