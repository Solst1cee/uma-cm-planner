// src/features/inheritance/g1SaddleIdsSync.test.ts
/**
 * data-overrides/g1_saddle_ids.json is the P5 hand-patch SOURCE; the copy at
 * src/features/inheritance/g1_saddle_ids.json exists only because tsc rejects
 * out-of-rootDir imports (see useG1SaddleSet.ts). This test enforces the
 * hand-sync rule so the two files can never silently drift.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import srcCopy from './g1_saddle_ids.json';

// Vitest runs from the repo root (vitest.config location), so cwd-relative is
// stable; import.meta.url is not a file: URL under the jsdom environment.
const overridesPath = resolve(process.cwd(), 'data-overrides/g1_saddle_ids.json');

describe('g1_saddle_ids.json dual-copy sync', () => {
  it('src/features/inheritance copy is identical to the data-overrides source', () => {
    const overrides = JSON.parse(readFileSync(overridesPath, 'utf8'));
    expect(
      srcCopy,
      'src/features/inheritance/g1_saddle_ids.json has drifted from data-overrides/g1_saddle_ids.json — '
      + 'copy the data-overrides version over it (sync rule documented in useG1SaddleSet.ts)',
    ).toEqual(overrides);
  });
});
