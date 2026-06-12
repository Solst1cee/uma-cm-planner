/**
 * Validates the EMITTED public/data/*.json (run `pnpm data:build` first —
 * the files are git-tracked generated output, so they exist in a checkout).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CmPreset, SkillRecord, SparkRates, SupportCardRecord } from '@/core/types';
import { PUBLIC_DATA_DIR } from './lib/io';

function readData<T>(name: string): T {
  return JSON.parse(readFileSync(join(PUBLIC_DATA_DIR, name), 'utf8')) as T;
}

const skills = readData<SkillRecord[]>('skills.json');
const cards = readData<SupportCardRecord[]>('support_cards.json');
const sparkRates = readData<SparkRates>('spark_rates.json');
const presets = readData<CmPreset[]>('cm_presets.json');

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
  it('contains the 217 Global cards, all server=global', () => {
    expect(cards).toHaveLength(217);
    expect(cards.every((c) => c.server === 'global')).toBe(true);
    expect(cards.every((c) => c.dataVersion === 'global-c1fa2107')).toBe(true);
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

describe('public/data/cm_presets.json', () => {
  it('contains all 31 upstream presets joined with course surface/distance', () => {
    expect(presets).toHaveLength(31);
    for (const preset of presets) {
      expect(['turf', 'dirt']).toContain(preset.surface);
      expect(preset.distance).toBeGreaterThan(0);
      expect(preset.courseId).toMatch(/^\d+$/);
    }
  });
});
