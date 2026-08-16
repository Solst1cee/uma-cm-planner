import { describe, expect, it } from 'vitest';
import {
  BASE_PORTRAIT_MAX_DISTANCE,
  portraitDistance,
  preferGameNativePortrait,
  skillSourceFile,
  supportSourceFile,
  UMA_TRAINED_ICON_ID_OVERRIDES,
  umaSourceFile,
} from './build-icons';

describe('skillSourceFile', () => {
  it('pads 5-digit-or-shorter iconIds to 5 chars', () => {
    expect(skillSourceFile('10071')).toBe('skill/utx_ico_skill_10071.png');
    expect(skillSourceFile('20013')).toBe('skill/utx_ico_skill_20013.png');
  });

  it('leaves the two 7-digit iconIds unpadded (padStart is a no-op)', () => {
    expect(skillSourceFile('1010011')).toBe('skill/utx_ico_skill_1010011.png');
    expect(skillSourceFile('2010010')).toBe('skill/utx_ico_skill_2010010.png');
  });
});

describe('supportSourceFile', () => {
  it('resolves normal cardIds to the lowercase source filename', () => {
    expect(supportSourceFile('10001')).toBe('support/support_card_s_10001.png');
    expect(supportSourceFile('30102')).toBe('support/support_card_s_30102.png');
  });

  it('resolves the 2 case-variant cards to the uppercase source filename', () => {
    // The dump ships these ONLY as `Support_card_s_…`; output is lowercased by
    // the caller, but the SOURCE must be read with the capital S.
    expect(supportSourceFile('30024')).toBe('support/Support_card_s_30024.png');
    expect(supportSourceFile('30061')).toBe('support/Support_card_s_30061.png');
  });
});

describe('umaSourceFile', () => {
  it('uses the trained _02 gold-frame portrait when present', () => {
    const exists = (rel: string): boolean => rel === 'chara/trained_chr_icon_1001_100101_02.png';
    expect(umaSourceFile('100101', '1001', exists)).toEqual({
      source: 'chara/trained_chr_icon_1001_100101_02.png',
      fallback: false,
    });
  });

  it('uses the known trained asset-id override for Global alt outfits', () => {
    const noTrained = (): boolean => false;
    expect(umaSourceFile('101502', '1015', noTrained)).toEqual({
      source: 'chara/trained_chr_icon_1015_101510_02.png',
      fallback: false,
    });
    expect(umaSourceFile('102602', '1026', noTrained)).toEqual({
      source: 'chara/trained_chr_icon_1026_102613_02.png',
      fallback: false,
    });
  });

  it('falls back to the base chr_icon when no trained _02 exists and no override is known', () => {
    const noTrained = (): boolean => false;
    expect(umaSourceFile('999902', '9999', noTrained)).toEqual({
      source: 'chara/chr_icon_9999.png',
      fallback: true,
    });
  });

  it('keys the trained probe on charaId + umaId together', () => {
    const seen: string[] = [];
    const exists = (rel: string): boolean => {
      seen.push(rel);
      return false;
    };
    umaSourceFile('100201', '1002', exists);
    expect(seen).toEqual(['chara/trained_chr_icon_1002_100201_02.png']);
  });

  it('resolves the alt outfits whose art was previously lost to the base-portrait fallback', () => {
    const noTrained = (): boolean => false;
    // Mejiro Dober [Sapphire Sojourn] — the report that surfaced the whole class.
    expect(umaSourceFile('105902', '1059', noTrained)).toEqual({
      source: 'chara/trained_chr_icon_1059_105923_02.png',
      fallback: false,
    });
    // The other three Global alts found by the same sweep.
    expect(umaSourceFile('100103', '1001', noTrained).source).toBe(
      'chara/trained_chr_icon_1001_100130_02.png',
    );
    expect(umaSourceFile('101002', '1010', noTrained).source).toBe(
      'chara/trained_chr_icon_1010_101023_02.png',
    );
    expect(umaSourceFile('101303', '1013', noTrained).source).toBe(
      'chara/trained_chr_icon_1013_101330_02.png',
    );
    // …and a JP-ahead one, to pin that the table is not Global-only.
    expect(umaSourceFile('106402', '1064', noTrained).source).toBe(
      'chara/trained_chr_icon_1064_106446_02.png',
    );
  });
});

describe('UMA_TRAINED_ICON_ID_OVERRIDES', () => {
  it('never maps a umaId to itself (that entry would be the no-override path)', () => {
    for (const [umaId, assetId] of Object.entries(UMA_TRAINED_ICON_ID_OVERRIDES)) {
      expect(assetId).not.toBe(umaId);
    }
  });

  it('maps every umaId to a DISTINCT asset id', () => {
    // Two outfits sharing one trained icon means an elimination mistake: the
    // asset ids are a per-character outfit catalogue, so they are 1:1.
    const assetIds = Object.values(UMA_TRAINED_ICON_ID_OVERRIDES);
    expect(new Set(assetIds).size).toBe(assetIds.length);
  });

  it('keeps every asset id within its umaId character (first 4 digits)', () => {
    for (const [umaId, assetId] of Object.entries(UMA_TRAINED_ICON_ID_OVERRIDES)) {
      expect(assetId.slice(0, 4)).toBe(umaId.slice(0, 4));
    }
  });
});

describe('portraitDistance', () => {
  it('scores identical samples 0', () => {
    expect(portraitDistance([0, 128, 255], [0, 128, 255])).toBe(0);
  });

  it('is the mean absolute per-pixel difference', () => {
    expect(portraitDistance([10, 20, 30], [12, 24, 36])).toBe(4);
  });

  it('rejects mismatched sample lengths rather than silently comparing a prefix', () => {
    expect(() => portraitDistance([1, 2], [1, 2, 3])).toThrow(/length/i);
  });
});

describe('preferGameNativePortrait', () => {
  it('uses the game-native portrait when it exists and the dump has no trained art', () => {
    expect(
      preferGameNativePortrait({
        gameIconExists: true,
        dumpHasTrainedArt: false,
        gameIconMatchesBase: true,
      }),
    ).toBe(true);
  });

  it('uses the game-native portrait when it is real outfit art', () => {
    expect(
      preferGameNativePortrait({
        gameIconExists: true,
        dumpHasTrainedArt: true,
        gameIconMatchesBase: false,
      }),
    ).toBe(true);
  });

  it('rejects a game-native portrait that is just the base chr_icon while the dump has the real art', () => {
    // The Mejiro Dober / Taiki Shuttle case: the client extraction hit the same
    // missing-asset-id fallback, and would otherwise SHADOW the override.
    expect(
      preferGameNativePortrait({
        gameIconExists: true,
        dumpHasTrainedArt: true,
        gameIconMatchesBase: true,
      }),
    ).toBe(false);
  });

  it('falls through to the dump when no game-native portrait is vendored', () => {
    expect(
      preferGameNativePortrait({
        gameIconExists: false,
        dumpHasTrainedArt: true,
        gameIconMatchesBase: false,
      }),
    ).toBe(false);
  });

  it('keeps a usable margin between the known-good and known-fallback measurements', () => {
    // Measured on the real dump: the two known-bad game-native files score 0 and
    // 2; all 17 previously-correct ones score 24-45.
    expect(BASE_PORTRAIT_MAX_DISTANCE).toBeGreaterThan(2);
    expect(BASE_PORTRAIT_MAX_DISTANCE).toBeLessThan(24);
  });
});
