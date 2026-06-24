import { expect, test, describe } from 'vitest';
import { hpStats, histogram, requiredStaminaForSpurt } from './staminaSpurt';

describe('hpStats', () => {
  test('min/max/median/mean', () => {
    expect(hpStats([10, 0, 5, 20])).toEqual({ min: 0, max: 20, median: 7.5, mean: 8.75 });
  });
  test('empty', () => {
    expect(hpStats([])).toEqual({ min: 0, max: 0, median: 0, mean: 0 });
  });
});

describe('histogram', () => {
  test('bins span [0, max] and count all samples', () => {
    const h = histogram([0, 1, 2, 3, 4], 2); // max 4 → bins [0,2),[2,4]
    expect(h).toHaveLength(2);
    expect(h.reduce((s, b) => s + b.count, 0)).toBe(5);
    expect(h[0]!.x0).toBe(0);
    expect(h[1]!.x1).toBeCloseTo(4);
  });
});

describe('requiredStaminaForSpurt', () => {
  // monotonic stub: spurt rate rises 0..100 as sta rises; crosses 95 at sta=775.
  // finalHp tracks the probed stamina so we can assert it's captured at the chosen sta.
  const probe = async (sta: number) => ({
    rate: Math.max(0, Math.min(100, (sta - 300) / 5)),
    finalHp: [sta],
  });
  test('finds the smallest sta meeting the threshold and returns HP at that sta', async () => {
    const r = await requiredStaminaForSpurt(probe, 95, { lo: 300, hi: 1200 });
    expect(r.reachable).toBe(true);
    expect(r.sta).toBeGreaterThanOrEqual(775); // 95 at (sta-300)/5 → sta=775
    expect(r.sta).toBeLessThanOrEqual(785);
    expect(r.rate).toBeGreaterThanOrEqual(95);
    expect(r.finalHp).toEqual([r.sta]); // HP sampled AT the chosen stamina
  });
  test('unreachable when even hi falls short', async () => {
    const r = await requiredStaminaForSpurt(async () => ({ rate: 50, finalHp: [] }), 95, { lo: 300, hi: 1200 });
    expect(r.reachable).toBe(false);
    expect(r.sta).toBe(1200);
  });
  test('already met at lo', async () => {
    const r = await requiredStaminaForSpurt(async () => ({ rate: 99, finalHp: [] }), 95, { lo: 300, hi: 1200 });
    expect(r.reachable).toBe(true);
    expect(r.sta).toBe(300);
  });
});
