import { describe, it, expect } from 'vitest';
import { wishlistPins, skillPatchMap, withSkillPatches, skillPatchesSig, activePatchNotes } from './rebalancePatches';
import type { RebalanceInfo, SkillRecord, WishlistItem } from './types';
import type { SimBuild } from '@/sim/types';

const TODAY = '2026-07-03';
const CM_CUTOFF = '2026-10-01';

function rec(skillId: string, rebalance?: RebalanceInfo): SkillRecord {
  return {
    skillId, nameEn: `Skill ${skillId}`, nameJp: skillId, baseSpCost: 100,
    rarity: 'white', iconId: '1', conditions: 'phase>=1', server: 'global', dataVersion: 't',
    ...(rebalance ? { rebalance } : {}),
  } as SkillRecord;
}

// v2 announced + elapsed (live at Current), carries a modifier.
const CONFIRMED: RebalanceInfo = {
  globalVer: 2, jpVer: 2,
  versions: [
    { ver: 1 },
    { ver: 2, jpDate: '2025-01-01', globalDate: '2026-06-01', globalArrival: '2026-06-01', modifier: 0.5, sourceUrl: 'https://x' },
  ],
};
// v2 predicted, arrival between today and the CM cutoff (upcoming-only).
const PREDICTED: RebalanceInfo = {
  globalVer: 1, jpVer: 2,
  versions: [
    { ver: 1 },
    { ver: 2, jpDate: '2025-06-01', globalArrival: '2026-08-15', globalDatePredicted: true, conditions: 'corner==2', sourceUrl: 'https://x' },
  ],
};
// AUTO candidate — no parameterized versions, never patches.
const CANDIDATE: RebalanceInfo = {
  globalVer: 1, jpVer: 1, versions: [{ ver: 1 }],
  uncuratedCandidate: true, candidateConditions: { jp: 'a==1', global: 'b==1' },
};

function byId(...recs: SkillRecord[]): Map<string, SkillRecord> {
  return new Map(recs.map((r) => [r.skillId, r]));
}

describe('skillPatchMap', () => {
  it('returns undefined when nothing patches', () => {
    const skillById = byId(rec('100'), rec('200', CANDIDATE));
    expect(skillPatchMap({ skillById, cutoffISO: TODAY, todayISO: TODAY })).toBeUndefined();
  });

  it('pin-lag: a confirmed globalVer >= 2 patches even at Current', () => {
    const skillById = byId(rec('300', CONFIRMED));
    const map = skillPatchMap({ skillById, cutoffISO: TODAY, todayISO: TODAY });
    expect(map).toEqual({ '300': { modifier: 0.5 } });
  });

  it('predicted versions do not patch at Current but do at a CM cutoff past arrival', () => {
    const skillById = byId(rec('400', PREDICTED));
    expect(skillPatchMap({ skillById, cutoffISO: TODAY, todayISO: TODAY })).toBeUndefined();
    expect(skillPatchMap({ skillById, cutoffISO: CM_CUTOFF, todayISO: TODAY }))
      .toEqual({ '400': { conditions: 'corner==2' } });
  });

  it('a pin overrides the horizon default, even off-horizon', () => {
    const skillById = byId(rec('400', PREDICTED));
    const pins = new Map([['400', 2]]);
    expect(skillPatchMap({ skillById, cutoffISO: TODAY, todayISO: TODAY, pins }))
      .toEqual({ '400': { conditions: 'corner==2' } });
    // pin back to baseline suppresses the pin-lag patch
    const skillById2 = byId(rec('300', CONFIRMED));
    expect(skillPatchMap({ skillById: skillById2, cutoffISO: TODAY, todayISO: TODAY, pins: new Map([['300', 1]]) }))
      .toBeUndefined();
  });

  it('emits sorted keys so JSON.stringify is a stable signature', () => {
    const skillById = byId(rec('900', CONFIRMED), rec('100', CONFIRMED));
    const map = skillPatchMap({ skillById, cutoffISO: TODAY, todayISO: TODAY })!;
    expect(Object.keys(map)).toEqual(['100', '900']);
  });
});

describe('wishlistPins', () => {
  it('keys pins by the resolved engine skill id and skips unpinned items', () => {
    const skillById = byId(rec('500', CONFIRMED));
    const wl: WishlistItem[] = [
      { skillId: '500', priority: 3, source: 'targeted', skillVer: 2 },
      { skillId: '600', priority: 3, source: 'targeted' },
    ];
    const pins = wishlistPins(wl, skillById);
    expect(pins.get('500')).toBe(2);
    expect(pins.has('600')).toBe(false);
  });
});

describe('withSkillPatches / skillPatchesSig', () => {
  const build: SimBuild = {
    umaId: 'u', stats: { spd: 1, sta: 1, pow: 1, gut: 1, wit: 1 },
    strategy: 'pace', aptitudes: { distance: 'A', surface: 'A', strategy: 'A' }, skills: [],
  };
  it('attaches only when non-empty and never mutates', () => {
    expect(withSkillPatches(build, undefined)).toBe(build);
    const p = { '300': { modifier: 0.5 } };
    const out = withSkillPatches(build, p);
    expect(out.skillPatches).toEqual(p);
    expect(build.skillPatches).toBeUndefined();
  });
  it('sig is empty-string for undefined and stable for a map', () => {
    expect(skillPatchesSig(undefined)).toBe('');
    expect(skillPatchesSig({ '300': { modifier: 0.5 } })).toBe(skillPatchesSig({ '300': { modifier: 0.5 } }));
  });
});

describe('activePatchNotes', () => {
  it('labels pin-lag, predicted arrival, and pinned selections', () => {
    const skillById = byId(rec('300', CONFIRMED), rec('400', PREDICTED), rec('200', CANDIDATE));
    const atCm = activePatchNotes({ skillById, cutoffISO: CM_CUTOFF, todayISO: TODAY });
    expect(atCm).toEqual([
      { skillId: '300', name: 'Skill 300', ver: 2, pinLag: true, predicted: false, arrival: '2026-06-01', pinned: false },
      { skillId: '400', name: 'Skill 400', ver: 2, pinLag: false, predicted: true, arrival: '2026-08-15', pinned: false },
    ]);
    const pinnedNotes = activePatchNotes({ skillById: byId(rec('400', PREDICTED)), cutoffISO: TODAY, todayISO: TODAY, pins: new Map([['400', 2]]) });
    expect(pinnedNotes[0]!.pinned).toBe(true);
  });
});
