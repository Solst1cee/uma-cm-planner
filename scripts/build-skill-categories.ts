/**
 * M1.7 coverage-table sort metadata — per-skill family `group`.
 *
 * Emits public/data/skill_categories.json: `{ skillId: { group } }`, where
 * `group` is master.mdb `skill_data.group_id`, which clusters a skill's
 * gold/white/○/◎ family so the icon-spec sort (src/features/inheritance/
 * skillSort.ts) lands them adjacently. Skills absent from skill_data (e.g.
 * 9xxxxx inherited-uniques) get group 0.
 *
 * Provenance: master.mdb (§6b) — no GameTora. Not in `pnpm data:build`
 * (needs the spikes mdb); run `pnpm tsx scripts/build-skill-categories.ts`.
 */
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { OVERRIDES_DIR, PUBLIC_DATA_DIR, REPO_ROOT, SPIKES_UPSTREAM_DIR, readJson, writeJsonDeterministic } from './lib/io';
import type { SkillSortMeta } from '@/core/skillCategory';

/** Hand-patch overrides (P5) — per-skill record replacement, applied LAST. */
export interface SkillCategoriesOverrides {
  /** skillId → full SkillSortMeta replacement (overrides win). */
  setBySkill?: Record<string, SkillSortMeta>;
  /** skillIds dropped from the emitted map entirely. */
  removeSkillIds?: string[];
}

export function applySkillCategoriesOverrides(
  base: Record<string, SkillSortMeta>,
  ov: SkillCategoriesOverrides,
): Record<string, SkillSortMeta> {
  const out: Record<string, SkillSortMeta> = { ...base };
  for (const [id, meta] of Object.entries(ov.setBySkill ?? {})) out[id] = meta;
  for (const id of ov.removeSkillIds ?? []) delete out[id];
  return out;
}

function mdbPath(): string | null {
  const candidates = [
    join(SPIKES_UPSTREAM_DIR, 'db', 'master.mdb'),
    join(REPO_ROOT, '..', '..', '..', 'spikes', 'repos', 'umalator-global', 'db', 'master.mdb'),
  ];
  return candidates.find((p) => existsSync(p)) ?? null;
}

function main(): void {
  const skills = readJson<Array<{ skillId: string }>>(join(PUBLIC_DATA_DIR, 'skills.json'));
  const mdb = mdbPath();
  const groupById = new Map<string, number>();
  if (mdb) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
    const db = new DatabaseSync(mdb, { readOnly: true });
    const rows = db.prepare('select id, group_id as g from skill_data').all() as Array<{ id: number | bigint; g: number }>;
    db.close();
    for (const r of rows) groupById.set(String(r.id), r.g);
  } else {
    console.warn('master.mdb not found — every skill falls back to group 0');
  }

  const base: Record<string, SkillSortMeta> = {};
  for (const s of skills) {
    base[s.skillId] = { group: groupById.get(s.skillId) ?? 0 };
  }
  // P5: merge the hand-patch overrides LAST (data-overrides/skill_categories_overrides.json).
  const ovPath = join(OVERRIDES_DIR, 'skill_categories_overrides.json');
  const ov = existsSync(ovPath) ? readJson<SkillCategoriesOverrides>(ovPath) : {};
  const out = applySkillCategoriesOverrides(base, ov);
  writeJsonDeterministic(join(PUBLIC_DATA_DIR, 'skill_categories.json'), out);

  console.log(`skill_categories.json: ${Object.keys(out).length} skills`);
}

const entry = process.argv[1] ?? '';
if (entry.endsWith('build-skill-categories.ts')) main();
