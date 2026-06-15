import { describe, it, expect } from 'vitest';
import { mergeTimeline, projectCmSchedule, predictGlobalDate, timelineBadge, sortTimeline } from './timeline';
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
