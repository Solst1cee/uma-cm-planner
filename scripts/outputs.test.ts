/**
 * Validates the EMITTED public/data/*.json (run `pnpm data:build` first —
 * the files are git-tracked generated output, so they exist in a checkout).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CmPreset, SkillRecord, SparkRates, SupportCardRecord, UmaRecord } from '@/core/types';
import { PUBLIC_DATA_DIR } from './lib/io';

function readData<T>(name: string): T {
  return JSON.parse(readFileSync(join(PUBLIC_DATA_DIR, name), 'utf8')) as T;
}

const skills = readData<SkillRecord[]>('skills.json');
const cards = readData<SupportCardRecord[]>('support_cards.json');
const sparkRates = readData<SparkRates>('spark_rates.json');
const presets = readData<CmPreset[]>('cm_presets.json');
const umas = readData<UmaRecord[]>('umas.json');

describe('public/data/skills.json', () => {
  it('contains the 578 Global-released skills, all server=global with the pinned dataVersion', () => {
    expect(skills).toHaveLength(578);
    expect(skills.every((s) => s.server === 'global')).toBe(true);
    expect(skills.every((s) => s.dataVersion === 'global-c1fa2107')).toBe(true);
  });

  it('links gold skills to their white prereq (Professor of Curvature → Corner Adept ○)', () => {
    const gold = skills.find((s) => s.skillId === '200331');
    expect(gold?.rarity).toBe('gold');
    expect(gold?.prereqSkillId).toBe('200332');
    // every gold with a prereq points at an existing white skill
    const byId = new Map(skills.map((s) => [s.skillId, s]));
    for (const s of skills) {
      if (s.prereqSkillId !== undefined) {
        expect(s.rarity).toBe('gold');
        expect(byId.get(s.prereqSkillId)?.rarity).toBe('white');
      }
    }
  });

  it('carries mutually exclusive skill variant families from upstream versions', () => {
    const rightHandedDemon = skills.find((s) => s.skillId === '200014');
    expect(rightHandedDemon?.variantSkillIds).toEqual(['200011', '200012', '200013']);
    const cornerAdept = skills.find((s) => s.skillId === '200332');
    expect(cornerAdept?.variantSkillIds).toEqual(['200331', '200333']);
  });

  it('classifies rarities incl. inherited uniques (9xxxxx) and uniques (cost 0)', () => {
    const inherited = skills.filter((s) => s.rarity === 'inherited_unique');
    expect(inherited).toHaveLength(84);
    expect(inherited.every((s) => /^9\d{5}$/.test(s.skillId))).toBe(true);
    const uniques = skills.filter((s) => s.rarity === 'unique');
    expect(uniques.length).toBeGreaterThan(0);
    expect(uniques.every((s) => s.baseSpCost === 0)).toBe(true);
  });

  it('tags scenario-exclusive skills with INTERNAL scenario ids via overrides (provenance §3.1)', () => {
    const radiantStar = skills.find((s) => s.skillId === '210061');
    expect(radiantStar?.scenarioId).toBe(4); // Trackblazer — internal id, not GT#3
    const burningSpiritSpd = skills.find((s) => s.skillId === '210011');
    expect(burningSpiritSpd?.scenarioId).toBe(2); // Aoharu / Unity Cup
    // internal id 3 does not exist; GT# numbering must never leak through
    expect(skills.every((s) => s.scenarioId !== 3)).toBe(true);
  });
});

describe('public/data/support_cards.json', () => {
  it('contains the 220 Global cards (217 pinned + 3 additions), all server=global', () => {
    expect(cards).toHaveLength(220);
    expect(cards.every((c) => c.server === 'global')).toBe(true);
    // 217 from the pinned upstream; 3 from data-overrides/card_additions.json
    // (upstream-pin lag, provenance §3.2) carry the master.mdb dataVersion.
    expect(cards.filter((c) => c.dataVersion === 'global-c1fa2107')).toHaveLength(217);
    expect(cards.filter((c) => c.dataVersion === 'global-mdb-10006400').map((c) => c.cardId)).toEqual([
      '30102',
      '30103',
      '30104',
    ]);
  });

  it('carries the 2026-06-11 banner SSRs via card_additions.json (review: 3 missing SSRs)', () => {
    const elCondor = cards.find((c) => c.cardId === '30102');
    expect(elCondor?.charName).toBe('El Condor Pasa');
    expect(elCondor?.rarity).toBe('SSR');
    expect(elCondor?.type).toBe('guts');
    expect(elCondor?.hintPoolSize).toBe(7);
    expect(elCondor?.skills).toContainEqual({ skillId: '200581', sourceType: 'chain' });
    // perLevel from master.mdb v10006400 under the §9 level-cap rule
    expect(elCondor?.perLevel.map((p) => p.hintLevels)).toEqual([1, 1, 1, 2, 2]);
    expect(cards.find((c) => c.cardId === '30103')?.type).toBe('wit');
    expect(cards.find((c) => c.cardId === '30104')?.type).toBe('stamina');
  });

  it('Kitasan Black 30028 is an SSR speed card with chain skill 200331', () => {
    const kitasan = cards.find((c) => c.cardId === '30028');
    expect(kitasan?.rarity).toBe('SSR');
    expect(kitasan?.type).toBe('speed');
    expect(kitasan?.skills).toContainEqual({ skillId: '200331', sourceType: 'chain' });
    expect(kitasan?.hintPoolSize).toBe(8);
  });

  it('per-LB passives follow the §9 level-cap rule (card 30001 hint frequency 30/33/36/40/40)', () => {
    const card = cards.find((c) => c.cardId === '30001');
    expect(card?.perLevel.map((p) => p.hintFrequency)).toEqual([30, 33, 36, 40, 40]);
    expect(card?.perLevel.map((p) => p.limitBreak)).toEqual([0, 1, 2, 3, 4]);
  });

  it('friend/group date events got re-typed by card_source_overrides.json', () => {
    const tazunaSsr = cards.find((c) => c.cardId === '30021');
    expect(tazunaSsr?.type).toBe('friend');
    expect(tazunaSsr?.skills).toContainEqual({ skillId: '201611', sourceType: 'date_event' });
    const sirius = cards.find((c) => c.cardId === '30081');
    expect(sirius?.type).toBe('group');
    expect(sirius?.skills).toContainEqual({ skillId: '200352', sourceType: 'date_event' });
  });

  it('hintPoolSize equals the count of hint_pool skills on every card', () => {
    for (const card of cards) {
      expect(card.hintPoolSize).toBe(card.skills.filter((s) => s.sourceType === 'hint_pool').length);
    }
  });

  it('event-skill derivation v2 carries chain choices, date events and direct grants (review critical finding)', () => {
    // The 16 entries named by the Phase 1 review + the sg grants decision +
    // one extra chain choice surfaced by the recompute (30011). Sources:
    // Tachyons-lab pin 2ce0c8fe (provenance §4.1), cross-checked against
    // GameTora live by the review (2026-06-12).
    const expected: Array<[cardId: string, skillId: string, sourceType: string]> = [
      ['30010', '200581', 'chain'], // Speed Star (chain finale choice)
      ['30010', '200582', 'chain'],
      ['30018', '200361', 'chain'], // Beeline Burst
      ['30018', '200362', 'chain'],
      ['30040', '201261', 'chain'], // Sixth Sense
      ['30040', '201262', 'chain'],
      ['30011', '201282', 'chain'], // Ines Fujin finale choice (recompute bonus)
      ['30021', '200431', 'date_event'], // Concentration
      ['30021', '200432', 'date_event'],
      ['30036', '200371', 'date_event'], // Rushing Gale!
      ['30080', '202031', 'date_event'], // Nothing Ventured
      ['30081', '202032', 'date_event'], // Risky Business
      ['30081', '200292', 'date_event'],
      ['30081', '202061', 'date_event'], // Best in Japan
      ['10021', '200432', 'date_event'],
      ['10022', '200831', 'date_event'],
      ['10060', '200372', 'date_event'],
      ['20021', '200831', 'date_event'],
      // sg direct grants — included by decision (provenance §4.1): real
      // obtainable skills, classified by their containing event category.
      ['10074', '200283', 'random_event'], // Wallflower
      ['10074', '200353', 'random_event'], // Corner Recovery ×
      ['10074', '200521', 'random_event'], // Running Idle
      ['30080', '200283', 'random_event'],
      ['30080', '200353', 'random_event'],
      ['30080', '200521', 'random_event'],
      ['30042', '200521', 'chain'], // Bamboo Memory chain grant
    ];
    for (const [cardId, skillId, sourceType] of expected) {
      const card = cards.find((c) => c.cardId === cardId);
      expect(
        card?.skills.some((s) => s.skillId === skillId && s.sourceType === sourceType),
        `card ${cardId} should source skill ${skillId} as ${sourceType}`,
      ).toBe(true);
    }
  });

  it('hint_pool entries carry hintLevels (hint_value_2); event entries never do', () => {
    for (const card of cards) {
      for (const skill of card.skills) {
        if (skill.sourceType === 'hint_pool') {
          expect(skill.hintLevels, `card ${card.cardId} hint ${skill.skillId}`).toBeGreaterThanOrEqual(1);
        } else {
          expect(skill.hintLevels, `card ${card.cardId} event ${skill.skillId}`).toBeUndefined();
        }
      }
    }
    // Current pin: every Global pool hint grants exactly 1 level (verified
    // against both Tachyons-lab hints_table and master.mdb hint_value_2,
    // 1282 rows, 2026-06-12).
    const kitasan = cards.find((c) => c.cardId === '30028');
    const pool = kitasan?.skills.filter((s) => s.sourceType === 'hint_pool') ?? [];
    expect(pool).toHaveLength(8);
    expect(pool.every((s) => s.hintLevels === 1)).toBe(true);
  });

  it('every card skill id refers to a released Global skill', () => {
    const skillIds = new Set(skills.map((s) => s.skillId));
    for (const card of cards) {
      for (const skill of card.skills) {
        expect(skillIds.has(skill.skillId), `card ${card.cardId} skill ${skill.skillId}`).toBe(true);
      }
    }
  });
});

describe('public/data/spark_rates.json', () => {
  it('deep-equals the docs/mechanics-notes.md verified values', () => {
    expect(sparkRates).toEqual({
      baseProcPctByStars: {
        blue: [70, 80, 90], // §2
        pink: [1, 3, 5],
        green: [5, 10, 15],
        whiteSkill: [3, 6, 9],
        whiteRace: [1, 2, 3],
        whiteScenario: [3, 6, 9],
      },
      inspirationEvents: 2, // §1
      affinityScaling: 'per_member_multiplicative_pct', // §3 (§4: no flat gp multiplier)
      pink: {
        careerStartStepThresholds: [1, 4, 7, 10], // §5
        careerStartMaxSteps: 4,
        careerStartCap: 'A',
        sToSRequiresInRunProcAtA: true,
      },
      blueCareerStartByStars: [5, 12, 21], // §6
      blueInRunRollRange: { 1: [1, 10], 2: [1, 16], 3: [1, 28] }, // §6 provisional
      blueInRunRollRangeProvisional: true,
      hintDiscountCumulativePct: [10, 20, 30, 35, 40], // §7
      fastLearnerMultiplier: 0.9, // §7
      dataVersion: 'global-2026-06',
    } satisfies SparkRates);
  });
});

describe('public/data/umas.json', () => {
  it('contains the 84 Global-released outfits (59 characters), all server=global on the pinned dataVersion', () => {
    expect(umas.length).toBeGreaterThan(0);
    expect(umas).toHaveLength(84); // umalator cutover umas.json @ c1fa2107
    expect(new Set(umas.map((u) => u.charaId)).size).toBe(59);
    expect(umas.every((u) => u.server === 'global')).toBe(true);
    expect(umas.every((u) => u.dataVersion === 'global-c1fa2107')).toBe(true);
  });

  it('Special Week 100101 carries the official EN name + epithet', () => {
    const spe = umas.find((u) => u.umaId === '100101');
    expect(spe).toBeDefined();
    expect(spe?.charaId).toBe('1001');
    expect(spe?.nameEn).toBe('Special Week');
    expect(spe?.epithet).toBe('Special Dreamer');
  });

  it('uses official EN names where GameTora house style differs (T.M. Opera O, provenance §3 EN-names row)', () => {
    expect(umas.find((u) => u.umaId === '101501')?.nameEn).toBe('T.M. Opera O');
  });

  it('follows the Parent.umaId convention: 6-digit card_data id, charaId = floor(umaId/100) (provenance §5)', () => {
    for (const u of umas) {
      expect(u.umaId, `umaId ${u.umaId}`).toMatch(/^\d{6}$/);
      expect(u.charaId, `umaId ${u.umaId}`).toBe(String(Math.floor(Number(u.umaId) / 100)));
      expect(u.nameEn.length, `umaId ${u.umaId}`).toBeGreaterThan(0);
      // Epithets are picker display strings: bracket-free, trimmed.
      expect(u.epithet, `umaId ${u.umaId}`).toMatch(/^\S(.*\S)?$/);
      expect(u.epithet, `umaId ${u.umaId}`).not.toMatch(/[[\]]/);
    }
  });

  it('is deterministically sorted by numeric umaId with no duplicates', () => {
    const ids = umas.map((u) => Number(u.umaId));
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('public/data/cm_presets.json', () => {
  it('contains all 31 upstream presets joined with course surface/distance', () => {
    expect(presets).toHaveLength(31);
    for (const preset of presets) {
      expect(['turf', 'dirt']).toContain(preset.surface);
      expect(preset.distance).toBeGreaterThan(0);
      expect(preset.courseId).toMatch(/^\d+$/);
    }
  });

  it('tags each preset with server (P4): JP CM history vs Global rounds since launch', () => {
    // Derivation rule (build-cm-presets.ts): date >= 2025-06-26 (Global
    // launch, provenance §3.1) → 'global'; earlier → 'jp'. Review fix for
    // "cm_presets.json mixes JP CM definitions".
    expect(presets.every((p) => p.dataVersion === 'global-c1fa2107')).toBe(true);
    const global = presets.filter((p) => p.server === 'global');
    const jp = presets.filter((p) => p.server === 'jp');
    expect(global).toHaveLength(5);
    expect(jp).toHaveLength(26);
    expect(global.every((p) => p.date >= '2025-06-26')).toBe(true);
    expect(jp.every((p) => p.date < '2025-06-26')).toBe(true);
    // Boundary: the 2025-06-21 CLASSIC predates Global launch by 5 days — JP.
    expect(presets.find((p) => p.date === '2025-06-21')?.server).toBe('jp');
    expect(presets.find((p) => p.date === '2026-01-22')?.server).toBe('global');
  });

  it('is sorted by code-point date order (deterministic, locale-independent)', () => {
    const dates = presets.map((p) => p.date);
    expect(dates).toEqual([...dates].sort());
  });
});
