/** M1 — Inheritance workbench (handoff: docs/modules/design_handoff_support_card_builder/).
 *  M1.1 lands the shell + plan-context header; the column panels are placeholders
 *  that later phases replace. M1.2 is the "Your uma plan" card — it shows the active
 *  plan's uma and an inventory-icon button that pops the shared PlanInventoryCard
 *  (dismiss-on-outside); picking a row there switches the current plan. M1.5 adds the
 *  "Deck" card (6-slot support deck + autosave templates) in the center column. */
import { useEffect, useRef, useState } from 'react';
import { useActivePlan } from '@/app/ActivePlanContext';
import type { CmPlan } from '@/core/types';
import type { CourseCatalogEntry } from '@/sim/courseCatalog';
import { trackName } from '@/features/planner/race-setup/trackCatalog';
import { GameIcon } from '@/features/data/GameIcon';
import { useGameData } from '@/features/data/gameData';
import { useUmas } from '@/features/parents/useUmas';
import { PlanInventoryCard } from '@/features/cm-planner/PlanInventoryCard';
import { SkillDetailDisclosure } from '@/features/cm-planner/SkillDetailDisclosure';
import { skillRecordToSummary } from '@/features/cm-planner/skillTechnicalDetails';
import { SkillPicker } from '@/features/skill-planner/SkillPicker';
import { addOrReplaceWishlistSkill, wishlistSkillRecord } from '@/features/skill-planner/skillFamilies';
import { PlanContextHeader } from './PlanContextHeaderView';
import { UmaPlanCard } from './UmaPlanCard';
import { PlanTargetsCard } from './PlanTargetsCard';
import { InheritanceCard } from './InheritanceCard';
import { umaPlanAptChips } from './umaPlanApt';
import {
  addBlueSpark,
  availableBlueStats,
  blueSparkRows,
  blueTotal,
  deleteBlueSpark,
  midRunSparkRows,
  pinkSparkRows,
  pinkSparkTotal,
  setBlueStars,
  wishlistSummary,
} from './planTargets';
import { YourDeckCard, type DeckCardInfo } from './YourDeckCard';
import { useActiveTemplateName, useDeckState, useDeckTemplates } from './useDeckState';
import { addCard, emptyDeck, isDeckEmpty, TYPE_COLORS, TYPE_LABEL } from './deckOps';
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
    setPlan,
    saveCurrentPlan,
    loadPlanIntoSlot,
    deleteSavedPlan,
    importSavedPlans,
    deleteAllSavedPlans,
  } = useActivePlan();
  const { umaById } = useUmas();
  const { skillById, cardById } = useGameData();
  const [track, setTrack] = useState<string | null>(null);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [targetsCollapsed, setTargetsCollapsed] = useState(false);
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

  const [deck, setDeck] = useDeckState();
  const { templates, save, remove, get } = useDeckTemplates();
  const [activeName, setActiveName, activeNameStored] = useActiveTemplateName();

  // Autosave: while a template is active, every deck edit live-updates that template.
  useEffect(() => {
    if (activeName) save(activeName, deck);
    // `save` is recreated each render; key on the deck + active name only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck, activeName]);

  // Before switching away, never silently lose a non-empty unnamed ("New") deck —
  // preserve it as an "Untitled" template (deduped) so the work survives.
  const preserveScratch = () => {
    if (activeName || isDeckEmpty(deck)) return;
    const taken = new Set(templates.map((t) => t.name));
    let n = 'Untitled';
    for (let i = 2; taken.has(n); i++) n = `Untitled ${i}`;
    save(n, deck);
  };

  const loadTemplate = (name: string) => {
    const t = get(name);
    if (t) setDeck({ slots: t.slots.slice(), slotLb: t.slotLb.slice() });
    setActiveName(name);
  };
  const handleSelectTemplate = (name: string) => {
    preserveScratch();
    loadTemplate(name);
  };
  // "New": keep the current cards, blank the name (detach from any template).
  const handleNewTemplate = () => setActiveName('');
  // The combobox only sends a name that is non-empty, trimmed, and NOT an existing
  // template (a collision is routed to onSelectTemplate instead) — so this only ever
  // creates or renames to a fresh unique name, never overwriting another template.
  const handleRename = (name: string) => {
    if (name === activeName) return;
    if (activeName) remove(activeName); // move the active template to the new name
    save(name, deck);
    setActiveName(name);
  };
  const handleDeleteTemplate = (name: string) => {
    // Deleting a template that isn't the one being edited: just remove it, leave the deck alone.
    if (name !== activeName) {
      remove(name);
      return;
    }
    // Deleting the active template: auto-load the next remaining one; if none left, go blank.
    const idx = templates.findIndex((t) => t.name === name);
    const remaining = templates.filter((t) => t.name !== name);
    remove(name);
    const next = remaining[Math.min(idx, remaining.length - 1)];
    if (next) {
      loadTemplate(next.name);
    } else {
      setDeck(emptyDeck());
      setActiveName('');
    }
  };

  // Once, on first load: pick the active template — the last-edited one, or, when
  // the user has none yet, seed a "Default" template from the current deck. Respects
  // any persisted choice (a name OR a deliberate "New" '') so it survives reloads.
  const didDefault = useRef(false);
  useEffect(() => {
    if (didDefault.current) return;
    didDefault.current = true;
    if (activeNameStored) return;
    if (templates.length > 0) {
      const last = templates[templates.length - 1];
      if (last) loadTemplate(last.name);
    } else {
      save('Default', deck); // first-time: always start the user with a Default template
      setActiveName('Default');
    }
    // Run once on mount; the read values are intentionally not deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resolveCard = (cardId: string): DeckCardInfo | undefined => {
    const card = cardById.get(cardId);
    if (!card) return undefined;
    return { typeLabel: TYPE_LABEL[card.type], typeColor: TYPE_COLORS[card.type], name: card.nameEn };
  };
  // The fill seam M1.6's "+ Add" button will call. Referenced now to keep it live.
  const addCardToDeck = (cardId: string) => setDeck(addCard(deck, cardId));
  void addCardToDeck;

  const uma = uma1Plan ? umaById.get(uma1Plan.umaId) ?? null : null;
  const aptChips = uma1Plan ? umaPlanAptChips(uma1Plan) : [];
  const portrait = uma ? (
    <GameIcon kind="uma" id={uma.umaId} size={64} alt="" />
  ) : (
    <span className="cmp-portrait-ph inh-uma-portrait-ph">uma</span>
  );

  // M1 edits (e.g. blue sparks) persist to the plan's JSON immediately — auto-save,
  // independent of the planner's auto-save toggle. setPlan keeps the UI instant.
  const editPlan = (next: CmPlan) => {
    setPlan(next);
    void saveCurrentPlan(next);
  };

  // Wishlist as planner-style skill plates (no traceContext → no engine/Worker),
  // each with a remove button — editable + addable like the planner wishlist.
  const wishlistPlates = uma1Plan
    ? uma1Plan.wishlist.map((item) => {
        const skill = wishlistSkillRecord(item.skillId, skillById);
        return (
          <div key={item.skillId} className="cmp-wishlist-line">
            {skill ? (
              <SkillDetailDisclosure skill={skillRecordToSummary(skill)} showCost />
            ) : (
              <span className="cmp-missing-skill">Skill {item.skillId}</span>
            )}
            <button
              type="button"
              className="cmp-small-btn cmp-remove-skill-btn"
              aria-label={`Remove ${skill?.nameEn ?? item.skillId}`}
              onClick={() =>
                editPlan({
                  ...uma1Plan,
                  wishlist: uma1Plan.wishlist.filter((t) => t.skillId !== item.skillId),
                })
              }
            >
              ×
            </button>
          </div>
        );
      })
    : [];
  const wishlistPicker = uma1Plan ? (
    <SkillPicker
      addedSkillIds={new Set(uma1Plan.wishlist.map((i) => i.skillId))}
      onPick={(skillId) =>
        editPlan({
          ...uma1Plan,
          wishlist: addOrReplaceWishlistSkill(uma1Plan.wishlist, skillId, skillById),
        })
      }
    />
  ) : null;

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
              planName={uma1Plan.name}
              name={uma?.nameEn ?? 'No uma selected'}
              epithet={uma?.epithet}
              note={uma1Plan.notes}
              portrait={portrait}
              aptChips={aptChips}
              inventory={inventory}
              inventoryOpen={inventoryOpen}
              onToggleInventory={() => setInventoryOpen((o) => !o)}
              onCloseInventory={() => setInventoryOpen(false)}
            />
          )}
          {uma1Plan && (
            <PlanTargetsCard
              collapsed={targetsCollapsed}
              onToggleCollapsed={() => setTargetsCollapsed((c) => !c)}
              blueRows={blueSparkRows(uma1Plan)}
              blueTotal={blueTotal(uma1Plan)}
              pinkComputable={uma !== null}
              pinkRows={pinkSparkRows(uma1Plan, uma)}
              pinkTotal={pinkSparkTotal(uma1Plan, uma)}
              midRunRows={midRunSparkRows(uma1Plan, uma)}
              availableBlueStats={availableBlueStats(uma1Plan)}
              wishlistPlates={wishlistPlates}
              wishlistPicker={wishlistPicker}
              summary={wishlistSummary(uma1Plan, skillById)}
              onSetBlueStars={(stat, stars) => editPlan(setBlueStars(uma1Plan, stat, stars))}
              onDeleteBlue={(stat) => editPlan(deleteBlueSpark(uma1Plan, stat))}
              onAddBlue={(stat) => editPlan(addBlueSpark(uma1Plan, stat))}
            />
          )}
        </div>
        <div className="inh-col inh-col-center">
          <InheritanceCard />
          <YourDeckCard
            state={deck}
            onChange={setDeck}
            resolveCard={resolveCard}
            templates={templates}
            activeName={activeName}
            onRename={handleRename}
            onSelectTemplate={handleSelectTemplate}
            onNewTemplate={handleNewTemplate}
            onDeleteTemplate={handleDeleteTemplate}
          />
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
