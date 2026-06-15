/** Streaming L-rank of acquirable skills (M4 §1). Each skill's marginal L is the
 *  engine bashin delta on the fixed base build. nsamples===0 ⇒ the engine can't
 *  evaluate it → 'na' (never a misleading 0 L, P3). mean ≤ DEAD_L ⇒ 'zero'. */
import type { BashinStats, SimBuild, SimRaceParams } from '@/sim';

export const DEAD_L = 0.1;

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
  const n = deps.nsamples ?? 200;
  const rows: SkillChartRow[] = [];
  for (const skillId of skillIds) {
    const s = await deps.skillDelta(build, race, skillId, n, deps.seed);
    const row = rowFrom(skillId, s);
    rows.push(row);
    onRow?.(row);
  }
  return rows.sort((a, b) => rankValue(b) - rankValue(a));
}
