import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { strToU8, zipSync } from 'fflate';
import type { CmPlan } from '@/core/types';
import { parsePlanFile } from '@/db';
import { GameIcon } from '@/features/data/GameIcon';
import { formatCourseLabel, type RaceSelection } from '@/features/planner/race-setup/selection';
import { trackName } from '@/features/planner/race-setup/trackCatalog';
import { statLine, aptitudeLine } from './planSummary';
import { useDismissOnOutside } from './useDismissOnOutside';
import type { CourseCatalogEntry } from '@/sim/courseCatalog';

interface PlanGroup {
  key: string;
  label: string;
  sort: number;
  plans: CmPlan[];
}

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

// --- inline icon glyphs (one source per icon, reused across header / group / row buttons) ---
const IconSvg = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">{children}</svg>
);
const CheckIcon = () => <IconSvg><path d="m4 10.2 3.4 3.4L16 5l1.4 1.4-10 10L2.6 11.6 4 10.2Z" /></IconSvg>;
const CloseIcon = () => <IconSvg><path d="m5.3 3.9 4.7 4.7 4.7-4.7 1.4 1.4-4.7 4.7 4.7 4.7-1.4 1.4-4.7-4.7-4.7 4.7-1.4-1.4L8.6 10 3.9 5.3l1.4-1.4Z" /></IconSvg>;
const UploadIcon = () => <IconSvg><path d="M9 13h2V6.8l2.6 2.6L15 8l-5-5-5 5 1.4 1.4L9 6.8V13Z" /><path d="M3 12h2v3h10v-3h2v5H3v-5Z" /></IconSvg>;
const DownloadIcon = () => <IconSvg><path d="M9 3h2v6.2l2.6-2.6L15 8l-5 5-5-5 1.4-1.4L9 9.2V3Z" /><path d="M3 12h2v3h10v-3h2v5H3v-5Z" /></IconSvg>;
const TrashIcon = () => <IconSvg><path d="M7 3h6l1 2h4v2H2V5h4l1-2Z" /><path d="M4 8h12l-.8 9H4.8L4 8Zm4 2v5h1.5v-5H8Zm3.5 0v5H13v-5h-1.5Z" /></IconSvg>;
const BackpackIcon = () => (
  <IconSvg>
    <path d="M7 2.5a3 3 0 0 1 6 0V4h.2A2.8 2.8 0 0 1 16 6.8v8.7A1.5 1.5 0 0 1 14.5 17h-9A1.5 1.5 0 0 1 4 15.5V6.8A2.8 2.8 0 0 1 6.8 4H7V2.5Zm1.5 0V4h3V2.5a1.5 1.5 0 0 0-3 0ZM7 9.5v3h6v-3a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1Z" />
  </IconSvg>
);
const EditIcon = () => <IconSvg><path d="M13.4 3.3 16.7 6.6 7.3 16H4v-3.3l9.4-9.4Z" /></IconSvg>;

/** The "Confirm delete all items?" check/✕ pair — header (delete-all) and per group (delete-group). */
function ConfirmDeleteToolbar({ confirmLabel, cancelLabel, onConfirm, onCancel }: {
  confirmLabel: string; cancelLabel: string; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <>
      <span className="cmp-inventory-confirm-text">Confirm delete all items?</span>
      <button type="button" className="cmp-inventory-icon-btn is-confirm" aria-label={confirmLabel} title={confirmLabel} onClick={onConfirm}>
        <CheckIcon />
      </button>
      <button type="button" className="cmp-inventory-icon-btn is-cancel" aria-label={cancelLabel} title="Cancel" onClick={onCancel}>
        <CloseIcon />
      </button>
    </>
  );
}

export function PlanInventoryCard({
  activePlan,
  autoApplyTrack,
  plans,
  collapsed,
  onAutoApplyTrackChange,
  onCollapsedChange,
  onDeletePlan,
  onDeleteAllPlans,
  onImportPlans,
  onSelectPlan,
}: {
  activePlan: CmPlan;
  autoApplyTrack: boolean;
  plans: CmPlan[];
  collapsed?: boolean;
  onAutoApplyTrackChange: (enabled: boolean) => void;
  onCollapsedChange?: (v: boolean) => void;
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

  useDismissOnOutside(toolbarRef, deleteAllConfirm, () => setDeleteAllConfirm(false));
  useDismissOnOutside(groupDeleteToolbarRef, deleteGroupConfirm !== null, () => setDeleteGroupConfirm(null));

  const [editMode, setEditMode] = useState(false);
  useEffect(() => {
    if (!editMode) return;
    const onDown = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest('[data-edit-stay]')) setEditMode(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [editMode]);

  // The course catalog is static — load it once for the group labels.
  useEffect(() => {
    let cancelled = false;
    import('@/sim/courseCatalog')
      .then(({ courseCatalog }) => courseCatalog())
      .then((courses) => {
        if (cancelled) return;
        setCourseById(new Map(courses.map((course) => [course.courseId, course])));
        setLoadState('ready');
      })
      .catch(() => {
        if (!cancelled) setLoadState('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const groups = useMemo(() => groupPlans(plans, courseById), [courseById, plans]);
  const activePlanJson = useMemo(() => JSON.stringify(activePlan, null, 2), [activePlan]);

  // All groups start expanded; re-seed from the memoized grouping (no second groupPlans pass)
  // whenever it changes — plans added/removed or the catalog finishing its load.
  useEffect(() => {
    setExpanded(new Set(groups.map((group) => group.key)));
  }, [groups]);

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
    // allSettled (not a stop-on-first-error loop) so one failed delete can't silently skip the rest
    // and leave the group half-deleted — every plan is attempted; any failure is surfaced.
    const results = await Promise.allSettled(group.plans.map((plan) => onDeletePlan(plan.id)));
    setDeleteGroupConfirm(null);
    setActionMessage(
      results.some((r) => r.status === 'rejected')
        ? { tone: 'error', text: `${group.label} plans could not be deleted.` }
        : null,
    );
  };

  if (collapsed) {
    return (
      <aside className="cmp-plan-inventory cmp-inventory-sliver">
        <button
          type="button"
          className="cmp-sliver-btn"
          aria-label="Expand inventory"
          onClick={() => onCollapsedChange?.(false)}
        >
          <span className="cmp-sliver-glyph cmp-sliver-backpack"><BackpackIcon /></span>
        </button>
      </aside>
    );
  }

  return (
    <aside className="cmp-plan-inventory" aria-labelledby="cmp-inventory-h">
      <section className="cmp-plan-card">
        <header className="cmp-plan-card-head">
          <span id="cmp-inventory-h" className="cmp-inventory-title">
            <span className="cmp-inventory-backpack"><BackpackIcon /></span>
            Plan Inventory
          </span>
          <div ref={toolbarRef} className="cmp-inventory-header-actions">
            {deleteAllConfirm ? (
              <ConfirmDeleteToolbar
                confirmLabel="Confirm delete all plans"
                cancelLabel="Cancel delete all plans"
                onConfirm={() => void handleDeleteAll()}
                onCancel={() => setDeleteAllConfirm(false)}
              />
            ) : (
              <>
                <button
                  type="button"
                  className="cmp-inventory-icon-btn cmp-inventory-action-btn"
                  aria-label="Upload plan JSON"
                  title="Upload"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <UploadIcon />
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
                  <DownloadIcon />
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
                  <TrashIcon />
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
          <button
            type="button"
            data-edit-stay
            className={`cmp-inventory-icon-btn cmp-inventory-edit-btn ${editMode ? 'is-on' : ''}`.trim()}
            aria-label="Edit inventory"
            aria-pressed={editMode}
            title="Edit"
            onClick={() => setEditMode((v) => !v)}
          >
            <EditIcon />
          </button>
          {onCollapsedChange && (
            <button
              type="button"
              className="cmp-inventory-icon-btn cmp-inventory-collapse-btn"
              aria-label="Collapse inventory"
              title="Collapse"
              onClick={() => onCollapsedChange(true)}
            >
              <span className="cmp-sliver-glyph">▤</span>
            </button>
          )}
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
                    data-edit-stay
                  >
                    {editMode && (deleteGroupConfirm === group.key ? (
                      <ConfirmDeleteToolbar
                        confirmLabel={`Confirm delete all plans in ${group.label}`}
                        cancelLabel={`Cancel delete all plans in ${group.label}`}
                        onConfirm={() => void handleDeleteGroup(group)}
                        onCancel={() => setDeleteGroupConfirm(null)}
                      />
                    ) : (
                      <>
                        <button
                          type="button"
                          className="cmp-inventory-icon-btn cmp-inventory-action-btn cmp-inventory-group-download"
                          aria-label={`Download all plans in ${group.label}`}
                          title="Download all"
                          onClick={() => downloadAllPlans(group.plans, `${safeFileName(group.label)}-plans.zip`)}
                        >
                          <DownloadIcon />
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
                          <TrashIcon />
                          <span>Delete all</span>
                        </button>
                      </>
                    ))}
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
                        {editMode && (
                          <span className="cmp-inventory-row-actions" data-edit-stay>
                            <button
                              type="button"
                              className="cmp-inventory-icon-btn"
                              aria-label={`Download ${plan.name}`}
                              title="Download plan JSON"
                              onClick={() => downloadPlan(plan)}
                            >
                              <DownloadIcon />
                            </button>
                            <button
                              type="button"
                              className="cmp-inventory-icon-btn"
                              aria-label="Delete plan"
                              title="Delete plan"
                              onClick={() => void handleDeletePlan(plan.id)}
                            >
                              <TrashIcon />
                            </button>
                          </span>
                        )}
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
