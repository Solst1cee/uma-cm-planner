import { describe, it, expect } from 'vitest';
import { buildJpCards } from './build-cards';
import type { GtCard } from './lib/upstream-types';
import { buildForesightCalibration } from './lib/foresight-build';

const cal = buildForesightCalibration(
  [{ cmNumber: 15, cupName: 'Cancer Cup', jpDate: '2022-07-14' }, { cmNumber: 14, cupName: 'Gemini Cup', jpDate: '2022-06-14' }],
  [{ cmNumber: 15, global: '2026-06-24' }, { cmNumber: 14, global: '2026-06-04' }],
);
// Minimal gametora rows: one JP-only SSR (in master? no), one already-Global (skipped).
const gt: GtCard[] = [
  { support_id: 90001, rarity: 3, type: 'intelligence', char_name: 'Test Uma',
    title_ja: 'JPカード', effects: [[18, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30]],
    hints: { hint_skills: [200001, 999999] }, event_skills: [200002], release: '2022-08-13' },
  { support_id: 10001, rarity: 3, type: 'speed', char_name: 'Global Uma', effects: [[18, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20]], release: '2020-01-01', release_en: '2025-06-26' },
];

describe('buildJpCards', () => {
  const out = buildJpCards({
    gametoraCards: gt,
    masterIds: new Set([10001]), // 10001 is a Global master card → skipped
    eventSources: {},
    releasedSkillIds: new Set(['200001', '200002']), // 999999 is JP-ahead → dropped
    cal,
    dataVersion: 'test',
  });
  it('emits only gametora cards absent from the master set, as server:jp', () => {
    expect(out).toHaveLength(1);
    expect(out[0]!.cardId).toBe('90001');
    expect(out[0]!.server).toBe('jp');
  });
  it('maps rarity/type (intelligence→wit) and name fallback', () => {
    expect(out[0]!.rarity).toBe('SSR');
    expect(out[0]!.type).toBe('wit');
    expect(out[0]!.nameEn).toBe('JPカード'); // title_en absent → title_ja
  });
  it('drops JP-ahead skills, keeps released ones', () => {
    const ids = out[0]!.skills.map((s) => s.skillId);
    expect(ids).toContain('200001'); // released hint
    expect(ids).toContain('200002'); // released event
    expect(ids).not.toContain('999999'); // JP-ahead hint dropped
  });
  it('projects the Global releaseDate as predicted', () => {
    expect(out[0]!.releaseDate).toBeDefined();
    expect(out[0]!.releaseDatePredicted).toBe(true);
  });
});
