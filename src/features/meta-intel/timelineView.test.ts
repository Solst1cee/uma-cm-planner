import { describe, expect, it } from 'vitest';
import type { TimelineEntry } from '@/core/types';
import { currentCm, filterTimeline, nowIndex, partitionByLane, windowTimeline } from './timelineView';

/** Minimal TimelineEntry builder — override only what a test cares about. */
function entry(over: Partial<TimelineEntry> & { id: string }): TimelineEntry {
  return {
    type: 'cm',
    title: over.id,
    dates: { finals: '2026-06-30' },
    tier: 'official',
    status: 'confirmed',
    source: { kind: 'manual', url: '' },
    server: 'global',
    dataVersion: 'test',
    ...over,
  } as TimelineEntry;
}

describe('partitionByLane', () => {
  it('buckets by type and sorts each lane ascending by effective date', () => {
    const out = partitionByLane([
      entry({ id: 'cmB', type: 'cm', dates: { finals: '2026-08-01' } }),
      entry({ id: 'patch1', type: 'patch', dates: { start: '2026-07-01' } }),
      entry({ id: 'cmA', type: 'cm', dates: { finals: '2026-06-01' } }),
      entry({ id: 'banner1', type: 'banner', dates: { start: '2026-06-15' } }),
    ]);
    expect(out.cm.map((e) => e.id)).toEqual(['cmA', 'cmB']);
    expect(out.banner.map((e) => e.id)).toEqual(['banner1']);
    expect(out.patch.map((e) => e.id)).toEqual(['patch1']);
  });
});

describe('filterTimeline', () => {
  const data = [
    entry({ id: 'cm1', type: 'cm', status: 'confirmed' }),
    entry({ id: 'banner1', type: 'banner', status: 'unconfirmed' }),
    entry({ id: 'patch1', type: 'patch', status: 'unconfirmed' }),
  ];

  it('keeps only enabled lanes', () => {
    const out = filterTimeline(data, { lanes: new Set(['cm', 'banner']), confirmedOnly: false });
    expect(out.map((e) => e.id)).toEqual(['cm1', 'banner1']);
  });

  it('drops unconfirmed entries when confirmedOnly is set', () => {
    const out = filterTimeline(data, { lanes: new Set(['cm', 'banner', 'patch']), confirmedOnly: true });
    expect(out.map((e) => e.id)).toEqual(['cm1']);
  });
});

describe('nowIndex', () => {
  const sorted = [
    entry({ id: 'a', dates: { finals: '2026-06-01' } }),
    entry({ id: 'b', dates: { finals: '2026-06-20' } }),
    entry({ id: 'c', dates: { finals: '2026-07-01' } }),
  ];

  it('returns the index of the first entry on/after now', () => {
    expect(nowIndex(sorted, '2026-06-15')).toBe(1);
  });

  it('returns 0 when every entry is upcoming', () => {
    expect(nowIndex(sorted, '2026-01-01')).toBe(0);
  });

  it('returns length when every entry is in the past', () => {
    expect(nowIndex(sorted, '2027-01-01')).toBe(3);
  });
});

describe('currentCm', () => {
  const cms = [
    entry({ id: 'cm1', dates: { finals: '2026-05-30' } }),
    entry({ id: 'cm2', dates: { finals: '2026-06-30' } }),
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

describe('windowTimeline', () => {
  const entries = [
    entry({ id: 'ancient', dates: { finals: '2025-06-15' } }), // >1y ago
    entry({ id: 'recent', dates: { finals: '2026-05-15' } }),
    entry({ id: 'soon', dates: { finals: '2026-07-15' } }),
    entry({ id: 'far', dates: { finals: '2027-09-15' } }),     // >1y ahead
    entry({ id: 'undated', dates: {} }),
  ];
  const now = '2026-06-15';

  it('all → everything, order preserved', () => {
    expect(windowTimeline(entries, now, 'all').map((e) => e.id)).toEqual([
      'ancient', 'recent', 'soon', 'far', 'undated',
    ]);
  });
  it('upcoming → effective date on/after now (undated excluded)', () => {
    expect(windowTimeline(entries, now, 'upcoming').map((e) => e.id)).toEqual(['soon', 'far']);
  });
  it('year → [now-6mo, now+12mo], undated excluded', () => {
    expect(windowTimeline(entries, now, 'year').map((e) => e.id)).toEqual(['recent', 'soon']);
  });
});
