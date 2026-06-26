import { describe, expect, it } from 'vitest';
import type { CmPlan, SkillRecord, UmaRecord } from '@/core/types';
import {
  addBlueSpark,
  availableBlueStats,
  blueSparkRows,
  blueTotal,
  deleteBlueSpark,
  midRunSparkRows,
  pinkSparkRows,
  pinkSparkTotal,
  setBlueStars,
  wishlistRows,
  wishlistSummary,
} from './planTargets';

const plan = (over: Partial<CmPlan> = {}): CmPlan =>
  ({
    id: 'p1', name: 'x', planNumber: 1,
    cmRef: { kind: 'cm', cmId: 'CM15', cmNumber: 15, courseId: '10906', surface: 'turf', distance: 2200 },
    scenarioId: 4, umaId: '106801', uniqueSkillId: '', role: 'ace', strategy: 'late',
    statProfile: { stats: { spd: 1, sta: 1, pow: 1, gut: 1, wit: 1 }, mood: 2 },
    sparkGoals: { pink: [], blue: {} }, wishlist: [], parents: {},
    patch: { version: 'x' }, server: 'global', dataVersion: 'x', ...over,
  }) as CmPlan;

const skill = (over: Partial<SkillRecord>): SkillRecord =>
  ({
    skillId: '1', nameEn: 'Skill', nameJp: '', baseSpCost: 0, rarity: 'white', iconId: '1',
    conditions: '', server: 'global', dataVersion: 'x', ...over,
  }) as SkillRecord;

describe('blue spark goals', () => {
  it('lists present blue goals in canonical stat order', () => {
    const p = plan({ sparkGoals: { pink: [], blue: { pow: 3, sta: 6 } } });
    expect(blueSparkRows(p)).toEqual([
      { stat: 'sta', label: 'Stamina', stars: 6 },
      { stat: 'pow', label: 'Power', stars: 3 },
    ]);
  });

  it('availableBlueStats excludes stats that already have a goal', () => {
    const p = plan({ sparkGoals: { pink: [], blue: { sta: 6 } } });
    expect(availableBlueStats(p).map((s) => s.stat)).toEqual(['spd', 'pow', 'gut', 'wit']);
  });

  it('setBlueStars clamps against the shared 18★ total budget (not per stat)', () => {
    expect(setBlueStars(plan(), 'sta', -3).sparkGoals.blue.sta).toBe(0);
    // empty plan → a single stat can take the whole budget
    expect(setBlueStars(plan(), 'sta', 25).sparkGoals.blue.sta).toBe(18);
    // 10 already spent on guts → sta is capped at the remaining 8
    const p = plan({ sparkGoals: { pink: [], blue: { gut: 10 } } });
    expect(setBlueStars(p, 'sta', 12).sparkGoals.blue.sta).toBe(8);
  });

  it('blueTotal sums all stat goals', () => {
    expect(blueTotal(plan({ sparkGoals: { pink: [], blue: { sta: 6, pow: 3 } } }))).toBe(9);
  });

  it('addBlueSpark adds at 1★, no-ops when present, and no-ops when the budget is full', () => {
    const added = addBlueSpark(plan(), 'pow');
    expect(added.sparkGoals.blue.pow).toBe(1);
    expect(addBlueSpark(added, 'pow', 5).sparkGoals.blue.pow).toBe(1);
    const full = plan({ sparkGoals: { pink: [], blue: { sta: 18 } } });
    expect(addBlueSpark(full, 'pow').sparkGoals.blue.pow).toBeUndefined();
  });

  it('deleteBlueSpark removes the stat goal', () => {
    const p = plan({ sparkGoals: { pink: [], blue: { sta: 6, pow: 3 } } });
    expect(deleteBlueSpark(p, 'sta').sparkGoals.blue).toEqual({ pow: 3 });
  });
});

describe('pinkSparkRows', () => {
  const uma: UmaRecord = {
    umaId: '106801', charaId: '1068', nameEn: 'Mejiro McQueen',
    baseAptitudes: {
      surface: { turf: 'A', dirt: 'G' },
      distance: { short: 'C', mile: 'B', medium: 'C', long: 'A' },
      strategy: { front: 'C', pace: 'B', late: 'B', end: 'B' },
    },
    server: 'global', dataVersion: 'x',
  };

  it('shows required career-start stars for the plan aptitudes, omitting already-met ones', () => {
    // turf · 2200 (medium) · late, default targets surface A / distance S / strategy A:
    //  - Turf: base A ≥ A → 0 stars (omitted)
    //  - Medium: base C → S (cap A = +2 steps) → 4 stars
    //  - Late Surger: base B → A (+1 step) → 1 star
    expect(pinkSparkRows(plan(), uma)).toEqual([
      { label: 'Medium', stars: 4 },
      { label: 'Late Surger', stars: 1 },
    ]);
  });

  it('returns [] when no uma is resolved', () => {
    expect(pinkSparkRows(plan(), null)).toEqual([]);
  });

  it('pinkSparkTotal sums required stars', () => {
    expect(pinkSparkTotal(plan(), uma)).toBe(5); // Medium 4 + Late Surger 1
  });

  it('midRunSparkRows lists aptitudes still needing in-run procs (e.g. Medium C → S)', () => {
    expect(midRunSparkRows(plan(), uma)).toEqual([{ label: 'Medium', steps: 1 }]);
  });
});

describe('wishlist', () => {
  const skillById = new Map<string, SkillRecord>([
    ['100', skill({ skillId: '100', nameEn: 'Arc Maestro', baseSpCost: 160, rarity: 'gold' })],
    ['200', skill({ skillId: '200', nameEn: 'Professor of Curvature', baseSpCost: 160, rarity: 'white' })],
  ]);

  it('resolves wishlist rows with name, SP, and gold flag', () => {
    const p = plan({ wishlist: [
      { skillId: '100', priority: 1, source: 'targeted' },
      { skillId: '200', priority: 2, source: 'targeted' },
    ] });
    expect(wishlistRows(p, skillById)).toEqual([
      { skillId: '100', name: 'Arc Maestro', sp: 160, gold: true },
      { skillId: '200', name: 'Professor of Curvature', sp: 160, gold: false },
    ]);
  });

  it('falls back gracefully for an unknown skill id', () => {
    const p = plan({ wishlist: [{ skillId: '999', priority: 1, source: 'targeted' }] });
    expect(wishlistRows(p, skillById)[0]).toEqual({ skillId: '999', name: 'Skill 999', sp: 0, gold: false });
  });

  it('summary counts skills and sums SP', () => {
    const p = plan({ wishlist: [
      { skillId: '100', priority: 1, source: 'targeted' },
      { skillId: '200', priority: 2, source: 'targeted' },
    ] });
    expect(wishlistSummary(p, skillById)).toEqual({ count: 2, totalSp: 320 });
  });
});
