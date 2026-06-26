// src/features/inheritance/useDeckState.ts
/** M1.5 deck persistence (local-first, P2). Guarded localStorage like
 *  useStaminaWarnThreshold — a corrupt/missing value can never break the panel.
 *  All three are **browser-local and plan-independent** (NOT tied to the uma plan):
 *   - working deck:          scb_deck
 *   - active template name:  scb_deck_active
 *   - named templates:       scb_profiles  (JSON array) */
import { useRef, useState } from 'react';
import type { LimitBreak } from '@/core/types';
import { type DeckState, emptyDeck, isValidDeckState } from './deckOps';

const DECK_KEY = 'scb_deck';
const ACTIVE_KEY = 'scb_deck_active';
const TEMPLATES_KEY = 'scb_profiles';

export interface DeckTemplate {
  name: string;
  slots: Array<string | null>;
  slotLb: LimitBreak[];
}

function readDeck(): DeckState {
  try {
    const raw = localStorage.getItem(DECK_KEY);
    if (raw == null) return emptyDeck();
    const parsed = JSON.parse(raw);
    return isValidDeckState(parsed) ? parsed : emptyDeck();
  } catch {
    return emptyDeck();
  }
}

/** The working deck (browser-local). Autosaves on every change. */
export function useDeckState(): [DeckState, (next: DeckState) => void] {
  const [state, setState] = useState<DeckState>(() => readDeck());

  const set = (next: DeckState) => {
    setState(next);
    try {
      localStorage.setItem(DECK_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable */
    }
  };

  return [state, set];
}

/** Raw read: null = never written (no choice made yet), '' = an explicit unnamed/"New"
 *  deck the user chose. The distinction lets the page auto-default on a truly fresh
 *  workspace but leave a deliberate "New" alone across reloads. */
function readActiveRaw(): string | null {
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

/** The active template name (browser-local): the deck the editor autosaves into.
 *  Returns `[name, set, stored]` where `stored` is true once a value (including '')
 *  has been persisted — i.e. the user has made a choice. '' = an unnamed deck. */
export function useActiveTemplateName(): [string, (name: string) => void, boolean] {
  const initial = readActiveRaw();
  const [name, setNameState] = useState<string>(initial ?? '');
  const [stored, setStored] = useState<boolean>(initial !== null);

  const set = (next: string) => {
    setNameState(next);
    setStored(true); // a choice (including '' for "New") is now persisted
    try {
      localStorage.setItem(ACTIVE_KEY, next);
    } catch {
      /* storage unavailable */
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
