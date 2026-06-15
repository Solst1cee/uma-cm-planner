# Vendored engine bundle

`umalator.bundle.mjs` is a **generated, committed** artifact — do not hand-edit.

- **Source:** jalbarrang/umalator-global, pinned **v0.14.2** (commit `c1fa2107`), GPL-3.0-only.
- **Clone location (gitignored):** `spikes/repos/umalator-global`.
- **Rebuild:** `pnpm sim:build` (runs `scripts/build-sim.mjs`).
- **Contents:** the three public simulators (`runSkillComparison`, `runComparison`,
  `runPlannerComparison`) + the engine's `coursesService`/`skillsService` with course &
  skill JSON baked in. We do NOT patch the physics; our mechanics corrections live in `src/core`.
- **License:** GPL-3.0-only (same as this repo). See `NOTICE.md`.
