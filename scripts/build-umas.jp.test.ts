import { describe, it, expect } from 'vitest';
import { buildJpUmas } from './build-umas';
import type { GtCharacterCard } from './lib/upstream-types';
import { buildForesightCalibration } from './lib/foresight-build';

const cal = buildForesightCalibration(
  [{ cmNumber: 15, cupName: 'Cancer Cup', jpDate: '2022-07-14' }, { cmNumber: 14, cupName: 'Gemini Cup', jpDate: '2022-06-14' }],
  [{ cmNumber: 15, global: '2026-06-24' }, { cmNumber: 14, global: '2026-06-04' }],
);
const chars: GtCharacterCard[] = [
  { card_id: 100103, char_id: 1001, name_en: 'Special Week', title: 'Special Dreamer',
    aptitude: ['A','G','G','C','A','A','A','B','C','G'], stat_bonus: [10,0,10,0,10], release: '2022-08-13' },
  { card_id: 100101, char_id: 1001, name_en: 'Special Week', title: 'Base', // in master set → skipped
    aptitude: ['A','G','G','C','A','A','A','B','C','G'], stat_bonus: [10,0,10,0,10], release: '2020-01-01', release_en: '2025-06-26' },
];

describe('buildJpUmas', () => {
  const out = buildJpUmas({ gametoraChars: chars, masterUmaIds: new Set(['100101']), cal, dataVersion: 'test' });
  it('emits gametora chars absent from the master set as server:jp', () => {
    expect(out).toHaveLength(1);
    expect(out[0]!.umaId).toBe('100103');
    expect(out[0]!.server).toBe('jp');
    expect(out[0]!.charaId).toBe('1001');
  });
  it('projects the release date (predicted) + maps name/epithet/aptitudes', () => {
    expect(out[0]!.releaseDate).toBeDefined();
    expect(out[0]!.releaseDatePredicted).toBe(true);
    expect(out[0]!.nameEn).toBe('Special Week');
    expect(out[0]!.epithet).toBe('Special Dreamer');
    expect(out[0]!.baseAptitudes).toBeDefined();
    expect(out[0]!.statGrowth).toBeDefined();
  });
});
