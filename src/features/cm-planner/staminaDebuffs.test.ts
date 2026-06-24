import { describe, expect, it } from 'vitest';
import { STAMINA_DEBUFF, buildInjectedDebuffs } from './staminaDebuffs';

describe('staminaDebuffs', () => {
  describe('STAMINA_DEBUFF constants', () => {
    it('has the expected white skill id', () => {
      expect(STAMINA_DEBUFF.white).toBe('201222');
    });

    it('has the expected gold skill id', () => {
      expect(STAMINA_DEBUFF.gold).toBe('201221');
    });
  });

  describe('buildInjectedDebuffs', () => {
    it('returns empty uma1 and uma2 when both counts are 0', () => {
      const result = buildInjectedDebuffs(0, 0, 2000);
      expect(result.uma1).toHaveLength(0);
      expect(result.uma2).toHaveLength(0);
    });

    it('uma2 is always empty', () => {
      const result = buildInjectedDebuffs(2, 1, 2000);
      expect(result.uma2).toHaveLength(0);
    });

    it('buildInjectedDebuffs(2, 1, 2000) returns 3 uma1 entries', () => {
      const result = buildInjectedDebuffs(2, 1, 2000);
      expect(result.uma1).toHaveLength(3);
    });

    it('white debuff entries have correct skill id', () => {
      const result = buildInjectedDebuffs(2, 0, 2000);
      for (const entry of result.uma1) {
        expect(entry.skillId).toBe(STAMINA_DEBUFF.white);
      }
    });

    it('gold debuff entries have correct skill id', () => {
      const result = buildInjectedDebuffs(0, 1, 2000);
      for (const entry of result.uma1) {
        expect(entry.skillId).toBe(STAMINA_DEBUFF.gold);
      }
    });

    it('white entries come before gold entries', () => {
      const result = buildInjectedDebuffs(2, 1, 2000);
      expect(result.uma1[0]!.skillId).toBe(STAMINA_DEBUFF.white);
      expect(result.uma1[1]!.skillId).toBe(STAMINA_DEBUFF.white);
      expect(result.uma1[2]!.skillId).toBe(STAMINA_DEBUFF.gold);
    });

    it('positions are inside the 25%–75% mid-race band (distance=2000)', () => {
      const distance = 2000;
      const result = buildInjectedDebuffs(2, 1, distance);
      for (const entry of result.uma1) {
        expect(entry.position).toBeGreaterThan(distance * 0.25); // > 500
        expect(entry.position).toBeLessThan(distance * 0.75);   // < 1500
      }
    });

    it('positions are evenly spaced for 2 white debuffs on 2000m', () => {
      const distance = 2000;
      const result = buildInjectedDebuffs(2, 0, distance);
      // spread formula: distance*(0.25 + 0.5*(i+1)/(count+1))
      // i=0: 2000*(0.25 + 0.5*1/3) = 2000*0.4167 ≈ 833.33
      // i=1: 2000*(0.25 + 0.5*2/3) = 2000*0.5833 ≈ 1166.67
      expect(result.uma1[0]!.position).toBeCloseTo(2000 * (0.25 + 0.5 * 1 / 3), 5);
      expect(result.uma1[1]!.position).toBeCloseTo(2000 * (0.25 + 0.5 * 2 / 3), 5);
    });

    it('floors fractional counts (1.9 → 1)', () => {
      const result = buildInjectedDebuffs(1.9, 0, 2000);
      expect(result.uma1).toHaveLength(1);
    });

    it('negative counts produce empty array', () => {
      const result = buildInjectedDebuffs(-1, -2, 2000);
      expect(result.uma1).toHaveLength(0);
    });
  });
});
