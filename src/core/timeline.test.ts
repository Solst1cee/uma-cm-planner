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

describe('projectCmSchedule', () => {
  it('emits a row only for cm entries with a cmNumber', () => {
    const rows = projectCmSchedule(base);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ date: '2026-05-22', cmId: 'CM15', cmNumber: 15, name: 'Taurus Cup', courseId: '10202' });
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
