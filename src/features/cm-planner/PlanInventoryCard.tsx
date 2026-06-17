import { useCallback, useEffect, useMemo, useState } from 'react';
import { currentAptitudeKeys, targetAptitude } from '@/core/simBuild';
import type { CmPlan, Grade, Stat, Strategy } from '@/core/types';
import { GameIcon } from '@/features/data/GameIcon';
import { formatCourseLabel, type RaceSelection } from '@/features/planner/race-setup/selection';
import { PRESETS } from '@/features/planner/race-setup/presets';
import { trackName } from '@/features/planner/race-setup/trackCatalog';
import type { CourseCatalogEntry } from '@/sim/courseCatalog';

interface PlanGroup {
  key: string;
  label: string;
  sort: number;
  plans: CmPlan[];
}

const STRATEGY_LABEL: Record<Strategy, string> = {
  front: 'Front',
  pace: 'Pace',
  late: 'Late',
  end: 'End',
};

const STAT_ORDER: Stat[] = ['spd', 'sta', 'pow', 'gut', 'wit'];

function layoutForCourse(course: CourseCatalogEntry['course']): RaceSelection['inOut'] {
  if (course === 2) return 'inner';
  if (course === 3) return 'outer';
  if (course === 4) return 'outer-inner';
  return undefined;
}

function groupForPlan(plan: CmPlan, courseById: Map<string, CourseCatalogEntry>): Omit<PlanGroup, 'plans'> {
  const preset = PRESETS.find((p) => p.cmId === plan.cmRef.cmId || p.cmNumber === plan.cmRef.cmNumber);
  if (preset) {
    return {
      key: `cm-${preset.cmNumber}`,
      label: `CM${preset.cmNumber}`,
      sort: preset.cmNumber,
    };
  }

  const course = courseById.get(plan.cmRef.courseId);
  const label = course
    ? formatCourseLabel({
        racetrack: trackName(course.raceTrackId),
        distance: course.distance,
        inOut: layoutForCourse(course.course),
      })
    : `${plan.cmRef.surface === 'dirt' ? 'Dirt' : 'Turf'} ${plan.cmRef.distance.toLocaleString('en-US')}m`;

  return {
    key: `course-${plan.cmRef.courseId}`,
    label,
    sort: 1000 + plan.cmRef.distance,
  };
}

function groupPlans(plans: CmPlan[], courseById: Map<string, CourseCatalogEntry>): PlanGroup[] {
  const byKey = new Map<string, PlanGroup>();
  for (const plan of plans) {
    const group = groupForPlan(plan, courseById);
    const existing = byKey.get(group.key);
    if (existing) {
      existing.plans.push(plan);
    } else {
      byKey.set(group.key, { ...group, plans: [plan] });
    }
  }

  return [...byKey.values()]
    .map((group) => ({
      ...group,
      plans: [...group.plans].sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.sort - b.sort || a.label.localeCompare(b.label));
}

function cap(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function gradeLabel(grade: Grade | undefined): string {
  return grade ?? '-';
}

function statLine(plan: CmPlan): string {
  return STAT_ORDER.map((stat) => String(plan.statProfile.stats[stat])).join(' / ');
}

function aptitudeLine(plan: CmPlan): string {
  const keys = currentAptitudeKeys(plan);
  return [
    `${cap(plan.cmRef.surface)} ${gradeLabel(targetAptitude(plan, keys.surface))}`,
    `${cap(keys.distance.key)} ${gradeLabel(targetAptitude(plan, keys.distance))}`,
    `${STRATEGY_LABEL[plan.strategy]} ${gradeLabel(targetAptitude(plan, keys.strategy))}`,
  ].join(' / ');
}

export function PlanInventoryCard({
  activePlan,
  autoApplyTrack,
  plans,
  onAutoApplyTrackChange,
  onDeletePlan,
  onSelectPlan,
}: {
  activePlan: CmPlan;
  autoApplyTrack: boolean;
  plans: CmPlan[];
  onAutoApplyTrackChange: (enabled: boolean) => void;
  onDeletePlan: (id: string) => Promise<void>;
  onSelectPlan: (id: string) => Promise<void>;
}) {
  const [courseById, setCourseById] = useState<Map<string, CourseCatalogEntry>>(new Map());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');

  const refreshPlans = useCallback(async () => {
    const courses = await import('@/sim/courseCatalog')
      .then(({ courseCatalog }) => courseCatalog())
      .catch(() => [] as CourseCatalogEntry[]);
    return { courses };
  }, []);

  useEffect(() => {
    let cancelled = false;
    refreshPlans()
      .then(({ courses }) => {
        if (cancelled) return;
        const nextCourseById = new Map(courses.map((course) => [course.courseId, course]));
        const nextGroups = groupPlans(plans, nextCourseById);
        setCourseById(nextCourseById);
        setExpanded(new Set(nextGroups.map((group) => group.key)));
        setLoadState('ready');
      })
      .catch(() => {
        if (!cancelled) setLoadState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [plans, refreshPlans]);

  const groups = useMemo(() => groupPlans(plans, courseById), [courseById, plans]);
  const activePlanJson = useMemo(() => JSON.stringify(activePlan, null, 2), [activePlan]);

  const toggleGroup = (key: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSelectPlan = async (id: string) => {
    try {
      await onSelectPlan(id);
    } catch {
      setLoadState('error');
    }
  };

  const handleDeletePlan = async (id: string) => {
    try {
      await onDeletePlan(id);
    } catch {
      setLoadState('error');
    }
  };

  return (
    <aside className="cmp-plan-inventory" aria-labelledby="cmp-inventory-h">
      <section className="cmp-plan-card">
        <header className="cmp-plan-card-head">
          <span id="cmp-inventory-h">Plan Inventory</span>
        </header>
        <div className="cmp-plan-card-body">
          <details className="cmp-plan-json">
            <summary>Active plan JSON</summary>
            <pre>{activePlanJson}</pre>
          </details>
          {loadState === 'loading' && <p className="muted small">Loading plans...</p>}
          {loadState === 'error' && <p className="error small">Saved plans could not be loaded.</p>}
          {loadState === 'ready' && groups.length === 0 && <p className="muted small">No saved plans yet.</p>}
          {loadState === 'ready' && groups.map((group) => {
            const isOpen = expanded.has(group.key);
            return (
              <section key={group.key} className="cmp-inventory-group">
                <button
                  type="button"
                  className="cmp-inventory-group-head cmp-collapse-head"
                  aria-expanded={isOpen}
                  onClick={() => toggleGroup(group.key)}
                >
                  <span>{group.label}</span>
                  <span className="cmp-inventory-count">{group.plans.length}</span>
                  <span className="cmp-collapse-caret" data-open={isOpen ? '' : undefined} />
                </button>
                {isOpen && (
                  <div className="cmp-inventory-list">
                    {group.plans.map((plan) => (
                      <article
                        key={plan.id}
                        className={`cmp-inventory-row ${plan.id === activePlan.id ? 'is-active' : ''}`.trim()}
                      >
                        <button
                          type="button"
                          className="cmp-inventory-select"
                          onClick={() => void handleSelectPlan(plan.id)}
                        >
                          {plan.umaId ? (
                            <GameIcon kind="uma" id={plan.umaId} size={34} alt="" />
                          ) : (
                            <span className="cmp-inventory-portrait">uma</span>
                          )}
                          <div className="cmp-inventory-plan-main">
                            <strong>{plan.name}</strong>
                            <span>{statLine(plan)}</span>
                            <span>{aptitudeLine(plan)}</span>
                          </div>
                        </button>
                        <button
                          type="button"
                          className="cmp-inventory-delete-btn"
                          aria-label="Delete plan"
                          title="Delete plan"
                          onClick={() => void handleDeletePlan(plan.id)}
                        >
                          <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                            <path d="M7 3h6l1 2h4v2H2V5h4l1-2Z" />
                            <path d="M4 8h12l-.8 9H4.8L4 8Zm4 2v5h1.5v-5H8Zm3.5 0v5H13v-5h-1.5Z" />
                          </svg>
                        </button>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </section>
      <section className="cmp-plan-card cmp-inventory-settings-card" aria-labelledby="cmp-inventory-settings-h">
        <header className="cmp-plan-card-head">
          <span id="cmp-inventory-settings-h">Inventory settings</span>
        </header>
        <div className="cmp-plan-card-body">
          <label className="cmp-inventory-setting-row">
            <span>
              <strong>Apply track setup</strong>
              <small>Change the race setup when loading a saved Uma plan.</small>
            </span>
            <input
              type="checkbox"
              role="switch"
              aria-label="Apply track setup when loading a plan"
              checked={autoApplyTrack}
              onChange={(event) => onAutoApplyTrackChange(event.target.checked)}
            />
          </label>
        </div>
      </section>
    </aside>
  );
}
