/** M1 — Inheritance workbench (handoff: docs/modules/design_handoff_support_card_builder/).
 *  M1.1 lands the shell + plan-context header; the column panels are placeholders
 *  that later phases replace. M1.2 is the "Your uma plan" card — it shows the active
 *  plan's uma and an inventory-icon button that pops the shared PlanInventoryCard
 *  (dismiss-on-outside); picking a row there switches the current plan. */
import { useEffect, useState } from 'react';
import { useActivePlan } from '@/app/ActivePlanContext';
import type { CourseCatalogEntry } from '@/sim/courseCatalog';
import { trackName } from '@/features/planner/race-setup/trackCatalog';
import { GameIcon } from '@/features/data/GameIcon';
import { useUmas } from '@/features/parents/useUmas';
import { PlanInventoryCard } from '@/features/cm-planner/PlanInventoryCard';
import { PlanContextHeader } from './PlanContextHeaderView';
import { UmaPlanCard } from './UmaPlanCard';
import { umaPlanAptChips } from './umaPlanApt';
import './inheritance.css';

interface Deps {
  loadCatalog?: () => Promise<CourseCatalogEntry[]>;
}
const defaultLoadCatalog = () => import('@/sim/courseCatalog').then((m) => m.courseCatalog());

/** Placeholder for a workbench card not yet built (M1.3–M1.8). */
function Placeholder({ title, phase }: { title: string; phase: string }) {
  return (
    <div className="panel inh-placeholder">
      <span className="inh-placeholder-title">{title}</span>
      <span className="inh-placeholder-phase">{phase}</span>
    </div>
  );
}

export function InheritancePage({ deps }: { deps?: Deps } = {}) {
  const {
    uma1Plan,
    uma2Plan,
    savedPlans,
    loadPlanIntoSlot,
    deleteSavedPlan,
    importSavedPlans,
    deleteAllSavedPlans,
  } = useActivePlan();
  const { umaById } = useUmas();
  const [track, setTrack] = useState<string | null>(null);
  const [inventoryOpen, setInventoryOpen] = useState(false);
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

  const uma = uma1Plan ? umaById.get(uma1Plan.umaId) ?? null : null;
  const aptChips = uma1Plan ? umaPlanAptChips(uma1Plan, uma) : [];
  const portrait = uma ? (
    <GameIcon kind="uma" id={uma.umaId} size={50} alt="" />
  ) : (
    <span className="cmp-portrait-ph">uma</span>
  );

  const inventory = uma1Plan ? (
    <PlanInventoryCard
      activePlan={uma1Plan}
      autoApplyTrack
      plans={savedPlans}
      focused="uma1"
      uma1PlanId={uma1Plan.id}
      uma2PlanId={uma2Plan?.id}
      hideSlotBadges
      hideSettings
      onAutoApplyTrackChange={() => {}}
      onDeletePlan={deleteSavedPlan}
      onDeleteAllPlans={deleteAllSavedPlans}
      onImportPlans={importSavedPlans}
      onLoadPlanIntoSlot={async (id, slot) => {
        await loadPlanIntoSlot(id, slot);
        setInventoryOpen(false);
      }}
    />
  ) : null;

  return (
    <div className="inh-page">
      <PlanContextHeader plan={uma1Plan} trackName={track} />
      <div className="inh-grid">
        <div className="inh-col inh-col-left">
          {uma1Plan && (
            <UmaPlanCard
              name={uma?.nameEn ?? 'No uma selected'}
              epithet={uma?.epithet}
              portrait={portrait}
              aptChips={aptChips}
              inventory={inventory}
              inventoryOpen={inventoryOpen}
              onToggleInventory={() => setInventoryOpen((o) => !o)}
              onCloseInventory={() => setInventoryOpen(false)}
            />
          )}
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
