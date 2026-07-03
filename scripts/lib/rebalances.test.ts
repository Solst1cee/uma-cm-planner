import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { detectCandidates, loadRebalances, validateRebalances, bakeRebalances, type CuratedRebalance } from './rebalances';
import { buildForesightCalibration, type ConfirmedCm } from './foresight-build';
import type { GtSkill } from './upstream-types';
import type { JpCmDate } from '@/core/types';

describe('detectCandidates', () => {
  const master = new Set(['10111', '10112']);

  it('flags a Global-released skill whose loc.en conditions differ from JP', () => {
    const gt: GtSkill = {
      id: 10111,
      condition_groups: [{ condition: 'is_last_straight==1&change_order_onetime<0&order>=3' }],
      loc: { en: { condition_groups: [{ condition: 'is_finalcorner==1&corner==0&change_order_onetime<0&order>=3' }] } },
    };
    const result = detectCandidates([gt], master);
    expect(result.get('10111')).toEqual({
      jp: 'is_last_straight==1&change_order_onetime<0&order>=3',
      global: 'is_finalcorner==1&corner==0&change_order_onetime<0&order>=3',
    });
  });

  it('is absent when JP and Global conditions serialize identically', () => {
    const gt: GtSkill = {
      id: 10111,
      condition_groups: [{ condition: 'order>=3' }],
      loc: { en: { condition_groups: [{ condition: 'order>=3' }] } },
    };
    expect(detectCandidates([gt], master).has('10111')).toBe(false);
  });

  it('is absent when loc.en (or its condition_groups) is missing — no recorded Global override', () => {
    const noLoc: GtSkill = { id: 10111, condition_groups: [{ condition: 'order>=3' }] };
    const emptyLoc: GtSkill = { id: 10112, condition_groups: [{ condition: 'order>=3' }], loc: { en: {} } };
    const result = detectCandidates([noLoc, emptyLoc], master);
    expect(result.has('10111')).toBe(false);
    expect(result.has('10112')).toBe(false);
  });

  it('is absent when the skill is not in the Global master (JP-only)', () => {
    const gt: GtSkill = {
      id: 99999,
      condition_groups: [{ condition: 'order>=3' }],
      loc: { en: { condition_groups: [{ condition: 'order>=1' }] } },
    };
    expect(detectCandidates([gt], master).has('99999')).toBe(false);
  });
});

describe('validateRebalances', () => {
  const valid = (): CuratedRebalance => ({
    skillId: '200012',
    globalVer: 1,
    versions: [{ ver: 1 }, { ver: 2, modifier: 0.25, sourceUrl: 'https://x' }],
  });

  it('accepts a well-formed entry', () => {
    expect(() => validateRebalances([valid()])).not.toThrow();
  });

  it('rejects non-ascending vers', () => {
    const e = valid();
    e.versions = [{ ver: 1 }, { ver: 2 }, { ver: 1, modifier: 0.1, sourceUrl: 'https://x' }];
    expect(() => validateRebalances([e])).toThrow(/ascending/);
  });

  it('rejects duplicate vers', () => {
    const e = valid();
    e.versions = [{ ver: 1 }, { ver: 2, modifier: 0.1, sourceUrl: 'https://x' }, { ver: 2, modifier: 0.2, sourceUrl: 'https://x' }];
    expect(() => validateRebalances([e])).toThrow(/ascending/);
  });

  it('rejects a globalVer not present in versions', () => {
    const e = valid();
    e.globalVer = 3;
    expect(() => validateRebalances([e])).toThrow(/globalVer/);
  });

  it('rejects a ver >= 2 with a value field but no sourceUrl', () => {
    const e = valid();
    e.versions = [{ ver: 1 }, { ver: 2, modifier: 0.25 }];
    expect(() => validateRebalances([e])).toThrow(/sourceUrl/);
  });

  it('allows a ver >= 2 with only conditions (no value field) and no sourceUrl', () => {
    const e = valid();
    e.versions = [{ ver: 1 }, { ver: 2, conditions: 'corner==2' }];
    expect(() => validateRebalances([e])).not.toThrow();
  });

  it('rejects version 1 (baseline) carrying parameters', () => {
    const e = valid();
    e.versions = [{ ver: 1, modifier: 0.1 }, { ver: 2, modifier: 0.25, sourceUrl: 'https://x' }];
    expect(() => validateRebalances([e])).toThrow(/baseline/);
  });

  it('rejects a missing version 1', () => {
    const e = valid();
    e.globalVer = 2;
    e.versions = [{ ver: 2, modifier: 0.25, sourceUrl: 'https://x' }];
    expect(() => validateRebalances([e])).toThrow(/version 1/);
  });

  it('rejects an empty/invalid skillId', () => {
    const e = valid();
    e.skillId = '';
    expect(() => validateRebalances([e])).toThrow(/skillId/);
  });
});

describe('loadRebalances', () => {
  it('parses and validates a well-formed file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rebalances-test-'));
    const path = join(dir, 'rebalances.json');
    const entries: CuratedRebalance[] = [
      { skillId: '200012', globalVer: 1, versions: [{ ver: 1 }, { ver: 2, modifier: 0.25, sourceUrl: 'https://x' }] },
    ];
    writeFileSync(path, JSON.stringify(entries));
    expect(loadRebalances(path)).toEqual(entries);
  });

  it('throws loudly on an invalid file (P5)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rebalances-test-'));
    const path = join(dir, 'rebalances.json');
    const bad: CuratedRebalance[] = [{ skillId: '200012', globalVer: 1, versions: [{ ver: 1, modifier: 0.1 }] }];
    writeFileSync(path, JSON.stringify(bad));
    expect(() => loadRebalances(path)).toThrow(/baseline/);
  });
});

describe('bakeRebalances', () => {
  const JP: JpCmDate[] = [
    { cmNumber: 10, cupName: 'Aquarius Cup', jpDate: '2022-02-18' },
    { cmNumber: 11, cupName: 'Pisces Cup', jpDate: '2022-03-22' },
    { cmNumber: 12, cupName: 'Aries Cup', jpDate: '2022-04-22' },
    { cmNumber: 13, cupName: 'Taurus Cup', jpDate: '2022-05-24' },
    { cmNumber: 14, cupName: 'Gemini Cup', jpDate: '2022-06-14' },
    { cmNumber: 15, cupName: 'Cancer Cup', jpDate: '2022-07-14' },
  ];
  const CONFIRMED: ConfirmedCm[] = [
    { cmNumber: 10, global: '2026-03-06' }, { cmNumber: 11, global: '2026-03-30' },
    { cmNumber: 12, global: '2026-04-23' }, { cmNumber: 13, global: '2026-05-14' },
    { cmNumber: 14, global: '2026-06-04' }, { cmNumber: 15, global: '2026-06-24' },
  ];
  const cal = buildForesightCalibration(JP, CONFIRMED);

  it('curated entry: announced globalDate wins (predicted:false)', () => {
    const curated: CuratedRebalance[] = [{
      skillId: '200012',
      globalVer: 2,
      versions: [
        { ver: 1 },
        { ver: 2, jpDate: '2022-08-13', globalDate: '2026-05-01', modifier: 0.25, sourceUrl: 'https://x' },
      ],
    }];
    const baked = bakeRebalances({ candidates: new Map(), curated, cal });
    const v2 = baked.get('200012')!.versions[1]!;
    expect(v2.globalArrival).toBe('2026-05-01');
    expect(v2.globalDatePredicted).toBeUndefined();
  });

  it('curated entry: jpDate-only projects via cal (predicted:true)', () => {
    const curated: CuratedRebalance[] = [{
      skillId: '200012',
      globalVer: 2,
      versions: [{ ver: 1 }, { ver: 2, jpDate: '2022-08-13', modifier: 0.25, sourceUrl: 'https://x' }],
    }];
    const baked = bakeRebalances({ candidates: new Map(), curated, cal });
    const v2 = baked.get('200012')!.versions[1]!;
    expect(v2.globalArrival).toBe('2026-07-16');
    expect(v2.globalDatePredicted).toBe(true);
  });

  it('curated entry: jpDate-only with cal:null yields no arrival (undatable, still displayed)', () => {
    const curated: CuratedRebalance[] = [{
      skillId: '200012',
      globalVer: 2,
      versions: [{ ver: 1 }, { ver: 2, jpDate: '2022-08-13', modifier: 0.25, sourceUrl: 'https://x' }],
    }];
    const baked = bakeRebalances({ candidates: new Map(), curated, cal: null });
    const v2 = baked.get('200012')!.versions[1]!;
    expect(v2.globalArrival).toBeUndefined();
    expect(v2.globalDatePredicted).toBeUndefined();
    expect(baked.get('200012')).toBeDefined(); // still present/displayed, just undated
  });

  it('jpVer is the max ver in the curated entry', () => {
    const curated: CuratedRebalance[] = [{
      skillId: '200012',
      globalVer: 1,
      versions: [
        { ver: 1 },
        { ver: 2, conditions: 'corner==2' },
        { ver: 3, jpDate: '2022-08-13', modifier: 0.3, sourceUrl: 'https://x' },
      ],
    }];
    const baked = bakeRebalances({ candidates: new Map(), curated, cal });
    expect(baked.get('200012')!.jpVer).toBe(3);
    expect(baked.get('200012')!.globalVer).toBe(1);
  });

  it('a curated skillId absorbs its auto candidate — no uncuratedCandidate flag', () => {
    const candidates = new Map([['200012', { jp: 'jp-cond', global: 'global-cond' }]]);
    const curated: CuratedRebalance[] = [{ skillId: '200012', globalVer: 1, versions: [{ ver: 1 }] }];
    const baked = bakeRebalances({ candidates, curated, cal });
    const info = baked.get('200012')!;
    expect(info.uncuratedCandidate).toBeUndefined();
    expect(info.candidateConditions).toBeUndefined();
  });

  it('an un-curated candidate yields a minimal placeholder RebalanceInfo', () => {
    const candidates = new Map([['300099', { jp: 'jp-cond', global: 'global-cond' }]]);
    const baked = bakeRebalances({ candidates, curated: [], cal });
    expect(baked.get('300099')).toEqual({
      globalVer: 1,
      jpVer: 1,
      versions: [{ ver: 1 }],
      uncuratedCandidate: true,
      candidateConditions: { jp: 'jp-cond', global: 'global-cond' },
    });
  });
});
