import { describe, it, expect } from 'vitest';
import { buildJpSkills } from './build-skills';
import type { GtSkill } from './lib/upstream-types';
import type { DateEntry } from './lib/jpSkillDate';

const cardDates = new Map<string, DateEntry>([['30275', { date: '2026-09-01', predicted: true }]]);
const umaDates = new Map<string, DateEntry>([
  ['100301', { date: '2026-08-10', predicted: true }],
  ['100401', { date: '2026-08-11', predicted: true }],
  ['100501', { date: '2026-08-12', predicted: true }],
  ['100601', { date: '2026-08-13', predicted: true }],
  ['100602', { date: '2026-08-14', predicted: true }],
]);

const gametora: GtSkill[] = [
  // white skill from a JP card → server:jp, dated from the card
  { id: 203441, rarity: 2, cost: 170, iconid: 20042, name_en: 'Gold Skill A', jpname: 'ゴールドA', sup_e: [[30275], []] },
  // uma-sourced unique → dated from the uma, cost 0; carries a gene_version →
  // should also emit an inherited-unique twin (9xxxxx)
  {
    id: 100301011,
    rarity: 5,
    iconid: 10030,
    name_en: 'Uma Unique',
    jpname: 'ユニーク',
    char: [100301],
    gene_version: { id: 900301, condition_groups: [{ condition: 'phase>=2' }] },
  },
  // already in the Global master → skipped
  { id: 200011, rarity: 1, cost: 120, iconid: 20001, name_en: 'Global White' },
  // sourceless → dropped
  { id: 209999, rarity: 1, cost: 100, iconid: 20003, name_en: 'Orphan' },
  // unique with no gene_version → no inherited twin
  { id: 100401011, rarity: 5, iconid: 10040, name_en: 'No Gene Unique', jpname: 'ノージーン', char: [100401] },
  // unique whose gene_version id already exists in masterSkillIds → skipped
  {
    id: 100501011,
    rarity: 5,
    iconid: 10050,
    name_en: 'Collides Unique',
    jpname: 'コリジョン',
    char: [100501],
    gene_version: { id: 200011, condition_groups: [{ condition: 'phase>=2' }] },
  },
  // two evolution-stage uniques that BOTH nest under the same gene_version id
  // (observed in real gametora data) — only the first should win the twin.
  {
    id: 100601011,
    rarity: 5,
    iconid: 10060,
    name_en: 'Base Form Unique',
    jpname: 'ベースフォーム',
    char: [100601],
    gene_version: { id: 900601, condition_groups: [{ condition: 'phase>=2' }] },
  },
  {
    id: 100602011,
    rarity: 5,
    iconid: 10060,
    name_en: 'Evolved Form Unique',
    jpname: 'エボルブフォーム',
    char: [100602],
    gene_version: { id: 900601, condition_groups: [{ condition: 'phase>=2' }] },
  },
];

describe('buildJpSkills', () => {
  const out = buildJpSkills({
    gametora,
    masterSkillIds: new Set(['200011']),
    cardDates,
    umaDates,
    dataVersion: 'test',
  });
  const byId = new Map(out.map((s) => [s.skillId, s]));

  it('emits source-backed JP skills as server:jp, skips master + sourceless', () => {
    expect(byId.has('203441')).toBe(true);
    expect(byId.has('100301011')).toBe(true);
    expect(byId.has('200011')).toBe(false); // in master
    expect(byId.has('209999')).toBe(false); // no source
    expect(byId.get('203441')!.server).toBe('jp');
  });
  it('maps rarity + cost + date from gametora/sources', () => {
    const gold = byId.get('203441')!;
    expect(gold.rarity).toBe('gold');
    expect(gold.baseSpCost).toBe(170);
    expect(gold.releaseDate).toBe('2026-09-01');
    expect(gold.releaseDatePredicted).toBe(true);
    expect(gold.nameEn).toBe('Gold Skill A');
    const uniq = byId.get('100301011')!;
    expect(uniq.rarity).toBe('unique');
    expect(uniq.baseSpCost).toBe(0); // no cost → 0
    expect(uniq.releaseDate).toBe('2026-08-10');
  });

  it('emits an inherited-unique twin for a unique with gene_version, dated like its parent', () => {
    const gene = byId.get('900301');
    expect(gene).toBeDefined();
    expect(gene?.rarity).toBe('inherited_unique');
    expect(gene?.baseSpCost).toBe(0);
    expect(gene?.server).toBe('jp');
    expect(gene?.releaseDate).toBe('2026-08-10'); // same as parent 100301011
    expect(gene?.releaseDatePredicted).toBe(true); // same as parent
    expect(gene?.nameEn).toBe('Uma Unique'); // parent's name
    expect(gene?.conditions).toBe('phase>=2'); // serialized from gene_version.condition_groups
  });

  it('does not emit an inherited-unique twin for a unique without gene_version', () => {
    expect(byId.has('100401011')).toBe(true); // the unique itself still emits
    // No stray 9xxxxx record was added for this unique.
    const geneIdsForNoGene = out.filter(
      (s) => s.rarity === 'inherited_unique' && s.nameEn === 'No Gene Unique',
    );
    expect(geneIdsForNoGene).toHaveLength(0);
  });

  it('skips a gene_version id that already exists in masterSkillIds', () => {
    expect(byId.has('100501011')).toBe(true); // the unique itself still emits
    expect(byId.has('200011')).toBe(false); // it's a master id — never added as inherited twin either
    const stray = out.filter((s) => s.rarity === 'inherited_unique' && s.nameEn === 'Collides Unique');
    expect(stray).toHaveLength(0);
  });

  it('dedupes two uniques whose gene_version nests the same inherited id (no duplicate skillId)', () => {
    expect(byId.has('100601011')).toBe(true);
    expect(byId.has('100602011')).toBe(true);
    const twins = out.filter((s) => s.skillId === '900601');
    expect(twins).toHaveLength(1); // only the first claim wins, not two colliding records
    expect(twins[0]?.nameEn).toBe('Base Form Unique');
    const ids = out.map((s) => s.skillId);
    expect(new Set(ids).size).toBe(ids.length); // no duplicate ids anywhere in the output
  });
});
