import { describe, expect, it } from 'vitest';
import { buildUmas, stripTitleBrackets } from './build-umas';
import type { GtCharacterCard, UmalatorUmasJson } from './lib/upstream-types';

const DV = 'global-test';

const cutover: UmalatorUmasJson = {
  '1002': { name: ['', 'Silence Suzuka'], outfits: { '100201': '[Innocent Silence]' } },
  '1001': {
    name: ['', 'Special Week'],
    // Trailing space mirrors a real upstream quirk ("[Saintly Jade Cleric ]").
    outfits: { '100102': "[Hopp'n♪Happy Heart ]", '100101': '[Special Dreamer]' },
  },
};

const gt: GtCharacterCard[] = [
  { card_id: 100101, char_id: 1001, name_en: 'Special Week', title_en_gl: '[Special Dreamer]' },
  { card_id: 100102, char_id: 1001, name_en: 'Special Week', title_en_gl: "[Hopp'n♪Happy Heart]" },
  { card_id: 100201, char_id: 1002, name_en: 'Silence Suzuka', title_en_gl: '[Innocent Silence]' },
  // JP-only catalog entry — fan-TL title only; must never produce a record.
  { card_id: 110101, char_id: 1101, name_en: 'Somebody Else', title: 'Fan Translation' },
];

describe('stripTitleBrackets', () => {
  it('strips surrounding brackets and trims inner/outer whitespace', () => {
    expect(stripTitleBrackets('[Special Dreamer]')).toBe('Special Dreamer');
    expect(stripTitleBrackets('[Saintly Jade Cleric ]')).toBe('Saintly Jade Cleric');
    expect(stripTitleBrackets(' [El☆Número 1] ')).toBe('El☆Número 1');
    expect(stripTitleBrackets('No Brackets')).toBe('No Brackets');
  });
});

describe('buildUmas', () => {
  it('emits one global record per cutover outfit, sorted by numeric umaId', () => {
    const records = buildUmas({ umas: cutover, gametoraChars: gt, dataVersion: DV });
    expect(records).toEqual([
      {
        umaId: '100101',
        charaId: '1001',
        nameEn: 'Special Week',
        server: 'global',
        dataVersion: DV,
        epithet: 'Special Dreamer',
      },
      {
        umaId: '100102',
        charaId: '1001',
        nameEn: 'Special Week',
        server: 'global',
        dataVersion: DV,
        epithet: "Hopp'n♪Happy Heart",
      },
      {
        umaId: '100201',
        charaId: '1002',
        nameEn: 'Silence Suzuka',
        server: 'global',
        dataVersion: DV,
        epithet: 'Innocent Silence',
      },
    ]);
    // The JP-only gametora entry (110101) is excluded: released = in the cutover.
    expect(records.some((r) => r.umaId === '110101')).toBe(false);
  });

  it('keeps the cutover (master.mdb official EN) name over GameTora house style', () => {
    const records = buildUmas({
      umas: { '1015': { name: ['', 'T.M. Opera O'], outfits: { '101501': '[O Sole Suo!]' } } },
      gametoraChars: [
        { card_id: 101501, char_id: 1015, name_en: 'TM Opera O', title_en_gl: '[O Sole Suo!]' },
      ],
      dataVersion: DV,
    });
    expect(records[0]?.nameEn).toBe('T.M. Opera O');
  });

  it('enforces charaId = floor(umaId/100) (provenance §5 Parent.umaId convention)', () => {
    expect(() =>
      buildUmas({
        umas: { '1001': { name: ['', 'Special Week'], outfits: { '100201': '[X]' } } },
        gametoraChars: gt,
        dataVersion: DV,
      }),
    ).toThrow(/floor\(umaId\/100\)/);
  });

  it('fails the build when the two official-EN epithet sources disagree (drift oracle)', () => {
    expect(() =>
      buildUmas({
        umas: { '1001': { name: ['', 'Special Week'], outfits: { '100101': '[Renamed Dreamer]' } } },
        gametoraChars: gt,
        dataVersion: DV,
      }),
    ).toThrow(/epithet disagrees/);
  });

  it('rejects a chara with no EN name', () => {
    expect(() =>
      buildUmas({
        umas: { '1001': { name: ['スペシャルウィーク', ''], outfits: { '100101': '[X]' } } },
        gametoraChars: [],
        dataVersion: DV,
      }),
    ).toThrow(/no EN name/);
  });
});
