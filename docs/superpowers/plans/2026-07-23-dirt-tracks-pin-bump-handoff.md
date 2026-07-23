# Handoff — dirt-track pin bump (v0.27.0 `484539f5` → v0.37.0 `271be4dc`)

**Date:** 2026-07-23 · **Status:** EXECUTED same day (option A, same branch) — outcome in mechanics-notes §12.5; kept for the investigation record · **Trigger:** the in-game
Global update of **2026-07-14** added three new racecourses — **Kawasaki, Funabashi,
Morioka** — plus **17 graded dirt races (4 new dirt G1s**: Kawasaki Kinen, Zen-Nippon
Junior Yushun, Kashiwa Kinen, Mile Championship Nambu Hai**)** and several new
dirt-activation skills ([official news](https://umamusume.com/news/896/)). Our unified
app+engine pin (`484539f5`, data `10006860` / 2026-07-09) predates all of it — the
planner's track picker still shows 108 courses / 12 tracks and none of the new dirt
courses or skills.

## Upstream state (jalbarrang/umalator-global)

Pin `484539f5` (v0.27.0, 2026-07-11) → HEAD `271be4dc` (v0.37.0, 2026-07-21):
**41 commits, 300 files**, including 23 Rust files. Key commits:

| Commit | What |
|---|---|
| `3aeb8c20` (v0.34.0) | **Course data: 108 → 119 courses.** Adds the 11 geometries master.mdb references but never had courseeventparams for: Kawasaki `11301–11303`, Funabashi `11401–11404`, Morioka `11501–11504`. Adds tracknames for Kawasaki/Funabashi/Morioka **and Longchamp** (`11203` got real geometry; `11201`/`11202` stay excluded — Cygames ships placeholders). Also **refreshes all 108 existing course geometries** to current track revisions (⇒ existing-course sim numbers move too). New `extract:geometry` tooling vendored+pinned from alpha123/uma-skill-tools. |
| `07817628` | game data → `10006900` (2026-07-15; the 07-14 in-game update's data) |
| `299fecc0` | game data → `10006910` (2026-07-17) |
| `af626e2e` (v0.32.1) | **fix(sim): align race pacing with canonical mechanics** — a physics change; shifts numbers on its own |
| `ce828832` + `ab93471f` | runtime skill effect **value scaling** (usages 8/9/14 typed policies; Aoharu usages 3–7) + a WASM DTO boundary guard |
| `48680499` | **forced activation positions actually fire the skill** — directly relevant to our deferred force-activation follow-up (roadmap S1 unlocks) |
| `f878614a` + `61fa28d4` | vacuum compare reinstated for duo fields + **vacuum mode with context runners** — relevant to the near-lane/contested-compare follow-up |
| `9c427ba5` | teammates excluded from external debuff effects (touches the debuff model our stamina-tab `buildInjectedDebuffs` rides on) |

Of the files `scripts/fetch-borrowed.ts` pins, these changed upstream:
`skills.json`, `support-cards.json`, `course_data.json`, `gametora/skills.json`,
`gametora/character-cards.json`, `gametora/support-cards.json`. (`umas.json` and
`cm-presets.json` unchanged.)

## Why this is NOT a mechanical runbook §1 bump

1. **The multifire engine patch must be re-ported, not re-applied.** Upstream has
   NOT absorbed cooldown re-fire (`cooldownReactivation` — 0 code-search hits at
   HEAD), and **8 of the 9 Rust files** in
   `engine-patches/2026-07-10-multifire-rust.patch` were also changed upstream
   (`runner/physics.rs`, `runner/skills.rs`, `runner/lifecycle.rs`, `runner/mod.rs`,
   `skills/model.rs`, both `race.rs`, `dto.rs`). The upstream pacing fix + value-scaling
   rework land right where our port lives. Expect a re-port of similar shape to the
   original 2026-07-10 effort, incl. re-adjudicating the determinism-sort scope
   (mechanics-notes §12.1) against the new `tick_conditions` shape.
2. **Fidelity re-baselines again** (`src/sim/fidelity.test.ts`, EXPECTED_MEAN
   0.3730…): the pacing fix + the 108-course geometry refresh move every number.
   Expected/desirable (P3 cutover), but must be deliberate + recorded per
   mechanics-notes §12.
3. **`ENGINE_DATA_DATE` → `'2026-07-17'`** (game data `10006910`; verify the baked
   date at bump time). Getting it wrong misfires the rebalance pin-lag gate both ways.
4. **Check for a NEW Global balance patch** between `10006860` → `10006910`: the
   07-14 update added new dirt skills and may have adjusted existing ones. Re-run the
   standing datamine feed (`scripts/rebalance-datamine/`, diff `484539f5` vs `271be4dc`
   extracts) before assuming `rebalances.json` is current. New dirt skills also change
   `skills.json` counts → update `scripts/outputs.test.ts` counts + every
   `global-484539f5` literal → `global-271be4dc` per runbook §1 step 4.
5. **Sourcing side-data:** Smart Falcon's trainee events changed (new-track events) —
   `uma_events.json` / `uma_event_details.json` come from the daftuyda/GameTora
   pipeline (manual re-run, not `data:build`).

## Options

- **A. Full bump to `271be4dc` (runbook default — recommended).** One pin, tracks +
  new dirt skills + physics fixes + the force-activation/context-runner unlocks all
  arrive together. Cost: the multifire re-port + re-baseline above. Plan it as its own
  S1-style task (the original re-platform was a full PR, #51).
- **B. Hand-engineered data-forward split (fast tracks, frozen physics).** Keep the
  clone at `484539f5`+patch; copy ONLY the additive files into it (the 11 new
  `courseeventparams/113xx–115xx.json`, the new `course_data.json` entries, the 4 new
  `tracknames.json` names) and `pnpm sim:build`. Gets the picker to 119 courses without
  moving existing numbers (skips the 108-course geometry refresh). Against the one-pin
  default (runbook §1) — a deliberate split; new dirt *skills* would still be missing.
  Only worth it if a dirt CM gets announced before anyone has time for option A.
- **C. Wait.** Fine until a CM lands on a dirt/new track or someone wants the new
  skills; the risk is a CM16+ announcement on Kawasaki/Funabashi/Morioka finding the
  planner without the course.

## Execution checklist for option A (when picked up)

Runbook §1 end-to-end, plus: re-port `engine-patches/2026-07-10-multifire-rust.patch`
onto `271be4dc` in the clone (`spikes/repos/umalator-global`, note it lives in the MAIN
checkout — `spikes/` is gitignored so a worktree won't have it), regenerate the patch
file (rename to the new date), `bun install` in the clone, `pnpm sim:build`, re-baseline
fidelity + record deltas in mechanics-notes §12, bump `ENGINE_DATA_DATE`, datamine-diff
for a new balance patch, update outputs.test.ts counts + `global-<pin8>` literals, full
gate (`pnpm typecheck && pnpm test && pnpm build`), and eyeball the new tracks in the
picker + §0 visualizer (Kawasaki/Funabashi/Morioka render from the new geometries).

Sources: [official news 896](https://umamusume.com/news/896/) ·
[GosuGamers summary](https://www.gosugamers.net/news/78774-umamusume-s-english-version-to-get-four-g1-dirt-races-and-three-new-racecourses) ·
[Game8 new dirt races](https://game8.co/games/Umamusume-Pretty-Derby/archives/607096) ·
upstream compare `484539f5...271be4dc`.
