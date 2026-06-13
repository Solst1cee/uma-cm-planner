/**
 * Panel A (plan §6): plan name, CM picker (preset or custom race entry),
 * scenario selector, and the target-skill editor with priority stars.
 * Target lists are variable length (1–7+); nothing here enforces a count.
 */
import { useMemo, useState } from 'react';
import type { CmPlan, CmPreset, Priority } from '@/core/types';
import { useGameData } from '@/features/data/gameData';
import { GameIcon } from '@/features/data/GameIcon';
import { SkillPicker } from '@/features/skill-planner/SkillPicker';

// Game-internal scenario ids (provenance §3.1 — id 3 does not exist).
const SCENARIOS = [
  { id: 1, label: 'URA Finals' },
  { id: 2, label: 'Unity Cup' },
  { id: 4, label: 'Trackblazer — default (latest)' },
] as const;

const PRIORITY_STARS: Record<Priority, string> = { 1: '★', 2: '★★', 3: '★★★' };

function nextPriority(p: Priority): Priority {
  // 1 = core target; tap cycles 1→2→3→1.
  return p === 3 ? 1 : ((p + 1) as Priority);
}

/**
 * Identity match, not just race-shape: 12 of 31 presets share a
 * (courseId, surface, distance) key with an earlier CM, so the month —
 * which applyPreset/makeDefaultPlan always write from preset.date — is
 * part of the identity. Without it the picker displays the wrong CM.
 */
function presetMatchesPlan(preset: CmPreset, plan: CmPlan): boolean {
  return (
    preset.date.slice(0, 7) === plan.month &&
    preset.courseId === plan.race.courseId &&
    preset.surface === plan.race.surface &&
    preset.distance === plan.race.distance
  );
}

/** P4: JP CM history is shown, but never unlabeled. */
function presetLabel(preset: CmPreset): string {
  const base = `${preset.name} (${preset.date})`;
  return preset.server === 'jp' ? `${base} (JP history)` : base;
}

export function PlanHeaderPanel({
  plan,
  onChange,
}: {
  plan: CmPlan;
  onChange: (next: CmPlan) => void;
}) {
  const { cmPresets, skillById } = useGameData();

  // Picker mode is component state: the default plan's race always equals a
  // preset, so deriving "custom" purely from race-shape equality made the
  // option unreachable (the select snapped back to the matched preset).
  const [customMode, setCustomMode] = useState(false);

  const matchedPreset = useMemo(
    () => cmPresets.findIndex((p) => presetMatchesPlan(p, plan)),
    [cmPresets, plan],
  );
  const showCustom = customMode || matchedPreset < 0;

  const addedSkillIds = useMemo(
    () => new Set(plan.targetSkills.map((t) => t.skillId)),
    [plan.targetSkills],
  );

  const applyPreset = (value: string) => {
    if (value === 'custom') {
      // Keep current race values; the fields below become editable and stay
      // visible until a preset is explicitly picked again.
      setCustomMode(true);
      return;
    }
    const preset = cmPresets[Number(value)];
    if (!preset) return;
    setCustomMode(false);
    onChange({
      ...plan,
      month: preset.date.slice(0, 7),
      race: {
        courseId: preset.courseId,
        surface: preset.surface,
        distance: preset.distance,
        season: preset.season,
        condition: preset.ground,
      },
    });
  };

  const setRace = (patch: Partial<CmPlan['race']>) => {
    onChange({ ...plan, race: { ...plan.race, ...patch } });
  };

  return (
    <section className="panel" aria-labelledby="plan-h">
      <h2 id="plan-h">Plan</h2>

      <label className="field">
        <span>Plan name</span>
        <input
          type="text"
          value={plan.name}
          onChange={(e) => onChange({ ...plan, name: e.target.value })}
        />
      </label>

      <label className="field">
        <span>Champions Meeting</span>
        <select
          value={showCustom ? 'custom' : String(matchedPreset)}
          onChange={(e) => applyPreset(e.target.value)}
        >
          {cmPresets.map((p, i) => (
            <option key={`${p.name}-${p.date}`} value={String(i)}>
              {presetLabel(p)}
            </option>
          ))}
          <option value="custom">Custom race…</option>
        </select>
      </label>

      {showCustom && (
        <div className="race-fields">
          <label className="field">
            <span>Course id</span>
            <input
              type="text"
              inputMode="numeric"
              value={plan.race.courseId}
              onChange={(e) => setRace({ courseId: e.target.value })}
            />
          </label>
          <label className="field">
            <span>Surface</span>
            <select
              value={plan.race.surface}
              onChange={(e) => setRace({ surface: e.target.value as 'turf' | 'dirt' })}
            >
              <option value="turf">Turf</option>
              <option value="dirt">Dirt</option>
            </select>
          </label>
          <label className="field">
            <span>Distance (m)</span>
            <input
              type="number"
              min={1000}
              max={4000}
              step={100}
              value={plan.race.distance}
              onChange={(e) => setRace({ distance: Number(e.target.value) })}
            />
          </label>
        </div>
      )}

      <label className="field">
        <span>Scenario</span>
        <select
          value={String(plan.scenario.id)}
          onChange={(e) => {
            const id = Number(e.target.value);
            // isDefault tracks "following the app-level latest-scenario default"
            onChange({ ...plan, scenario: { id, isDefault: id === 4 } });
          }}
        >
          {SCENARIOS.map((s) => (
            <option key={s.id} value={String(s.id)}>
              {s.label}
            </option>
          ))}
        </select>
      </label>

      <h3>Target skills</h3>
      {plan.targetSkills.length === 0 && (
        <p className="muted">No target skills yet — search below to add (1–7+ is fine).</p>
      )}
      <ul className="target-list" aria-label="Target skills">
        {plan.targetSkills.map((target) => {
          const skill = skillById.get(target.skillId);
          const name = skill?.nameEn ?? target.skillId;
          return (
            <li key={target.skillId} className="target-row">
              <button
                type="button"
                className={`star-btn prio-${target.priority}`}
                aria-label={`Priority ${target.priority} for ${name} — tap to cycle`}
                onClick={() =>
                  onChange({
                    ...plan,
                    targetSkills: plan.targetSkills.map((t) =>
                      t.skillId === target.skillId
                        ? { ...t, priority: nextPriority(t.priority) }
                        : t,
                    ),
                  })
                }
              >
                {PRIORITY_STARS[target.priority]}
              </button>
              {skill && <GameIcon kind="skill" id={skill.iconId} size={22} alt="" />}
              <span className="target-name">{name}</span>
              {skill && <span className="muted small">{skill.baseSpCost} SP</span>}
              <button
                type="button"
                className="icon-btn"
                aria-label={`Remove ${name}`}
                onClick={() =>
                  onChange({
                    ...plan,
                    targetSkills: plan.targetSkills.filter(
                      (t) => t.skillId !== target.skillId,
                    ),
                  })
                }
              >
                ✕
              </button>
            </li>
          );
        })}
      </ul>

      <SkillPicker
        addedSkillIds={addedSkillIds}
        onPick={(skillId) =>
          onChange({
            ...plan,
            targetSkills: [...plan.targetSkills, { skillId, priority: 1 }],
          })
        }
      />
    </section>
  );
}
