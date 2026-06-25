// src/features/inheritance/InheritancePage.tsx
/** M1 — Inheritance workbench (handoff: docs/modules/design_handoff_support_card_builder/).
 *  M1.1 lands the shell + plan-context header; the column panels are placeholders
 *  that later phases (M1.2–M1.8) replace. */
import { useEffect, useState } from 'react';
import { useActivePlan } from '@/app/ActivePlanContext';
import type { CourseCatalogEntry } from '@/sim/courseCatalog';
import { trackName } from '@/features/planner/race-setup/trackCatalog';
import { PlanContextHeader } from './PlanContextHeaderView';
import './inheritance.css';

interface Deps {
  loadCatalog?: () => Promise<CourseCatalogEntry[]>;
}
const defaultLoadCatalog = () => import('@/sim/courseCatalog').then((m) => m.courseCatalog());

/** Placeholder for a workbench card not yet built (M1.2–M1.8). */
function Placeholder({ title, phase }: { title: string; phase: string }) {
  return (
    <div className="panel inh-placeholder">
      <span className="inh-placeholder-title">{title}</span>
      <span className="inh-placeholder-phase">{phase}</span>
    </div>
  );
}

export function InheritancePage({ deps }: { deps?: Deps } = {}) {
  const { uma1Plan } = useActivePlan();
  const [track, setTrack] = useState<string | null>(null);
  const loadCatalog = deps?.loadCatalog ?? defaultLoadCatalog;

  const courseId = uma1Plan?.cmRef.courseId;
  useEffect(() => {
    if (!courseId) return;
    let cancelled = false;
    loadCatalog()
      .then((catalog) => {
        if (cancelled) return;
        const entry = catalog.find((c) => c.courseId === courseId);
        setTrack(entry ? trackName(entry.raceTrackId) : null);
      })
      .catch(() => {
        if (!cancelled) setTrack(null);
      });
    return () => {
      cancelled = true;
    };
    // loadCatalog is stable (module default or test-injected); key on the course only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  return (
    <div className="inh-page">
      <PlanContextHeader plan={uma1Plan} trackName={track} />
      <div className="inh-grid">
        <div className="inh-col inh-col-left">
          <Placeholder title="Your uma plan" phase="M1.2" />
          <Placeholder title="Plan targets" phase="M1.3" />
        </div>
        <div className="inh-col inh-col-center">
          <Placeholder title="Inheritance" phase="M1.4" />
          <Placeholder title="Your deck" phase="M1.5" />
          <Placeholder title="Support cards" phase="M1.6" />
          <Placeholder title="Obtainable vs. wishlist" phase="M1.7" />
        </div>
        <div className="inh-col inh-col-right">
          <Placeholder title="Target spark" phase="M1.8" />
        </div>
      </div>
    </div>
  );
}
