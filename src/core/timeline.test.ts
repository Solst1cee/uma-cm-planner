import { describe, it, expect } from 'vitest';
import { mergeTimeline, projectCmSchedule, predictGlobalDate, timelineBadge, sortTimeline, addMonths, currentCm } from './timeline';
import type { TimelineEntry } from './types';

const base: TimelineEntry[] = [
  { id: 'cm-a', type: 'cm', title: 'Aries Cup', dates: { finals: '2026-04-22' }, cm: { courseId: '10101' }, tier: 'datamined', status: 'unconfirmed', source: { kind: 'umalator', url: 'u' }, server: 'jp', dataVersion: 'v' },
  { id: 'cm-b', type: 'cm', title: 'Taurus Cup', dates: { finals: '2026-05-22' }, cm: { cmNumber: 15, courseId: '10202' }, tier: 'official', status: 'confirmed', source: { kind: 'umalator', url: 'u' }, server: 'global', dataVersion: 'v' },
];

describe('mergeTimeline (insert-or-patch by id)', () => {
  it('patches an existing entry', () => {
    const merged = mergeTimeline(base, [{ id: 'cm-a', cm: { cmNumber: 14, courseId: '10101' }, status: 'confirmed' }]);
    const a = merged.find((e) => e.id === 'cm-a')!;
    expect(a.cm?.cmNumber).toBe(14);
    expect(a.status).toBe('confirmed');
    expect(a.title).toBe('Aries Cup');
  });
  it('inserts a new entry', () => {
    const next: TimelineEntry = { id: 'patch-1', type: 'patch', title: 'v3.0', dates: { start: '2026-06-01' }, patch: { version: '3.0' }, tier: 'prediction', status: 'unconfirmed', source: { kind: 'manual', url: 'm' }, server: 'global', dataVersion: 'v' };
    const merged = mergeTimeline(base, [next]);
    expect(merged.find((e) => e.id === 'patch-1')).toBeDefined();
    expect(merged).toHaveLength(3);
  });
});

describe('mergeTimeline — cm.conditions', () => {
  it('carries cm.conditions through mergeTimeline overrides', () => {
    const base: TimelineEntry[] = [{ id: 'cm15', type: 'cm', title: 'Cancer Cup',
      dates: { finals: '2026-06-24' }, cm: { cmNumber: 15, courseId: '10906' },
      tier: 'official', status: 'confirmed', source: { kind: 'official_news', url: '' },
      server: 'global', dataVersion: 'x' }];
    const merged = mergeTimeline(base, [{ id: 'cm15', cm: { conditions: { ground: 'good', weather: 'cloudy', season: 'summer' } } }]);
    expect(merged[0]?.cm?.conditions).toEqual({ ground: 'good', weather: 'cloudy', season: 'summer' });
    expect(merged[0]?.cm?.courseId).toBe('10906'); // unrelated cm fields preserved by the deep merge
  });
});

describe('projectCmSchedule', () => {
  it('emits a row only for cm entries with a cmNumber', () => {
    const rows = projectCmSchedule(base);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ date: '2026-05-22', cmId: 'CM15', cmNumber: 15, name: 'Taurus Cup', courseId: '10202' });
  });

  it('yields exactly six rows in date order for CM10–15 fixture', () => {
    const cm10to15: TimelineEntry[] = [
      {
        id: 'cm10-aquarius-cup', type: 'cm', title: 'Aquarius Cup',
        dates: { start: '2026-03-02', finals: '2026-03-06', end: '2026-03-12' },
        cm: { cmNumber: 10, courseId: '10611', trackSummary: 'Tokyo dirt 1600m (mile)' },
        tier: 'official', status: 'confirmed',
        source: { kind: 'official_news', url: 'https://umamusume.com/news/612/' },
        server: 'global', dataVersion: 'global-76214c82',
      },
      {
        id: 'cm11-pisces-cup', type: 'cm', title: 'Pisces Cup',
        dates: { start: '2026-03-26', finals: '2026-03-30', end: '2026-04-05' },
        cm: { cmNumber: 11, courseId: '10914', trackSummary: 'Hanshin turf 3200m (long)' },
        tier: 'official', status: 'confirmed',
        source: { kind: 'official_news', url: 'https://umamusume.com/news/642/' },
        server: 'global', dataVersion: 'global-76214c82',
      },
      {
        id: 'cm12-aries-cup', type: 'cm', title: 'Aries Cup',
        dates: { start: '2026-04-20', finals: '2026-04-23', end: '2026-04-29' },
        cm: { cmNumber: 12, courseId: '10504', trackSummary: 'Nakayama turf 2000m (medium)' },
        tier: 'official', status: 'confirmed',
        source: { kind: 'official_news', url: 'https://umamusume.com/news/700/' },
        server: 'global', dataVersion: 'global-76214c82',
      },
      {
        id: 'cm13-taurus-cup', type: 'cm', title: 'Taurus Cup',
        dates: { start: '2026-05-10', finals: '2026-05-14', end: '2026-05-20' },
        cm: { cmNumber: 13, courseId: '10606', trackSummary: 'Tokyo turf 2400m (medium)' },
        tier: 'official', status: 'confirmed',
        source: { kind: 'official_news', url: 'https://umamusume.com/news/771/' },
        server: 'global', dataVersion: 'global-76214c82',
      },
      {
        id: 'cm14-gemini-cup', type: 'cm', title: 'Gemini Cup',
        dates: { start: '2026-05-31', finals: '2026-06-04', end: '2026-06-10' },
        cm: { cmNumber: 14, courseId: '10602', trackSummary: 'Tokyo turf 1600m (mile)' },
        tier: 'official', status: 'confirmed',
        source: { kind: 'official_news', url: 'https://umamusume.com/news/790/' },
        server: 'global', dataVersion: 'global-76214c82',
      },
      {
        id: 'cm15-cancer-cup', type: 'cm', title: 'Cancer Cup',
        dates: { start: '2026-06-21', finals: '2026-06-24', end: '2026-06-30' },
        cm: { cmNumber: 15, courseId: '10906', trackSummary: 'Hanshin turf 2200m (inner, right · good/summer/cloudy)' },
        tier: 'official', status: 'confirmed',
        source: { kind: 'official_news', url: 'https://umamusume.com/news/829/' },
        server: 'global', dataVersion: 'global-76214c82',
      },
    ];
    const rows = projectCmSchedule(cm10to15);
    expect(rows).toHaveLength(6);
    expect(rows.map((r) => r.cmNumber)).toEqual([10, 11, 12, 13, 14, 15]);
    expect(rows.map((r) => r.cmId)).toEqual(['CM10', 'CM11', 'CM12', 'CM13', 'CM14', 'CM15']);
    expect(rows.map((r) => r.courseId)).toEqual(['10611', '10914', '10504', '10606', '10602', '10906']);
    expect(rows.map((r) => r.date)).toEqual([
      '2026-03-06', '2026-03-30', '2026-04-23', '2026-05-14', '2026-06-04', '2026-06-24',
    ]);
  });
});

describe('predictGlobalDate', () => {
  it('compresses the JP gap by the pace multiplier', () => {
    const g = predictGlobalDate('2025-04-11', 2.0, '2025-01-01', '2026-01-01');
    expect(g).toBe('2026-02-20'); // 2026-01-01 + 50 days (100 JP gap days / 2.0)
  });
});

describe('timelineBadge', () => {
  it('confirmed → ✓; else tier symbol', () => {
    expect(timelineBadge({ ...base[1] as TimelineEntry }).symbol).toBe('✓');
    expect(timelineBadge({ ...base[0] as TimelineEntry }).symbol).toBe('◆');
    expect(timelineBadge({ ...base[0] as TimelineEntry, tier: 'prediction' }).symbol).toBe('~');
  });
});

describe('sortTimeline', () => {
  it('orders by the effective date ascending', () => {
    expect(sortTimeline(base).map((e) => e.id)).toEqual(['cm-a', 'cm-b']);
  });
});

import { predictGlobalDateDefault, JP_GLOBAL_PACE, JP_LAUNCH, GLOBAL_LAUNCH } from './timeline';

describe('pace calibration', () => {
  it('exposes the calibrated JP→Global pace (SoulEC 1.422) + launch anchors', () => {
    expect(JP_GLOBAL_PACE).toBeCloseTo(1.422);
    expect(JP_LAUNCH).toBe('2021-02-24');
    expect(GLOBAL_LAUNCH).toBe('2025-06-26');
  });
  it('predictGlobalDateDefault maps JP launch → Global launch and compresses later dates', () => {
    expect(predictGlobalDateDefault('2021-02-24')).toBe('2025-06-26');
    const d = predictGlobalDateDefault('2025-01-16'); // ~1422 JP days after launch
    expect(d > '2025-06-26').toBe(true);
    expect(predictGlobalDateDefault('2025-01-16')).toBe(d); // deterministic
  });
});

describe('addMonths', () => {
  it('adds whole months', () => {
    expect(addMonths('2026-06-30', 1)).toBe('2026-07-30');
    expect(addMonths('2026-06-30', 3)).toBe('2026-09-30');
  });
  it('rolls over the year', () => {
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15');
  });
  it('clamps to the last day when the target month is shorter', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-03-31', 1)).toBe('2026-04-30');
  });
  it('handles negative months (windowing lower bound)', () => {
    expect(addMonths('2026-06-15', -6)).toBe('2025-12-15');
  });
});

describe('currentCm', () => {
  const cms: TimelineEntry[] = [
    { id: 'cm1', type: 'cm', title: 'A', dates: { finals: '2026-05-30' }, tier: 'official', status: 'confirmed', source: { kind: 'official_news', url: '' }, server: 'global', dataVersion: 'x' },
    { id: 'cm2', type: 'cm', title: 'B', dates: { finals: '2026-06-30' }, tier: 'official', status: 'confirmed', source: { kind: 'official_news', url: '' }, server: 'global', dataVersion: 'x' },
  ];
  it('picks the first CM on/after now', () => {
    expect(currentCm(cms, '2026-06-15')?.id).toBe('cm2');
  });
  it('falls back to the most recent past CM when none are upcoming', () => {
    expect(currentCm(cms, '2027-01-01')?.id).toBe('cm2');
  });
  it('returns null for an empty list', () => {
    expect(currentCm([], '2026-06-15')).toBeNull();
  });
});
