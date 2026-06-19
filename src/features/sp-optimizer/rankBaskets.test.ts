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
      server: 'global', dataVersion: 'global-76214c82', seed: 1,
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
