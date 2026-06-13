/**
 * Plan §6 contingency view (links Module 4 → Module 2): for each
 * spark-covered target, the static branch display —
 * "<skill>: spark ≈NN% → if procs: N SP; if not: M SP (+Δ SP)".
 *
 * v1 is deliberately STATIC: no SP-budget math, no recompute hooks — that
 * lands with Module 2 (SP Optimizer). It shows both branches, the hint-level
 * assumption behind the proc branch verbatim, and the P3 caveat.
 */
import { useMemo } from 'react';
import type { CmPlan, OwnedCard } from '@/core/types';
import { buildCoverageMatrix } from '@/core/coverage';
import { computeContingencies } from '@/core/contingency';
import { useGameData } from '@/features/data/gameData';
import { useChosenParents } from '@/features/coverage/useChosenParents';
import { formatSparkPct } from '@/features/coverage/tierMeta';

export function SparkContingencyPanel({
  plan,
  inventory,
}: {
  plan: CmPlan;
  inventory: OwnedCard[];
}) {
  const { skills, cards, skillById, sparkRates } = useGameData();
  const { parents } = useChosenParents(plan);

  const contingencies = useMemo(() => {
    if (parents.length === 0 || plan.targetSkills.length === 0) return [];
    const rows = buildCoverageMatrix({
      plan,
      inventory,
      cards,
      skills,
      parents,
      rates: sparkRates, // required for the spark tier — parents are ignored without it
    });
    // cards lets the miss branch use card-derived hint levels where available.
    return computeContingencies({ rows, skills, rates: sparkRates, cards });
  }, [plan, inventory, cards, skills, parents, sparkRates]);

  return (
    <details className="panel contingency">
      <summary>
        Spark contingencies{' '}
        <span className="muted small">(spark procs vs misses — static v1)</span>
      </summary>
      {parents.length === 0 ? (
        <p className="muted">
          No parents chosen (or their records are missing) — pick parents above to see
          spark contingencies for your targets.
        </p>
      ) : contingencies.length === 0 ? (
        <p className="muted">
          No spark-covered targets — none of the chosen parents carries a white spark
          matching a target skill.
        </p>
      ) : (
        <ul className="contingency-list">
          {contingencies.map((c) => {
            const name = skillById.get(c.skillId)?.nameEn ?? c.skillId;
            return (
              <li key={c.skillId}>
                <p className="contingency-line">
                  <strong>{name}</strong>: spark {c.approximate ? '≈' : ''}
                  {formatSparkPct(c.sparkPct)}% → if procs: {c.spIfProc} SP; if not:{' '}
                  {c.spIfMiss} SP ({c.deltaSp >= 0 ? '+' : ''}
                  {c.deltaSp} SP)
                </p>
                <p className="muted small">{c.spIfProcAssumption}</p>
              </li>
            );
          })}
        </ul>
      )}
      <p className="muted small">
        Spark % is the probability of the spark proccing at least once across both
        inspiration events — estimation, not a guarantee. Static view: budgeting across
        all branches lands with Module 2 (SP Optimizer).
      </p>
    </details>
  );
}
