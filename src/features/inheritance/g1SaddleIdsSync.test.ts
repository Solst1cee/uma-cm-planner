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

  it('whitelist is populated with the authoritative G1 saddle set (win-bonus is live)', () => {
    // Derived from master.mdb single_mode_wins_saddle (win_saddle_type==3 ⇔ grade 100);
    // see mechanics-notes §3 + provenance §5. Guards against a silent revert to [].
    const ids = new Set((srcCopy as { g1SaddleIds: string[] }).g1SaddleIds);
    expect(ids.size).toBe(34);
    // canonical G1 races present…
    for (const id of ['10', '11', '12', '13', '18', '39', '147']) expect(ids.has(id)).toBe(true);
    // …compound titles (1–9) and G2/G3 saddles (e.g. 45 Yayoi Sho) absent.
    for (const id of ['1', '5', '9', '40', '45']) expect(ids.has(id)).toBe(false);
  });
});
