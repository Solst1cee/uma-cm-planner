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
import { addOrReplaceWishlistSkill, wishlistSkillId } from './skillFamilies';

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

function cmNumberFromName(name: string): number {
  const m = name.match(/CM\s*0*(\d+)/i);
  return m ? Number(m[1]) : 0;
}

/**
 * Identity match: presets sharing a (courseId, surface, distance) key exist,
 * so we also match on name to disambiguate (the preset name is written onto
 * the plan when applyPreset is called).
 */
function presetMatchesPlan(preset: CmPreset, plan: CmPlan): boolean {
  return (
    preset.name === plan.name &&
    preset.courseId === plan.cmRef.courseId &&
    preset.surface === plan.cmRef.surface &&
    preset.distance === plan.cmRef.distance
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
    () => new Set(plan.wishlist.flatMap((t) => {
      const resolvedSkillId = wishlistSkillId(t.skillId, skillById);
      return resolvedSkillId !== t.skillId ? [t.skillId, resolvedSkillId] : [t.skillId];
    })),
    [plan.wishlist, skillById],
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
    const cmNumber = cmNumberFromName(preset.name);
    setCustomMode(false);
    onChange({
      ...plan,
      name: preset.name,
      cmRef: {
        cmId: `CM${cmNumber}`,
        cmNumber,
        courseId: preset.courseId,
        surface: preset.surface,
        distance: preset.distance,
        season: preset.season,
        condition: preset.ground,
      },
    });
  };

  const setCmRef = (patch: Partial<CmPlan['cmRef']>) => {
    onChange({ ...plan, cmRef: { ...plan.cmRef, ...patch } });
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
              value={plan.cmRef.courseId}
              onChange={(e) => setCmRef({ courseId: e.target.value })}
            />
          </label>
          <label className="field">
            <span>Surface</span>
            <select
              value={plan.cmRef.surface}
              onChange={(e) => setCmRef({ surface: e.target.value as 'turf' | 'dirt' })}
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
              value={plan.cmRef.distance}
              onChange={(e) => setCmRef({ distance: Number(e.target.value) })}
            />
          </label>
        </div>
      )}

      <label className="field">
        <span>Scenario</span>
        <select
          value={String(plan.scenarioId ?? '')}
          onChange={(e) => {
            onChange({ ...plan, scenarioId: Number(e.target.value) });
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
      {plan.wishlist.length === 0 && (
        <p className="muted">No target skills yet — search below to add (1–7+ is fine).</p>
      )}
      <ul className="target-list" aria-label="Target skills">
        {plan.wishlist.map((target) => {
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
                    wishlist: plan.wishlist.map((t) =>
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
                    wishlist: plan.wishlist.filter(
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
            wishlist: addOrReplaceWishlistSkill(plan.wishlist, skillId, skillById),
          })
        }
      />
    </section>
  );
}
