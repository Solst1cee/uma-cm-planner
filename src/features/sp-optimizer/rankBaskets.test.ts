/**
 * Tests for the M2 sim orchestrator. The simulator is injected as a fake so
 * the test is deterministic and needs no engine; the real default wires to
 * @/sim (evalSkillDelta / runPlannerCompare). Sim is the arbiter; the proxy
 * only narrows (spec §4).
 */
import { describe, expect, it } from 'vitest';

import type { CaptureBundle } from '@/core/spOptimizer';
import { type SimDeps, rankBaskets, toSimBuild } from '@/features/sp-optimizer/rankBaskets';
import bundle from '@/core/__fixtures__/m2/basic-screen.json';

function fakeDeps(): SimDeps {
  const val = (id: string) => Number(id.slice(-1));
  return {
    skillDelta: (_b, _r, skillId) => stat(val(skillId)),
    planner: (_b, _r, skills) =>
      stat(skills.reduce((s, id) => s + val(id), 0) - (skills.length > 1 ? 0.5 : 0)),
  };
}
function stat(mean: number) {
  return { mean, median: mean, min: mean, max: mean, nsamples: 64, results: [mean] };
}

describe('toSimBuild', () => {
  it('maps a BuildContext + skill set to a SimBuild', () => {
    const sb = toSimBuild((bundle as CaptureBundle).context, ['200332']);
    expect(sb.stats.spd).toBe(1150);
    expect(sb.strategy).toBe('pace');
    expect(sb.skills).toEqual(['200332']);
  });
});

describe('rankBaskets', () => {
  it('returns up to 3 diverse baskets ranked on simulated combined Δ-lengths', () => {
    const result = rankBaskets(bundle as CaptureBundle, { deps: fakeDeps() });
    expect(result.mode).toBe('exact');
    expect(result.baskets.length).toBeGreaterThan(0);
    expect(result.baskets.length).toBeLessThanOrEqual(3);
    const scores = result.baskets.map((b) => b.score);
    expect(scores).toEqual([...scores].sort((a, z) => z - a));
  });

  it('is deterministic for the same bundle + seed', () => {
    const a = rankBaskets(bundle as CaptureBundle, { deps: fakeDeps() });
    const b = rankBaskets(bundle as CaptureBundle, { deps: fakeDeps() });
    expect(a.baskets).toEqual(b.baskets);
  });

  it('counts pinned and chosen skills in spUsed; owned skills stay free', () => {
    const b: CaptureBundle = {
      schemaVersion: 1, source: 'manual', capturedAt: '2026-06-15T00:00:00.000Z',
      server: 'global', dataVersion: 'global-271be4dc', seed: 1,
      context: {
        umaId: '', stats: { spd: 1000, sta: 800, pow: 800, gut: 400, wit: 600 },
        aptitudes: { distance: 'A', surface: 'A', strategy: 'A' }, strategy: 'pace',
        courseId: '10101', spBudget: 300, ownedSkills: ['100'], pinned: ['200332'],
        candidates: [
          { skillId: '200332', rarity: 'white', screenSpCost: 100 }, // pinned, costs SP
          { skillId: '200341', rarity: 'white', screenSpCost: 50 },
        ],
      },
    };
    const result = rankBaskets(b, { deps: fakeDeps() });
    expect(result.baskets.length).toBeGreaterThan(0);
    for (const basket of result.baskets) {
      // every basket includes the pinned 200332 (100 SP); 200341 adds 50.
      const expected = basket.skills.includes('200341') ? 150 : 100;
      expect(basket.spUsed).toBe(expected);
      expect(basket.spLeft).toBe(300 - expected);
    }
  });
});

// `bundle` (the default fixture import above) is a full real-data capture; the
// candidate-row tests below need a small hand-built one, so this helper is
// named distinctly to avoid shadowing that import.
function candidateBundle(over: Partial<CaptureBundle['context']> = {}): CaptureBundle {
  return {
    schemaVersion: 1, source: 'manual', capturedAt: 'x', server: 'global', dataVersion: 'v', seed: 1,
    context: {
      umaId: 'u', stats: { spd: 1000, sta: 800, pow: 700, gut: 400, wit: 900 },
      aptitudes: { distance: 'A', surface: 'A', strategy: 'A' }, strategy: 'pace',
      courseId: '10906', spBudget: 300, ownedSkills: [], pinned: [],
      candidates: [
        { skillId: 'a', rarity: 'white', screenSpCost: 100, hintLevel: 0 },
        { skillId: 'b', rarity: 'white', screenSpCost: 100 },
      ],
      ...over,
    },
  };
}
// Deterministic fake sim: ΔL = 1 for 'a', 2 for 'b'; basket score = sum of member ΔL.
const candidateDeps: SimDeps = {
  skillDelta: (_b, _r, id) => {
    const mean = id === 'a' ? 1 : 2;
    return { mean, min: 0, max: 0, median: 0, nsamples: 5, results: [mean] };
  },
  planner: (_b, _r, skills) => {
    const mean = skills.reduce((s, id) => s + (id === 'a' ? 1 : 2), 0);
    return { mean, min: 0, max: 0, median: 0, nsamples: 5, results: [mean] };
  },
};

describe('rankBaskets candidate rows', () => {
  it('returns one CandidateRow per candidate with deltaL + lPerSp + pinned', () => {
    const r = rankBaskets(candidateBundle({ pinned: ['a'] }), { deps: candidateDeps });
    expect(r.candidates.map((c) => c.skillId).sort()).toEqual(['a', 'b']);
    const a = r.candidates.find((c) => c.skillId === 'a')!;
    expect(a.deltaL).toBe(1);              // measured vs owned base even though pinned
    expect(a.lPerSp).toBeCloseTo(10);      // 1 / 100 * 1000
    expect(a.pinned).toBe(true);
    expect(r.candidates.find((c) => c.skillId === 'b')!.pinned).toBe(false);
  });
  it('reports a greedyScore', () => {
    const r = rankBaskets(candidateBundle(), { deps: candidateDeps });
    expect(typeof r.greedyScore).toBe('number');
    expect(r.greedyScore).toBeGreaterThan(0);
  });
});
