/** Streaming L-rank of acquirable skills (M4 §1). Each skill's marginal L is the
 *  engine bashin delta on the fixed base build. nsamples===0 ⇒ the engine can't
 *  evaluate it → 'na' (never a misleading 0 L, P3). mean ≤ DEAD_L ⇒ 'zero'. */
import type { BashinStats, SimBuild, SimRaceParams } from '@/sim';

export const DEAD_L = 0.1;

/**
 * Default sample count for the DISCOVERY chart. The chart ranks the whole
 * acquirable catalog serially on one worker; discovery trades precision for speed
 * (rows are badged "refining / RNG estimate", P3). M2's purchase optimizer sets
 * its own higher count for precision.
 * TODO(slice-1b): progressive refine — re-sim the surviving top-N at higher samples.
 */
export const DISCOVERY_NSAMPLES = 30;

export interface SkillChartRow {
  skillId: string;
  /** mean bashin; null when not simulatable ('na'). */
  L: number | null;
  /** engine distribution; null when 'na'. */
  min: number | null;
  max: number | null;
  median: number | null;
  status: 'live' | 'zero' | 'na';
  nsamples: number;
}

export interface RankSkillChartDeps {
  /** Injected sim — evalSkillDelta or SimClient.skillDelta (sync or async both work). */
  skillDelta: (b: SimBuild, r: SimRaceParams, skillId: string, n: number, seed?: number)
    => BashinStats | Promise<BashinStats>;
  nsamples?: number;
  seed?: number;
}

function rowFrom(skillId: string, s: BashinStats): SkillChartRow {
  if (s.nsamples === 0) {
    return { skillId, L: null, min: null, max: null, median: null, status: 'na', nsamples: 0 };
  }
  const status = s.mean > DEAD_L ? 'live' : 'zero';
  return { skillId, L: s.mean, min: s.min, max: s.max, median: s.median, status, nsamples: s.nsamples };
}

/** Finite sentinel (not -Infinity) so comparing two 'na' rows never yields NaN. */
const NA_RANK = Number.MIN_SAFE_INTEGER;
function rankValue(r: SkillChartRow): number {
  return r.status === 'na' ? NA_RANK : (r.L ?? 0);
}

/** Sort comparator: L desc, na last; NaN-safe for na-vs-na. */
export function compareSkillChartRows(a: SkillChartRow, b: SkillChartRow): number {
  return rankValue(b) - rankValue(a);
}

/** Resolve each skill's L (streaming via onRow), return rows sorted L desc (na last).
 *  shouldContinue (optional) is checked before each skill so callers can cancel. */
export async function rankSkillChart(
  build: SimBuild,
  race: SimRaceParams,
  skillIds: string[],
  deps: RankSkillChartDeps,
  onRow?: (row: SkillChartRow) => void,
  shouldContinue?: () => boolean,
): Promise<SkillChartRow[]> {
  const n = deps.nsamples ?? DISCOVERY_NSAMPLES;
  const rows: SkillChartRow[] = [];
  for (const skillId of skillIds) {
    if (shouldContinue && !shouldContinue()) break;
    let s: BashinStats;
    try {
      s = await deps.skillDelta(build, race, skillId, n, deps.seed);
    } catch {
      // The engine can't evaluate this skill on this build (unmodeled effect or a
      // degenerate runner) — surface it as not-simulatable rather than crashing the
      // whole chart stream (P3).
      s = { mean: 0, median: 0, min: 0, max: 0, nsamples: 0, results: [] };
    }
    const row = rowFrom(skillId, s);
    rows.push(row);
    onRow?.(row);
  }
  return rows.sort(compareSkillChartRows);
}
