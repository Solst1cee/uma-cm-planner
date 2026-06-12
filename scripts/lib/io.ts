/**
 * Shared IO helpers for the build-time data pipeline (plan §6 build step 1).
 * All output is deterministic: 2-space JSON + trailing newline, callers
 * stable-sort records before writing.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// fileURLToPath gets the raw string: under vitest's jsdom environment the
// global URL class is jsdom's, which Node's fileURLToPath rejects.
export const REPO_ROOT = import.meta.url.startsWith('file:')
  ? join(dirname(fileURLToPath(import.meta.url)), '..', '..')
  : process.cwd();
export const SCRIPTS_DIR = join(REPO_ROOT, 'scripts');
export const BORROWED_DIR = join(SCRIPTS_DIR, 'borrowed');
export const PUBLIC_DATA_DIR = join(REPO_ROOT, 'public', 'data');
export const OVERRIDES_DIR = join(REPO_ROOT, 'data-overrides');
/** Local Phase-0 clone of the pinned upstream (gitignored; see docs/provenance.md §1). */
export const SPIKES_UPSTREAM_DIR = join(REPO_ROOT, 'spikes', 'repos', 'umalator-global');

export function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

export function readBorrowedJson<T>(relPath: string): T {
  return readJson<T>(join(BORROWED_DIR, relPath));
}

export function writeJsonDeterministic(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}
