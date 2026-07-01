// src/core/coverageMatrix.test.ts
import { describe, expect, it } from 'vitest';
import { buildCoverageMatrix, type CoverageInput } from './coverageMatrix';
import type { CardSkill, Parent, SkillRecord, SupportCardRecord, SparkRates } from './types';
import { FIXTURE_SPARK_RATES } from './fixtures';

const rates: SparkRates = FIXTURE_SPARK_RATES;

const skill = (skillId: string, nameEn: string, rarity: SkillRecord['rarity']): SkillRecord =>
  ({ skillId, nameEn, nameJp: '', baseSpCost: 0, rarity, iconId: '0', server: 'global', dataVersion: 't', conditions: '' });

const card = (cardId: string, nameEn: string, skills: CardSkill[]): SupportCardRecord =>
  ({ cardId, nameEn, charName: '', rarity: 'SSR', type: 'speed', perLevel: [], skills, hintPoolSize: 0, server: 'global', dataVersion: 't' });

const parent = (id: string, umaId: string, over: Partial<Parent> = {}): Parent =>
  ({ id, umaId, blueSpark: { stat: 'spd', stars: 1 }, pinkSpark: { aptitude: 'turf', stars: 1 },
     whiteSparks: [], source: 'mine', ...over });

const skillById = new Map([
  ['200011', skill('200011', 'Corner Adept', 'white')],
  ['200022', skill('200022', 'Slick Surge', 'gold')],
  ['200033', skill('200033', 'Straightaway', 'white')],
  ['900011', skill('900011', 'Shooting Star', 'inherited_unique')],
  ['100011', skill('100011', 'Shooting Star', 'unique')],
]);
const greenMap = new Map([['100011', '900011']]);

function baseInput(over: Partial<CoverageInput>): CoverageInput {
  return {
    wishlistSkillIds: ['200011', '200022', '200033', '900011'],
    planUma: { umaId: '100301', nameEn: 'Trainee', innateSkills: ['200011'] },
    activeParents: [],
    deckCards: [],
    deckLbByCardId: new Map(),
    skillById,
    cardById: new Map(),
    greenMap,
    sparkRates: rates,
    ...over,
  };
}

describe('buildCoverageMatrix', () => {
  it('marks an innate wishlist skill covered via the innate cell', () => {
    const res = buildCoverageMatrix(baseInput({}));
    const row = res.rows.find((r) => r.skillId === '200011')!;
    expect(row.cells.innate.length).toBe(1);
    expect(row.covered).toBe(true);
  });

  it('covers a white wishlist skill via a parent white spark with an inherit %', () => {
    const p = parent('pa', '100101', { whiteSparks: [{ skillId: '200033', stars: 3 }] });
    const res = buildCoverageMatrix(baseInput({ activeParents: [{ parent: p, isA: true }] }));
    const row = res.rows.find((r) => r.skillId === '200033')!;
    expect(row.cells.parent.length).toBe(1);
    expect(row.cells.parent[0]!.pct).toBeGreaterThan(0);
    expect(row.covered).toBe(true);
  });

  it('covers an inherited-unique wishlist skill via a parent green spark (reconciled id)', () => {
    const p = parent('pa', '100101', { greenSpark: { skillId: '100011', stars: 2 } });
    const res = buildCoverageMatrix(baseInput({ activeParents: [{ parent: p, isA: true }] }));
    const row = res.rows.find((r) => r.skillId === '900011')!;
    expect(row.cells.parent.length).toBe(1);
    expect(row.covered).toBe(true);
  });

  it('buckets deck cards into hint/chain/random by sourceType', () => {
    const c = card('30001', 'Speedy', [
      { skillId: '200022', sourceType: 'chain' },
      { skillId: '200033', sourceType: 'hint_pool' },
    ]);
    const res = buildCoverageMatrix(baseInput({ deckCards: [c], deckLbByCardId: new Map([['30001', 4]]) }));
    expect(res.rows.find((r) => r.skillId === '200022')!.cells.chain.length).toBe(1);
    expect(res.rows.find((r) => r.skillId === '200033')!.cells.hint.length).toBe(1);
  });

  it('flags a fully-unsourced wishlist skill uncovered', () => {
    const res = buildCoverageMatrix(baseInput({}));
    const row = res.rows.find((r) => r.skillId === '200022')!; // gold, no source
    expect(row.covered).toBe(false);
  });

  it('reports the gold rarity on the row', () => {
    const res = buildCoverageMatrix(baseInput({}));
    expect(res.rows.find((r) => r.skillId === '200022')!.isGold).toBe(true);
  });

  it('builds bars with per-column and uncovered counts', () => {
    const p = parent('pa', '100101', { whiteSparks: [{ skillId: '200033', stars: 3 }] });
    const res = buildCoverageMatrix(baseInput({ activeParents: [{ parent: p, isA: true }] }));
    const innate = res.bars.find((b) => b.column === 'innate')!;
    const uncovered = res.bars.find((b) => b.column === 'uncovered')!;
    expect(innate.count).toBe(1);       // 200011
    // CONCERN: brief says toBe(1) but 900011 (inherited_unique, no source in this test) is
    // also uncovered — the wishlist has 4 skills: 200011 (innate), 200033 (parent), 200022
    // (gold, no source), 900011 (no source) → 2 uncovered. Brief comment only called out
    // 200022 but forgot 900011. Corrected to 2 here; reported in task-4-report.md.
    expect(uncovered.count).toBe(2);    // 200022 gold + 900011 inherited_unique, both unsourced
  });

  it('lists deck/inheritance skills not on the wishlist as bonus', () => {
    const c = card('30001', 'Speedy', [{ skillId: '200099', sourceType: 'chain' }]);
    const bonusSkillById = new Map(skillById);
    bonusSkillById.set('200099', skill('200099', 'Bonus Skill', 'white'));
    const res = buildCoverageMatrix(baseInput({ deckCards: [c], skillById: bonusSkillById }));
    expect(res.bonus.some((b) => b.skillId === '200099')).toBe(true);
  });
});
