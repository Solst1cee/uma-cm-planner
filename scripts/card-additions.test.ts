import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { SupportCardRecord } from '@/core/types';
import { loadCardAdditions } from './lib/card-additions';

const dir = mkdtempSync(join(tmpdir(), 'card-additions-'));
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

let fileCount = 0;
function writeAdditions(records: unknown[]): string {
  const path = join(dir, `additions-${fileCount++}.json`);
  writeFileSync(path, JSON.stringify({ _comment: 'test', records }), 'utf8');
  return path;
}

function validRecord(overrides: Partial<SupportCardRecord> = {}): Record<string, unknown> {
  return {
    _comment: 'doc only',
    cardId: '30102',
    nameEn: '[Twinkle in Your Eyes ∞]',
    charName: 'El Condor Pasa',
    rarity: 'SSR',
    type: 'guts',
    perLevel: [0, 1, 2, 3, 4].map((lb) => ({
      limitBreak: lb,
      hintFrequency: 20,
      hintLevels: 1,
      specialtyPriority: 20,
    })),
    skills: [
      { skillId: '200132', sourceType: 'hint_pool', hintLevels: 1 },
      { skillId: '200581', sourceType: 'chain' },
    ],
    hintPoolSize: 1,
    server: 'global',
    dataVersion: 'global-mdb-10006400',
    ...overrides,
  };
}

const opts = {
  existingCardIds: new Set(['30028']),
  releasedSkillIds: new Set(['200132', '200581']),
};

describe('loadCardAdditions', () => {
  it('returns [] when the file does not exist (mechanism is optional)', () => {
    expect(loadCardAdditions(join(dir, 'nope.json'), opts)).toEqual([]);
  });

  it('loads a valid record and strips _-prefixed documentation keys', () => {
    const out = loadCardAdditions(writeAdditions([validRecord()]), opts);
    expect(out).toHaveLength(1);
    expect(out[0]?.cardId).toBe('30102');
    expect((out[0] as unknown as Record<string, unknown>)['_comment']).toBeUndefined();
  });

  it('rejects a skill id that is not Global-released (P4)', () => {
    const record = validRecord({
      skills: [{ skillId: '999999', sourceType: 'chain' }],
      hintPoolSize: 0,
    });
    expect(() => loadCardAdditions(writeAdditions([record]), opts)).toThrow(/not a Global-released skill id/);
  });

  it('rejects hintLevels on non-hint_pool entries (types.ts contract)', () => {
    const record = validRecord({
      skills: [{ skillId: '200581', sourceType: 'chain', hintLevels: 1 }],
      hintPoolSize: 0,
    });
    expect(() => loadCardAdditions(writeAdditions([record]), opts)).toThrow(/hintLevels is hint_pool-only/);
  });

  it('rejects a wrong derived hintPoolSize', () => {
    expect(() => loadCardAdditions(writeAdditions([validRecord({ hintPoolSize: 5 })]), opts)).toThrow(
      /hintPoolSize 5 != hint_pool entry count 1/,
    );
  });

  it('rejects malformed perLevel (must be exactly LB 0-4)', () => {
    const record = validRecord();
    (record['perLevel'] as unknown[]).pop();
    expect(() => loadCardAdditions(writeAdditions([record]), opts)).toThrow(/exactly 5 entries/);
  });

  it('rejects ids the generator already emitted (stale addition after a pin bump)', () => {
    expect(() => loadCardAdditions(writeAdditions([validRecord({ cardId: '30028' })]), opts)).toThrow(
      /already emitted by the generator/,
    );
  });

  it('rejects duplicate ids within the file', () => {
    expect(() => loadCardAdditions(writeAdditions([validRecord(), validRecord()]), opts)).toThrow(
      /duplicate id in file/,
    );
  });
});
