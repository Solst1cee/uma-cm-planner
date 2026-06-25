// src/features/inheritance/InheritancePage.tsx
/** M1 — Inheritance workbench (handoff: docs/modules/design_handoff_support_card_builder/).
 *  M1.1 lands the shell + plan-context header; the column panels are placeholders
 *  that later phases (M1.2–M1.8) replace. */
import { useEffect, useMemo, useState } from 'react';
import { useActivePlan } from '@/app/ActivePlanContext';
import type { CourseCatalogEntry } from '@/sim/courseCatalog';
import { trackName } from '@/features/planner/race-setup/trackCatalog';
import { GameIcon } from '@/features/data/GameIcon';
import { useUmas } from '@/features/parents/useUmas';
import type { SearchItem } from '@/features/parents/SearchPicker';
import { useGameData } from '@/features/data/gameData';
import { PlanContextHeader } from './PlanContextHeaderView';
import { UmaPlanCard } from './UmaPlanCard';
import { umaPlanAptChips } from './umaPlanApt';
import { YourDeckCard, type DeckCardInfo } from './YourDeckCard';
import { useDeckState, useDeckTemplates } from './useDeckState';
import { addCard, TYPE_COLORS, TYPE_LABEL } from './deckOps';
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

  const { cardById } = useGameData();
  const [deck, setDeck] = useDeckState(uma1Plan?.id);
  const { templates, save, remove, get } = useDeckTemplates();

  const resolveCard = (cardId: string): DeckCardInfo | undefined => {
    const card = cardById.get(cardId);
    if (!card) return undefined;
    return { typeLabel: TYPE_LABEL[card.type], typeColor: TYPE_COLORS[card.type], name: card.nameEn };
  };
  // The fill seam M1.6's "+ Add" button will call. Referenced now to keep it live.
  const addCardToDeck = (cardId: string) => setDeck(addCard(deck, cardId));
  void addCardToDeck;

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
            onSaveTemplate={(name) => save(name, deck)}
            onLoadTemplate={(name) => {
              const t = get(name);
              if (t) setDeck({ slots: t.slots.slice(), slotLb: t.slotLb.slice() });
            }}
            onDeleteTemplate={remove}
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
