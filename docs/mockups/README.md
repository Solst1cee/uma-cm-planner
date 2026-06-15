# Mockups — the canonical visual spec

These HTML mockups capture the **product vision** for each module. **They are the spec: build the UI to match them.** Open any file in a browser to view it.

Originated from the superpowers brainstorm (`.superpowers/brainstorm/1698-1781377711/content/`, which is gitignored) and copied here so the spec is **version-controlled** and travels with the code. Treat these committed copies as canonical; if a mockup is revised, update the file here.

| File | Module | Built route | Fidelity (2026-06-15) |
|---|---|---|---|
| [m4-current.html](m4-current.html) | **M4 — Skill Acquisition Planner** | `/` | ~25% |
| [m3-timeline.html](m3-timeline.html) | **M3 — Meta Intel Workspace** | `/meta-intel` | ~25% |
| [m2-sp-optimizer.html](m2-sp-optimizer.html) | **M2 — SP Purchase Optimizer** | `/sp-optimizer` | ~20% |
| [m1-inheritance.html](m1-inheritance.html) | **M1 — Inheritance Planner** | — (unbuilt) | ~8% |
| [intro.html](intro.html) | Overview / framing | — | — |

**Why fidelity is low + the path to close it:** see [CLAUDE.md](../../CLAUDE.md) → *Design fidelity*. In short — the mockups share **one design system** (dark token + badge/chip/effect/track grammar); building it once re-skins everything. ~80% of the gap needs **no new data**; only 4 items are genuinely data-gated (skill effect-type/duration, uma stats/aptitudes/innate/unique-id, per-record release dates, banner+patch timeline entries).

Per-module gap detail lives in each [docs/modules/](../modules/) doc.
