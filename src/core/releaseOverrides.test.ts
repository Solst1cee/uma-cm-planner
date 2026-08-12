import { describe, expect, it } from 'vitest';
import { availabilityTier, visibleAtHorizon } from '@/core/availability';
import umas from '../../public/data/umas.json';
import cards from '../../public/data/support_cards.json';
import skills from '../../public/data/skills.json';

const TODAY = '2026-08-12';
const CM18 = '2026-09-01'; // CM18 finals — the cm-horizon cutoff a plan would use
const find = (a: any[], k: string, id: string) => a.find((x) => String(x[k]) === id);

describe('August Global releases resolve correctly after the release overrides', () => {
  it('elapsed announced dates are now-visible at the default Current horizon', () => {
    const live: Array<[string, any]> = [
      ['Yukino Bijin', find(umas as any[], 'umaId', '102901')],
      ['Daiichi Ruby SSR', find(cards as any[], 'cardId', '30114')],
      ['K.S. Miracle SR', find(cards as any[], 'cardId', '20051')],
      ['Snow Bright unique', find(skills as any[], 'skillId', '100291')],
    ];
    for (const [name, r] of live) {
      expect(r, name).toBeTruthy();
      expect(availabilityTier(r, TODAY, TODAY), name).toBe('now');
      expect(visibleAtHorizon(availabilityTier(r, TODAY, TODAY), { kind: 'current' }), name).toBe(true);
    }
  });

  it('future announced dates are upcoming — hidden at Current, visible at a CM18 horizon', () => {
    const soon: Array<[string, any]> = [
      ['Agnes Digital Halloween', find(umas as any[], 'umaId', '101902')],
      ['Aston Machan', find(umas as any[], 'umaId', '108701')],
      ['Mejiro Palmer SSR', find(cards as any[], 'cardId', '30115')],
      ['Silent Letter unique', find(skills as any[], 'skillId', '100871')],
    ];
    for (const [name, r] of soon) {
      expect(availabilityTier(r, TODAY, TODAY), name).not.toBe('now');
      expect(availabilityTier(r, CM18, TODAY), name).toBe('upcoming');
      expect(visibleAtHorizon(availabilityTier(r, CM18, TODAY), { kind: 'current' }), name).toBe(false);
      expect(
        visibleAtHorizon(availabilityTier(r, CM18, TODAY), { kind: 'cm', cmNumber: 18 }),
        name,
      ).toBe(true);
    }
  });

  it('an untouched projected JP record stays hidden even though its date elapsed', () => {
    // 30145 Tanino Gimlet — deliberately left predicted (sources hedge "expected").
    const r = find(cards as any[], 'cardId', '30145');
    expect(r.releaseDatePredicted).toBe(true);
    expect(availabilityTier(r, TODAY, '2026-12-31')).not.toBe('now');
  });
});
