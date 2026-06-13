import { describe, expect, it } from 'vitest';
import { skillSourceFile, supportSourceFile, umaSourceFile } from './build-icons';

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

  it('falls back to the base chr_icon when no trained _02 exists (alt-outfit gap)', () => {
    const noTrained = (): boolean => false;
    // e.g. 100402 Maruzensky "Hot Summer Night" — one of the 17 fallback umas.
    expect(umaSourceFile('100402', '1004', noTrained)).toEqual({
      source: 'chara/chr_icon_1004.png',
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
});
