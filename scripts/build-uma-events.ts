/**
 * M1.7 add-on — career training-event skill availability.
 *
 * Inverts daftuyda/UmaTools `skills_all.json` `char_e` (per-skill list of outfit
 * ids obtainable via a training event) into `{ [umaId]: skillId[] }`, merges the
 * hand-patch `data-overrides/uma_events_overrides.json` LAST (P5), and emits
 * `public/data/uma_events.json` (id→id facts only, no upstream copy).
 *
 * ⚠️ PROVENANCE: the input is GameTora-derived (daftuyda scrapes GameTora + GameWith).
 * Used under the owner-authorized private-use relaxation (docs/provenance.md §8, "path B")
 * — the input stays localOnly (`scripts/borrowed/daftuyda/`, gitignored) and this
 * generated file MUST be swapped for a self-extracted / manual source before any
 * public release. NOT wired into `pnpm data:build` (the input is not in CI); run
 * manually: `pnpm tsx scripts/build-uma-events.ts`.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { OVERRIDES_DIR, PUBLIC_DATA_DIR, readBorrowedJson, readJson, writeJsonDeterministic } from './lib/io';

/** One daftuyda skill record (only the fields we consume). */
export interface DaftuydaSkill {
  id: number;
  /** Outfit ids (our `umaId` space) that can obtain this skill via a training event. */
  char_e?: number[] | null;
}

/** Hand-patch overrides (P5) — additive/subtractive per uma, applied after the invert. */
export interface UmaEventsOverrides {
  addByUma?: Record<string, string[]>;
  removeByUma?: Record<string, string[]>;
}

const byNumericId = (a: string, b: string) => Number(a) - Number(b);

/** Invert per-skill `char_e` → `{ [umaId]: skillId[] }` (both keyed by string). */
export function buildUmaEvents(skills: DaftuydaSkill[]): Record<string, string[]> {
  const byUma = new Map<string, Set<string>>();
  for (const s of skills) {
    if (!s || typeof s.id !== 'number' || !Array.isArray(s.char_e)) continue;
    const skillId = String(s.id);
    for (const outfit of s.char_e) {
      if (typeof outfit !== 'number') continue;
      const key = String(outfit);
      let set = byUma.get(key);
      if (!set) { set = new Set<string>(); byUma.set(key, set); }
      set.add(skillId);
    }
  }
  const out: Record<string, string[]> = {};
  for (const key of [...byUma.keys()].sort(byNumericId)) {
    out[key] = [...byUma.get(key)!].sort(byNumericId);
  }
  return out;
}

/** Merge overrides LAST: add ids (union), then remove ids (set-difference). */
export function applyUmaEventsOverrides(
  base: Record<string, string[]>,
  ov: UmaEventsOverrides,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [uma, ids] of Object.entries(base)) out[uma] = ids.slice();
  for (const [uma, add] of Object.entries(ov.addByUma ?? {})) {
    out[uma] = [...new Set([...(out[uma] ?? []), ...add])].sort(byNumericId);
  }
  for (const [uma, remove] of Object.entries(ov.removeByUma ?? {})) {
    const drop = new Set(remove);
    if (out[uma]) out[uma] = out[uma].filter((id) => !drop.has(id));
  }
  return out;
}

export function generateUmaEvents(skills: DaftuydaSkill[], ov: UmaEventsOverrides): Record<string, string[]> {
  return applyUmaEventsOverrides(buildUmaEvents(skills), ov);
}

function main(): void {
  const skills = readBorrowedJson<DaftuydaSkill[]>('daftuyda/skills_all.json');
  const ovPath = join(OVERRIDES_DIR, 'uma_events_overrides.json');
  const ov = existsSync(ovPath) ? readJson<UmaEventsOverrides>(ovPath) : {};
  const merged = generateUmaEvents(skills, ov);
  const outPath = join(PUBLIC_DATA_DIR, 'uma_events.json');
  writeJsonDeterministic(outPath, merged);
  const umas = Object.keys(merged).length;
  const pairs = Object.values(merged).reduce((n, ids) => n + ids.length, 0);
  // eslint-disable-next-line no-console
  console.log(`uma_events.json: ${umas} umas, ${pairs} event-skill pairs → ${outPath}`);
}

// Run only when invoked directly (not when imported by the test).
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('build-uma-events.ts')) {
  main();
}
