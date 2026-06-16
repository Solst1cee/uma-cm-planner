import { useEffect, useMemo, useState } from 'react';
import {
  isCurrentAptitude,
  setStrategyTargetAptitude,
  setTargetAptitudeByKey,
  targetAptitude,
} from '@/core/simBuild';
import type { AptKey, CmPlan, Grade, Mood, Role, SkillRecord, Stat, Strategy } from '@/core/types';
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

function displayToken(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function moodIconId(value: Mood): string {
  return MOODS.find((mood) => mood.value === value)?.iconId ?? 'mood-0';
}

function gradeIconId(grade: Grade): string {
  return `apt-${grade}`;
}

function generatePlanName(plan: CmPlan, umaName: string | undefined): string {
  const parts = [
    `Plan ${plan.planNumber}`,
    plan.cmRef.cmNumber > 0 ? `CM${plan.cmRef.cmNumber}` : plan.cmRef.cmId,
    umaName ?? (plan.umaId ? `Uma ${plan.umaId}` : 'No Uma'),
    displayToken(plan.role),
    displayToken(plan.strategy),
    plan.remark?.trim(),
  ];
  return parts.filter((part): part is string => part !== undefined && part !== '').join(' / ');
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

export function PlannerSidebar({
  plan,
  onChange,
  onSave,
}: {
  plan: CmPlan;
  onChange: (next: CmPlan) => void;
  onSave: () => Promise<void>;
}) {
  const { skillById, umas, umaById } = useGameData();
  const [uniqueByUmaId, setUniqueByUmaId] = useState<Map<string, SkillSummary> | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [umaQuery, setUmaQuery] = useState('');
  const [umaPickerOpen, setUmaPickerOpen] = useState(false);
  const [activeUmaIndex, setActiveUmaIndex] = useState(0);

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

  const globalUmas = useMemo(
    () => (umas ?? []).filter((u) => u.server === plan.server),
    [plan.server, umas],
  );
  const currentUma = (umaById ?? new Map()).get(plan.umaId);
  const currentUmaName = currentUma?.nameEn ?? (plan.umaId ? `Uma ${plan.umaId}` : undefined);
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
  const selectedStrategy = STRATEGIES.find((strategy) => strategy.value === plan.strategy) ?? STRATEGIES[0];
  const projectedTotal = plan.wishlist.reduce((sum, item) => sum + (item.projectedL ?? 0), 0);
  const spTotal = plan.wishlist.reduce((sum, item) => {
    const skill = wishlistSkillRecord(item.skillId, skillById);
    return sum + (skill?.baseSpCost ?? 0);
  }, 0);

  useEffect(() => {
    if (!umaPickerOpen) setUmaQuery(currentUmaName ?? '');
  }, [currentUmaName, umaPickerOpen]);

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
      await onSave();
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

  return (
    <aside className="cmp-sidebar" aria-labelledby="cmp-plan-h">
      <section className="cmp-plan-card">
        <header className="cmp-plan-card-head" id="cmp-plan-h">
          Current Uma Plan
        </header>
        <div className="cmp-plan-card-body">
          <label className="cmp-name-field">
            <span className="visually-hidden">Plan name</span>
            <input
              type="text"
              value={plan.name}
              onChange={(e) => onChange({ ...plan, name: e.target.value })}
              aria-label="Plan name"
            />
          </label>
          <div className="cmp-save-row">
            <span className="muted small">
              {saveState === 'saved' ? 'saved' : saveState === 'saving' ? 'saving...' : 'autosaves'}
            </span>
            <div className="cmp-action-seg">
              <button
                type="button"
                onClick={() => onChange({ ...plan, name: generatePlanName(plan, currentUmaName) })}
              >
                Auto-generate
              </button>
              <button type="button" onClick={() => void handleSave()}>
                Save
              </button>
              <button type="button" disabled>
                Switch
              </button>
              <button type="button" disabled>
                + New
              </button>
            </div>
          </div>

          <section className="cmp-sidebar-section" aria-labelledby="cmp-runner-h">
            <h3 id="cmp-runner-h">Runner</h3>
            <div className="cmp-runner-card">
              {plan.umaId ? <GameIcon kind="uma" id={plan.umaId} size={52} alt="" /> : <span className="cmp-portrait-ph">uma</span>}
              <div className="cmp-runner-picker">
                <label className="field cmp-compact-field cmp-uma-search-field">
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
                </label>
                {currentUma?.epithet && <span className="muted small">{currentUma.epithet}</span>}
              </div>
            </div>
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

            <div className="cmp-unique-block">
              <div className="cmp-mini-label">Unique Skill</div>
              {uniqueSkill ? (
                <SkillDetailDisclosure skill={uniqueSkill} showCost={false} />
              ) : (
                <p className="muted small">Unique skill pending source data.</p>
              )}
            </div>
          </section>

          <section className="cmp-sidebar-section" aria-labelledby="cmp-stats-h">
            <h3 id="cmp-stats-h">Stats</h3>
            <div className="cmp-stat-grid">
              {STATS.map(({ key, label, shortLabel, iconId }) => (
                <label key={key} className="cmp-stat-field">
                  <span className="cmp-stat-label">
                    <GameIcon kind="ui" id={iconId} size={18} alt="" />
                    <span>{label}</span>
                  </span>
                  <span className="cmp-stat-value-row">
                    <input
                      type="number"
                      min={0}
                      aria-label={shortLabel}
                      value={plan.statProfile.stats[key]}
                      onChange={(e) => onChange(setStat(plan, key, Number(e.target.value)))}
                    />
                  </span>
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
                        <span className="cmp-apt-name">{selectedStrategy?.label ?? 'Style'}</span>
                        <span className="cmp-apt-any">Style</span>
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
                      <span className="cmp-apt-tile-face">
                        <span className="cmp-apt-name">Target</span>
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
          </section>

          <section className="cmp-sidebar-section" aria-labelledby="cmp-wishlist-h">
            <div className="cmp-section-title-row">
              <h3 id="cmp-wishlist-h">Wishlist ({plan.wishlist.length})</h3>
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
                      className="cmp-small-btn"
                      aria-label={`Remove ${summary?.nameEn ?? item.skillId}`}
                      onClick={() =>
                        onChange({
                          ...plan,
                          wishlist: plan.wishlist.filter((target) => target.skillId !== item.skillId),
                        })
                      }
                    >
                      -
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
      </section>
    </aside>
  );
}
