/**
 * Fetch the borrowed upstream JSON (P1: reuse, don't extract ourselves) from
 * the pinned commits (docs/provenance.md §1, §3, §4.1) into scripts/borrowed/
 * (gitignored). Two upstreams: jalbarrang/umalator-global (engine data) and
 * jechto/Tachyons-lab (event-reward dataset — closes the chain-choice /
 * date-event / skill-grant blind spot in GameTora's eventData parse).
 *
 * Modes:
 *   pnpm data:fetch                 — download from raw.githubusercontent.com,
 *                                      falling back per-file to the private
 *                                      mirror (MIRROR_REPO below) when the
 *                                      pinned upstream URL fails
 *   pnpm data:fetch -- --from-spikes — copy from the local Phase-0 artifacts
 *                                      (spikes/repos/umalator-global,
 *                                       spikes/tachyons-data.json)
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { BORROWED_DIR, REPO_ROOT, SPIKES_UPSTREAM_DIR } from './lib/io';

/** v0.27.0 — see docs/provenance.md §1. */
export const UPSTREAM_COMMIT = '271be4dcc590a58a35baa12e343a6e9ed6b7ebb9';
/** Data version stamped on every generated record = `global-<first 8 of UPSTREAM_COMMIT>`. */
export const DATA_VERSION = `global-${UPSTREAM_COMMIT.slice(0, 8)}`;
const RAW_BASE = `https://raw.githubusercontent.com/jalbarrang/umalator-global/${UPSTREAM_COMMIT}/`;

/**
 * jechto/Tachyons-lab pin — latest commit touching front/src/app/data/data.json
 * as of 2026-07-11 ("Added last months cards", authored 2026-07-01; supersedes
 * the prior 2ce0c8fe pin dated 2026-06-09, which lagged the umalator-global
 * v0.27.0 card set enough to fail assertTachyonsParity on cards 30058-30061).
 * See docs/provenance.md §4.1.
 */
export const TACHYONS_COMMIT = '1e8692a35e7dd3956eca772e3ed57deabd067f17';
const TACHYONS_RAW_BASE = `https://raw.githubusercontent.com/jechto/Tachyons-lab/${TACHYONS_COMMIT}/`;

/**
 * PRIVATE fallback mirror of this whole directory, keyed by `local` name
 * (provenance §1.3). On 2026-08-09 `jalbarrang/umalator-global` was renamed to
 * `jalbarrang/torena-sim` and force-rewritten to 4 commits, deleting every
 * game-data JSON from HEAD. There are no tags, releases, or forks, so
 * UPSTREAM_COMMIT now survives only as *unreachable history*:
 * raw.githubusercontent.com still serves it (verified 2026-08-12), but GitHub
 * may garbage-collect those objects at any time — and the day it does, an
 * un-mirrored `pnpm data:fetch` would fail and `public/data/` would become
 * unreproducible.
 *
 * The mirror is private on purpose: `gametora/*.json` are GameTora-derived
 * datasets which this project never republishes (plan §7), and this repo is
 * public. Access therefore goes through the authenticated `gh` CLI rather than
 * a plain URL — there is no token to manage, but `gh auth login` is required.
 */
const MIRROR_REPO = 'Solst1cee/uma-cm-planner-borrowed';

/**
 * Read one file from the private mirror via `gh`. Returns the raw bytes, or
 * `null` when the mirror is unreachable for any reason (gh missing, not
 * authenticated, no access, file absent) — callers decide whether that is
 * fatal, since the mirror is a fallback and not the primary source.
 */
function readFromMirror(local: string): Buffer | null {
  try {
    return execFileSync(
      'gh',
      ['api', `repos/${MIRROR_REPO}/contents/${local}`, '-H', 'Accept: application/vnd.github.raw'],
      { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] },
    );
  } catch {
    return null;
  }
}

export interface BorrowedFile {
  upstream: string;
  local: string;
  /** raw.githubusercontent.com base; defaults to the umalator-global pin. */
  rawBase?: string;
  /** --from-spikes source relative to the repo root; defaults to the umalator-global clone. */
  spikesPath?: string;
  /**
   * Skip the network download — this file is never published on
   * raw.githubusercontent.com (it only exists in the local Phase-0 mdb clone).
   * The existing scripts/borrowed/ copy is reused as-is; `--from-spikes`
   * (re)copies it from spikes/. See docs/provenance.md §4.1.
   */
  localOnly?: boolean;
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
  // Succession-relation tables — extracted from the GLOBAL master.mdb in Phase 0
  // (provenance §4.1). umalator-global removed db/extract/ at v0.16.0, and these
  // were never on raw.githubusercontent.com, so they are local-only: the
  // committed scripts/borrowed/ copy is reused, `--from-spikes` recopies from
  // the local clone. Pin-independent stable game data (affinity groups).
  { upstream: 'db/extract/relation.json', local: 'relation.json', localOnly: true },
  {
    upstream: 'db/extract/relation_member.json',
    local: 'relation_member.json',
    localOnly: true,
  },
  // Support-card unique-effect table (master.mdb support_card_unique_effect),
  // extracted in Phase 0; local-only like the relation tables. Joined with the
  // effect-type enum (gametora/support-effects.json) in build-card-unique-effects.
  {
    upstream: 'db/extract/unique_effects.json',
    local: 'support-card-unique-effects.json',
    localOnly: true,
  },
  {
    upstream: 'front/src/app/data/data.json',
    local: 'tachyons-data.json',
    rawBase: TACHYONS_RAW_BASE,
    spikesPath: 'spikes/tachyons-data.json',
  },
];

function prepareBorrowedDir(): void {
  mkdirSync(BORROWED_DIR, { recursive: true });
  // Borrowed snapshots are never committed to THIS (public) repo — game data is
  // Cygames property and gametora/* is GameTora-derived (provenance §2, plan §7);
  // '*' also ignores this .gitignore itself. Durability instead comes from the
  // private MIRROR_REPO above (provenance §1.3), not from tracking them here.
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
    const dest = join(BORROWED_DIR, file.local);
    if (file.localOnly) {
      if (existsSync(dest)) {
        console.log(`local   ${file.local} (reused — not published upstream)`);
        continue;
      }
      // Not on raw.githubusercontent.com at all, but the mirror carries it.
      const mirrored = readFromMirror(file.local);
      if (!mirrored) {
        throw new Error(
          `local-only borrowed file missing: ${dest}. It is not published upstream — ` +
            `run \`pnpm data:fetch -- --from-spikes\` once to seed it from the local clone ` +
            `(provenance §4.1), or authenticate \`gh\` so it can be restored from ` +
            `${MIRROR_REPO} (provenance §1.3).`,
        );
      }
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, mirrored);
      console.log(`mirror  ${file.local} (restored from ${MIRROR_REPO})`);
      continue;
    }

    const url = `${file.rawBase ?? RAW_BASE}${file.upstream}`;
    let res: Response | null = null;
    let transportError: unknown = null;
    try {
      res = await fetch(url);
    } catch (err: unknown) {
      transportError = err;
    }

    if (res?.ok) {
      const body = await res.text();
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, body, 'utf8');
      console.log(`fetched ${file.local}`);
      continue;
    }

    // Primary failed. This is the expected steady state once GitHub GCs the
    // rewritten-away upstream history, so fall back rather than dying.
    const mirrored = readFromMirror(file.local);
    if (!mirrored) {
      const why = res
        ? `${res.status} ${res.statusText}`
        : `${transportError instanceof Error ? transportError.message : String(transportError)}`;
      throw new Error(
        `download failed (${why}): ${url}\n` +
          `The private mirror ${MIRROR_REPO} was also unreachable — check that \`gh\` is ` +
          `installed and \`gh auth login\` has run, or use \`pnpm data:fetch -- --from-spikes\` ` +
          `to copy from the local upstream clone (provenance §1.3, §4.1).`,
      );
    }
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, mirrored);
    console.log(`mirror  ${file.local} (upstream unavailable — restored from ${MIRROR_REPO})`);
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
