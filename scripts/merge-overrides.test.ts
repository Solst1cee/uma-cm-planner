import { describe, expect, it } from 'vitest';
import { applyOverrides, type OverrideFile } from './merge-overrides';

interface TestRecord {
  cardId: string;
  nameEn: string;
  skills: Array<{ skillId: string; sourceType: string }>;
  nested: { a: number; b: number };
}

function makeRecords(): TestRecord[] {
  return [
    {
      cardId: '30081',
      nameEn: 'Team Sirius',
      skills: [
        { skillId: '200352', sourceType: 'random_event' },
        { skillId: '200022', sourceType: 'chain' },
      ],
      nested: { a: 1, b: 2 },
    },
    {
      cardId: '30028',
      nameEn: 'Kitasan Black',
      skills: [{ skillId: '200331', sourceType: 'chain' }],
      nested: { a: 3, b: 4 },
    },
  ];
}

function overrideFile(records: OverrideFile['records']): OverrideFile {
  return { _target: 'support_cards', records };
}

describe('applyOverrides', () => {
  it('overrides win: patches scalars and keyed-array elements, leaves the rest intact', () => {
    const out = applyOverrides(
      makeRecords(),
      overrideFile({
        '30081': {
          _comment: 'doc only',
          nameEn: 'Team Sirius (patched)',
          skills: [{ skillId: '200352', sourceType: 'date_event', _comment: 'date event' }],
          nested: { b: 99 },
        },
      }),
      'cardId',
      'test_overrides.json',
    );
    const sirius = out.find((r) => r.cardId === '30081');
    expect(sirius?.nameEn).toBe('Team Sirius (patched)');
    // keyed-array upsert: targeted element re-typed, sibling untouched
    expect(sirius?.skills).toEqual([
      { skillId: '200352', sourceType: 'date_event' },
      { skillId: '200022', sourceType: 'chain' },
    ]);
    // deep object merge: only the overridden key changes
    expect(sirius?.nested).toEqual({ a: 1, b: 99 });
    // untouched record is untouched
    expect(out.find((r) => r.cardId === '30028')).toEqual(makeRecords()[1]);
  });

  it('appends keyed-array elements that do not exist yet', () => {
    const out = applyOverrides(
      makeRecords(),
      overrideFile({
        '30028': { skills: [{ skillId: '999999', sourceType: 'date_event' }] },
      }),
      'cardId',
      'test_overrides.json',
    );
    expect(out.find((r) => r.cardId === '30028')?.skills).toEqual([
      { skillId: '200331', sourceType: 'chain' },
      { skillId: '999999', sourceType: 'date_event' },
    ]);
  });

  it('strips _-prefixed documentation keys from merged output', () => {
    const out = applyOverrides(
      makeRecords(),
      overrideFile({ '30028': { _comment: 'top', nested: { _comment: 'inner', a: 7 } } }),
      'cardId',
      'test_overrides.json',
    );
    const kitasan = out.find((r) => r.cardId === '30028') as unknown as Record<string, unknown>;
    expect(kitasan['_comment']).toBeUndefined();
    expect(kitasan['nested']).toEqual({ a: 7, b: 4 });
  });

  it('throws on unknown record ids (drift detection)', () => {
    expect(() =>
      applyOverrides(
        makeRecords(),
        overrideFile({ '11111': { nameEn: 'ghost' } }),
        'cardId',
        'test_overrides.json',
      ),
    ).toThrow(/unknown cardId "11111"/);
  });

  it('does not mutate the input records', () => {
    const records = makeRecords();
    applyOverrides(
      records,
      overrideFile({ '30081': { skills: [{ skillId: '200352', sourceType: 'date_event' }] } }),
      'cardId',
      'test_overrides.json',
    );
    expect(records).toEqual(makeRecords());
  });
});
