import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { strToU8, zipSync } from 'fflate';
import { currentAptitudeKeys, targetAptitude } from '@/core/simBuild';
import type { CmPlan, Grade, Stat, Strategy } from '@/core/types';
import { parsePlanFile } from '@/db';
import { GameIcon } from '@/features/data/GameIcon';
import { formatCourseLabel, type RaceSelection } from '@/features/planner/race-setup/selection';
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
  if (plan.cmRef.kind === 'cm') {
    return {
      key: `cm-${plan.cmRef.cmNumber}`,
      label: `CM${plan.cmRef.cmNumber}`,
      sort: plan.cmRef.cmNumber,
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

function safeFileName(value: string): string {
  const cleaned = value.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').replace(/\s+/g, ' ');
  return cleaned || 'uma-plan';
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadPlan(plan: CmPlan): void {
  downloadBlob(
    new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' }),
    `${safeFileName(plan.name)}.json`,
  );
}

export function createPlansZip(plans: CmPlan[]): Uint8Array {
  const files = Object.fromEntries(
    plans.map((plan, index) => [
      `${String(index + 1).padStart(2, '0')}-${safeFileName(plan.name)}.json`,
      strToU8(JSON.stringify(plan, null, 2)),
    ]),
  );
  return zipSync(files);
}

function downloadAllPlans(plans: CmPlan[], fileName = 'uma-plans.zip'): void {
  const zip = createPlansZip(plans);
  const buffer = new ArrayBuffer(zip.byteLength);
  new Uint8Array(buffer).set(zip);
  downloadBlob(new Blob([buffer], { type: 'application/zip' }), fileName);
}

function readFileText(file: File): Promise<string> {
  if (typeof file.text === 'function') return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('File could not be read.'));
    reader.readAsText(file);
  });
}

export function PlanInventoryCard({
  activePlan,
  autoApplyTrack,
  plans,
  onAutoApplyTrackChange,
  onDeletePlan,
  onDeleteAllPlans,
  onImportPlans,
  onSelectPlan,
}: {
  activePlan: CmPlan;
  autoApplyTrack: boolean;
  plans: CmPlan[];
  onAutoApplyTrackChange: (enabled: boolean) => void;
  onDeletePlan: (id: string) => Promise<void>;
  onDeleteAllPlans: () => Promise<void>;
  onImportPlans: (plans: CmPlan[]) => Promise<number>;
  onSelectPlan: (id: string) => Promise<void>;
}) {
  const [courseById, setCourseById] = useState<Map<string, CourseCatalogEntry>>(new Map());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);
  const [deleteGroupConfirm, setDeleteGroupConfirm] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ tone: 'status' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const groupDeleteToolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!deleteAllConfirm) return;
    const dismiss = (event: PointerEvent) => {
      if (!toolbarRef.current?.contains(event.target as Node)) setDeleteAllConfirm(false);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [deleteAllConfirm]);

  useEffect(() => {
    if (!deleteGroupConfirm) return;
    const dismiss = (event: PointerEvent) => {
      if (!groupDeleteToolbarRef.current?.contains(event.target as Node)) setDeleteGroupConfirm(null);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [deleteGroupConfirm]);

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

  const handleUpload = async (files: FileList) => {
    setActionMessage(null);
    try {
      const parsed = await Promise.all(
        Array.from(files).map(async (file) => parsePlanFile(JSON.parse(await readFileText(file)) as unknown)),
      );
      const count = await onImportPlans(parsed.flat());
      setActionMessage({ tone: 'status', text: `Imported ${count} plan${count === 1 ? '' : 's'}.` });
    } catch (error) {
      setActionMessage({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Plan upload failed.',
      });
    }
  };

  const handleDeleteAll = async () => {
    try {
      await onDeleteAllPlans();
      setDeleteAllConfirm(false);
      setActionMessage(null);
    } catch {
      setActionMessage({ tone: 'error', text: 'Plans could not be deleted.' });
    }
  };

  const handleDeleteGroup = async (group: PlanGroup) => {
    try {
      for (const plan of group.plans) {
        await onDeletePlan(plan.id);
      }
      setDeleteGroupConfirm(null);
      setActionMessage(null);
    } catch {
      setActionMessage({ tone: 'error', text: `${group.label} plans could not be deleted.` });
    }
  };

  return (
    <aside className="cmp-plan-inventory" aria-labelledby="cmp-inventory-h">
      <section className="cmp-plan-card">
        <header className="cmp-plan-card-head">
          <span id="cmp-inventory-h">Plan Inventory</span>
          <div ref={toolbarRef} className="cmp-inventory-header-actions">
            {deleteAllConfirm ? (
              <>
                <span className="cmp-inventory-confirm-text">Confirm delete all items?</span>
                <button
                  type="button"
                  className="cmp-inventory-icon-btn is-confirm"
                  aria-label="Confirm delete all plans"
                  title="Confirm delete all plans"
                  onClick={() => void handleDeleteAll()}
                >
                  <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                    <path d="m4 10.2 3.4 3.4L16 5l1.4 1.4-10 10L2.6 11.6 4 10.2Z" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="cmp-inventory-icon-btn is-cancel"
                  aria-label="Cancel delete all plans"
                  title="Cancel"
                  onClick={() => setDeleteAllConfirm(false)}
                >
                  <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                    <path d="m5.3 3.9 4.7 4.7 4.7-4.7 1.4 1.4-4.7 4.7 4.7 4.7-1.4 1.4-4.7-4.7-4.7 4.7-1.4-1.4L8.6 10 3.9 5.3l1.4-1.4Z" />
                  </svg>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="cmp-inventory-icon-btn cmp-inventory-action-btn"
                  aria-label="Upload plan JSON"
                  title="Upload"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                    <path d="M9 13h2V6.8l2.6 2.6L15 8l-5-5-5 5 1.4 1.4L9 6.8V13Z" />
                    <path d="M3 12h2v3h10v-3h2v5H3v-5Z" />
                  </svg>
                  <span>Upload</span>
                </button>
                <button
                  type="button"
                  className="cmp-inventory-icon-btn cmp-inventory-action-btn"
                  aria-label="Download all plans as ZIP"
                  title="Download all"
                  disabled={plans.length === 0}
                  onClick={() => downloadAllPlans(plans)}
                >
                  <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                    <path d="M9 3h2v6.2l2.6-2.6L15 8l-5 5-5-5 1.4-1.4L9 9.2V3Z" />
                    <path d="M3 12h2v3h10v-3h2v5H3v-5Z" />
                  </svg>
                  <span>Download all</span>
                </button>
                <button
                  type="button"
                  className="cmp-inventory-icon-btn cmp-inventory-action-btn"
                  aria-label="Delete all plans"
                  title="Delete all"
                  disabled={plans.length === 0}
                  onClick={() => {
                    setActionMessage(null);
                    setDeleteGroupConfirm(null);
                    setDeleteAllConfirm(true);
                  }}
                >
                  <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                    <path d="M7 3h6l1 2h4v2H2V5h4l1-2Z" />
                    <path d="M4 8h12l-.8 9H4.8L4 8Zm4 2v5h1.5v-5H8Zm3.5 0v5H13v-5h-1.5Z" />
                  </svg>
                  <span>Delete all</span>
                </button>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              multiple
              className="visually-hidden"
              aria-label="Upload plan files"
              onChange={(event) => {
                const files = event.target.files;
                event.target.value = '';
                if (files?.length) void handleUpload(files);
              }}
            />
          </div>
        </header>
        <div className="cmp-plan-card-body">
          {actionMessage && (
            <div
              className={`cmp-inventory-action-message ${actionMessage.tone === 'error' ? 'error' : 'muted'}`}
              role={actionMessage.tone === 'error' ? 'alert' : 'status'}
            >
              {actionMessage.text}
            </div>
          )}
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
                <div className="cmp-inventory-group-head">
                  <button
                    type="button"
                    className="cmp-inventory-group-toggle cmp-collapse-head"
                    aria-expanded={isOpen}
                    onClick={() => toggleGroup(group.key)}
                  >
                    <span className="cmp-inventory-group-label">{group.label}</span>
                    <span className="cmp-inventory-count">{group.plans.length}</span>
                  </button>
                  <div
                    ref={deleteGroupConfirm === group.key ? groupDeleteToolbarRef : undefined}
                    className="cmp-inventory-group-actions"
                  >
                    {deleteGroupConfirm === group.key ? (
                      <>
                        <span className="cmp-inventory-confirm-text">Confirm delete all items?</span>
                        <button
                          type="button"
                          className="cmp-inventory-icon-btn is-confirm"
                          aria-label={`Confirm delete all plans in ${group.label}`}
                          title={`Confirm delete all plans in ${group.label}`}
                          onClick={() => void handleDeleteGroup(group)}
                        >
                          <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                            <path d="m4 10.2 3.4 3.4L16 5l1.4 1.4-10 10L2.6 11.6 4 10.2Z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="cmp-inventory-icon-btn is-cancel"
                          aria-label={`Cancel delete all plans in ${group.label}`}
                          title="Cancel"
                          onClick={() => setDeleteGroupConfirm(null)}
                        >
                          <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                            <path d="m5.3 3.9 4.7 4.7 4.7-4.7 1.4 1.4-4.7 4.7 4.7 4.7-1.4 1.4-4.7-4.7-4.7 4.7-1.4-1.4L8.6 10 3.9 5.3l1.4-1.4Z" />
                          </svg>
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="cmp-inventory-icon-btn cmp-inventory-action-btn cmp-inventory-group-download"
                          aria-label={`Download all plans in ${group.label}`}
                          title="Download all"
                          onClick={() => downloadAllPlans(group.plans, `${safeFileName(group.label)}-plans.zip`)}
                        >
                          <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                            <path d="M9 3h2v6.2l2.6-2.6L15 8l-5 5-5-5 1.4-1.4L9 9.2V3Z" />
                            <path d="M3 12h2v3h10v-3h2v5H3v-5Z" />
                          </svg>
                          <span>Download all</span>
                        </button>
                        <button
                          type="button"
                          className="cmp-inventory-icon-btn cmp-inventory-action-btn"
                          aria-label={`Delete all plans in ${group.label}`}
                          title="Delete all"
                          onClick={() => {
                            setActionMessage(null);
                            setDeleteAllConfirm(false);
                            setDeleteGroupConfirm(group.key);
                          }}
                        >
                          <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                            <path d="M7 3h6l1 2h4v2H2V5h4l1-2Z" />
                            <path d="M4 8h12l-.8 9H4.8L4 8Zm4 2v5h1.5v-5H8Zm3.5 0v5H13v-5h-1.5Z" />
                          </svg>
                          <span>Delete all</span>
                        </button>
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    className="cmp-inventory-group-caret-btn"
                    aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${group.label}`}
                    aria-expanded={isOpen}
                    onClick={() => toggleGroup(group.key)}
                  >
                    <span className="cmp-collapse-caret" data-open={isOpen ? '' : undefined} />
                  </button>
                </div>
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
                          className="cmp-inventory-icon-btn"
                          aria-label={`Download ${plan.name}`}
                          title="Download plan JSON"
                          onClick={() => downloadPlan(plan)}
                        >
                          <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                            <path d="M9 3h2v6.2l2.6-2.6L15 8l-5 5-5-5 1.4-1.4L9 9.2V3Z" />
                            <path d="M3 12h2v3h10v-3h2v5H3v-5Z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="cmp-inventory-icon-btn"
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
