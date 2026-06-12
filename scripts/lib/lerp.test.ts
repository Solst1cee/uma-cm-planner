/**
 * Passive-matrix lerp tests — docs/mechanics-notes.md §9.
 * Matrix rows below are copied verbatim from the pinned upstream
 * gametora/support-cards.json (commit c1fa2107, retrieved 2026-06-12), which
 * is byte-identical to GLOBAL master.mdb support_card_effect_table.
 */
import { describe, expect, it } from 'vitest';
import { buildPerLevel, LEVEL_CAPS, passiveValueAt } from './lerp';

// Card 30001 [The Brightest Star in Japan!] Special Week (SSR) — effect 18
// (Hint Frequency). Worked example from mechanics-notes §9 verification:
// SSR caps 30/35/40/45/50 → 30 / 33 / 36 / 40 / 40.
const CARD_30001_HINT_FREQ = [-1, -1, 5, -1, -1, 30, 30, -1, -1, 40, -1];

// Card 10021 [Tracen Academy] Tazuna (R) — effect 14 (Initial Friendship
// Gauge). Cross-checked against Tachyons-lab's published per-LB table
// (lerp_levels reference impl, mechanics-notes §9): 20/21/22/23/25.
const CARD_10021_EFFECT_14 = [10, -1, -1, -1, 20, -1, -1, -1, 25, -1, -1];

describe('passiveValueAt', () => {
  it('reproduces the mechanics-notes §9 worked example (card 30001 hint frequency, SSR caps)', () => {
    const atCaps = LEVEL_CAPS.SSR.map((cap) => passiveValueAt(CARD_30001_HINT_FREQ, cap));
    expect(atCaps).toEqual([30, 33, 36, 40, 40]);
  });

  it('matches the Tachyons-lab per-LB oracle for an R card (card 10021 effect 14)', () => {
    const atCaps = LEVEL_CAPS.R.map((cap) => passiveValueAt(CARD_10021_EFFECT_14, cap));
    expect(atCaps).toEqual([20, 21, 22, 23, 25]);
  });

  it('returns 0 below the first specified breakpoint (not yet active)', () => {
    expect(passiveValueAt(CARD_30001_HINT_FREQ, 5)).toBe(0);
    expect(passiveValueAt([-1, -1, -1, -1, -1, -1, -1, 1, -1, -1, -1], 30)).toBe(0);
  });

  it('carries the last specified value forward', () => {
    expect(passiveValueAt(CARD_30001_HINT_FREQ, 50)).toBe(40);
  });

  it('floors interpolated values (integer floor rule)', () => {
    // Between lv45=40 and... use 30001 row: between lv30 (30) and lv45 (40),
    // lv35 → 33.33… → 33.
    expect(passiveValueAt(CARD_30001_HINT_FREQ, 35)).toBe(33);
  });

  it('returns 0 for a fully unspecified row', () => {
    expect(passiveValueAt(new Array<number>(11).fill(-1), 50)).toBe(0);
  });
});

describe('buildPerLevel', () => {
  it('evaluates effects 17/18/19 at each LB cap and defaults missing rows to 0', () => {
    const effects = [
      [18, ...CARD_30001_HINT_FREQ],
      [17, -1, -1, 1, -1, -1, 2, 2, -1, -1, 2, -1],
      // no row 19
    ];
    const perLevel = buildPerLevel(effects, 'SSR');
    expect(perLevel).toHaveLength(5);
    expect(perLevel.map((p) => p.limitBreak)).toEqual([0, 1, 2, 3, 4]);
    expect(perLevel.map((p) => p.hintFrequency)).toEqual([30, 33, 36, 40, 40]);
    expect(perLevel.map((p) => p.hintLevels)).toEqual([2, 2, 2, 2, 2]);
    expect(perLevel.map((p) => p.specialtyPriority)).toEqual([0, 0, 0, 0, 0]);
  });
});
