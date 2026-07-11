# Vendored engine — Rust/WASM (v0.27.0)

Everything in this directory is a **generated, committed** artifact — do not hand-edit.

- **Source:** jalbarrang/umalator-global, pinned **v0.27.0** (commit `484539f5c67e7aea8ef3715443d66602d871902d`), GPL-3.0-only. The engine is now upstream's **Rust core compiled to WebAssembly** (upstream re-platformed off TypeScript around v0.19); we re-platformed onto it 2026-07-10 (spec: `docs/superpowers/specs/2026-07-10-sim-engine-wasm-replatform-design.md`).
- **Clone location (gitignored):** `spikes/repos/umalator-global`, on local branch `local-wasm-baseline` (= the `484539f5` pin + our engine patch applied as clone-local commits).

## Committed artifacts

| File | What it is |
|---|---|
| `pkg/` | The `wasm-pack --target web` output of the `uma-sim-wasm` crate (`uma_sim_wasm_bg.wasm` + JS glue + `.d.ts`). The `.wasm` is the compiled Rust physics core; sha256 `4fa2e875…` (recorded in `docs/mechanics-notes.md` §12). Built by `scripts/build-wasm.mjs`. |
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

The multi-fire Rust port + a determinism sort + an upstream TS settings-thread fix live in `engine-patches/2026-07-10-multifire-rust.patch` (12 files). To rebuild from a clean clone:

```sh
git -C spikes/repos/umalator-global checkout 484539f5 -b local-wasm-baseline
git -C spikes/repos/umalator-global apply <repo>/engine-patches/2026-07-10-multifire-rust.patch
pnpm sim:build
```

`cooldownReactivation` (default ON) reproduces upstream single-fire when OFF; see `docs/mechanics-notes.md` §12 for the fidelity anchors and the determinism-sort scope adjudication (§12.1). License: GPL-3.0-only (same as this repo); see `NOTICE.md`.

**⚠️ P3 cutover note:** every simulated number shifts at this cutover — 13 releases of upstream physics + fresh game data + the fidelity baseline moving to the stamina-ON pipeline (the old v0.14.2 anchor 0.2202 ran `ignoreStaminaConsumption:true` and is retired, non-comparable). This is expected and desirable, not a regression.
