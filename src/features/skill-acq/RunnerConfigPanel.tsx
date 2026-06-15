/**
 * Runner config (M4 slice 1): the controlled editor for the plan's runner —
 * five stats, running strategy, mood, and the three target aptitudes. Aptitude
 * storage lives in sparkGoals.pink; read/write it through simBuild's helpers so
 * this panel never re-derives the pink-goal keying.
 */
import type { CmPlan, Grade, Mood, Stat, Strategy } from '@/core/types';
import type { AptDim } from '@/core/simBuild';
import { simAptitudes, setTargetAptitude } from '@/core/simBuild';

const STATS: { key: Stat; label: string }[] = [
  { key: 'spd', label: 'Speed' },
  { key: 'sta', label: 'Stamina' },
  { key: 'pow', label: 'Power' },
  { key: 'gut', label: 'Guts' },
  { key: 'wit', label: 'Wisdom' },
];

const STRATEGIES: { value: Strategy; label: string }[] = [
  { value: 'front', label: 'Front' },
  { value: 'pace', label: 'Pace' },
  { value: 'late', label: 'Late' },
  { value: 'end', label: 'End' },
];

const MOODS: { value: Mood; label: string }[] = [
  { value: -2, label: 'Awful' },
  { value: -1, label: 'Bad' },
  { value: 0, label: 'Normal' },
  { value: 1, label: 'Good' },
  { value: 2, label: 'Great' },
];

const GRADES: Grade[] = ['S', 'A', 'B', 'C', 'D', 'E', 'F', 'G'];

const APT_DIMS: { dim: AptDim; label: string }[] = [
  { dim: 'distance', label: 'Distance' },
  { dim: 'surface', label: 'Surface' },
  { dim: 'strategy', label: 'Strategy' },
];

export function RunnerConfigPanel({
  plan,
  onChange,
}: {
  plan: CmPlan;
  onChange: (next: CmPlan) => void;
}) {
  const apt = simAptitudes(plan);

  return (
    <section className="panel" aria-labelledby="runner-cfg-h">
      <h2 id="runner-cfg-h">Runner</h2>

      <h3>Stats</h3>
      <div className="race-fields">
        {STATS.map(({ key, label }) => (
          <label className="field" key={key}>
            <span>{label}</span>
            <input
              type="number"
              aria-label={label}
              value={plan.statProfile.stats[key]}
              onChange={(e) =>
                onChange({
                  ...plan,
                  statProfile: {
                    ...plan.statProfile,
                    stats: {
                      ...plan.statProfile.stats,
                      [key]: Number(e.target.value) || 0,
                    },
                  },
                })
              }
            />
          </label>
        ))}
      </div>

      <h3>Strategy</h3>
      <div className="lb-chips" role="group" aria-label="Strategy">
        {STRATEGIES.map(({ value, label }) => (
          <button
            type="button"
            key={value}
            className="lb-chip"
            aria-pressed={plan.strategy === value}
            onClick={() => onChange({ ...plan, strategy: value })}
          >
            {label}
          </button>
        ))}
      </div>

      <label className="field">
        <span>Mood</span>
        <select
          aria-label="Mood"
          value={plan.statProfile.mood}
          onChange={(e) =>
            onChange({
              ...plan,
              statProfile: { ...plan.statProfile, mood: Number(e.target.value) as Mood },
            })
          }
        >
          {MOODS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </label>

      <h3>Aptitudes</h3>
      <div className="race-fields">
        {APT_DIMS.map(({ dim, label }) => (
          <label className="field" key={dim}>
            <span>{label}</span>
            <select
              aria-label={`${label} aptitude`}
              value={apt[dim]}
              onChange={(e) => onChange(setTargetAptitude(plan, dim, e.target.value as Grade))}
            >
              {GRADES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </section>
  );
}
