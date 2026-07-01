import { describe, expect, it } from 'vitest';
import { decodeFactor } from './factorDecode';

describe('decodeFactor', () => {
  it('decodes blue stat factors (stat = floor(id/100), star = id%10)', () => {
    expect(decodeFactor(202)).toEqual({ kind: 'blue', stat: 'sta', star: 2 });
    expect(decodeFactor(101)).toEqual({ kind: 'blue', stat: 'spd', star: 1 });
    expect(decodeFactor(103)).toEqual({ kind: 'blue', stat: 'spd', star: 3 });
    expect(decodeFactor(503)).toEqual({ kind: 'blue', stat: 'wit', star: 3 });
  });

  it('decodes pink aptitude factors (surface / style / distance)', () => {
    expect(decodeFactor(1101)).toEqual({ kind: 'pink', aptitude: 'turf', star: 1 });
    expect(decodeFactor(1202)).toEqual({ kind: 'pink', aptitude: 'dirt', star: 2 });
    expect(decodeFactor(2201)).toEqual({ kind: 'pink', aptitude: 'pace', star: 1 });
    expect(decodeFactor(2301)).toEqual({ kind: 'pink', aptitude: 'late', star: 1 });
    expect(decodeFactor(3101)).toEqual({ kind: 'pink', aptitude: 'sprint', star: 1 });
    expect(decodeFactor(3402)).toEqual({ kind: 'pink', aptitude: 'long', star: 2 });
  });

  it('decodes white skill sparks to a group base + star', () => {
    expect(decodeFactor(2003601)).toEqual({ kind: 'white', groupBase: 200360, star: 1 });
  });

  it('decodes green/unique sparks (base + alt outfit variants)', () => {
    // 10[150][1][02] → middle 150, variant 1 (base) → 100001+150 = 100151, star 2
    expect(decodeFactor(10150102)).toEqual({ kind: 'green', uniqueSkillId: '100151', star: 2 });
    // variant 2 (alt outfit) → 110001 + middle
    expect(decodeFactor(10150202)).toEqual({ kind: 'green', uniqueSkillId: '110151', star: 2 });
  });

  it('skips race + scenario sparks and invalid stars', () => {
    expect(decodeFactor(1001202)).toEqual({ kind: 'skip' }); // race spark
    expect(decodeFactor(3000101)).toEqual({ kind: 'skip' }); // scenario spark
    expect(decodeFactor(200)).toEqual({ kind: 'skip' }); // star 0 → invalid
    expect(decodeFactor(0)).toEqual({ kind: 'skip' });
  });
});
