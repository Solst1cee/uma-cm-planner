/** Streaming L-rank of acquirable skills (M4 §1). Each skill's marginal L is the
 *  engine bashin delta on the fixed base build. nsamples===0 ⇒ the engine can't
 *  evaluate it → 'na' (never a misleading 0 L, P3). mean ≤ DEAD_L ⇒ 'zero'. */
import type { BashinStats, SimBuild, SimRaceParams } from '@/sim';

export const DEAD_L = 0.1;

/**
 * Default sample count for the DISCOVERY chart. The chart ranks the whole
 * acquirable catalog (~477 skills) serially on one worker: at 200 samples that
 * is ~3.3 min, at 30 it is ~36 s with the top rows streaming in within ~1-2 s.
 * Discovery trades precision for speed (rows are badged "refining / RNG estimate",
 * P3); M2's purchase optimizer sets its own higher count for precision.
 * TODO(slice-1b): progressive refine — re-sim the surviving top-N at higher samples.
 */
export const DISCOVERY_NSAMPLES = 30;

export interface SkillChartRow {
  skillId: string;
  /** mean bashin; null when not simulatable ('na'). */
  L: number | null;
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
  if (s.nsamples === 0) return { skillId, L: null, status: 'na', nsamples: 0 };
  const status = s.mean > DEAD_L ? 'live' : 'zero';
  return { skillId, L: s.mean, status, nsamples: s.nsamples };
}

function rankValue(r: SkillChartRow): number {
  // live/zero rank by L; na sorts last.
  return r.status === 'na' ? -Infinity : (r.L ?? 0);
}

/** Resolve each skill's L (streaming via onRow), return rows sorted L desc (na last). */
export async function rankSkillChart(
  build: SimBuild,
  race: SimRaceParams,
  skillIds: string[],
  deps: RankSkillChartDeps,
  onRow?: (row: SkillChartRow) => void,
): Promise<SkillChartRow[]> {
  const n = deps.nsamples ?? DISCOVERY_NSAMPLES;
  const rows: SkillChartRow[] = [];
  for (const skillId of skillIds) {
    let s: BashinStats;
    try {
      s = await deps.skillDelta(build, race, skillId, n, deps.seed);
    } catch {
      // The engine can't evaluate this skill on this build (e.g. an unmodeled
      // effect, or a degenerate runner) — surface it as not-simulatable rather
      // than letting one throw crash the whole chart stream (P3).
      s = { mean: 0, median: 0, min: 0, max: 0, nsamples: 0, results: [] };
    }
    const row = rowFrom(skillId, s);
    rows.push(row);
    onRow?.(row);
  }
  return rows.sort((a, b) => rankValue(b) - rankValue(a));
}
