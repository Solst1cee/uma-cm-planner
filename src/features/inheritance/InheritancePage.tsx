/** M1 — Inheritance workbench (handoff: docs/modules/design_handoff_support_card_builder/).
 *  M1.1 lands the shell + plan-context header; the column panels are placeholders
 *  that later phases replace. M1.2 is the "Your uma plan" card — it shows the active
 *  plan's uma and an inventory-icon button that pops the shared PlanInventoryCard
 *  (dismiss-on-outside); picking a row there switches the current plan. M1.5 adds the
 *  "Deck" card (6-slot support deck + autosave templates) in the center column. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useActivePlan } from '@/app/ActivePlanContext';
import type { CardBaseEffects, CardType, CardUniqueEffects, CmPlan, LimitBreak, TimelineEntry } from '@/core/types';
import type { CourseCatalogEntry } from '@/sim/courseCatalog';
import { trackName } from '@/features/planner/race-setup/trackCatalog';
import { GameIcon } from '@/features/data/GameIcon';
import { BASE_URL, useGameData } from '@/features/data/gameData';
import { cardRowsByKey, resolveDeckObjects, scoreCards, umaBonusFromGrowth, DEFAULT_SCENARIO } from '@/core/cardScore';
import { buildPoolItem, type PoolItem } from './poolModel';
import { useScoreWeights } from './useScoreWeights';
import { ScoreWeightsPanel } from './ScoreWeightsPanel';
import { SupportCardPoolCard, CardDetailCard } from './SupportCardPoolCard';
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
import { canAddCard, isTraineeConflict } from './deckConflicts';
import { useActiveTemplateName, useDeckState, useDeckTemplates } from './useDeckState';
import { addCard, emptyDeck, isDeckEmpty, TYPE_COLORS, TYPE_LABEL } from './deckOps';
import './inheritance.css';

/** Support-card type → the bundled in-game UI type-tile id (kind="ui"). */
const STAT_UI_ID: Partial<Record<CardType, string>> = {
  speed: 'stat-spd',
  stamina: 'stat-sta',
  power: 'stat-pow',
  guts: 'stat-gut',
  wit: 'stat-wit',
  friend: 'stat-friend',
  group: 'stat-group',
};

/** A support-card icon (square chip) or full art, with the in-game coloured
 *  stat-type tile (spd/sta/pow/gut/wit) overlaid in the top-right corner.
 *  friend/group cards have no stat type → no badge. The tile carries its own
 *  in-game colour + border, so it's shown bare, flush in the corner (no overflow). */
function cardVisual(it: { cardId: string; type: CardType }, size: number, kind: 'card' | 'card-art') {
  const statUiId = STAT_UI_ID[it.type];
  return (
    <span className="inh-pool-card-icon" style={{ width: size, height: size }}>
      <GameIcon kind={kind} id={it.cardId} size={size} alt="" className="inh-pool-card-img" />
      {statUiId && (
        <span className="inh-pool-card-type">
          <GameIcon
            kind="ui"
            id={statUiId}
            size={Math.max(15, Math.round(size * 0.28))}
            alt=""
            className="inh-pool-card-type-img"
          />
        </span>
      )}
    </span>
  );
}

/** Full illustration that fills its container (object-fit cover). Uses GameIcon
 *  `fill` so it stretches to the box. No stat-type tile here — the detail card
 *  shows that by the name instead. */
function cardArt(it: PoolItem) {
  return (
    <span className="inh-pool-card-icon inh-pool-art-fill">
      <GameIcon kind="card-art" id={it.cardId} fill alt="" className="inh-pool-art-img" />
    </span>
  );
}

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
  const { skillById, cardById, cards, timeline } = useGameData();
  const [track, setTrack] = useState<string | null>(null);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [targetsCollapsed, setTargetsCollapsed] = useState(false);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
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

  const { scenario, setScenario } = useScoreWeights();
  const [deck, setDeck] = useDeckState();
  const [cardLb, setCardLb] = useState<Record<string, LimitBreak>>({});
  // Selected pool card → its detail shows in the right-sidebar card (toggle).
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  // Per-card "Unique Effect" lines (public/data/card_unique_effects.json), lazy-loaded.
  const [uniqueEffects, setUniqueEffects] = useState<CardUniqueEffects>({});
  const [baseEffects, setBaseEffects] = useState<CardBaseEffects>({});
  useEffect(() => {
    let cancelled = false;
    const load = <T,>(file: string, set: (v: T) => void) =>
      fetch(`${BASE_URL}data/${file}`)
        .then((r) => (r.ok ? r.json() : {}))
        .then((d) => { if (!cancelled) set(d as T); })
        .catch(() => { /* optional dataset — degrade to none */ });
    void load<CardUniqueEffects>('card_unique_effects.json', setUniqueEffects);
    void load<CardBaseEffects>('card_effects.json', setBaseEffects);
    return () => { cancelled = true; };
  }, []);
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

  // Trainee's character name (a support card of the same character is blocked).
  const traineeCharName = uma1Plan ? umaById.get(uma1Plan.umaId)?.nameEn ?? null : null;

  const resolveCard = (cardId: string): DeckCardInfo | undefined => {
    const card = cardById.get(cardId);
    if (!card) return undefined;
    return {
      typeLabel: TYPE_LABEL[card.type],
      typeColor: TYPE_COLORS[card.type],
      name: card.nameEn,
      charName: card.charName,
      sameAsTrainee: isTraineeConflict(card.charName, traineeCharName),
      // Real in-game square icon + stat-type tile, same size as the pool's Icon view (60).
      icon: cardVisual({ cardId, type: card.type }, 60, 'card'),
    };
  };

  // Characters currently in the deck (only one support card per character), and a
  // guarded add that refuses trainee / duplicate-character cards.
  const deckCharNames = new Set(
    (deck.slots.filter(Boolean) as string[])
      .map((id) => cardById.get(id)?.charName)
      .filter((c): c is string => !!c),
  );
  const addToDeck = (id: string) => {
    const card = cardById.get(id);
    // Enforce the conflict rules only when the card resolves; if we can't tell the
    // character, allow the add rather than silently dropping it.
    if (card && !canAddCard({ cardCharName: card.charName, traineeCharName, deckCharNames, inDeck: deck.slots.includes(id) })) return;
    setDeck(addCard(deck, id, cardLb[id] ?? 4));
  };

  // Pool scoring memos
  const wishlist = useMemo(
    () => new Set((uma1Plan?.wishlist ?? []).map((w) => w.skillId)),
    [uma1Plan],
  );
  const byKey = useMemo(cardRowsByKey, []);
  const deckObjs = useMemo(() => resolveDeckObjects(deck, byKey), [deck, byKey]);
  const rows = useMemo(
    () =>
      cards
        .map((c) => byKey.get(`${c.cardId}:${cardLb[c.cardId] ?? 4}`))
        .filter(Boolean),
    [cards, cardLb, byKey],
  );
  const scores = useMemo(
    () => scoreCards(scenario, deckObjs, rows as never),
    [scenario, deckObjs, rows],
  );
  const items = useMemo(
    () =>
      cards.map((c) => {
        const lb = cardLb[c.cardId] ?? 4;
        return buildPoolItem(c, {
          score: scores.get(c.cardId)?.score,
          wishlist,
          lb,
          statsRow: byKey.get(`${c.cardId}:${lb}`),
        });
      }),
    [cards, scores, wishlist, cardLb, byKey],
  );
  const selectedItem = selectedCardId ? items.find((i) => i.cardId === selectedCardId) ?? null : null;
  const wishlistSkillNames = useMemo(
    () =>
      [...wishlist]
        // Unique / inherited-unique skills aren't obtainable from support cards,
        // so they can't drive a support-card filter — drop them from the chips.
        .filter((id) => {
          const r = skillById.get(id)?.rarity;
          return r !== 'unique' && r !== 'inherited_unique';
        })
        .map((id) => ({ id, name: skillById.get(id)?.nameEn ?? id })),
    [wishlist, skillById],
  );

  const uma = uma1Plan ? umaById.get(uma1Plan.umaId) ?? null : null;

  // Auto-match the scorer's "Uma's Bonuses" to the selected plan's uma growth
  // (the per-stat training multiplier). Fires only when the uma changes, so the
  // user can still hand-tune after; a ref reads the latest scenario without
  // re-running on every weight edit.
  const umaGrowth = uma?.statGrowth;
  const scenarioRef = useRef(scenario);
  scenarioRef.current = scenario;
  useEffect(() => {
    if (!umaGrowth) return;
    const next = umaBonusFromGrowth(umaGrowth);
    const s = scenarioRef.current;
    const cur = s.general.umaBonus;
    if (cur.length === next.length && next.every((v, i) => v === cur[i])) return;
    setScenario({ ...s, general: { ...s.general, umaBonus: next } });
    // Only re-run when the uma's growth changes (setScenario is stable).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [umaGrowth]);

  // Reset weights to euophrys defaults, but keep the Uma's Bonuses matched to the
  // current plan's uma (resetting those to the generic 1.06 would be wrong).
  const resetWeights = () =>
    setScenario(
      umaGrowth
        ? { ...DEFAULT_SCENARIO, general: { ...DEFAULT_SCENARIO.general, umaBonus: umaBonusFromGrowth(umaGrowth) } }
        : DEFAULT_SCENARIO,
    );

  // Derive the CM date from the timeline so JP-ahead cards are gated against the
  // plan's actual CM date (not today). Mirrors the pattern in SkillChartPanel.
  const cmNumber = uma1Plan?.cmRef.kind === 'cm' ? uma1Plan.cmRef.cmNumber : undefined;
  const cmEntry = (timeline as TimelineEntry[] | undefined)
    ?.find((e) => e.type === 'cm' && e.cm?.cmNumber === cmNumber);
  const asOfISO = cmEntry?.dates.start ?? cmEntry?.dates.finals ?? new Date().toISOString().slice(0, 10);

  const aptChips = uma1Plan ? umaPlanAptChips(uma1Plan) : [];
  const portrait = uma ? (
    // 0.9-aspect box (uma icons are 230×256) so the portrait isn't letterboxed.
    <GameIcon kind="uma" id={uma.umaId} height={64} width={Math.round(64 * 230 / 256)} alt="" />
  ) : (
    <span className="cmp-portrait-ph inh-uma-portrait-ph">uma</span>
  );

  // M1 edits (e.g. blue sparks) persist to the plan's JSON immediately — auto-save,
  // independent of the planner's auto-save toggle. setPlan keeps the UI instant.
  const editPlan = (next: CmPlan) => {
    setPlan(next);
    saveQueue.current = saveQueue.current
      .catch(() => undefined)
      .then(() => saveCurrentPlan(next, { commit: 'if-current' }));
    void saveQueue.current;
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
      asOfISO={asOfISO}
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
            onSelect={(id) => setSelectedCardId(id)}
            templates={templates}
            activeName={activeName}
            onRename={handleRename}
            onSelectTemplate={handleSelectTemplate}
            onNewTemplate={handleNewTemplate}
            onDeleteTemplate={handleDeleteTemplate}
          />
          <SupportCardPoolCard
            weightsSlot={
              <ScoreWeightsPanel scenario={scenario} onChange={setScenario} onReset={resetWeights} />
            }
            items={items}
            wishlistSkillNames={wishlistSkillNames}
            statsShown={[]}
            cardLb={cardLb}
            onCardLb={(id, lb) => setCardLb((m) => ({ ...m, [id]: lb }))}
            deckCardIds={new Set(deck.slots.filter(Boolean) as string[])}
            traineeCharName={traineeCharName}
            deckCharNames={deckCharNames}
            onAdd={addToDeck}
            renderIcon={(it, size) => cardVisual(it, size, 'card')}
            renderTypeIcon={(type, size) => {
              const id = STAT_UI_ID[type];
              return id ? <GameIcon kind="ui" id={id} size={size} alt={TYPE_LABEL[type]} /> : null;
            }}
            selectedCardId={selectedCardId}
            onSelectCard={(id) => setSelectedCardId((cur) => (cur === id ? null : id))}
            asOfISO={asOfISO}
          />
          <Placeholder title="Obtainable vs. wishlist" phase="M1.7" />
        </div>
        <div className="inh-col inh-col-right">
          <Placeholder title="Target spark" phase="M1.8" />
          {selectedItem && (
            <CardDetailCard
              item={selectedItem}
              lb={cardLb[selectedItem.cardId] ?? 4}
              onCardLb={(id, lb) => setCardLb((m) => ({ ...m, [id]: lb }))}
              inDeck={deck.slots.includes(selectedItem.cardId)}
              blocked={
                !deck.slots.includes(selectedItem.cardId) &&
                (isTraineeConflict(selectedItem.charName, traineeCharName) ||
                  deckCharNames.has(selectedItem.charName))
              }
              blockReason={
                isTraineeConflict(selectedItem.charName, traineeCharName) ? 'trainee' : 'duplicate'
              }
              deckFull={!deck.slots.includes(null)}
              onAdd={addToDeck}
              onClose={() => setSelectedCardId(null)}
              art={cardArt(selectedItem)}
              typeIcon={(() => {
                const tid = STAT_UI_ID[selectedItem.type];
                return tid ? <GameIcon kind="ui" id={tid} size={26} alt={TYPE_LABEL[selectedItem.type]} /> : null;
              })()}
              uniqueEffects={uniqueEffects[selectedItem.cardId] ?? []}
              baseEffects={baseEffects[selectedItem.cardId] ?? []}
              skillName={(id) => skillById.get(id)?.nameEn ?? id}
            />
          )}
        </div>
      </div>
    </div>
  );
}
