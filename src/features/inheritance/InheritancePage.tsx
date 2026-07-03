/** M1 — Inheritance workbench (handoff: docs/modules/design_handoff_support_card_builder/).
 *  M1.1 lands the shell + plan-context header; the column panels are placeholders
 *  that later phases replace. M1.2 is the "Your uma plan" card — it shows the active
 *  plan's uma and an inventory-icon button that pops the shared PlanInventoryCard
 *  (dismiss-on-outside); picking a row there switches the current plan. M1.5 adds the
 *  "Deck" card (6-slot support deck + autosave templates) in the center column. */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useActivePlan } from '@/app/ActivePlanContext';
import { useAvailability } from '@/app/useAvailability';
import type { CardBaseEffects, CardType, CardUniqueEffects, CmPlan, LimitBreak } from '@/core/types';
import type { CourseCatalogEntry } from '@/sim/courseCatalog';
import { buildUniqueToInheritedMap, reconcileGreenSkillId } from '@/core/greenSparkReconcile';
import { toSingleCircle } from '@/core/skillCircle';
import { buildCoverageMatrix } from '@/core/coverageMatrix';
import { type SkillSortMeta } from '@/core/skillCategory';
import { buildIconRank, buildSkillComparator } from './skillSort';
import { planLineageAffinity } from '@/core/lineageAffinity';
import { useRoster } from './useRoster';
import { useAffinityIndex } from './useAffinityIndex';
import { useG1SaddleSet } from './useG1SaddleSet';
import { CoverageMatrixCard } from './CoverageMatrixCard';
import { trackName } from '@/features/planner/race-setup/trackCatalog';
import { GameIcon } from '@/features/data/GameIcon';
import { BASE_URL, useGameData } from '@/features/data/gameData';
import { cardRowsByKey, resolveDeckObjects, scoreCards, umaBonusFromGrowth, DEFAULT_SCENARIO } from '@/core/cardScore';
import { buildPoolItem, type PoolItem } from './poolModel';
import { useScoreWeights } from './useScoreWeights';
import { ScoreWeightsPanel } from './ScoreWeightsPanel';
import { SupportCardPoolCard, CardDetailCard } from './SupportCardPoolCard';
import { useUmas } from '@/features/parents/useUmas';
import { HeaderHelp } from '@/features/cm-planner/HeaderHelp';
import { PlanInventoryCard } from '@/features/cm-planner/PlanInventoryCard';
import { SkillDetailDisclosure } from '@/features/cm-planner/SkillDetailDisclosure';
import { loadInnateSkillsByUmaId, loadUniqueSkillByUmaId, skillRecordToSummary, type SkillSummary } from '@/features/cm-planner/skillTechnicalDetails';
import { SkillPicker } from '@/features/skill-planner/SkillPicker';
import { addOrReplaceWishlistSkill, wishlistSkillRecord } from '@/features/skill-planner/skillFamilies';
import { SkillDetailPopover } from './SkillDetailPopover';

/** Baked skill_details.json value (build-skill-details.ts). */
interface BakedSkillDetail { effect?: string; condition?: string; durationMs?: number }
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
/** Icon-spec sort rank (features/inheritance/skillSort.ts) — computed once. */
const ICON_RANK = buildIconRank();

/** One rendered training-event entry from public/data/uma_event_details.json
 *  (baked by scripts/build-uma-event-details.ts — mirror of its UmaEventDetail). */
interface UmaEventDetail {
  name: string;
  category: string;
  jpCurrentDiffers?: boolean;
  conditions?: string[];
  choices: Array<{ option: string; rewards: Array<{ label: string; skillId?: string }> }>;
}

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
  const { skillById, cardById, cards, skills, sparkRates } = useGameData();
  const { visible, tierOf } = useAvailability();
  const { roster } = useRoster();
  const affinityIdx = useAffinityIndex();
  const g1Set = useG1SaddleSet();
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
  // Uma → skill ids obtainable via its career training events (public/data/uma_events.json).
  const [umaEventsByUmaId, setUmaEventsByUmaId] = useState<Record<string, string[]>>({});
  // Uma → rendered training-event details for the Event-cell popup
  // (public/data/uma_event_details.json — see scripts/build-uma-event-details.ts).
  const [umaEventDetails, setUmaEventDetails] = useState<Record<string, UmaEventDetail[]>>({});
  // skillId → { category, group } for sorting BOTH coverage tables.
  const [skillCategories, setSkillCategories] = useState<Record<string, SkillSortMeta>>({});
  // skillId → baked readable description for the M1.7 skill-detail popup.
  const [skillDetails, setSkillDetails] = useState<Record<string, BakedSkillDetail>>({});
  useEffect(() => {
    let cancelled = false;
    const load = <T,>(file: string, set: (v: T) => void) =>
      fetch(`${BASE_URL}data/${file}`)
        .then((r) => (r.ok ? r.json() : {}))
        .then((d) => { if (!cancelled) set(d as T); })
        .catch(() => { /* optional dataset — degrade to none */ });
    void load<CardUniqueEffects>('card_unique_effects.json', setUniqueEffects);
    void load<CardBaseEffects>('card_effects.json', setBaseEffects);
    void load<Record<string, string[]>>('uma_events.json', setUmaEventsByUmaId);
    void load<Record<string, UmaEventDetail[]>>('uma_event_details.json', setUmaEventDetails);
    void load<Record<string, SkillSortMeta>>('skill_categories.json', setSkillCategories);
    void load<Record<string, BakedSkillDetail>>('skill_details.json', setSkillDetails);
    return () => { cancelled = true; };
  }, []);
  // Uma → its innate skill kit (skillId → unlocking potential level, from the
  // engine's skill collection `sources[].needRank`). The coverage matrix's
  // Innate column keeps only the non-unique (white + gold) ones.
  const [innateByUmaId, setInnateByUmaId] = useState<Map<string, Map<string, number>> | null>(null);
  // Uma (outfit) → its unique skill, for the inherited-unique name-icon portrait.
  const [uniqueByUmaId, setUniqueByUmaId] = useState<Map<string, SkillSummary> | null>(null);
  useEffect(() => {
    let cancelled = false;
    void loadInnateSkillsByUmaId()
      .then((m) => { if (!cancelled) setInnateByUmaId(m); })
      .catch(() => { /* degrade: Innate column stays empty */ });
    void loadUniqueSkillByUmaId()
      .then((m) => { if (!cancelled) setUniqueByUmaId(m); })
      .catch(() => { /* degrade: unique name-icon falls back to skill icon */ });
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

  // Coverage matrix (M1.7)
  const umaNameById = useMemo(
    () => new Map([...umaById].map(([id, u]) => [id, u.nameEn])),
    [umaById],
  );
  const greenMap = useMemo(() => buildUniqueToInheritedMap(skills).map, [skills]);
  // group_id → its white base skill name, so a gold sorts just above its white twin.
  const groupWhiteName = useMemo(() => {
    const m = new Map<number, string>();
    for (const [id, rec] of skillById) {
      if (rec.rarity !== 'white') continue;
      const g = skillCategories[id]?.group;
      if (g === undefined) continue;
      const prev = m.get(g);
      if (prev === undefined || rec.nameEn < prev) m.set(g, rec.nameEn);
    }
    return m;
  }, [skillById, skillCategories]);
  // Comparator honouring the user's icon-spec order (uniques top, then icons).
  const compareSkills = useMemo(() => buildSkillComparator(
    (id) => {
      const rec = skillById.get(id);
      return rec ? { iconId: rec.iconId, rarity: rec.rarity, group: skillCategories[id]?.group ?? 0, name: rec.nameEn } : undefined;
    },
    ICON_RANK,
    (g) => groupWhiteName.get(g),
  ), [skillById, skillCategories, groupWhiteName]);
  // Inherited-unique / unique skillId → a uma (outfit) id, so the skill-name
  // icon can show the character portrait for uniques instead of a skill icon.
  const uniqueSkillToUma = useMemo(() => {
    const m = new Map<string, string>();
    for (const [umaId, summary] of uniqueByUmaId ?? []) {
      m.set(summary.skillId, umaId); // native unique id
      m.set(reconcileGreenSkillId(summary.skillId, greenMap), umaId); // inherited (9xxxxx) twin
    }
    return m;
  }, [uniqueByUmaId, greenMap]);
  const coverageResult = useMemo(() => {
    const wishlistSkillIds = (uma1Plan?.wishlist ?? []).map((w) => w.skillId);
    const rosterById = new Map(roster.map((p) => [p.id, p]));
    const pA = uma1Plan?.parents.a ? rosterById.get(uma1Plan.parents.a) : undefined;
    const pB = uma1Plan?.parents.b ? rosterById.get(uma1Plan.parents.b) : undefined;
    // A white spark only ever grants the single-circle (○) grade — normalise a
    // recorded ◎ id to its ○ family member so coverage/bonus display "…○".
    const normSparks = <T extends { skillId: string }>(sparks: T[]): T[] =>
      sparks.map((s) => ({ ...s, skillId: toSingleCircle(s.skillId, skillById) }));
    const normParent = (p: typeof pA): typeof pA => p && ({
      ...p,
      whiteSparks: normSparks(p.whiteSparks),
      grandparents: p.grandparents?.map((gp) => gp && { ...gp, whiteSparks: normSparks(gp.whiteSparks ?? []) }) as typeof p.grandparents,
    });
    const nA = normParent(pA);
    const nB = normParent(pB);
    const activeParents = [
      ...(nA ? [{ parent: nA, isA: true as const }] : []),
      ...(nB ? [{ parent: nB, isA: false as const }] : []),
    ];

    let memberAffinity: ((ctx: { parentId: string; grandparent: boolean; gpIndex: number }) => number | undefined) | undefined;
    if (affinityIdx && uma1Plan && pA && pB) {
      const la = planLineageAffinity(affinityIdx, uma1Plan.umaId, pA, pB, g1Set);
      memberAffinity = ({ parentId, grandparent, gpIndex }) => {
        if (!grandparent) return parentId === pA.id ? la.memberScores.parentA : parentId === pB.id ? la.memberScores.parentB : undefined;
        if (parentId === pA.id) return gpIndex === 0 ? la.memberScores.gA1 : la.memberScores.gA2;
        if (parentId === pB.id) return gpIndex === 0 ? la.memberScores.gB1 : la.memberScores.gB2;
        return undefined;
      };
    }

    const deckCards = deck.slots.filter((id): id is string => !!id).map((id) => cardById.get(id)).filter((c): c is NonNullable<typeof c> => !!c);
    const deckLbByCardId = new Map<string, LimitBreak>();
    deck.slots.forEach((id, i) => { if (id) deckLbByCardId.set(id, deck.slotLb[i] ?? 4); });

    const planUmaRec = uma1Plan ? umaById.get(uma1Plan.umaId) ?? null : null;
    // The uma's innate kit = its outfitId-associated skills, kept to white + gold
    // (drop unique / inherited-unique — not "innate" for coverage). Prefer the
    // baked UmaRecord.innateSkills if the data pipeline ever populates it.
    const innateRanks = uma1Plan ? innateByUmaId?.get(uma1Plan.umaId) : undefined;
    const innateSkills =
      planUmaRec?.innateSkills ??
      (innateRanks
        ? [...innateRanks.keys()].filter((id) => {
            const r = skillById.get(id)?.rarity;
            return r === 'white' || r === 'gold';
          })
        : []);
    const innateRankBySkillId = innateRanks ? Object.fromEntries(innateRanks) : undefined;
    // Skills this uma's career training events can grant (availability, not per-run).
    const eventSkills = uma1Plan ? (umaEventsByUmaId[uma1Plan.umaId] ?? []) : [];

    return buildCoverageMatrix({
      wishlistSkillIds,
      planUma: planUmaRec
        ? { umaId: planUmaRec.umaId, nameEn: planUmaRec.nameEn, innateSkills, eventSkills, innateRankBySkillId }
        : null,
      activeParents,
      deckCards,
      deckLbByCardId,
      skillById,
      cardById,
      greenMap,
      sparkRates,
      memberAffinity,
      umaNameById,
      compareSkills,
    });
  }, [uma1Plan, roster, affinityIdx, g1Set, skills, deck, cardById, skillById, sparkRates, umaById, umaNameById, innateByUmaId, umaEventsByUmaId, compareSkills]);

  // Event-cell hint button + popup: the training events of the plan uma that can
  // grant the (family-resolved) skill. Returns null when no details exist — the
  // cell then falls back to the plain chip.
  const renderEventHint = (skillId: string): ReactNode => {
    if (!uma1Plan) return null;
    const events = (umaEventDetails[uma1Plan.umaId] ?? []).filter((e) =>
      e.choices.some((ch) => ch.rewards.some((r) => r.skillId === skillId)));
    if (events.length === 0) return null;
    return (
      <HeaderHelp label="Training-event details" placement="right">
        <div className="inh-ev-pop">
          {events.map((e) => (
            <div key={e.name} className="inh-ev-detail">
              {/* Section 1 — event name headbar (violet lightbar) */}
              <div className="inh-ev-name">
                {e.name}
                {e.jpCurrentDiffers && (
                  <span className="inh-ev-flag" title="JP-current rewards differ — showing Global-period data">Global</span>
                )}
              </div>
              {/* Section 2 — conditions (grey) */}
              {e.conditions && e.conditions.length > 0 && (
                <div className="inh-ev-sec inh-ev-sec-cond">
                  <div className="inh-ev-sub">Conditions</div>
                  <ul className="inh-ev-conds">{e.conditions.map((c, i) => <li key={i}>{c}</li>)}</ul>
                </div>
              )}
              {/* Section 3 — rewards (white) */}
              {e.choices.map((ch, i) => (
                <div key={i} className="inh-ev-sec inh-ev-sec-reward">
                  <div className="inh-ev-sub">{ch.option || 'Reward'}</div>
                  <ul className="inh-ev-rewards">
                    {ch.rewards.map((r, j) => (
                      <li key={j} className={r.skillId === skillId ? 'is-target' : undefined}>{r.label}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ))}
        </div>
      </HeaderHelp>
    );
  };
  const byKey = useMemo(cardRowsByKey, []);
  const deckObjs = useMemo(() => resolveDeckObjects(deck, byKey), [deck, byKey]);
  // Only horizon-visible cards get scored + view-modeled — at the default
  // horizon that skips the ~300 hidden JP-ahead cards on every rebuild.
  const poolCards = useMemo(() => cards.filter((c) => visible(c)), [cards, visible]);
  const rows = useMemo(
    () =>
      poolCards
        .map((c) => byKey.get(`${c.cardId}:${cardLb[c.cardId] ?? 4}`))
        .filter(Boolean),
    [poolCards, cardLb, byKey],
  );
  const scores = useMemo(
    () => scoreCards(scenario, deckObjs, rows as never),
    [scenario, deckObjs, rows],
  );
  const items = useMemo(
    () =>
      poolCards.map((c) => {
        const lb = cardLb[c.cardId] ?? 4;
        return buildPoolItem(c, {
          score: scores.get(c.cardId)?.score,
          wishlist,
          lb,
          statsRow: byKey.get(`${c.cardId}:${lb}`),
        });
      }),
    [poolCards, scores, wishlist, cardLb, byKey],
  );
  // A deck slot can hold a card that is NOT horizon-visible (added at a wider
  // lens); clicking it must still open the detail — build its item on demand.
  const selectedItem = useMemo(() => {
    if (!selectedCardId) return null;
    const inPool = items.find((i) => i.cardId === selectedCardId);
    if (inPool) return inPool;
    const c = cards.find((x) => x.cardId === selectedCardId);
    if (!c) return null;
    const lb = cardLb[selectedCardId] ?? 4;
    return buildPoolItem(c, { wishlist, lb, statsRow: byKey.get(`${selectedCardId}:${lb}`) });
  }, [selectedCardId, items, cards, cardLb, wishlist, byKey]);
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
            visible={visible}
            tierOf={tierOf}
          />
          <CoverageMatrixCard
            result={coverageResult}
            hasWishlist={(uma1Plan?.wishlist?.length ?? 0) > 0}
            hasPlanUma={!!uma1Plan}
            renderCardIcon={(cardId, size) => (
              <GameIcon kind="card" id={cardId} size={size} alt="" className="inh-pool-card-img" />
            )}
            renderSkillIcon={(skillId) => {
              const rec = skillById.get(skillId);
              // Inherited-unique / unique → the character portrait; else the skill icon.
              if (rec && (rec.rarity === 'inherited_unique' || rec.rarity === 'unique')) {
                const umaId = uniqueSkillToUma.get(skillId);
                if (umaId) return <GameIcon kind="uma" id={umaId} size={18} alt="" className="inh-cov-name-uma" />;
              }
              return rec?.iconId
                ? <GameIcon kind="skill" id={rec.iconId} size={18} alt="" className="inh-cov-name-skill" />
                : null;
            }}
            renderSkillDetail={(skillId, name) => {
              const rec = skillById.get(skillId);
              if (!rec) return name;
              return (
                <SkillDetailPopover
                  name={name}
                  skill={{ skillId, name: rec.nameEn, rarity: rec.rarity, spCost: rec.baseSpCost, description: skillDetails[skillId]?.effect }}
                />
              );
            }}
            renderEventHint={renderEventHint}
          />
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
              skillName={(id) => skillById.get(toSingleCircle(id, skillById))?.nameEn ?? id}
            />
          )}
        </div>
      </div>
    </div>
  );
}
