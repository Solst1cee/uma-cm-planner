/**
 * M1.7 bonus-sort — per-skill "in-game icon" category.
 *
 * Classifies every skill in public/data/skills.json into one of five buckets
 * (the order the bonus list sorts by): unique · normal · recovery · green ·
 * debuff. Signals come from master.mdb `skill_data` (ability_type / target_type
 * / value); rarity comes from our skills.json (covers 9xxxxx inherited-uniques
 * that aren't in skill_data). Emits public/data/skill_categories.json.
 *
 * Provenance: master.mdb (§6b) — no GameTora. Not in `pnpm data:build`
 * (needs the spikes mdb); run `pnpm tsx scripts/build-skill-categories.ts`.
 */
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { PUBLIC_DATA_DIR, REPO_ROOT, SPIKES_UPSTREAM_DIR, readJson, writeJsonDeterministic } from './lib/io';
import type { SkillRarity } from '@/core/types';
import { CATEGORY_ORDER, classifySkill, type SkillAbility, type SkillSortMeta } from '@/core/skillCategory';

function mdbPath(): string | null {
  const candidates = [
    join(SPIKES_UPSTREAM_DIR, 'db', 'master.mdb'),
    join(REPO_ROOT, '..', '..', '..', 'spikes', 'repos', 'umalator-global', 'db', 'master.mdb'),
  ];
  return candidates.find((p) => existsSync(p)) ?? null;
}

function main(): void {
  const skills = readJson<Array<{ skillId: string; rarity: SkillRarity }>>(join(PUBLIC_DATA_DIR, 'skills.json'));
  const mdb = mdbPath();
  const abilityById = new Map<string, SkillAbility>();
  const groupById = new Map<string, number>();
  if (mdb) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
    const db = new DatabaseSync(mdb, { readOnly: true });
    const rows = db.prepare(
      'select id, group_id as g, skill_category as c, ability_type_1_1 as a, target_type_1_1 as t, float_ability_value_1_1 as v from skill_data',
    ).all() as Array<{ id: number | bigint; g: number; c: number; a: number; t: number; v: number }>;
    db.close();
    for (const r of rows) {
      abilityById.set(String(r.id), { category: r.c, abilityType: r.a, targetType: r.t, value: r.v });
      groupById.set(String(r.id), r.g);
    }
  } else {
    console.warn('master.mdb not found — every non-unique skill falls back to "normal"');
  }

  const out: Record<string, SkillSortMeta> = {};
  for (const s of skills) {
    out[s.skillId] = { category: classifySkill(s.rarity, abilityById.get(s.skillId)), group: groupById.get(s.skillId) ?? 0 };
  }
  writeJsonDeterministic(join(PUBLIC_DATA_DIR, 'skill_categories.json'), out);

  const counts = CATEGORY_ORDER.map((c) => `${c}:${Object.values(out).filter((x) => x.category === c).length}`).join(' ');
  console.log(`skill_categories.json: ${Object.keys(out).length} skills (${counts})`);
}

const entry = process.argv[1] ?? '';
if (entry.endsWith('build-skill-categories.ts')) main();
