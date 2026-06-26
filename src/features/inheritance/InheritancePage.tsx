// src/features/inheritance/InheritancePage.tsx
/** M1 — Inheritance workbench (handoff: docs/modules/design_handoff_support_card_builder/).
 *  M1.1 lands the shell + plan-context header; the column panels are placeholders
 *  that later phases (M1.2–M1.8) replace. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useActivePlan } from '@/app/ActivePlanContext';
import type { CourseCatalogEntry } from '@/sim/courseCatalog';
import { trackName } from '@/features/planner/race-setup/trackCatalog';
import { GameIcon } from '@/features/data/GameIcon';
import { useUmas } from '@/features/parents/useUmas';
import type { SearchItem } from '@/features/parents/SearchPicker';
import { useGameData } from '@/features/data/gameData';
import type { CardType, LimitBreak } from '@/core/types';
import { cardRowsByKey, resolveDeckObjects, scoreCards } from '@/core/cardScore';
import { buildPoolItem } from './poolModel';
import { useScoreWeights } from './useScoreWeights';
import { ScoreWeightsPanel } from './ScoreWeightsPanel';
import { SupportCardPoolCard } from './SupportCardPoolCard';
import { PlanContextHeader } from './PlanContextHeaderView';
import { UmaPlanCard } from './UmaPlanCard';
import { umaPlanAptChips } from './umaPlanApt';
import { YourDeckCard, type DeckCardInfo } from './YourDeckCard';
import { useActiveTemplateName, useDeckState, useDeckTemplates } from './useDeckState';
import { addCard, emptyDeck, isDeckEmpty, TYPE_COLORS, TYPE_LABEL } from './deckOps';
import './inheritance.css';

/** Support-card training type → the bundled UI stat-icon id (kind="ui").
 *  friend/group cards have no stat type, so they get no badge. */
const STAT_UI_ID: Partial<Record<CardType, string>> = {
  speed: 'stat-spd',
  stamina: 'stat-sta',
  power: 'stat-pow',
  guts: 'stat-gut',
  wit: 'stat-wit',
};

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
  const { uma1Plan, setPlan } = useActivePlan();
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

  const { cardById, cards, skillById } = useGameData();
  const { scenario, setScenario, reset } = useScoreWeights();
  const [deck, setDeck] = useDeckState();
  const [cardLb, setCardLb] = useState<Record<string, LimitBreak>>({});
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
      cards.map((c) =>
        buildPoolItem(c, { score: scores.get(c.cardId)?.score, wishlist, lb: cardLb[c.cardId] ?? 4 }),
      ),
    [cards, scores, wishlist, cardLb],
  );
  const wishlistSkillNames = useMemo(
    () => [...wishlist].map((id) => ({ id, name: skillById.get(id)?.nameEn ?? id })),
    [wishlist, skillById],
  );

  const { umas, umaById } = useUmas();
  const uma = uma1Plan ? umaById.get(uma1Plan.umaId) ?? null : null;
  const aptChips = uma1Plan ? umaPlanAptChips(uma1Plan, uma) : [];
  const umaItems = useMemo<SearchItem[]>(
    () =>
      umas.map((u) => ({
        id: u.umaId,
        name: u.nameEn,
        sub: u.epithet,
        icon: <GameIcon kind="uma" id={u.umaId} size={24} alt="" />,
      })),
    [umas],
  );
  const portrait = uma ? (
    <GameIcon kind="uma" id={uma.umaId} size={50} alt="" />
  ) : (
    <span className="cmp-portrait-ph">uma</span>
  );
  const handlePickUma = (umaId: string) => {
    if (uma1Plan) setPlan({ ...uma1Plan, umaId });
  };

  return (
    <div className="inh-page">
      <PlanContextHeader plan={uma1Plan} trackName={track} />
      <div className="inh-grid">
        <div className="inh-col inh-col-left">
          <UmaPlanCard
            name={uma?.nameEn ?? 'No uma selected'}
            epithet={uma?.epithet}
            portrait={portrait}
            aptChips={aptChips}
            umaItems={umaItems}
            onPickUma={handlePickUma}
          />
          <Placeholder title="Plan targets" phase="M1.3" />
        </div>
        <div className="inh-col inh-col-center">
          <Placeholder title="Inheritance" phase="M1.4" />
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
          <ScoreWeightsPanel scenario={scenario} onChange={setScenario} onReset={reset} />
          <SupportCardPoolCard
            items={items}
            wishlistSkillNames={wishlistSkillNames}
            statsShown={[]}
            cardLb={cardLb}
            onCardLb={(id, lb) => setCardLb((m) => ({ ...m, [id]: lb }))}
            deckCardIds={new Set(deck.slots.filter(Boolean) as string[])}
            onAdd={(id) => setDeck(addCard(deck, id, cardLb[id] ?? 4))}
            renderIcon={(it, size) => {
              const statUiId = STAT_UI_ID[it.type];
              return (
                <span className="inh-pool-card-icon" style={{ width: size, height: size }}>
                  <GameIcon kind="card" id={it.cardId} size={size} alt="" className="inh-pool-card-img" />
                  {statUiId && (
                    <GameIcon
                      kind="ui"
                      id={statUiId}
                      size={Math.round(size * 0.44)}
                      alt=""
                      className="inh-pool-card-type"
                    />
                  )}
                </span>
              );
            }}
            skillName={(id) => skillById.get(id)?.nameEn ?? id}
          />
          <Placeholder title="Obtainable vs. wishlist" phase="M1.7" />
        </div>
        <div className="inh-col inh-col-right">
          <Placeholder title="Target spark" phase="M1.8" />
        </div>
      </div>
    </div>
  );
}
