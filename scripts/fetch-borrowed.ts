/**
 * Fetch the borrowed upstream JSON (P1: reuse, don't extract ourselves) from
 * the pinned commits (docs/provenance.md §1, §3, §4.1) into scripts/borrowed/
 * (gitignored). Two upstreams: jalbarrang/umalator-global (engine data) and
 * jechto/Tachyons-lab (event-reward dataset — closes the chain-choice /
 * date-event / skill-grant blind spot in GameTora's eventData parse).
 *
 * Modes:
 *   pnpm data:fetch                 — download from raw.githubusercontent.com
 *   pnpm data:fetch -- --from-spikes — copy from the local Phase-0 artifacts
 *                                      (spikes/repos/umalator-global,
 *                                       spikes/tachyons-data.json)
 */
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { BORROWED_DIR, REPO_ROOT, SPIKES_UPSTREAM_DIR } from './lib/io';

/** v0.14.2 — see docs/provenance.md §1. */
export const UPSTREAM_COMMIT = 'c1fa2107b6a7be6283bf6414ebb7a23ea0c095ca';
const RAW_BASE = `https://raw.githubusercontent.com/jalbarrang/umalator-global/${UPSTREAM_COMMIT}/`;

/**
 * jechto/Tachyons-lab pin — latest commit touching front/src/app/data/data.json
 * as of 2026-06-12 (data dated 2026-06-09; sha256 verified identical to the
 * Phase-0 local copy spikes/tachyons-data.json). See docs/provenance.md §4.1.
 */
export const TACHYONS_COMMIT = '2ce0c8fe4af685d2a3cf5d5fd8f80fe60c6115de';
const TACHYONS_RAW_BASE = `https://raw.githubusercontent.com/jechto/Tachyons-lab/${TACHYONS_COMMIT}/`;

export interface BorrowedFile {
  upstream: string;
  local: string;
  /** raw.githubusercontent.com base; defaults to the umalator-global pin. */
  rawBase?: string;
  /** --from-spikes source relative to the repo root; defaults to the umalator-global clone. */
  spikesPath?: string;
}

export const BORROWED_FILES: ReadonlyArray<BorrowedFile> = [
  { upstream: 'src/modules/data/json/skills.json', local: 'skills.json' },
  { upstream: 'src/modules/data/json/support-cards.json', local: 'support-cards.json' },
  { upstream: 'src/modules/data/json/umas.json', local: 'umas.json' },
  { upstream: 'src/modules/data/json/course_data.json', local: 'course_data.json' },
  { upstream: 'src/modules/data/json/gametora/skills.json', local: 'gametora/skills.json' },
  {
    upstream: 'src/modules/data/json/gametora/character-cards.json',
    local: 'gametora/character-cards.json',
  },
  { upstream: 'src/modules/data/json/gametora/support-cards.json', local: 'gametora/support-cards.json' },
  { upstream: 'src/modules/data/json/gametora/support-effects.json', local: 'gametora/support-effects.json' },
  {
    upstream: 'src/modules/data/json/gametora/event-skill-sources.json',
    local: 'gametora/event-skill-sources.json',
  },
  { upstream: 'src/store/race/cm-presets.json', local: 'cm-presets.json' },
  { upstream: 'db/extract/relation.json', local: 'relation.json' },
  { upstream: 'db/extract/relation_member.json', local: 'relation_member.json' },
  {
    upstream: 'front/src/app/data/data.json',
    local: 'tachyons-data.json',
    rawBase: TACHYONS_RAW_BASE,
    spikesPath: 'spikes/tachyons-data.json',
  },
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
    const src = file.spikesPath
      ? join(REPO_ROOT, file.spikesPath)
      : join(SPIKES_UPSTREAM_DIR, file.upstream);
    if (!existsSync(src)) {
      throw new Error(
        `--from-spikes: missing ${src}. Restore the pinned upstream artifacts under spikes/ ` +
          `(provenance §1, §4.1) or run without --from-spikes to download.`,
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
    const url = `${file.rawBase ?? RAW_BASE}${file.upstream}`;
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
