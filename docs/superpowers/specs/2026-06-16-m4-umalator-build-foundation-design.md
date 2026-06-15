# 2026-06-16 — M4 rebuilt around umalator's build UI (vendor-into-shell)

## Context

Module 4 (Skill Acquisition Planner) is engine-first. We already vendored the
umalator-global **engine** (`src/sim/`), but hand-rolled the UI on top of it — first a
crude skill chart (now at `/legacy`), then a crude `§0` track. Side-by-side with the real
thing (VFalator; **uma.guide**, captioned "Track visualization based on uma-tools"), the
hand-rolled UI is far from functional — a direct violation of **P1 (REUSE FIRST)**, and the
original plan §4 already scoped *"vendor the Bassin-chart UI + activation bars."*

umalator's left panel is a fully working **build editor** (uma, stats, strategy, aptitudes,
mood, skills) with **save / JSON+B64 import-export / paste / OCR / saved-builds**, plus a
**race-setup bar**, a rich **track** (legs, corners, slopes, distance ruler, skill-activation
zones, HP), and **Skill Chart / Uma Chart / Compare** tabs. It is **React 19** (same as us)
and **GPL-3.0-only** (same as us — vendoring the UI changes nothing legally).

**Decision (owner, 2026-06-16): build M4 *around* umalator's working build UI rather than
re-deriving it or bridging it into the not-yet-finished modules.** Take the working tool as
the foundation; layer our planner on top; defer integration with M1/M2/M3 until those are
ready.

## Goals / non-goals

- **Goal:** a genuinely functional M4 that reuses umalator's proven build editor + race setup
  + track, mounted in our app, that we grow the planner around.
- **Goal (visual fidelity) — REQUIRED:** the page must *look like umalator / uma.guide*. We
  adopt umalator's own dark-theme styling and the exact track visuals (legs, corner/straight
  colours, slope profile, skill-activation bands, distance ruler), and follow the
  `.superpowers/brainstorm/1698-1781377711/content/m4-current.html` mockup for any chrome we
  add. We **reuse umalator's CSS, not reskin it** into a foreign look. Each slice is verified
  by eye against umalator / the mockup, not just by tests.
- **Non-goal (now):** Compare / Uma-2 (two-runner head-to-head); full `CmPlan`↔Dexie SSOT
  unification; M1/M2/M3 wiring; reconciling umalator's bundled data with our `public/data`
  pipeline. All deferred, not abandoned.

## Architecture — vendor into our existing shell

- Vendor umalator's relevant modules (build editor / runner-card, race-setup, racetrack, share
  + library stores, and later the skill/uma chart tabs) into our repo under
  `src/features/planner/` (or `src/vendor/umalator-ui/`), **GPL-attributed** per
  `docs/provenance.md`.
- Mount it as the new `/` page **inside our current app shell** (header/nav, footer). M1/M2/M3
  routes + our Dexie stay untouched. The old hand-rolled `SkillAcquisitionPage` (currently
  `/legacy`), my `§0 TrackDiagramPanel`, and the slice-1 `rankSkillChart` UI are **retired**
  once the vendored equivalents are mounted (the pure cores `src/core/track.ts` etc. can be
  deleted with them; the engine adapter `src/sim/courseGeometry.ts` stays if still used).
- **Strip the Compare / Uma-2 tab.** Keep single-runner sim, HP, skill-activation zones, track.

## Data model — one Build core, two faces

- `Build` = umalator's `IRunnerState` shape: `outfitId`/uma, 5 stats (`speed/stamina/power/
  guts/wisdom`), `strategy`, three aptitude grades, `mood`, `skills[]`. The vendored left
  editor edits this directly.
- A **`kind` discriminator** distinguishes two faces that share the `Build` core:
  - **Real uma** (a trained character) = `Build` + sparks + tags → this is our existing
    `RosterEntry` (M1). *Not built now*; the point is the editor is reusable for it later.
  - **`CmPlan`** = `Build` + the planner layer (`cmRef`, `role`, `sparkGoals`, `wishlist`
    with `priority`/`source`/`projectedL`, `parents`, deck, `patch`, `server`, `dataVersion`,
    `planNumber`/`remark`). This is the face we build now.
- "CmPlan needs more variables to work with the other modules later" — those extra fields are
  exactly the planner layer above; they ride alongside the shared `Build` core.

## State & persistence — defer bridging

- Reuse umalator's working **Zustand + localStorage** stores (runner build, saved-builds
  library, race presets) **as-is for now**. Persist `CmPlan`'s extra planner fields alongside.
- **Defer** unifying into our Dexie SSOT and wiring M1/M2/M3 until those modules are ready.
  Two state worlds coexist temporarily; this is an accepted, explicit trade for speed-to-
  functional.

## Data governance (P4) — honest flag

- The vendored UI initially runs on umalator's **bundled** game data (the pinned snapshot in
  the engine bundle) — that's what makes it work out-of-the-box. Reconciling with our
  Global-versioned `public/data` pipeline (+ overrides, server filtering) is **deferred** and
  noted in the UI where it matters (P3/P4).

## Slices (roadmap)

- **Slice A (first, functional base):** vendor the **build editor + race-setup bar + track**,
  mount at `/`, single-runner, no Compare, no charts. Reuses umalator's stores/data. Ship a
  working M4 foundation.
- **Slice B:** vendor the **Skill Chart** tab (M4 §1).
- **Slice C:** vendor the **Uma Chart** tab (M4 §1).
- **Slice D:** our planner additions — `§2` wishlist (priority/source) + `§3` card-hint
  sourcing + CM identity (`cmRef`/preset selection) wrapped around the editor/charts.
- **Later:** `CmPlan`↔Dexie SSOT unification + M1/M2/M3 wiring; `public/data` reconciliation;
  Compare / debuffer evaluation.

## Risks & unknowns

- **Zustand store coupling.** We keep umalator's stores rather than decouple them — low risk
  for Slice A, but our planner state must layer cleanly on top.
- **Styling — preserve umalator's look (requirement, not just a risk).** umalator uses
  `--background`/`--foreground` CSS vars; our app uses `--bg-*`/`--fg`/`--accent`. Bridge with
  `:root` aliases (map umalator's vars onto ours / import its theme) so the vendored UI keeps
  its **native dark-theme appearance** — do NOT reskin it. Verify rendered output against
  umalator / the mockup each slice.
- **Vendoring volume.** Pulling UI modules (not just the engine) is a larger surface; vendor
  the minimum Slice A needs first, expand per slice.
- **Two state worlds** until the Dexie/SSOT unification — accepted, time-boxed.
- **Data divergence (P4)** — bundled vs `public/data`; deferred, flagged.

## Testing

- Smoke/render tests that the vendored editor + race-setup + track mount and render for CM15
  inside our shell (inject data/stores; no real engine in jsdom where avoidable).
- Unit tests for our planner additions and the `Build`↔`CmPlan` mapping as they land.
- `pnpm typecheck` + `pnpm test` + `pnpm build` green each slice.

## Provenance / licensing

- All vendored UI is from `jalbarrang/umalator-global` (GPL-3.0-only) — same repo + license as
  the engine we already vendor. No new license obligation; record the UI vendor + retrieval
  date in `docs/provenance.md` (NOTICE/CREDITS already cover the chain).
