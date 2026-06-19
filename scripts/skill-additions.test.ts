import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadSkillAdditions } from './lib/skill-additions';

function tmpFile(contents: object): string {
  const dir = mkdtempSync(join(tmpdir(), 'skilladd-'));
  const p = join(dir, 'skill_additions.json');
  writeFileSync(p, JSON.stringify(contents), 'utf8');
  return p;
}

const valid = {
  skillId: '999001', nameEn: 'Preview Skill', nameJp: 'プレビュー', baseSpCost: 200,
  rarity: 'gold', iconId: '00001', conditions: 'distance_type==2',
  server: 'jp', dataVersion: 'global-76214c82',
  releaseDate: '2026-07-30', releaseDatePredicted: true,
};

describe('loadSkillAdditions', () => {
  it('returns [] when the file is missing', () => {
    expect(loadSkillAdditions(join(tmpdir(), 'nope-skill_additions.json'), { existingSkillIds: new Set() })).toEqual([]);
  });
  it('inserts a valid server:jp upcoming skill', () => {
    const recs = loadSkillAdditions(tmpFile({ records: [valid] }), { existingSkillIds: new Set() });
    expect(recs).toHaveLength(1);
    expect(recs[0]?.skillId).toBe('999001');
  });
  it('rejects server:global (use skills.json / overrides instead)', () => {
    expect(() => loadSkillAdditions(tmpFile({ records: [{ ...valid, server: 'global' }] }), { existingSkillIds: new Set() })).toThrow(/server must be "jp"/);
  });
  it('rejects a skill missing releaseDate', () => {
    const { releaseDate, ...noDate } = valid;
    expect(() => loadSkillAdditions(tmpFile({ records: [noDate] }), { existingSkillIds: new Set() })).toThrow(/releaseDate/);
  });
  it('rejects collision with an already-emitted skill id', () => {
    expect(() => loadSkillAdditions(tmpFile({ records: [valid] }), { existingSkillIds: new Set(['999001']) })).toThrow(/already emitted/);
  });
});
