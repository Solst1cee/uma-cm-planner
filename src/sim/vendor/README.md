# Vendored engine — Rust/WASM (v0.37.0)

Everything in this directory is a **generated, committed** artifact — do not hand-edit.

- **Source:** jalbarrang/umalator-global, pinned **v0.37.0** (commit `271be4dcc590a58a35baa12e343a6e9ed6b7ebb9`), GPL-3.0-only. The engine is now upstream's **Rust core compiled to WebAssembly** (upstream re-platformed off TypeScript around v0.19); we re-platformed onto it 2026-07-10 (spec: `docs/superpowers/specs/2026-07-10-sim-engine-wasm-replatform-design.md`) and bumped v0.27.0 → v0.37.0 on 2026-07-23 (dirt-track update; mechanics-notes §12.5).
- **Clone location (gitignored):** `spikes/repos/umalator-global`, on local branch `local-wasm-v037` (= the `271be4dc` pin + our engine patch as a clone-local commit).

## Committed artifacts

| File | What it is |
|---|---|
| `pkg/` | The `wasm-pack --target web` output of the `uma-sim-wasm` crate (`uma_sim_wasm_bg.wasm` + JS glue + `.d.ts`). The `.wasm` is the compiled Rust physics core; sha256 `194bd138…` (recorded in `docs/mechanics-notes.md` §12.5). Built by `scripts/build-wasm.mjs`. |
| `umalator-wasm.bundle.mjs` | The wrapper ESM bundle: the pkg glue (bundled, not external) + the upstream TS adapters / round-reducers / data-service singletons `src/sim` runs on top of it, with the 8 baked-JSON datasets fed through `initDataFromRaw` at import time. Built by `scripts/build-sim.mjs`. |
| `umalator-wasm.bundle.d.mts` | Hand-widened type surface for the wrapper bundle. |

The physics engine is a **web-worker/lazy-only** dependency (also used main-thread by M2 via a shared lazy chunk); `src/core` stays engine-free. Our mechanics corrections (multi-fire, skill-level/patch overrides) live in the engine patch below, **not** in `src/core`.

## Rebuild

```sh
pnpm sim:build   # = node scripts/build-wasm.mjs  (→ pkg/) then node scripts/build-sim.mjs (→ wrapper bundle)
```

`build-wasm.mjs` runs `wasm-pack build --target web` on the crate; `build-sim.mjs` esbuild-bundles the wrapper. Run them in that order (the wrapper statically imports the pkg glue). `pnpm sim:build` does both.

### Rust toolchain prereqs (one-time)

- **rustup** stable (`rustc 1.97.0` at the pin) with the `wasm32-unknown-unknown` target: `rustup target add wasm32-unknown-unknown`
- **wasm-pack** `0.15.0` (npm-global install used here): `npm i -g wasm-pack` (or `cargo install wasm-pack`)
- On Windows, the **MSVC** toolchain (VS 2022 build tools) for the host build steps.
- `build-wasm.mjs` forces the rustup `stable` toolchain onto PATH and falls back to `~/.cargo/bin` when a fresh shell doesn't carry it — a standalone (non-rustup) `cargo` lacks the wasm32 std and will fail.

### Patch re-apply flow (fresh clone)

The multi-fire Rust port + an upstream TS settings-thread fix live in `engine-patches/2026-07-23-multifire-rust.patch` (12 files; the old determinism sort is gone — upstream v0.32.1 ships it natively).

**The clone itself is gitignored** and lives at `spikes/repos/umalator-global` (upstream `jalbarrang/umalator-global`) — re-clone it there if absent. `scripts/build-sim.mjs` resolves the upstream npm deps (`i18next`, `react-i18next`, `es-toolkit`, `prando`, …) from the **clone's own `node_modules`** (`absWorkingDir` is the clone), so a fresh clone must have its deps installed first or `build-sim.mjs` fails to resolve them. The clone uses **Bun** (`bun.lock`, `packageManager: bun@1.3.13`), so install with `bun install` inside the clone.

To rebuild from a clean clone:

```sh
# 0. acquire the clone (gitignored) if not already present
git clone https://github.com/jalbarrang/umalator-global spikes/repos/umalator-global

# 1. check out the pin + apply our engine patch as clone-local commits
git -C spikes/repos/umalator-global checkout 271be4dc -b local-wasm-v037
git -C spikes/repos/umalator-global apply <repo>/engine-patches/2026-07-23-multifire-rust.patch

# 2. install the clone's JS deps (build-sim.mjs resolves them from HERE) — Bun
(cd spikes/repos/umalator-global && bun install)

# 3. rebuild the committed artifacts (needs the Rust toolchain prereqs above)
pnpm sim:build
```

`cooldownReactivation` (default ON) reproduces upstream single-fire when OFF; see `docs/mechanics-notes.md` §12 for the fidelity anchors and the determinism-sort scope adjudication (§12.1). License: GPL-3.0-only (same as this repo); see `NOTICE.md`.

> **⚠️ Reproduction status (honest, owner follow-up):** byte-stability *across rebuilds of the existing clone* IS proven (`docs/mechanics-notes.md` §12.1). A **full clean-clone reproduction** of the above flow (fresh `git clone` + fresh `bun install` + `pnpm sim:build` producing the identical committed `pkg/` bytes) has **not yet been executed end-to-end** — the clone in use predates this documentation. Verifying it from a pristine clone remains an owner follow-up; treat the exact `bun install` / toolchain versions above as best-known, not yet cold-validated.

**⚠️ P3 cutover note:** every simulated number shifts at this cutover — 13 releases of upstream physics + fresh game data + the fidelity baseline moving to the stamina-ON pipeline (the old v0.14.2 anchor 0.2202 ran `ignoreStaminaConsumption:true` and is retired, non-comparable). This is expected and desirable, not a regression.
