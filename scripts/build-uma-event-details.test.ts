import { describe, expect, it } from 'vitest';
import {
  applyDetailOverrides, buildEventDetails, pickGlobalVariant, raceRef, renderCondition, renderReward,
  type GtEvent, type RaceNameLookup, type SkillNameLookup,
} from './build-uma-event-details';

const skillName: SkillNameLookup = (id) =>
  ({ '201702': "All I've Got", '201902': 'Head-On' } as Record<string, string>)[id];
const raceName: RaceNameLookup = (id) =>
  ({ '101801': 'Mile Championship', '200701': 'Kinko Sho' } as Record<string, string>)[id];

/** Beyond-the-Mile-shaped fixture: current = JP 3rd-anni rewards, history = the
 *  pre_3rd_anni variant (what Global has), absent before JP 1st anni. */
const btm: GtEvent = {
  i: 4010,
  n: 'Beyond the Mile',
  c: [{ o: '', r: [{ t: 'pt', v: '+50' }, { t: 'sk', v: '+2', d: 201702 }, { t: 'sk', v: '+2', d: 202502 }, { t: 'sk', v: '+2', d: 201902 }] }],
  conditions: [['win', '101801|2'], ['win', 200701]],
  did_not_exist: 'pre_first_anni',
  history: [{
    period: 'pre_3rd_anni',
    data: {
      i: 4010, n: 'Beyond the Mile',
      c: [{ o: '', r: [{ t: 'sp', v: '+25' }, { t: 'pt', v: '+30' }, { t: 'sk', v: '+2', d: 201702 }, { t: 'sk', v: '+2', d: 201902 }] }],
      conditions: [['win', '101801|2'], ['win', 200701]],
    },
  }],
};

describe('pickGlobalVariant', () => {
  it('picks the earliest applicable history variant for Global (T=1.4 → pre_3rd_anni)', () => {
    const v = pickGlobalVariant(btm, 1.4)!;
    expect(v.jpCurrentDiffers).toBe(true);
    expect(v.data.c![0]!.r).toContainEqual({ t: 'pt', v: '+30' });
  });

  it('excludes an event Global has not reached (did_not_exist ahead of T)', () => {
    expect(pickGlobalVariant(btm, 0.5)).toBeNull(); // pre-1st-anni Global: event absent
  });

  it('uses current data when T is past every history period', () => {
    const v = pickGlobalVariant(btm, 3.5)!;
    expect(v.jpCurrentDiffers).toBe(false);
    expect(v.data.c![0]!.r).toContainEqual({ t: 'pt', v: '+50' });
  });

  it('no history / no did_not_exist → current data, no flag', () => {
    const v = pickGlobalVariant({ n: 'X', c: [] }, 1.4)!;
    expect(v.jpCurrentDiffers).toBe(false);
  });
});

describe('renderReward', () => {
  it('renders a skill hint with the skill name + carries skillId', () => {
    expect(renderReward({ t: 'sk', v: '+2', d: 201902 }, skillName))
      .toEqual([{ label: 'Head-On hint +2', skillId: '201902' }]);
  });
  it('renders stats', () => {
    expect(renderReward({ t: 'sp', v: '+25' }, skillName)).toEqual([{ label: 'Speed +25' }]);
  });
  it('renders a direct grant (sg) as "Obtain …"', () => {
    expect(renderReward({ t: 'sg', d: 201702 }, skillName)).toEqual([{ label: "Obtain All I've Got", skillId: '201702' }]);
  });
  it('flattens nested branch rewards', () => {
    expect(renderReward({ t: null, r: [{ t: 'pt', v: '+45' }, { t: 'sk', v: '+1', d: 201902 }] }, skillName))
      .toEqual([{ label: 'Skill points +45' }, { label: 'Head-On hint +1', skillId: '201902' }]);
  });
  it('surfaces unknown codes raw (P3 — no guessing)', () => {
    expect(renderReward({ t: 'zz', v: '+9' }, skillName)).toEqual([{ label: '(zz +9)' }]);
  });
});

describe('renderCondition / raceRef', () => {
  it('renders win with a year suffix', () => {
    expect(renderCondition(['win', '101801|2'], raceName)).toBe('Win the Mile Championship (Classic)');
  });
  it('renders win without a year', () => {
    expect(renderCondition(['win', 200701], raceName)).toBe('Win the Kinko Sho');
  });
  it('falls back to "race #id" when the name is unknown', () => {
    expect(raceRef('999999|3', raceName)).toBe('race #999999 (Senior)');
  });
  it('renders unmapped condition types raw', () => {
    expect(renderCondition(['beat_rival', '101701|2', 1009], raceName)).toBe('beat_rival: "101701|2", 1009');
  });
});

describe('buildEventDetails', () => {
  it('keeps only skill-granting events, Global variant, rendered text (the Taiki case)', () => {
    const details = buildEventDetails(
      { secret: [btm], nochoice: [{ n: 'Stat Only', c: [{ o: '', r: [{ t: 'sp', v: '+10' }] }] }] },
      skillName, raceName, 1.4,
    );
    expect(details).toHaveLength(1);
    const e = details[0]!;
    expect(e.name).toBe('Beyond the Mile');
    expect(e.jpCurrentDiffers).toBe(true);
    expect(e.conditions).toEqual(['Win the Mile Championship (Classic)', 'Win the Kinko Sho']);
    expect(e.choices[0]!.rewards).toContainEqual({ label: 'Head-On hint +2', skillId: '201902' });
    expect(e.choices[0]!.rewards).toContainEqual({ label: 'Skill points +30' });
  });
});

describe('applyDetailOverrides', () => {
  it('adds and removes by uma without mutating the base', () => {
    const base = { '101001': [{ name: 'A', category: 'secret', choices: [] }] };
    const out = applyDetailOverrides(base, {
      addByUma: { '101001': [{ name: 'B', category: 'manual', choices: [] }] },
      removeByUma: { '101001': ['A'] },
    });
    expect(out['101001']!.map((e) => e.name)).toEqual(['B']);
    expect(base['101001']).toHaveLength(1);
  });
});
