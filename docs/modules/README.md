# Module docs

Per-module living docs. **Load the lean [CLAUDE.md](../../CLAUDE.md) + the one module you're working on** — not the whole repo — to keep session context manageable.

| Module | Route | Status | Doc |
|---|---|---|---|
| **M4 — Skill Acquisition Planner** | `/` | Slice 1 shipped | [module-4-skill-acquisition.md](module-4-skill-acquisition.md) *(detailed)* |
| **M1 — Inheritance Planner** | — (stub) | Plans 1–2 done; 3–5 next | [module-1-inheritance.md](module-1-inheritance.md) |
| **M2 — SP Purchase Optimizer** | `/sp-optimizer` | MVP shipped; F1–F4 | [module-2-sp-optimizer.md](module-2-sp-optimizer.md) |
| **M3 — Meta Intel Workspace** | `/meta-intel` | Timeline shipped; phase-2 | [module-3-meta-intel.md](module-3-meta-intel.md) |

Build order was M4 → M1 → M2 → M3; M2/M3 were built ahead of M1's UI plans.

**Shared foundation** (read once, applies to all): vendored umalator engine ([src/sim/](../../src/sim/)), the canonical `CmPlan` SSOT ([2026-06-15-shared-data-model.md](../superpowers/specs/2026-06-15-shared-data-model.md)), pure mechanics core in [src/core/](../../src/core/).

Full design rationale per module lives in [docs/superpowers/specs/](../superpowers/specs/); executed implementation plans in [docs/superpowers/plans/](../superpowers/plans/).
