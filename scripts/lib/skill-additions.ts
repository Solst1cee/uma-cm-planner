/**
 * data-overrides/skill_additions.json — full SkillRecord entries for upcoming
 * (server:'jp') skills not yet in the Global cutover, so the skill chart's
 * "show upcoming" toggle has data to gate by CM date. Each entry MUST carry a
 * releaseDate. Mirrors card-additions.ts (insert, not patch). P3/P4/P5.
 */
import { existsSync } from 'node:fs';
import type { SkillRecord } from '@/core/types';
import { readJson, stripMeta } from './io';

export interface SkillAdditionsFile {
  _comment?: string;
  records: SkillRecord[];
}

const RARITIES = new Set(['white', 'gold', 'unique', 'inherited_unique']);

function validate(r: SkillRecord, problems: string[]): void {
  const w = `skill_additions record "${r.skillId}"`;
  if (typeof r.skillId !== 'string' || !/^\d+$/.test(r.skillId)) problems.push(`${w}: skillId must be a numeric string`);
  if (typeof r.nameEn !== 'string' || r.nameEn.length === 0) problems.push(`${w}: nameEn missing`);
  if (!RARITIES.has(r.rarity)) problems.push(`${w}: bad rarity "${r.rarity}"`);
  if (typeof r.conditions !== 'string') problems.push(`${w}: conditions must be a string`);
  if (r.server !== 'jp') problems.push(`${w}: server must be "jp" (upcoming preview, P4)`);
  if (typeof r.releaseDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.releaseDate)) problems.push(`${w}: releaseDate (ISO yyyy-mm-dd) is required for upcoming skills`);
  if (typeof r.dataVersion !== 'string' || r.dataVersion.length === 0) problems.push(`${w}: dataVersion missing`);
}

export function loadSkillAdditions(
  path: string,
  opts: { existingSkillIds: ReadonlySet<string> },
): SkillRecord[] {
  if (!existsSync(path)) return [];
  const parsed = readJson<SkillAdditionsFile>(path);
  if (!Array.isArray(parsed.records)) {
    throw new Error('skill_additions.json: "records" must be an array of full SkillRecord entries');
  }
  const problems: string[] = [];
  const seen = new Set<string>();
  const records = parsed.records.map((raw) => stripMeta(raw));
  for (const r of records) {
    validate(r, problems);
    if (seen.has(r.skillId)) problems.push(`skill_additions record "${r.skillId}": duplicate id in file`);
    seen.add(r.skillId);
    if (opts.existingSkillIds.has(r.skillId)) {
      problems.push(`skill_additions record "${r.skillId}": already emitted by the generator — the upstream pin caught up; delete this addition.`);
    }
  }
  if (problems.length > 0) throw new Error(`skill_additions.json failed validation:\n  ${problems.join('\n  ')}`);
  return records;
}
