// Builds the `uma-sim-wasm` crate (upstream umalator-global v0.27.0, Rust/WASM
// re-platform) into a wasm-pack `--target web` bundle vendored at
// src/sim/vendor/pkg/.
// Source: spikes/repos/umalator-global @ 271be4d (v0.37.0 pin), GPL-3.0-only,
// checked out on local branch `local-wasm-baseline`.
// Ported from the upstream clone's scripts/build-wasm.ts (bun) to plain Node.
//
// IMPORTANT: the default `cargo` on some machines is a standalone (non-rustup)
// install that lacks the wasm32 std. We force the rustup `stable` toolchain
// (which has `wasm32-unknown-unknown` installed) onto PATH so `wasm-pack` /
// `cargo` resolve to it. `~/.cargo/bin` may not be on PATH in a fresh shell,
// so we also fall back to invoking rustc/rustup directly from there.
//
// Prereqs (one-time, see .superpowers/sdd/task-0-brief.md Step 1):
//   rustup target add wasm32-unknown-unknown
//   cargo install wasm-pack
import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const isWin = process.platform === 'win32';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENGINE = path.join(ROOT, 'spikes/repos/umalator-global');
const CRATE_DIR = path.join(ENGINE, 'packages', 'uma-sim-wasm');
const OUT_DIR = path.join(ROOT, 'src/sim/vendor/pkg');

/** Resolve a command on PATH (using the given env), or `null` if missing. */
function which(cmd, env) {
  const finder = isWin ? 'where' : 'which';
  const res = spawnSync(finder, [cmd], { encoding: 'utf8', env, shell: isWin });
  if (res.status !== 0 || !res.stdout) {
    return null;
  }
  return res.stdout.split(/\r?\n/, 1)[0]?.trim() || null;
}

const env = { ...process.env };

// Locate rustc/rustup even when ~/.cargo/bin isn't on PATH yet (fresh shell).
const cargoBinFallback = join(
  process.env.USERPROFILE ?? process.env.HOME ?? '',
  '.cargo',
  'bin'
);
let rustupCmd = which('rustup', env);
if (!rustupCmd) {
  const fallback = join(cargoBinFallback, isWin ? 'rustup.exe' : 'rustup');
  const probe = spawnSync(fallback, ['--version'], { encoding: 'utf8', shell: isWin });
  if (probe.status === 0) {
    rustupCmd = fallback;
    env.PATH = `${cargoBinFallback}${delimiter}${env.PATH ?? ''}`;
  }
}

// Prefer the rustup `stable` toolchain (has wasm32 std) by prepending its bin
// dir to PATH. `rustc --print sysroot` returns a native path on every
// platform, so no Windows/git-bash `cygpath` dance is needed.
if (rustupCmd) {
  const res = spawnSync(rustupCmd, ['run', 'stable', 'rustc', '--print', 'sysroot'], {
    encoding: 'utf8',
    env,
    shell: isWin,
  });
  const sysroot = res.status === 0 ? res.stdout.trim() : '';
  if (sysroot) {
    env.PATH = `${join(sysroot, 'bin')}${delimiter}${env.PATH ?? ''}`;
  }
}

if (!which('wasm-pack', env)) {
  console.error('error: wasm-pack not found. Install it with:  cargo install wasm-pack');
  process.exit(1);
}

console.log(`[build-wasm] building uma-sim-wasm -> ${path.relative(ROOT, OUT_DIR)}`);
const build = spawnSync(
  'wasm-pack',
  [
    'build',
    CRATE_DIR,
    '--target',
    'web',
    '--release',
    '--out-dir',
    OUT_DIR,
    '--out-name',
    'uma_sim_wasm',
  ],
  { stdio: 'inherit', cwd: ENGINE, env, shell: isWin }
);

if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

// wasm-pack writes a pkg/.gitignore that would hide the vendored artifacts —
// this bundle IS the vendored output, so it must be committable.
rmSync(join(OUT_DIR, '.gitignore'), { force: true });

console.log('[build-wasm] done. Import from src/sim/vendor/pkg/uma_sim_wasm.js');
