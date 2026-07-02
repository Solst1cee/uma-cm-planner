import { describe, it, expect } from 'vitest';
import { effectiveVersion, versionPatch } from './rebalance';
import type { RebalanceInfo } from './types';

const info: RebalanceInfo = {
  globalVer: 1,
  jpVer: 3,
  versions: [
    { ver: 1 },
    { ver: 2, jpDate: '2025-11-20', globalArrival: '2026-08-10', globalDatePredicted: true, conditions: 'corner==2', sourceUrl: 'https://x' },
    { ver: 3, jpDate: '2026-05-10', globalDate: '2026-09-01', globalArrival: '2026-09-01', modifier: 0.25, sourceUrl: 'https://x' },
  ],
};
const today = '2026-07-03';

describe('effectiveVersion', () => {
  it('falls back to globalVer when no version has arrived by the cutoff', () => {
    expect(effectiveVersion(info, today, today).ver).toBe(1); // Current: v2 predicted, v3 not yet
  });
  it('a predicted arrival activates only when the cutoff is beyond today', () => {
    expect(effectiveVersion(info, '2026-08-26', today).ver).toBe(2); // CM horizon past v2's projection
  });
  it('an announced arrival wins at its date; highest live version is picked', () => {
    expect(effectiveVersion(info, '2026-09-01', today).ver).toBe(3);
  });
  it('an announced arrival that already elapsed is live even at Current (pin lag)', () => {
    const lag: RebalanceInfo = { globalVer: 2, jpVer: 2, versions: [
      { ver: 1 }, { ver: 2, globalDate: '2026-06-20', globalArrival: '2026-06-20', modifier: 0.3, sourceUrl: 'https://x' },
    ]};
    expect(effectiveVersion(lag, today, today).ver).toBe(2);
  });
});

describe('versionPatch', () => {
  it('baseline has no patch; parameterized versions surface only their set fields', () => {
    expect(versionPatch(info.versions[0]!)).toBeUndefined();
    expect(versionPatch(info.versions[1]!)).toEqual({ conditions: 'corner==2' });
    expect(versionPatch(info.versions[2]!)).toEqual({ modifier: 0.25 });
  });
});
