/**
 * M4 §1 "Unique-skill chart" — rank umas by their native unique skill's bashin L
 * on a course, computed FAITHFULLY at each of the 4 running styles on a FIXED
 * reference runner (the basinnhyou model — see the design spec), ranked by the
 * best (max) style. Runner-independent of the user's plan by construction. Per-skill
 * L is the engine's A/B Monte-Carlo (injected skillDelta = evalSkillDelta / SimClient).
 */
import type { BashinStats, Grade, SimBuild, SimRaceParams, Strategy } from '@/sim';
import type { Stat } from '@/core/types';
import { nullsLast } from './compare';
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
  /** mean bashin — the rank value. */
  L: number;
  /** distribution from the engine's Monte-Carlo samples (surfaced on hover). */
  min: number;
  max: number;
  median: number;
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
  /**
   * 'live' = meaningful length; 'zero' = procs but ≤ DEAD_L; 'inactive' = the unique
   * can never proc here (no style activated it); 'na' = no style was simulatable.
   */
  status: 'live' | 'zero' | 'na' | 'inactive';
  nsamples: number;
}
export interface RankUmaChartDeps {
  skillDelta: (b: SimBuild, r: SimRaceParams, skillId: string, n: number, seed?: number)
    => BashinStats | Promise<BashinStats>;
  nsamples?: number;
  seed?: number;
  uniqueLevel?: number;
}

export function referenceBuild(outfitId: string, strategy: Strategy): SimBuild {
  return {
    umaId: outfitId,
    stats: REFERENCE_STATS,
    strategy,
    aptitudes: REFERENCE_APTITUDES,
    skills: [],
    mood: REFERENCE_MOOD,
  };
}

/** Chart order comparator: L desc, na last (na → null key so it sinks; NaN-safe for na-vs-na).
 *  Exported so the hook keeps the streamed list sorted as rows arrive (no end-of-run reshuffle). */
export const compareUmaChartRows = nullsLast<UmaChartRow>((r) => (r.status === 'na' ? null : (r.L ?? 0)), 'desc');

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
  let anyActivated = false;
  const level = deps.uniqueLevel ?? 5;
  for (const strategy of UMA_CHART_STRATEGIES) {
    let s: BashinStats;
    try {
      const build = {
        ...referenceBuild(c.outfitId, strategy),
        skillLevels: { [c.uniqueSkillId]: level },
      };
      s = await deps.skillDelta(build, race, c.uniqueSkillId, n, deps.seed);
    } catch {
      continue; // this style can't be evaluated — faithful: just drop it
    }
    if (s.nsamples === 0) continue;
    if (s.activated !== false) anyActivated = true; // undefined (older/test stats) counts as activated
    perStyle.push({ strategy, L: s.mean, min: s.min, max: s.max, median: s.median, nsamples: s.nsamples });
  }
  if (perStyle.length === 0) {
    return { outfitId: c.outfitId, uniqueSkillId: c.uniqueSkillId, L: null, bestStrategy: null, perStyle: [], status: 'na', nsamples: 0 };
  }
  const best = perStyle.reduce((a, b) => (b.L > a.L ? b : a));
  const status = !anyActivated ? 'inactive' : best.L > DEAD_L ? 'live' : 'zero';
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
  shouldContinue?: () => boolean,
): Promise<UmaChartRow[]> {
  const n = deps.nsamples ?? DISCOVERY_NSAMPLES;
  const rows: UmaChartRow[] = [];
  for (const c of candidates) {
    // Cancellation: a new run()/unmount flips this false, so we stop queuing sims.
    // (The shared SimClient worker is FIFO — abandoned work would block the next run.)
    if (shouldContinue && !shouldContinue()) break;
    const row = await rowFor(c, race, deps, n);
    rows.push(row);
    onRow?.(row);
  }
  return rows.sort(compareUmaChartRows);
}
