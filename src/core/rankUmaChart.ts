/**
 * M4 §1 "Unique-skill chart" — rank umas by their native unique skill's bashin L
 * on a course, computed FAITHFULLY at each of the 4 running styles on a FIXED
 * reference runner (the basinnhyou model — see the design spec), ranked by the
 * best (max) style. Runner-independent of the user's plan by construction. Per-skill
 * L is the engine's A/B Monte-Carlo (injected skillDelta = evalSkillDelta / SimClient).
 */
import type { BashinStats, Grade, SimBuild, SimRaceParams, Strategy } from '@/sim';
import type { Stat } from '@/core/types';
import { DEAD_L, DISCOVERY_NSAMPLES } from './rankSkillChart';

/** Fixed reference runner. basinnhyou's cmdef baseStats are JP-tuned and exceed
 *  Global's 1200 stat cap, so we clamp to the cap — both CM15/CM16 cmdefs are all
 *  >= 1200, so this lands at all-1200 (a "maxed Global runner"). Aptitudes/mood
 *  mirror basinnhyou's defaults (Distance S / Surface A / Strategy A, +2). A tunable
 *  yardstick — numbers are RELATIVE to it (P3); the only chart-specific value to
 *  maintain, and only when Global raises its cap. Must stay non-zero (a 0-speed
 *  build throws firstPositionInLateRace). */
export const REFERENCE_STATS: Record<Stat, number> =
  { spd: 1200, sta: 1200, pow: 1200, gut: 1200, wit: 1200 };
export const REFERENCE_APTITUDES: { distance: Grade; surface: Grade; strategy: Grade } =
  { distance: 'S', surface: 'A', strategy: 'A' };
export const REFERENCE_MOOD = 2 as const;
export const UMA_CHART_STRATEGIES: Strategy[] = ['front', 'pace', 'late', 'end'];

export interface UmaChartCandidate {
  outfitId: string;
  uniqueSkillId: string | null;
}
export interface UmaStyleL {
  strategy: Strategy;
  L: number;
  nsamples: number;
}
export interface UmaChartRow {
  outfitId: string;
  uniqueSkillId: string | null;
  /** best (max) mean L across styles; null when na. */
  L: number | null;
  bestStrategy: Strategy | null;
  /** faithful per-style values for successfully-simmed styles (for the user to judge). */
  perStyle: UmaStyleL[];
  status: 'live' | 'zero' | 'na';
  nsamples: number;
}
export interface RankUmaChartDeps {
  skillDelta: (b: SimBuild, r: SimRaceParams, skillId: string, n: number, seed?: number)
    => BashinStats | Promise<BashinStats>;
  nsamples?: number;
  seed?: number;
}

function referenceBuild(outfitId: string, strategy: Strategy): SimBuild {
  return {
    umaId: outfitId,
    stats: REFERENCE_STATS,
    strategy,
    aptitudes: REFERENCE_APTITUDES,
    skills: [],
    mood: REFERENCE_MOOD,
  };
}

function rankValue(r: UmaChartRow): number {
  return r.status === 'na' ? -Infinity : (r.L ?? 0);
}

async function rowFor(
  c: UmaChartCandidate,
  race: SimRaceParams,
  deps: RankUmaChartDeps,
  n: number,
): Promise<UmaChartRow> {
  if (!c.uniqueSkillId) {
    return { outfitId: c.outfitId, uniqueSkillId: null, L: null, bestStrategy: null, perStyle: [], status: 'na', nsamples: 0 };
  }
  const perStyle: UmaStyleL[] = [];
  for (const strategy of UMA_CHART_STRATEGIES) {
    let s: BashinStats;
    try {
      s = await deps.skillDelta(referenceBuild(c.outfitId, strategy), race, c.uniqueSkillId, n, deps.seed);
    } catch {
      continue; // this style can't be evaluated — faithful: just drop it
    }
    if (s.nsamples === 0) continue;
    perStyle.push({ strategy, L: s.mean, nsamples: s.nsamples });
  }
  if (perStyle.length === 0) {
    return { outfitId: c.outfitId, uniqueSkillId: c.uniqueSkillId, L: null, bestStrategy: null, perStyle: [], status: 'na', nsamples: 0 };
  }
  const best = perStyle.reduce((a, b) => (b.L > a.L ? b : a));
  const status = best.L > DEAD_L ? 'live' : 'zero';
  return {
    outfitId: c.outfitId,
    uniqueSkillId: c.uniqueSkillId,
    L: best.L,
    bestStrategy: best.strategy,
    perStyle,
    status,
    nsamples: best.nsamples,
  };
}

/** Resolve each uma's best-of-4-styles unique L (streaming via onRow); sorted L desc, na last. */
export async function rankUmaChart(
  candidates: UmaChartCandidate[],
  race: SimRaceParams,
  deps: RankUmaChartDeps,
  onRow?: (row: UmaChartRow) => void,
): Promise<UmaChartRow[]> {
  const n = deps.nsamples ?? DISCOVERY_NSAMPLES;
  const rows: UmaChartRow[] = [];
  for (const c of candidates) {
    const row = await rowFor(c, race, deps, n);
    rows.push(row);
    onRow?.(row);
  }
  return rows.sort((a, b) => rankValue(b) - rankValue(a));
}
