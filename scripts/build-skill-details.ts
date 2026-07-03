/**
 * M1.7 skill-detail popup — per-skill effect / condition / duration.
 *
 * Reads daftuyda/UmaTools `skills_all.json` (id-keyed by our skill id):
 *   effect      = desc_en (readable summary)
 *   condition   = condition_groups[0].condition (activation DSL)
 *   durationMs  = condition_groups[0].base_time (base duration; ÷10000 = seconds)
 * → emits public/data/skill_details.json = { skillId: { effect, condition, durationMs } }.
 *
 * ⚠️ PROVENANCE PATH B (docs/provenance.md §10): GameTora/GameWith-derived,
 * owner-authorised for the private build only; input stays localOnly
 * (scripts/borrowed/daftuyda/, gitignored) and this file MUST be swapped before
 * any public release. Not in `pnpm data:build` — run
 * `pnpm tsx scripts/build-skill-details.ts`.
 */
import { join } from 'node:path';
import { PUBLIC_DATA_DIR, readBorrowedJson, readJson, writeJsonDeterministic } from './lib/io';

interface DaftuydaConditionGroup { base_time?: number | null; condition?: string | null }
interface DaftuydaSkill { id: number; desc_en?: string | null; condition_groups?: DaftuydaConditionGroup[] | null }

export interface SkillDetail {
  effect?: string;
  condition?: string;
  durationMs?: number;
}

export function buildSkillDetails(daftuyda: DaftuydaSkill[], ourIds: Set<string>): Record<string, SkillDetail> {
  const out: Record<string, SkillDetail> = {};
  for (const s of daftuyda) {
    const id = String(s.id);
    if (!ourIds.has(id)) continue;
    const g = s.condition_groups?.[0];
    const detail: SkillDetail = {};
    const effect = (s.desc_en ?? '').trim();
    if (effect) detail.effect = effect;
    const condition = (g?.condition ?? '').trim();
    if (condition) detail.condition = condition;
    if (typeof g?.base_time === 'number' && g.base_time > 0) detail.durationMs = g.base_time;
    if (detail.effect || detail.condition || detail.durationMs !== undefined) out[id] = detail;
  }
  return out;
}

function main(): void {
  const daftuyda = readBorrowedJson<DaftuydaSkill[]>('daftuyda/skills_all.json');
  const skills = readJson<Array<{ skillId: string }>>(join(PUBLIC_DATA_DIR, 'skills.json'));
  const ourIds = new Set(skills.map((s) => s.skillId));
  const out = buildSkillDetails(daftuyda, ourIds);
  writeJsonDeterministic(join(PUBLIC_DATA_DIR, 'skill_details.json'), out);
  console.log(`skill_details.json: ${Object.keys(out).length}/${ourIds.size} skills detailed`);
}

const entry = process.argv[1] ?? '';
if (entry.endsWith('build-skill-details.ts')) main();
