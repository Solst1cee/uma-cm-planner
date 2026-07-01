import { describe, expect, it } from 'vitest';
import cards from '@/vendor/uma-tiers/gl';
import { processCards } from '@/vendor/uma-tiers/tierlist-calc';
import { getDefaultScenario } from '@/vendor/uma-tiers/scenarios';

describe('vendored uma-tiers', () => {
  it('loads 1130 card rows (226 ids × 5 LBs)', () => {
    expect(cards).toHaveLength(1130);
    expect(new Set(cards.map((c) => c.id)).size).toBe(226);
  });

  it('default GL scenario is MANT with bondPerDay 10', () => {
    const s = getDefaultScenario('gl');
    expect(s.general.bondPerDay).toBe(10);
    expect(s.speed.stats).toHaveLength(7);
  });

  it('processCards scores a Speed deck and returns rows sorted desc', () => {
    const scenario = getDefaultScenario('gl');
    const weights = { ...scenario.speed, ...scenario.general };
    const speedRows = cards.filter((c) => c.type === 0);
    const out = processCards(speedRows, weights, []);
    expect(out.length).toBeGreaterThan(0);
    const first = out[0]!;
    const last = out[out.length - 1]!;
    expect(first.score).toBeGreaterThanOrEqual(last.score);
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('lb');
  });
});
