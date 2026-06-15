/**
 * M4 §1 — engine-driven skill chart. Ranks acquirable skills by marginal
 * bashin (L) on the plan's base build (via useSkillChart → rankSkillChart),
 * with search + rarity + "show every" filters and a one-tap "+ target" that
 * appends to the plan wishlist. P3: results are simulated estimates (caveat
 * shown); P4: catalog is server-filtered so JP-only skills never appear.
 */
import { useMemo, useState } from 'react';
import type { BashinStats, SimBuild, SimRaceParams } from '@/sim';
import type { CmPlan } from '@/core/types';
import { acquirableSkills } from '@/core/skillCatalog';
import { effectiveSpCost } from '@/core/cost';
import { planToSimBuild } from '@/core/simBuild';
import { useGameData } from '@/features/data/gameData';
import { useSkillChart } from '@/features/skill-acq/useSkillChart';

interface SkillChartPanelProps {
  plan: CmPlan;
  onChange: (next: CmPlan) => void;
  deps?: {
    skillDelta: (b: SimBuild, r: SimRaceParams, id: string, n: number, seed?: number) => BashinStats | Promise<BashinStats>;
    nsamples?: number;
  };
}

type RarityFilter = 'all' | 'white' | 'gold';

export function SkillChartPanel({ plan, onChange, deps }: SkillChartPanelProps) {
  const { skills, skillById, sparkRates } = useGameData();

  const catalog = useMemo(() => acquirableSkills(skills, plan.server), [skills, plan.server]);
  // The engine can't race a 0-speed runner; don't sim until the user has stats.
  const hasSpeed = plan.statProfile.stats.spd > 0;
  const ids = useMemo(() => (hasSpeed ? catalog.map((s) => s.skillId) : []), [catalog, hasSpeed]);
  const build = useMemo(() => planToSimBuild(plan), [plan]); // identity changes each plan edit — acceptable
  const race = useMemo(() => ({ courseId: plan.cmRef.courseId }), [plan.cmRef.courseId]);

  const { rows, status, done, total } = useSkillChart(build, race, ids, deps);

  const [search, setSearch] = useState('');
  const [rarityFilter, setRarityFilter] = useState<RarityFilter>('all');
  const [showEvery, setShowEvery] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpanded = (skillId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(skillId)) next.delete(skillId);
      else next.add(skillId);
      return next;
    });
  };

  const searchLower = search.toLowerCase();

  return (
    <section className="panel" aria-labelledby="skill-chart-h">
      <h2 id="skill-chart-h">Skill chart</h2>

      {status === 'running' && (
        <p className="muted small">
          refining {done}/{total}…
        </p>
      )}
      <p className="muted small">Simulated estimate — RNG-dependent.</p>

      <div className="chart-controls">
        <input
          className="search"
          type="text"
          aria-label="Search skills"
          placeholder="Search skills"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {(['all', 'white', 'gold'] as const).map((r) => (
          <button
            key={r}
            type="button"
            className="chip"
            aria-pressed={rarityFilter === r}
            onClick={() => setRarityFilter(r)}
          >
            {r}
          </button>
        ))}
        <label>
          <input
            type="checkbox"
            aria-label="Show every skill"
            checked={showEvery}
            onChange={(e) => setShowEvery(e.target.checked)}
          />{' '}
          Show every skill
        </label>
      </div>

      {!hasSpeed && (
        <p className="muted">
          Enter your runner's stats (Speed is required) in the Runner panel to rank skills.
        </p>
      )}

      {hasSpeed && (
      <ul className="skill-chart-list" aria-label="Skill chart">
        {rows.map((row) => {
          const skill = skillById.get(row.skillId);
          if (!skill) return null;
          if (!showEvery && (row.status === 'zero' || row.status === 'na')) return null;
          if (rarityFilter !== 'all' && skill.rarity !== rarityFilter) return null;
          if (searchLower && !skill.nameEn.toLowerCase().includes(searchLower)) return null;

          const isTargeted = plan.wishlist.some((w) => w.skillId === row.skillId);
          const isExpanded = expanded.has(row.skillId);

          return (
            <li
              key={row.skillId}
              className="skill-chart-row"
              aria-label={skill.rarity === 'gold' ? `${skill.nameEn}, gold skill` : skill.nameEn}
            >
              {skill.rarity === 'gold' && (
                <span className="gold-star" title="Gold skill" aria-hidden="true">
                  ★
                </span>
              )}
              <span className={skill.rarity === 'gold' ? 'sk-gold' : 'sk-white'}>{skill.nameEn}</span>

              {row.status === 'na' ? (
                <span
                  className="na"
                  title="engine can't simulate this effect"
                  aria-label="not applicable — the engine can't simulate this effect"
                >
                  n/a
                </span>
              ) : (
                <span className={row.status === 'zero' ? 'muted' : 'L'}>+{(row.L ?? 0).toFixed(2)}</span>
              )}

              <span className="cost">SP {effectiveSpCost(skill, 0, sparkRates)}</span>

              <button
                type="button"
                className="icon-btn"
                aria-expanded={isExpanded}
                aria-label={`Details for ${skill.nameEn}`}
                onClick={() => toggleExpanded(row.skillId)}
              >
                details
              </button>

              {isTargeted ? (
                <span className="check">✓</span>
              ) : (
                <button
                  type="button"
                  aria-label={`Add ${skill.nameEn}`}
                  onClick={() =>
                    onChange({
                      ...plan,
                      wishlist: [...plan.wishlist, { skillId: row.skillId, priority: 1, source: 'targeted' }],
                    })
                  }
                >
                  + target
                </button>
              )}

              {isExpanded && (
                <div className="skill-chart-details muted small">
                  <div>{skill.conditions}</div>
                  <div>
                    L mean +{row.L?.toFixed(2)} (n={row.nsamples})
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      )}
    </section>
  );
}
