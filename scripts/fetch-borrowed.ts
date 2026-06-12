/**
 * Fetch the borrowed upstream JSON (P1: reuse, don't extract ourselves) from
 * jalbarrang/umalator-global at the pinned commit (docs/provenance.md §1, §3)
 * into scripts/borrowed/ (gitignored).
 *
 * Modes:
 *   pnpm data:fetch                 — download from raw.githubusercontent.com
 *   pnpm data:fetch -- --from-spikes — copy from the local Phase-0 clone
 *                                      (spikes/repos/umalator-global)
 */
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { BORROWED_DIR, SPIKES_UPSTREAM_DIR } from './lib/io';

/** v0.14.2 — see docs/provenance.md §1. */
export const UPSTREAM_COMMIT = 'c1fa2107b6a7be6283bf6414ebb7a23ea0c095ca';
const RAW_BASE = `https://raw.githubusercontent.com/jalbarrang/umalator-global/${UPSTREAM_COMMIT}/`;

export const BORROWED_FILES: ReadonlyArray<{ upstream: string; local: string }> = [
  { upstream: 'src/modules/data/json/skills.json', local: 'skills.json' },
  { upstream: 'src/modules/data/json/support-cards.json', local: 'support-cards.json' },
  { upstream: 'src/modules/data/json/umas.json', local: 'umas.json' },
  { upstream: 'src/modules/data/json/course_data.json', local: 'course_data.json' },
  { upstream: 'src/modules/data/json/gametora/skills.json', local: 'gametora/skills.json' },
  { upstream: 'src/modules/data/json/gametora/support-cards.json', local: 'gametora/support-cards.json' },
  { upstream: 'src/modules/data/json/gametora/support-effects.json', local: 'gametora/support-effects.json' },
  {
    upstream: 'src/modules/data/json/gametora/event-skill-sources.json',
    local: 'gametora/event-skill-sources.json',
  },
  { upstream: 'src/store/race/cm-presets.json', local: 'cm-presets.json' },
];

function prepareBorrowedDir(): void {
  mkdirSync(BORROWED_DIR, { recursive: true });
  // Borrowed snapshots are never committed (game data is Cygames property —
  // provenance §2); '*' also ignores this .gitignore itself.
  writeFileSync(join(BORROWED_DIR, '.gitignore'), '*\n', 'utf8');
}

export function borrowedFilesPresent(): boolean {
  return BORROWED_FILES.every((f) => existsSync(join(BORROWED_DIR, f.local)));
}

export function copyFromSpikes(): void {
  prepareBorrowedDir();
  for (const file of BORROWED_FILES) {
    const src = join(SPIKES_UPSTREAM_DIR, file.upstream);
    if (!existsSync(src)) {
      throw new Error(
        `--from-spikes: missing ${src}. Re-clone the pinned upstream into spikes/repos/ ` +
          `(provenance §1) or run without --from-spikes to download.`,
      );
    }
    const dest = join(BORROWED_DIR, file.local);
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(src, dest);
    console.log(`copied  ${file.local}`);
  }
}

export async function downloadFromGitHub(): Promise<void> {
  prepareBorrowedDir();
  for (const file of BORROWED_FILES) {
    const url = `${RAW_BASE}${file.upstream}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`download failed (${res.status} ${res.statusText}): ${url}`);
    }
    const body = await res.text();
    const dest = join(BORROWED_DIR, file.local);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, body, 'utf8');
    console.log(`fetched ${file.local}`);
  }
}

export async function fetchBorrowed(opts: { fromSpikes: boolean }): Promise<void> {
  if (opts.fromSpikes) {
    copyFromSpikes();
  } else {
    await downloadFromGitHub();
  }
}

const isMain = (process.argv[1] ?? '').replace(/\\/g, '/').endsWith('scripts/fetch-borrowed.ts');
if (isMain) {
  fetchBorrowed({ fromSpikes: process.argv.includes('--from-spikes') }).catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  });
}
