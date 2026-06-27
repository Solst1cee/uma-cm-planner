import { describe, expect, it } from 'vitest';
import sample from './__fixtures__/umaextractor-sample.json';
import { parseUmaExtractor, ratingFromRank, type ParseDeps } from './umaExtractor';

// Stub resolver: white group base → a deterministic white skill id (groupBase+1).
const deps: ParseDeps = { resolveWhiteSkill: (g) => String(g + 1) };

describe('parseUmaExtractor', () => {
  it('maps a veteran to a Parent with blue + pink main sparks', () => {
    const { parents } = parseUmaExtractor(sample, deps);
    expect(parents).toHaveLength(1);
    const p = parents[0]!;
    expect(p.id).toBe('47'); // trained_chara_id
    expect(p.umaId).toBe('101501'); // card_id
    expect(p.source).toBe('mine');
    expect(p.importSource).toBe('umaextractor');
    expect(p.blueSpark).toEqual({ stat: 'sta', stars: 2 }); // factor 202
    expect(p.pinkSpark).toEqual({ aptitude: 'pace', stars: 1 }); // factor 2201
    expect(p.stats).toEqual({ spd: 991, sta: 677, pow: 632, gut: 398, wit: 450 });
    expect(p.rankScore).toBe(9347); // raw rank_score kept for display
  });

  it('decodes white sparks via the injected resolver and skips race/scenario', () => {
    const p = parseUmaExtractor(sample, deps).parents[0]!;
    // factor 2003601 → groupBase 200360 → resolver → '200361'
    expect(p.whiteSparks).toContainEqual({ skillId: '200361', stars: 1 });
    // race (1001202/1001701), scenario (3000101), green (10150102) are NOT white sparks
    expect(p.whiteSparks.every((w) => w.skillId === '200361')).toBe(true);
  });

  it('stores the green/inherited-unique spark as the decoded unique id', () => {
    const p = parseUmaExtractor(sample, deps).parents[0]!;
    // factor 10150102 → base-outfit unique 100001+150 = 100151, star 2
    expect(p.greenSpark).toEqual({ skillId: '100151', stars: 2 });
  });

  it('reads grandparents from succession positions 10 and 20', () => {
    const p = parseUmaExtractor(sample, deps).parents[0]!;
    expect(p.grandparents).toHaveLength(2);
    const [g1, g2] = p.grandparents!;
    expect(g1!.umaId).toBe('100701'); // position 10 card_id
    expect(g2!.umaId).toBe('100601'); // position 20 card_id
    expect(g1!.blueSpark).toEqual({ stat: 'sta', stars: 1 }); // factor 201
  });

  it('maps win_saddle_id_array to wonRaces', () => {
    const p = parseUmaExtractor(sample, deps).parents[0]!;
    expect(p.wonRaces).toEqual(['6', '10', '11', '13', '14', '18', '26']);
  });

  it('accepts the {trained_chara_array} envelope and wiz/wisdom dualities', () => {
    const wrapped = { trained_chara_array: sample };
    expect(parseUmaExtractor(wrapped, deps).parents).toHaveLength(1);
  });

  it('returns empty without throwing on malformed input', () => {
    expect(parseUmaExtractor(null, deps)).toEqual({ parents: [], skipped: 0 });
    expect(parseUmaExtractor({ nope: 1 }, deps)).toEqual({ parents: [], skipped: 0 });
    expect(parseUmaExtractor([{ trained_chara_id: 1 }], deps).skipped).toBe(1); // no card_id
  });

  it('ratingFromRank maps known ranks', () => {
    expect(ratingFromRank(12)).toBe('B+');
    expect(ratingFromRank(13)).toBe('A');
  });
});
