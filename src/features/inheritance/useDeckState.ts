// src/features/inheritance/useDeckState.ts
/** M1.5 deck persistence (local-first, P2). Guarded localStorage like
 *  useStaminaWarnThreshold — a corrupt/missing value can never break the panel.
 *   - working deck autosaves per active plan:  scb_deck:<planId>
 *   - active template name per plan:           scb_deck_active:<planId>
 *   - named templates:                         scb_profiles  (JSON array) */
import { useEffect, useRef, useState } from 'react';
import type { LimitBreak } from '@/core/types';
import { type DeckState, emptyDeck, isValidDeckState } from './deckOps';

const deckKey = (planId: string) => `scb_deck:${planId}`;
const activeKey = (planId: string) => `scb_deck_active:${planId}`;
const TEMPLATES_KEY = 'scb_profiles';

export interface DeckTemplate {
  name: string;
  slots: Array<string | null>;
  slotLb: LimitBreak[];
}

function readDeck(planId: string): DeckState {
  try {
    const raw = localStorage.getItem(deckKey(planId));
    if (raw == null) return emptyDeck();
    const parsed = JSON.parse(raw);
    return isValidDeckState(parsed) ? parsed : emptyDeck();
  } catch {
    return emptyDeck();
  }
}

/** Working deck for the active plan: loads on planId change, autosaves on change.
 *  planId undefined → in-memory empty deck, no persistence. */
export function useDeckState(planId: string | undefined): [DeckState, (next: DeckState) => void] {
  const [state, setState] = useState<DeckState>(() => (planId ? readDeck(planId) : emptyDeck()));

  // Reload when the active plan changes (skip the first run — initial state already loaded it).
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    setState(planId ? readDeck(planId) : emptyDeck());
  }, [planId]);

  const set = (next: DeckState) => {
    setState(next);
    if (planId) {
      try {
        localStorage.setItem(deckKey(planId), JSON.stringify(next));
      } catch {
        /* storage unavailable */
      }
    }
  };

  return [state, set];
}

/** Raw read: null = the key was never written for this plan (no choice made yet),
 *  '' = an explicit unnamed/"New" deck the user chose. The distinction lets the page
 *  auto-default on a fresh plan but leave a deliberate "New" alone across reloads. */
function readActiveRaw(planId: string): string | null {
  try {
    return localStorage.getItem(activeKey(planId));
  } catch {
    return null;
  }
}

/** The active template name for a plan (the deck the editor is currently autosaving into).
 *  Returns `[name, set, stored]` where `stored` is true when a value (including '') has
 *  been persisted for this plan — i.e. the user has made a choice. '' = an unnamed deck.
 *  Loads on planId change, autosaves on set. planId undefined → in-memory only. */
export function useActiveTemplateName(
  planId: string | undefined,
): [string, (name: string) => void, boolean] {
  const initial = planId ? readActiveRaw(planId) : null;
  const [name, setNameState] = useState<string>(initial ?? '');
  const [stored, setStored] = useState<boolean>(initial !== null);

  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const raw = planId ? readActiveRaw(planId) : null;
    setNameState(raw ?? '');
    setStored(raw !== null);
  }, [planId]);

  const set = (next: string) => {
    setNameState(next);
    setStored(true); // a choice (including '' for "New") is now persisted
    if (planId) {
      try {
        localStorage.setItem(activeKey(planId), next);
      } catch {
        /* storage unavailable */
      }
    }
  };

  return [name, set, stored];
}

function readTemplates(): DeckTemplate[] {
  try {
    const raw = localStorage.getItem(TEMPLATES_KEY);
    if (raw == null) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (t): t is DeckTemplate =>
        typeof t === 'object' && t !== null && typeof (t as DeckTemplate).name === 'string' && isValidDeckState(t),
    );
  } catch {
    return [];
  }
}

/** Named deck templates over scb_profiles. */
export function useDeckTemplates(): {
  templates: DeckTemplate[];
  save: (name: string, state: DeckState) => void;
  remove: (name: string) => void;
  get: (name: string) => DeckTemplate | undefined;
} {
  const [templates, setTemplates] = useState<DeckTemplate[]>(() => readTemplates());
  // Mirror of `templates` kept up-to-date synchronously so `save`/`remove` always
  // read the latest array, even when called multiple times before a re-render.
  const latestTemplates = useRef<DeckTemplate[]>(templates);
  latestTemplates.current = templates;

  const persist = (next: DeckTemplate[]) => {
    // Update the ref immediately so back-to-back calls within the same event handler
    // (before React re-renders) always read the freshest array, not a stale closure.
    latestTemplates.current = next;
    // Use functional-update form as an extra safety belt.
    setTemplates(() => next);
    // Write `next` outside the updater callback to avoid double-writes in StrictMode
    // (React may invoke the updater twice; the localStorage write here runs only once).
    try {
      localStorage.setItem(TEMPLATES_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable */
    }
  };

  const save = (name: string, state: DeckState) => {
    const entry: DeckTemplate = { name, slots: state.slots.slice(), slotLb: state.slotLb.slice() };
    persist(latestTemplates.current.filter((t) => t.name !== name).concat(entry));
  };
  const remove = (name: string) => persist(latestTemplates.current.filter((t) => t.name !== name));
  const get = (name: string) => templates.find((t) => t.name === name);

  return { templates, save, remove, get };
}
