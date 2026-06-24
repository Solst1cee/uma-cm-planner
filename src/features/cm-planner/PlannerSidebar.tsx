import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  isCurrentAptitude,
  planToSimBuild,
  setStrategyTargetAptitude,
  setTargetAptitudeByKey,
  targetAptitude,
} from '@/core/simBuild';
import { pinkAptitudeRequirement } from '@/core/aptitudeInheritance';
import { generatePlanName } from '@/core/planName';
import type { TraceContext } from './useSkillTrace';
import type { AptKey, CmPlan, Grade, Mood, Role, SkillRecord, Stat, Strategy, UmaRecord } from '@/core/types';
import { useGameData } from '@/features/data/gameData';
import { GameIcon } from '@/features/data/GameIcon';
import { SkillPicker } from '@/features/skill-planner/SkillPicker';
import {
  addOrReplaceWishlistSkill,
  replaceWishlistSkillVariant,
  skillVariantOptions,
  wishlistSkillId,
  wishlistSkillRecord,
} from '@/features/skill-planner/skillFamilies';
import { SkillDetailDisclosure } from './SkillDetailDisclosure';
import { StatInput } from './StatInputField';
import {
  loadUniqueSkillByUmaId,
  skillRecordToSummary,
  type SkillSummary,
} from './skillTechnicalDetails';

const STATS: Array<{ key: Stat; label: string; shortLabel: string; iconId: string }> = [
  { key: 'spd', label: 'Speed', shortLabel: 'SPD', iconId: 'stat-spd' },
  { key: 'sta', label: 'Stamina', shortLabel: 'STA', iconId: 'stat-sta' },
  { key: 'pow', label: 'Power', shortLabel: 'PWR', iconId: 'stat-pow' },
  { key: 'gut', label: 'Guts', shortLabel: 'GUT', iconId: 'stat-gut' },
  { key: 'wit', label: 'Wit', shortLabel: 'WIT', iconId: 'stat-wit' },
];

const STRATEGIES: Array<{ value: Strategy; label: string; fullLabel: string }> = [
  { value: 'front', label: 'Front', fullLabel: 'Front Runner' },
  { value: 'pace', label: 'Pace', fullLabel: 'Pace Chaser' },
  { value: 'late', label: 'Late', fullLabel: 'Late Surger' },
  { value: 'end', label: 'End', fullLabel: 'End Closer' },
];

const ROLES: Array<{ value: Role; label: string }> = [
  { value: 'ace', label: 'Ace' },
  { value: 'debuffer', label: 'Debuf' },
  { value: 'hybrid', label: 'Hybrid' },
];

const MOODS: Array<{ value: Mood; label: string; iconId: string }> = [
  { value: 2, label: 'Great', iconId: 'mood-2' },
  { value: 1, label: 'Good', iconId: 'mood-1' },
  { value: 0, label: 'Normal', iconId: 'mood-0' },
  { value: -1, label: 'Bad', iconId: 'mood--1' },
  { value: -2, label: 'Awful', iconId: 'mood--2' },
];

const GRADES: Grade[] = ['S', 'A', 'B', 'C', 'D', 'E', 'F', 'G'];

type AptitudeTarget = { aptKey: AptKey; label: string };

const APTITUDE_GROUPS: Array<{ label: string; options: AptitudeTarget[] }> = [
  {
    label: 'Track',
    options: [
      { aptKey: { kind: 'surface', key: 'turf' }, label: 'Turf' },
      { aptKey: { kind: 'surface', key: 'dirt' }, label: 'Dirt' },
    ],
  },
  {
    label: 'Distance',
    options: [
      { aptKey: { kind: 'distance', key: 'short' }, label: 'Sprint' },
      { aptKey: { kind: 'distance', key: 'mile' }, label: 'Mile' },
      { aptKey: { kind: 'distance', key: 'medium' }, label: 'Medium' },
      { aptKey: { kind: 'distance', key: 'long' }, label: 'Long' },
    ],
  },
];

function moodIconId(value: Mood): string {
  return MOODS.find((mood) => mood.value === value)?.iconId ?? 'mood-0';
}

function gradeIconId(grade: Grade): string {
  return `apt-${grade}`;
}

function statGrowthLabel(value: number | undefined): string {
  return value === undefined || value === 0 ? '-' : `+${value}%`;
}

function baseAptitudeFor(uma: UmaRecord, aptKey: AptKey): Grade | undefined {
  const aptitudes = uma.baseAptitudes;
  if (!aptitudes) return undefined;
  if (aptKey.kind === 'surface') return aptitudes.surface[aptKey.key];
  if (aptKey.kind === 'distance') return aptitudes.distance[aptKey.key];
  return aptitudes.strategy[aptKey.key];
}

function aptLabel(aptKey: AptKey, fallback: string): string {
  if (aptKey.kind !== 'strategy') return fallback;
  return STRATEGIES.find((strategy) => strategy.value === aptKey.key)?.fullLabel ?? fallback;
}

function setStat(plan: CmPlan, stat: Stat, value: number): CmPlan {
  return {
    ...plan,
    statProfile: {
      ...plan.statProfile,
      stats: { ...plan.statProfile.stats, [stat]: Number.isFinite(value) ? value : 0 },
    },
  };
}

function skillSummaryFromMap(
  skillId: string,
  skillById: Map<string, SkillRecord>,
): SkillSummary | null {
  const skill = skillById.get(skillId);
  return skill ? skillRecordToSummary(skill) : null;
}

function resizeNoteTextarea(textarea: HTMLTextAreaElement): void {
  textarea.style.height = 'auto';
  textarea.style.height = `${textarea.scrollHeight}px`;
}

export function PlannerSidebar({
  plan,
  autoSave,
  isSaved,
  onChange,
  onSave,
  onSaveAs,
  onNew,
  onAutoSaveChange,
  raceNameLabel,
  collapseSkillSignal,
  focused = 'uma1',
  onFocusChange = () => undefined,
  uma2Empty = false,
  onDuplicateUma1ToUma2,
  onReplicateUma2ToUma1,
  trackMismatchLabel,
}: {
  plan: CmPlan;
  autoSave: boolean;
  isSaved: boolean;
  onChange: (next: CmPlan) => void;
  onSave: (next: CmPlan) => Promise<void>;
  onSaveAs: (next: CmPlan) => Promise<void>;
  onNew: () => void;
  onAutoSaveChange: (enabled: boolean) => void;
  raceNameLabel?: string;
  collapseSkillSignal?: number;
  focused?: 'uma1' | 'uma2';
  onFocusChange?: (slot: 'uma1' | 'uma2') => void;
  uma2Empty?: boolean;
  onDuplicateUma1ToUma2?: () => void;
  onReplicateUma2ToUma1?: () => void;
  trackMismatchLabel?: string;
}) {
  const { skillById, umas, umaById } = useGameData();
  const [uniqueByUmaId, setUniqueByUmaId] = useState<Map<string, SkillSummary> | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [umaQuery, setUmaQuery] = useState('');
  const [umaPickerOpen, setUmaPickerOpen] = useState(false);
  const [activeUmaIndex, setActiveUmaIndex] = useState(0);
  const [wishlistDeleteConfirm, setWishlistDeleteConfirm] = useState(false);
  const initialUmaName = umaById?.get(plan.umaId)?.nameEn ?? (plan.umaId ? `Uma ${plan.umaId}` : undefined);
  const [autoGeneratePlanId, setAutoGeneratePlanId] = useState<string | null>(() =>
    plan.name === generatePlanName(plan, initialUmaName, raceNameLabel) ? plan.id : null,
  );
  const previousPlanIdRef = useRef(plan.id);
  const noteTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const wishlistHeaderActionsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadUniqueSkillByUmaId()
      .then((map) => {
        if (!cancelled) setUniqueByUmaId(map);
      })
      .catch(() => {
        if (!cancelled) setUniqueByUmaId(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!uniqueByUmaId || !plan.umaId || plan.uniqueSkillId) return;
    const unique = uniqueByUmaId.get(plan.umaId);
    if (unique) onChange({ ...plan, uniqueSkillId: unique.skillId });
  }, [onChange, plan, uniqueByUmaId]);

  useEffect(() => {
    if (noteTextareaRef.current) resizeNoteTextarea(noteTextareaRef.current);
  }, [plan.notes]);

  useEffect(() => {
    if (!wishlistDeleteConfirm) return;
    const dismiss = (event: PointerEvent) => {
      if (!wishlistHeaderActionsRef.current?.contains(event.target as Node)) {
        setWishlistDeleteConfirm(false);
      }
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [wishlistDeleteConfirm]);

  useEffect(() => {
    if (plan.wishlist.length === 0) setWishlistDeleteConfirm(false);
  }, [plan.wishlist.length]);

  const globalUmas = useMemo(
    () => (umas ?? []).filter((u) => u.server === plan.server),
    [plan.server, umas],
  );
  const currentUma = (umaById ?? new Map()).get(plan.umaId);
  const currentUmaName = currentUma?.nameEn ?? (plan.umaId ? `Uma ${plan.umaId}` : undefined);
  const autoGenerateName = autoGeneratePlanId === plan.id;
  const generatedPlanName = generatePlanName(plan, currentUmaName, raceNameLabel);

  useEffect(() => {
    if (previousPlanIdRef.current === plan.id) return;
    previousPlanIdRef.current = plan.id;
    setAutoGeneratePlanId(plan.name === generatedPlanName ? plan.id : null);
  }, [generatedPlanName, plan.id, plan.name]);
  const umaResults = useMemo(() => {
    const q = umaQuery.trim().toLowerCase();
    return globalUmas
      .filter((uma) => {
        if (q === '') return true;
        const unique = uniqueByUmaId?.get(uma.umaId);
        const haystack = [uma.nameEn, uma.epithet, unique?.nameEn]
          .filter((part): part is string => Boolean(part))
          .join(' ')
          .toLowerCase();
        return haystack.includes(q);
      })
      .slice(0, 24);
  }, [globalUmas, umaQuery, uniqueByUmaId]);
  const wishlistIds = useMemo(
    () => new Set(plan.wishlist.flatMap((item) => {
      const resolvedSkillId = wishlistSkillId(item.skillId, skillById);
      return resolvedSkillId && resolvedSkillId !== item.skillId
        ? [item.skillId, resolvedSkillId]
        : [item.skillId];
    })),
    [plan.wishlist, skillById],
  );
  const hiddenWishlistSkillIds = useMemo(() => {
    const hidden = new Set<string>();
    if (plan.uniqueSkillId) {
      const inheritedSkillId = wishlistSkillId(plan.uniqueSkillId, skillById);
      if (inheritedSkillId !== plan.uniqueSkillId) hidden.add(inheritedSkillId);
    }
    return hidden;
  }, [plan.uniqueSkillId, skillById]);
  const uniqueFromRuntime = plan.umaId ? uniqueByUmaId?.get(plan.umaId) ?? null : null;
  const uniqueFromRecord = plan.uniqueSkillId
    ? skillSummaryFromMap(plan.uniqueSkillId, skillById)
    : null;
  const uniqueSkill = uniqueFromRuntime ?? uniqueFromRecord;
  const strategyTargetKey: AptKey = { kind: 'strategy', key: plan.strategy };
  const strategyTargetValue = targetAptitude(plan, strategyTargetKey) ?? 'A';
  const selectedStrategy = STRATEGIES.find((strategy) => strategy.value === plan.strategy) ?? STRATEGIES[0]!;
  const sparkRequirements = useMemo(() => {
    if (!currentUma?.baseAptitudes) return [];
    const targets = [
      ...APTITUDE_GROUPS.flatMap((group) =>
        group.options.map((option) => ({
          label: option.label,
          aptKey: option.aptKey,
          target: targetAptitude(plan, option.aptKey),
        })),
      ),
      {
        label: selectedStrategy.fullLabel,
        aptKey: strategyTargetKey,
        target: strategyTargetValue,
      },
    ];
    return targets
      .map(({ label, aptKey, target }) => ({
        label: aptLabel(aptKey, label),
        requirement: pinkAptitudeRequirement(baseAptitudeFor(currentUma, aptKey), target),
      }))
      .filter((item) => item.requirement.stars > 0);
  }, [currentUma, plan, selectedStrategy.fullLabel, strategyTargetKey, strategyTargetValue]);
  const midRunSparkRequirements = sparkRequirements.filter(
    (item) => item.requirement.steps === 4 && item.requirement.inRunStepsNeeded > 0,
  );
  const projectedTotal = plan.wishlist.reduce((sum, item) => sum + (item.projectedL ?? 0), 0);
  const spTotal = plan.wishlist.reduce((sum, item) => {
    const skill = wishlistSkillRecord(item.skillId, skillById);
    return sum + (skill?.baseSpCost ?? 0);
  }, 0);
  const traceCtx = useMemo<TraceContext>(
    () => ({ build: planToSimBuild(plan), race: { courseId: plan.cmRef.courseId }, buildLabel: 'your build' }),
    [plan],
  );

  useEffect(() => {
    if (!umaPickerOpen) setUmaQuery(currentUmaName ?? '');
  }, [currentUmaName, umaPickerOpen]);

  useEffect(() => {
    if (autoGenerateName && plan.name !== generatedPlanName) {
      onChange({ ...plan, name: generatedPlanName });
    }
  }, [autoGenerateName, generatedPlanName, onChange, plan]);

  useEffect(() => {
    setActiveUmaIndex(0);
  }, [umaQuery]);

  useEffect(() => {
    if (!umaPickerOpen) {
      if (activeUmaIndex !== 0) setActiveUmaIndex(0);
      return;
    }
    if (umaResults.length === 0) {
      if (activeUmaIndex !== 0) setActiveUmaIndex(0);
      return;
    }
    if (activeUmaIndex >= umaResults.length) setActiveUmaIndex(umaResults.length - 1);
  }, [activeUmaIndex, umaPickerOpen, umaResults.length]);

  const handleSave = async () => {
    setSaveState('saving');
    try {
      await onSave(plan);
      setSaveState('saved');
      window.setTimeout(() => setSaveState('idle'), 1200);
    } catch {
      setSaveState('error');
    }
  };

  const handleSaveAs = async () => {
    setSaveState('saving');
    try {
      await onSaveAs(plan);
      setSaveState('saved');
      window.setTimeout(() => setSaveState('idle'), 1200);
    } catch {
      setSaveState('error');
    }
  };

  const handleSelectUma = (umaId: string) => {
    const uniqueSkillId = umaId ? uniqueByUmaId?.get(umaId)?.skillId ?? '' : '';
    onChange({ ...plan, umaId, uniqueSkillId });
    setUmaQuery('');
    setUmaPickerOpen(false);
  };

  const accentColor = focused === 'uma1' ? '#5aa0ff' : '#e0564f';

  return (
    <aside className="cmp-sidebar" aria-labelledby="cmp-plan-h">
      <section
        className="cmp-plan-card cmp-flip-card"
        data-testid="cmp-flip-card"
        data-uma={focused}
        style={{ '--uma-accent': accentColor } as React.CSSProperties}
      >
        <header className="cmp-plan-card-head cmp-flip-head" id="cmp-plan-h">
          <span className="cmp-flip-seg">
            <button
              type="button"
              className={focused === 'uma1' ? 'on' : ''}
              onClick={() => onFocusChange('uma1')}
            >
              UMA1
            </button>
            <button
              type="button"
              className={focused === 'uma2' ? 'on' : ''}
              onClick={() => onFocusChange('uma2')}
            >
              UMA2
            </button>
          </span>
        </header>
        {focused === 'uma2' && uma2Empty ? (
          <div className="cmp-uma2-empty">
            <p>No uma2 yet.</p>
            {onDuplicateUma1ToUma2 && (
              <button type="button" onClick={onDuplicateUma1ToUma2}>
                ⇋ Duplicate Uma 1
              </button>
            )}
            <p className="muted small">Or load a plan from the inventory.</p>
          </div>
        ) : (
        <div className="cmp-plan-card-body">
          {trackMismatchLabel && (
            <div className="cmp-track-mismatch-row">
              <span className="cmp-track-mismatch-chip">{trackMismatchLabel}</span>
            </div>
          )}
          <div className="cmp-name-row">
            <label className={`cmp-name-field ${autoGenerateName ? 'is-auto' : ''}`.trim()}>
              <span className="visually-hidden">Plan name</span>
              <input
                type="text"
                value={plan.name}
                readOnly={autoGenerateName}
                onChange={(e) => onChange({ ...plan, name: e.target.value })}
                aria-label="Plan name"
              />
            </label>
            <label className="cmp-name-auto-toggle">
              <span>Auto</span>
              <input
                type="checkbox"
                role="switch"
                aria-label="Auto-generate plan name"
                checked={autoGenerateName}
                onChange={(e) => {
                  const enabled = e.target.checked;
                  setAutoGeneratePlanId(enabled ? plan.id : null);
                }}
              />
            </label>
          </div>
          <label className="cmp-note-field">
            <span className="visually-hidden">Plan note</span>
            <textarea
              ref={noteTextareaRef}
              value={plan.notes ?? ''}
              onChange={(e) => onChange({ ...plan, notes: e.target.value })}
              onInput={(e) => resizeNoteTextarea(e.currentTarget)}
              aria-label="Plan note"
              placeholder="note"
              rows={1}
            />
          </label>
<div className="cmp-save-row">
            <span
              className={`cmp-save-status ${isSaved ? 'is-saved' : 'is-unsaved'}`}
              aria-live="polite"
            >
              {saveState === 'saving'
                ? 'saving...'
                : saveState === 'error'
                  ? 'save failed'
                  : isSaved
                    ? 'saved'
                    : 'unsaved'}
            </span>
            <label className="cmp-autosave-toggle">
              <span>Auto-save</span>
              <input
                type="checkbox"
                role="switch"
                aria-label="Auto-save"
                checked={autoSave}
                onChange={(e) => onAutoSaveChange(e.target.checked)}
              />
            </label>
            <div className="cmp-action-seg">
              {focused === 'uma1' && onReplicateUma2ToUma1 && (
                <button type="button" disabled={uma2Empty} onClick={onReplicateUma2ToUma1}>
                  Replicate uma2
                </button>
              )}
              {focused === 'uma2' && onDuplicateUma1ToUma2 && (
                <button type="button" onClick={onDuplicateUma1ToUma2}>
                  Replicate uma1
                </button>
              )}
              <button type="button" onClick={() => void handleSave()}>
                Save
              </button>
              <button type="button" onClick={() => void handleSaveAs()}>
                Save as
              </button>
              <button type="button" onClick={onNew}>
                New
              </button>
            </div>
          </div>

          <section className="cmp-sidebar-section" aria-labelledby="cmp-runner-h">
            <div className="cmp-runner-title-row">
              <h3 id="cmp-runner-h">Runner</h3>
              <div className="cmp-runner-role">
                <div className="cmp-mini-label">Role</div>
                <div className="cmp-control-group" aria-label="Role">
                  {ROLES.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={plan.role === value}
                      onClick={() => onChange({ ...plan, role: value })}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="cmp-runner-card">
              {plan.umaId ? <GameIcon kind="uma" id={plan.umaId} size={70} alt="" /> : <span className="cmp-portrait-ph">uma</span>}
              <div className="cmp-runner-picker">
                <label
                  className={`field cmp-compact-field cmp-uma-search-field ${
                    currentUma?.epithet && !umaPickerOpen ? 'has-epithet-overlay' : ''
                  }`.trim()}
                >
                  <span className="visually-hidden">Select uma</span>
                  <input
                    type="search"
                    value={umaQuery}
                    aria-label="Search uma or unique skill"
                    placeholder="Search uma or unique skill..."
                    onFocus={(e) => {
                      setUmaPickerOpen(true);
                      e.currentTarget.select();
                    }}
                    onClick={(e) => {
                      setUmaPickerOpen(true);
                      e.currentTarget.select();
                    }}
                    onBlur={() => window.setTimeout(() => setUmaPickerOpen(false), 120)}
                    onChange={(e) => {
                      setUmaQuery(e.target.value);
                      setUmaPickerOpen(true);
                    }}
                    onKeyDown={(e) => {
                      if (umaResults.length === 0) return;
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setUmaPickerOpen(true);
                        setActiveUmaIndex((index) => Math.min(index + 1, umaResults.length - 1));
                        return;
                      }
                      if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setUmaPickerOpen(true);
                        setActiveUmaIndex((index) => Math.max(index - 1, 0));
                        return;
                      }
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const nextUma = umaResults[activeUmaIndex];
                        if (nextUma) handleSelectUma(nextUma.umaId);
                      }
                    }}
                  />
                  {currentUma?.epithet && !umaPickerOpen && (
                    <span className="cmp-uma-input-overlay" aria-hidden="true">
                      <span className="cmp-uma-input-name">{currentUmaName}</span>
                      <span className="cmp-uma-epithet">{currentUma.epithet}</span>
                    </span>
                  )}
                </label>
                {umaPickerOpen && (
                  <ul className="cmp-uma-results" aria-label="Uma search results">
                    {umaResults.length === 0 && <li className="muted small">No matching umas.</li>}
                    {umaResults.map((uma, index) => {
                      const unique = uniqueByUmaId?.get(uma.umaId);
                      return (
                        <li key={uma.umaId}>
                          <button
                            type="button"
                            className={`cmp-uma-result ${index === activeUmaIndex ? 'is-active' : ''}`.trim()}
                            aria-pressed={plan.umaId === uma.umaId}
                            aria-selected={index === activeUmaIndex}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => handleSelectUma(uma.umaId)}
                          >
                            <GameIcon kind="uma" id={uma.umaId} size={36} alt="" />
                            <span>
                              <strong>{uma.nameEn}</strong>
                              {unique && <small>{unique.nameEn}</small>}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            <div className="cmp-unique-block">
              <div className="cmp-mini-label">Unique Skill</div>
              {uniqueSkill ? (
                <SkillDetailDisclosure
                  skill={uniqueSkill}
                  showCost={false}
                  traceContext={traceCtx}
                  collapseSignal={collapseSkillSignal}
                />
              ) : (
                <p className="muted small">Unique skill pending source data.</p>
              )}
            </div>
          </section>

          <section className="cmp-sidebar-section" aria-labelledby="cmp-stats-h">
            <h3 id="cmp-stats-h">Stats</h3>
            <div className="cmp-stat-grid">
              {STATS.map(({ key, label, shortLabel, iconId }) => (
                <label key={key} className={`cmp-stat-field cmp-stat-${key}`}>
                  <span className="cmp-stat-label">
                    <GameIcon kind="ui" id={iconId} size={18} alt="" />
                    <span>{label}</span>
                  </span>
                  <span className="cmp-stat-value-row">
                    <StatInput
                      value={plan.statProfile.stats[key]}
                      label={shortLabel}
                      onValueChange={(n) => onChange(setStat(plan, key, n))}
                    />
                  </span>
                  <span className="cmp-stat-growth">{statGrowthLabel(currentUma?.statGrowth?.[key])}</span>
                </label>
              ))}
            </div>
          </section>

          <section className="cmp-sidebar-section" aria-labelledby="cmp-target-h">
            <h3 id="cmp-target-h">Plan target</h3>
            <div className="cmp-target-block">
              <div className="cmp-apt-groups">
                {APTITUDE_GROUPS.map((group) => (
                  <section className="cmp-apt-group" key={group.label} aria-label={`${group.label} targets`}>
                    <div className="cmp-apt-group-title">{group.label}</div>
                    <div className="cmp-apt-grid">
                      {group.options.map((option) => {
                        const current = isCurrentAptitude(plan, option.aptKey);
                        const value = targetAptitude(plan, option.aptKey) ?? '';
                        return (
                          <label
                            key={`${option.aptKey.kind}-${option.aptKey.key}`}
                            className={`cmp-apt-card ${current ? 'is-current' : ''}`.trim()}
                          >
                            <span className="cmp-apt-tile-face">
                              <span className="cmp-apt-name">{option.label}</span>
                              {value ? (
                                <GameIcon kind="ui" id={gradeIconId(value)} width={15} height={14} alt="" />
                              ) : (
                                <span className="cmp-apt-any">Any</span>
                              )}
                            </span>
                            <select
                              className="cmp-tile-select"
                              aria-label={`${option.label} target aptitude`}
                              value={value}
                              onChange={(e) =>
                                onChange(
                                  setTargetAptitudeByKey(
                                    plan,
                                    option.aptKey,
                                    e.target.value as Grade | '',
                                  ),
                                )
                              }
                            >
                              {!current && <option value="">Any</option>}
                              {GRADES.map((grade) => (
                                <option key={grade} value={grade}>
                                  {grade === 'S' ? 'A/S' : grade}
                                </option>
                              ))}
                            </select>
                          </label>
                        );
                      })}
                    </div>
                  </section>
                ))}
                <section className="cmp-apt-group" aria-label="Strategy target">
                  <div className="cmp-apt-group-title">Style</div>
                  <div className="cmp-strategy-target-card">
                    <label className="cmp-apt-card cmp-strategy-target-field">
                      <span className="cmp-apt-tile-face">
                        <span className="cmp-apt-name">{selectedStrategy?.fullLabel ?? 'Strategy'}</span>
                      </span>
                      <select
                        className="cmp-tile-select"
                        aria-label="Strategy"
                        value={plan.strategy}
                        onChange={(e) =>
                          onChange(
                            setStrategyTargetAptitude(
                              plan,
                              e.target.value as Strategy,
                              strategyTargetValue,
                            ),
                          )
                        }
                      >
                        {STRATEGIES.map((strategy) => (
                          <option key={strategy.value} value={strategy.value}>
                            {strategy.fullLabel}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="cmp-apt-card cmp-strategy-target-field is-current">
                      <span className="cmp-apt-tile-face cmp-apt-grade-face">
                        <GameIcon kind="ui" id={gradeIconId(strategyTargetValue)} width={15} height={14} alt="" />
                      </span>
                      <select
                        className="cmp-tile-select"
                        aria-label="Strategy target aptitude"
                        value={strategyTargetValue}
                        onChange={(e) =>
                          onChange(
                            setStrategyTargetAptitude(
                              plan,
                              plan.strategy,
                              e.target.value as Grade,
                            ),
                          )
                        }
                      >
                        {GRADES.map((grade) => (
                          <option key={grade} value={grade}>
                            {grade === 'S' ? 'A/S' : grade}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </section>
              </div>
            </div>
            <div className="cmp-target-block">
              <section className="cmp-apt-group cmp-mood-group" aria-label="Mood target">
                <div className="cmp-apt-group-title">Mood</div>
                <label className="cmp-apt-card cmp-mood-card is-current">
                  <span className="cmp-apt-tile-face">
                    <span className="cmp-mood-face">
                      <GameIcon
                        kind="ui"
                        id={moodIconId(plan.statProfile.mood)}
                        width={56}
                        height={22}
                        alt=""
                        className="cmp-mood-pill"
                      />
                    </span>
                  </span>
                  <select
                    className="cmp-tile-select"
                    aria-label="Mood"
                    value={plan.statProfile.mood}
                    onChange={(e) =>
                      onChange({
                        ...plan,
                        statProfile: { ...plan.statProfile, mood: Number(e.target.value) as Mood },
                      })
                    }
                  >
                    {MOODS.map(({ value, label }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </section>
            </div>
            <div className="cmp-spark-summary-row" aria-label="Required pink spark summary">
              <span className="cmp-spark-summary-label">Pink sparks</span>
              <div className="cmp-spark-chip-list">
                {currentUma?.baseAptitudes ? (
                  sparkRequirements.length > 0 ? (
                    sparkRequirements.map((item) => (
                      <span
                        key={item.label}
                        className="cmp-spark-chip"
                        title={
                          item.requirement.reachesTargetAtCareerStart
                            ? 'Career-start inheritance reaches the target.'
                            : `Career-start inheritance reaches ${item.requirement.careerStartGrade}.`
                        }
                      >
                        {item.label} ★{item.requirement.stars}
                      </span>
                    ))
                  ) : (
                    <span className="cmp-spark-empty">none required</span>
                  )
                ) : (
                  <span className="cmp-spark-empty">select runner</span>
                )}
              </div>
            </div>
            {currentUma?.baseAptitudes && midRunSparkRequirements.length > 0 && (
              <div className="cmp-spark-summary-row" aria-label="Required mid-run spark summary">
                <span className="cmp-spark-summary-label">Mid-run spark</span>
                <div className="cmp-spark-chip-list">
                  {midRunSparkRequirements.map((item) => (
                    <span
                      key={item.label}
                      className="cmp-spark-chip"
                      title={`Needs ${item.requirement.inRunStepsNeeded} in-run pink proc${item.requirement.inRunStepsNeeded === 1 ? '' : 's'} after career-start inheritance.`}
                    >
                      {item.label} x {item.requirement.inRunStepsNeeded}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="cmp-sidebar-section" aria-labelledby="cmp-wishlist-h">
            <div className="cmp-section-title-row">
              <h3 id="cmp-wishlist-h">Wishlist ({plan.wishlist.length})</h3>
              <div
                ref={wishlistHeaderActionsRef}
                className="cmp-inventory-header-actions cmp-wishlist-header-actions"
              >
                {wishlistDeleteConfirm ? (
                  <>
                    <span className="cmp-inventory-confirm-text">Confirm delete all items?</span>
                    <button
                      type="button"
                      className="cmp-inventory-icon-btn is-confirm"
                      aria-label="Confirm delete all wishlist skills"
                      title="Confirm delete all wishlist skills"
                      onClick={() => {
                        onChange({ ...plan, wishlist: [] });
                        setWishlistDeleteConfirm(false);
                      }}
                    >
                      <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                        <path d="m4 10.2 3.4 3.4L16 5l1.4 1.4-10 10L2.6 11.6 4 10.2Z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="cmp-inventory-icon-btn is-cancel"
                      aria-label="Cancel delete all wishlist skills"
                      title="Cancel"
                      onClick={() => setWishlistDeleteConfirm(false)}
                    >
                      <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                        <path d="m5.3 3.9 4.7 4.7 4.7-4.7 1.4 1.4-4.7 4.7 4.7 4.7-1.4 1.4-4.7-4.7-4.7 4.7-1.4-1.4L8.6 10 3.9 5.3l1.4-1.4Z" />
                      </svg>
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="cmp-inventory-icon-btn cmp-inventory-action-btn"
                    aria-label="Delete all wishlist skills"
                    title="Delete all"
                    disabled={plan.wishlist.length === 0}
                    onClick={() => setWishlistDeleteConfirm(true)}
                  >
                    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                      <path d="M7 3h6l1 2h4v2H2V5h4l1-2Z" />
                      <path d="M4 8h12l-.8 9H4.8L4 8Zm4 2v5h1.5v-5H8Zm3.5 0v5H13v-5h-1.5Z" />
                    </svg>
                    <span>Delete all</span>
                  </button>
                )}
              </div>
            </div>
            <div className="cmp-wishlist-list">
              {plan.wishlist.length === 0 && <p className="muted small">No target skills yet.</p>}
              {plan.wishlist.map((item) => {
                const skill = wishlistSkillRecord(item.skillId, skillById);
                const summary = skill ? skillRecordToSummary(skill) : null;
                const variants = skill ? skillVariantOptions(skill, skillById) : [];
                return (
                  <div key={item.skillId} className="cmp-wishlist-line">
                    {summary ? (
                      <SkillDetailDisclosure
                        skill={summary}
                        traceContext={traceCtx}
                        collapseSignal={collapseSkillSignal}
                        side={
                          item.projectedL !== undefined ? (
                            <span className="L">+{item.projectedL.toFixed(2)}</span>
                          ) : undefined
                        }
                        technicalHeaderSide={
                          variants.length > 1 ? (
                            <label className="cmp-variant-select">
                              <span>Variant</span>
                              <select
                                aria-label={`Skill variant for ${summary.nameEn}`}
                                value={summary.skillId}
                                onChange={(e) =>
                                  onChange({
                                    ...plan,
                                    wishlist: replaceWishlistSkillVariant(
                                      plan.wishlist,
                                      item.skillId,
                                      e.target.value,
                                      skillById,
                                    ),
                                  })
                                }
                              >
                                {variants.map((variant) => (
                                  <option key={variant.skillId} value={variant.skillId}>
                                    {variant.nameEn}
                                  </option>
                                ))}
                              </select>
                            </label>
                          ) : undefined
                        }
                      />
                    ) : (
                      <span className="cmp-missing-skill">{item.skillId}</span>
                    )}
                    <button
                      type="button"
                      className="cmp-small-btn cmp-remove-skill-btn"
                      aria-label={`Remove ${summary?.nameEn ?? item.skillId}`}
                      onClick={() =>
                        onChange({
                          ...plan,
                          wishlist: plan.wishlist.filter((target) => target.skillId !== item.skillId),
                        })
                      }
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="cmp-wishlist-totals">
              <span>
                individual L <b className="L">+{projectedTotal.toFixed(2)}</b>
              </span>
              <span>
                base SP <b>{spTotal}</b>
              </span>
            </div>
            <SkillPicker
              addedSkillIds={wishlistIds}
              hiddenSkillIds={hiddenWishlistSkillIds}
              onPick={(skillId) =>
                onChange({
                  ...plan,
                  wishlist: addOrReplaceWishlistSkill(
                    plan.wishlist,
                    skillId,
                    skillById,
                    hiddenWishlistSkillIds,
                  ),
                })
              }
            />
          </section>
        </div>
        )}
      </section>
    </aside>
  );
}
