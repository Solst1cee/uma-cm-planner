import { describe, it, expect } from 'vitest';
import { buildJpSkills } from './build-skills';
import type { GtSkill } from './lib/upstream-types';
import type { DateEntry } from './lib/jpSkillDate';

const cardDates = new Map<string, DateEntry>([['30275', { date: '2026-09-01', predicted: true }]]);
const umaDates = new Map<string, DateEntry>([['100301', { date: '2026-08-10', predicted: true }]]);

const gametora: GtSkill[] = [
  // white skill from a JP card → server:jp, dated from the card
  { id: 203441, rarity: 2, cost: 170, iconid: 20042, name_en: 'Gold Skill A', jpname: 'ゴールドA', sup_e: [[30275], []] },
  // uma-sourced unique → dated from the uma, cost 0
  { id: 100301011, rarity: 5, iconid: 10030, name_en: 'Uma Unique', jpname: 'ユニーク', char: [100301] },
  // already in the Global master → skipped
  { id: 200011, rarity: 1, cost: 120, iconid: 20001, name_en: 'Global White' },
  // sourceless → dropped
  { id: 209999, rarity: 1, cost: 100, iconid: 20003, name_en: 'Orphan' },
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
});
