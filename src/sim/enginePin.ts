/** The vendored engine's baked-in game-data date (master.mdb pin).
 *
 *  Bump this on every engine-data refresh (`pnpm sim:build` against a newer
 *  master.mdb pin) — see docs/data-refresh-runbook.md §1 (Step 1b) /
 *  docs/provenance.md §1.
 *
 *  Consumed by `src/core/rebalance.ts` (`isInPin`) to gate the rebalance-patch
 *  system (`src/core/rebalancePatches.ts`): a confirmed skill-rebalance version
 *  dated on/before this date is already computed natively by the engine, so it
 *  must NOT be re-injected as a `skillPatches` override, and must NOT surface a
 *  "confirmed patch, engine pin pending" note — that note is only honest for
 *  versions the frozen engine data still lags (pin-lag).
 *
 *  Pure constant module — no imports. `src/core/` (which must stay engine-bundle
 *  free) imports this file directly; keep it free of any import that would drag
 *  the ~5MB engine/WASM bundle along with it (see CLAUDE.md "Keep the engine
 *  lazy"). */
export const ENGINE_DATA_DATE = '2026-07-09'; // game data 10006860 (v0.27.0 pin)
