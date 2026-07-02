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

  it('does NOT put an inherited-unique wishlist skill in the innate cell', () => {
    // Innate holds only the non-unique kit (200011). 900011 (inherited-unique)
    // is on the wishlist but must not be flagged innate.
    const res = buildCoverageMatrix(baseInput({}));
    const row = res.rows.find((r) => r.skillId === '900011')!;
    expect(row.cells.innate.length).toBe(0);
  });

  describe('innate potential-level badge', () => {
    it('shows "LvN" when the unlocking potential level is known', () => {
      const res = buildCoverageMatrix(baseInput({
        planUma: { umaId: '100301', nameEn: 'Mayano', innateSkills: ['200011'], innateRankBySkillId: { '200011': 5 } },
      }));
      const chip = res.rows.find((r) => r.skillId === '200011')!.cells.innate[0]!;
      expect(chip.label).toBe('Lv5');
      expect(chip.title).toContain('potential Lv5');
    });

    it('uses the COVERING skill\'s rank for a family match (held ○ vs wishlisted ◎)', () => {
      const fam = new Map([
        ['500011', { ...skill('500011', 'Right-Handed ◎', 'white'), variantSkillIds: ['500012'] }],
        ['500012', { ...skill('500012', 'Right-Handed ○', 'white'), variantSkillIds: ['500011'] }],
      ]);
      const res = buildCoverageMatrix(baseInput({
        wishlistSkillIds: ['500011'], skillById: fam, greenMap: new Map(),
        planUma: { umaId: '100301', nameEn: 'T', innateSkills: ['500012'], innateRankBySkillId: { '500012': 3 } },
      }));
      expect(res.rows[0]!.cells.innate[0]!.label).toBe('Lv3');
    });

    it('falls back to uma initials when the rank is unknown (honest, no fabricated level)', () => {
      const res = buildCoverageMatrix(baseInput({}));
      const chip = res.rows.find((r) => r.skillId === '200011')!.cells.innate[0]!;
      expect(chip.label).toBe('T'); // initials of the one-word "Trainee"
    });
  });

  describe('career training-event column', () => {
    it('marks a wishlist skill covered via the event cell (uma event pool)', () => {
      const res = buildCoverageMatrix(baseInput({
        planUma: { umaId: '100301', nameEn: 'Taiki', innateSkills: [], eventSkills: ['200033'] },
      }));
      const row = res.rows.find((r) => r.skillId === '200033')!;
      expect(row.cells.event.length).toBe(1);
      expect(row.cells.innate.length).toBe(0); // event-only, not innate
      expect(row.covered).toBe(true);
    });

    it('event availability is independent of innate (both can fire)', () => {
      const res = buildCoverageMatrix(baseInput({
        planUma: { umaId: '100301', nameEn: 'Taiki', innateSkills: ['200011'], eventSkills: ['200011'] },
      }));
      const row = res.rows.find((r) => r.skillId === '200011')!;
      expect(row.cells.innate.length).toBe(1);
      expect(row.cells.event.length).toBe(1);
    });

    it('no eventSkills → event cells stay empty', () => {
      const res = buildCoverageMatrix(baseInput({}));
      expect(res.rows.every((r) => r.cells.event.length === 0)).toBe(true);
    });

    it('counts an Event coverage bar', () => {
      const res = buildCoverageMatrix(baseInput({
        planUma: { umaId: '100301', nameEn: 'Taiki', innateSkills: [], eventSkills: ['200033'] },
      }));
      const bar = res.bars.find((b) => b.column === 'event')!;
      expect(bar.count).toBe(1);
    });
  });

  describe('variant-family coverage (○ ≡ ◎, gold separate)', () => {
    // Right-Handed family: ○ and ◎ are the same white skill (interchangeable);
    // the Demon gold is a SEPARATE skill. Ids 5000xx to avoid the base fixtures.
    const RH: [string, string, SkillRecord['rarity'], string[]][] = [
      ['500011', 'Right-Handed ◎', 'white', ['500012', '500014']],
      ['500012', 'Right-Handed ○', 'white', ['500011', '500014']],
      ['500014', 'Right-Handed Demon', 'gold', ['500011', '500012']],
    ];
    const famById = new Map(
      RH.map(([id, name, rarity, variants]) => [id, { ...skill(id, name, rarity), variantSkillIds: variants }]),
    );
    const famInput = (wishId: string, over: Partial<CoverageInput>) =>
      baseInput({ wishlistSkillIds: [wishId], skillById: famById, greenMap: new Map(),
        planUma: { umaId: '100301', nameEn: 'Trainee', innateSkills: [] }, ...over });

    // Innate
    it('innate ○ covers a wishlisted ◎ (same white skill)', () => {
      const res = buildCoverageMatrix(famInput('500011', { planUma: { umaId: '100301', nameEn: 'T', innateSkills: ['500012'] } }));
      expect(res.rows[0]!.cells.innate.length).toBe(1);
    });
    it('innate ◎ covers a wishlisted ○ (symmetry)', () => {
      const res = buildCoverageMatrix(famInput('500012', { planUma: { umaId: '100301', nameEn: 'T', innateSkills: ['500011'] } }));
      expect(res.rows[0]!.cells.innate.length).toBe(1);
    });
    it('innate ○ does NOT cover the wishlisted gold Demon', () => {
      const res = buildCoverageMatrix(famInput('500014', { planUma: { umaId: '100301', nameEn: 'T', innateSkills: ['500012'] } }));
      expect(res.rows[0]!.cells.innate.length).toBe(0);
    });
    it('innate gold Demon does NOT cover a wishlisted white ◎ (gold is separate)', () => {
      const res = buildCoverageMatrix(famInput('500011', { planUma: { umaId: '100301', nameEn: 'T', innateSkills: ['500014'] } }));
      expect(res.rows[0]!.cells.innate.length).toBe(0);
    });

    // Event pool — same family rules as innate
    it('event ○ covers a wishlisted ◎ (same white skill)', () => {
      const res = buildCoverageMatrix(famInput('500011', { planUma: { umaId: '100301', nameEn: 'T', innateSkills: [], eventSkills: ['500012'] } }));
      expect(res.rows[0]!.cells.event.length).toBe(1);
    });
    it('event ○ does NOT cover the wishlisted gold Demon', () => {
      const res = buildCoverageMatrix(famInput('500014', { planUma: { umaId: '100301', nameEn: 'T', innateSkills: [], eventSkills: ['500012'] } }));
      expect(res.rows[0]!.cells.event.length).toBe(0);
    });

    // Parent spark — priced off the held ○, not the wishlisted ◎
    it('a parent ○ white spark covers a wishlisted ◎ with a real inherit %', () => {
      const p = parent('pa', '100101', { whiteSparks: [{ skillId: '500012', stars: 3 }] });
      const res = buildCoverageMatrix(famInput('500011', { activeParents: [{ parent: p, isA: true }] }));
      expect(res.rows[0]!.cells.parent.length).toBe(1);
      expect(res.rows[0]!.cells.parent[0]!.pct).toBeGreaterThan(0);
    });
    it('a parent ○ white spark does NOT cover a wishlisted gold Demon', () => {
      const p = parent('pa', '100101', { whiteSparks: [{ skillId: '500012', stars: 3 }] });
      const res = buildCoverageMatrix(famInput('500014', { activeParents: [{ parent: p, isA: true }] }));
      expect(res.rows[0]!.cells.parent.length).toBe(0);
    });

    // Deck card
    it('a deck card that grants ○ covers a wishlisted ◎', () => {
      const c = card('30001', 'Speedy', [{ skillId: '500012', sourceType: 'hint_pool' }]);
      const res = buildCoverageMatrix(famInput('500011', { deckCards: [c], deckLbByCardId: new Map([['30001', 4]]) }));
      expect(res.rows[0]!.cells.hint.length).toBe(1);
    });
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
    const chainChip = res.rows.find((r) => r.skillId === '200022')!.cells.chain[0]!;
    const hintChip = res.rows.find((r) => r.skillId === '200033')!.cells.hint[0]!;
    expect(chainChip).toBeTruthy();
    expect(hintChip).toBeTruthy();
    // deck-source chips carry the cardId so the UI can render the real card icon
    expect(chainChip.cardId).toBe('30001');
    expect(hintChip.cardId).toBe('30001');
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

  it('a date_event sourceType on a deck card lands in the random cell', () => {
    const c = card('30002', 'EventCard', [{ skillId: '200033', sourceType: 'date_event' }]);
    const res = buildCoverageMatrix(baseInput({ deckCards: [c], deckLbByCardId: new Map([['30002', 4]]) }));
    const row = res.rows.find((r) => r.skillId === '200033')!;
    expect(row.cells.random.length).toBe(1);
  });

  it('parent and grandparent with the same skill produce isolated per-member pcts (FIX 1)', () => {
    // Parent has its own white spark for 200033, and a grandparent also has a white spark for 200033.
    // Both cells should be populated with an independent (isolated) pct > 0.
    const gp: import('./types').ParentRef = { umaId: '200201', whiteSparks: [{ skillId: '200033', stars: 2 }] };
    const p = parent('pa', '100101', {
      whiteSparks: [{ skillId: '200033', stars: 3 }],
      grandparents: [gp, undefined],
    });
    const res = buildCoverageMatrix(baseInput({ activeParents: [{ parent: p, isA: true }] }));
    const row = res.rows.find((r) => r.skillId === '200033')!;
    expect(row.cells.parent.length).toBe(1);
    expect(row.cells.gp.length).toBe(1);
    expect(row.cells.parent[0]!.pct).toBeGreaterThan(0);
    expect(row.cells.gp[0]!.pct).toBeGreaterThan(0);
  });

  it('FIX A — parent green spark is priced (pct > 0, not ~0%)', () => {
    // greenMap maps native '100011' → inherited-unique '900011'.
    // Parent stores green as native id; wishlist uses 9xxxxx id.
    // Before FIX A, sparkChance saw greenSpark.skillId='100011' vs skillId='900011' → no match → pct 0.
    const p = parent('pa', '100101', { greenSpark: { skillId: '100011', stars: 3 } });
    const res = buildCoverageMatrix(baseInput({ activeParents: [{ parent: p, isA: true }] }));
    const row = res.rows.find((r) => r.skillId === '900011')!;
    expect(row.cells.parent.length).toBe(1);
    expect(row.cells.parent[0]!.pct).toBeGreaterThan(0); // green base [5,10,15] → 3★ > 0
  });

  it('FIX B — grandparent green-only spark chip shows no pct (unpriced, not ~0%)', () => {
    // GP grants via a green spark only; sparkChance cannot price gp green sparks.
    // pct must be undefined so the chip renders as "unpriced" not "~0%".
    const gp: import('./types').ParentRef = {
      umaId: '200301',
      whiteSparks: [],
      greenSpark: { skillId: '100011', stars: 3 },
    };
    const p = parent('pb', '100102', { grandparents: [gp, undefined] });
    const res = buildCoverageMatrix(baseInput({ activeParents: [{ parent: p, isA: true }] }));
    const row = res.rows.find((r) => r.skillId === '900011')!;
    expect(row.cells.gp.length).toBe(1);
    expect(row.cells.gp[0]!.pct).toBeUndefined();
  });

  it('FIX B — grandparent white spark is still priced (pct > 0)', () => {
    // A GP with a matching white spark should still get a numeric pct.
    const gp: import('./types').ParentRef = {
      umaId: '200401',
      whiteSparks: [{ skillId: '200033', stars: 3 }],
    };
    const p = parent('pc', '100103', { grandparents: [gp, undefined] });
    const res = buildCoverageMatrix(baseInput({ activeParents: [{ parent: p, isA: true }] }));
    const row = res.rows.find((r) => r.skillId === '200033')!;
    expect(row.cells.gp.length).toBe(1);
    expect(row.cells.gp[0]!.pct).toBeGreaterThan(0);
  });
});
