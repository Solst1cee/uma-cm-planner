# M1.5 "Your deck" card — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "Your deck" placeholder in the M1 inheritance workbench with a working 6-slot support-card deck panel (drop/add, per-slot limit break, remove, clear, named templates), with its own state autosaved per active plan.

**Architecture:** A pure immutable deck-ops module (`deckOps.ts`) + a localStorage persistence hook (`useDeckState.ts`) + a provider-free presentational panel (`YourDeckCard.tsx`), wired into `InheritancePage.tsx`. The deck is its own model (NOT `CmPlan.lockedDeckSlots`) and needs no Dexie change. Drag-drop uses standard HTML5 DnD (`text/card-id`) so M1.6's card pool plugs in with zero coupling.

**Tech Stack:** TypeScript + React 19, Vitest (jsdom) + @testing-library/react, CSS in `inheritance.css`. Path alias `@/*` → `src/*`.

**Spec:** [docs/superpowers/specs/2026-06-26-m1-5-your-deck-card-design.md](../specs/2026-06-26-m1-5-your-deck-card-design.md).

## Global Constraints

- **Worktree:** all work on branch `feat/m1-5-your-deck` in worktree `C:\Users\User\Project\uma-cm-planner\.claude\worktrees\feat-m1-5-your-deck`. Run all commands there.
- **No Dexie / CmPlan schema change.** The deck is a standalone `DeckState`; do not touch `CmPlan.lockedDeckSlots` or `src/db/`.
- **Provider-free presentational components** (M1 convention): `YourDeckCard.tsx` must NOT call `useGameData`/`GameIcon` — the page resolves card display info and passes it as props.
- **Windows case-insensitive FS:** component file (`YourDeckCard.tsx`) and pure-helper siblings (`deckOps.ts`, `useDeckState.ts`) already have distinct base names — keep them distinct.
- **New-slot LB default = 4 (max).** `DEFAULT_SLOT_LB = 4`.
- **Trust `pnpm typecheck` + `pnpm build`** (vitest can flake against a running dev server — CLAUDE.md). Run new test files directly: `pnpm vitest run <path>`.
- **Tests with ≥2 render-and-query cases register `afterEach(cleanup)`** (CLAUDE.md skill-trace gotcha).
- **Commit message footer:** end every commit body with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

## File Structure

| File | Responsibility |
|---|---|
| `src/features/inheritance/deckOps.ts` (create) | Pure `DeckState` type + immutable ops + `CardType` color/label maps + `isValidDeckState` guard. No React/DOM. |
| `src/features/inheritance/deckOps.test.ts` (create) | Unit tests for all ops + guard. |
| `src/features/inheritance/useDeckState.ts` (create) | `useDeckState(planId)` per-plan autosave + `useDeckTemplates()` over `scb_profiles`. |
| `src/features/inheritance/useDeckState.test.ts` (create) | jsdom localStorage tests. |
| `src/features/inheritance/YourDeckCard.tsx` (create) | Provider-free 6-slot deck panel + toolbar + HTML5-DnD drop. |
| `src/features/inheritance/YourDeckCard.test.tsx` (create) | Component tests (provider-free, injected props). |
| `src/features/inheritance/inheritance.css` (modify) | Add `.inh-deck-*` rules. |
| `src/features/inheritance/InheritancePage.tsx` (modify) | Replace the M1.5 placeholder with `<YourDeckCard>`; lift deck state; expose `addCardToDeck`. |
| `src/features/inheritance/InheritancePage.test.tsx` (modify) | Assert the deck panel renders (6 slots). |

---

### Task 1: Pure deck ops + card-type maps (`deckOps.ts`)

**Files:**
- Create: `src/features/inheritance/deckOps.ts`
- Test: `src/features/inheritance/deckOps.test.ts`

**Interfaces:**
- Consumes: `LimitBreak` and `CardType` from `@/core/types` (`LimitBreak = 0|1|2|3|4`; `CardType = 'speed'|'stamina'|'power'|'guts'|'wit'|'friend'|'group'`).
- Produces: `DeckState`, `DECK_SLOTS=6`, `DEFAULT_SLOT_LB=4`, `emptyDeck()`, `clearDeck()`, `addCard(s,cardId,lb?)`, `dropCard(s,index,cardId,lb?)`, `removeSlot(s,index)`, `toggleSlotLb(s,index,level)`, `isValidDeckState(v)`, `TYPE_COLORS: Record<CardType,string>`, `TYPE_LABEL: Record<CardType,string>`.

- [ ] **Step 1: Write the failing tests**

Create `src/features/inheritance/deckOps.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  DECK_SLOTS, DEFAULT_SLOT_LB, TYPE_COLORS, TYPE_LABEL,
  emptyDeck, clearDeck, addCard, dropCard, removeSlot, toggleSlotLb, isValidDeckState,
} from './deckOps';

describe('emptyDeck', () => {
  it('is 6 null slots and 6 LB-4 entries', () => {
    const d = emptyDeck();
    expect(d.slots).toEqual([null, null, null, null, null, null]);
    expect(d.slotLb).toEqual([4, 4, 4, 4, 4, 4]);
    expect(DECK_SLOTS).toBe(6);
    expect(DEFAULT_SLOT_LB).toBe(4);
  });
  it('clearDeck equals emptyDeck', () => {
    expect(clearDeck()).toEqual(emptyDeck());
  });
  it('does not mutate a shared reference (fresh arrays each call)', () => {
    const a = emptyDeck();
    a.slots[0] = 'x';
    expect(emptyDeck().slots[0]).toBeNull();
  });
});

describe('addCard', () => {
  it('fills the first empty slot at LB 4', () => {
    const d = addCard(emptyDeck(), 'c1');
    expect(d.slots[0]).toBe('c1');
    expect(d.slotLb[0]).toBe(4);
  });
  it('uses the second slot when the first is taken', () => {
    const d = addCard(addCard(emptyDeck(), 'c1'), 'c2');
    expect(d.slots).toEqual(['c1', 'c2', null, null, null, null]);
  });
  it('ignores a card already in the deck', () => {
    const once = addCard(emptyDeck(), 'c1');
    expect(addCard(once, 'c1')).toEqual(once);
  });
  it('is a no-op when the deck is full', () => {
    let d = emptyDeck();
    ['a', 'b', 'c', 'd', 'e', 'f'].forEach((id) => (d = addCard(d, id)));
    expect(addCard(d, 'g')).toEqual(d);
  });
  it('honors an explicit LB', () => {
    expect(addCard(emptyDeck(), 'c1', 2).slotLb[0]).toBe(2);
  });
  it('does not mutate the input', () => {
    const input = emptyDeck();
    addCard(input, 'c1');
    expect(input.slots[0]).toBeNull();
  });
});

describe('dropCard', () => {
  it('places a card into the target slot at LB 4', () => {
    const d = dropCard(emptyDeck(), 2, 'c1');
    expect(d.slots[2]).toBe('c1');
    expect(d.slotLb[2]).toBe(4);
  });
  it('moves a card already in the deck (empties its old slot)', () => {
    const start = addCard(emptyDeck(), 'c1'); // slot 0
    const moved = dropCard(start, 3, 'c1');
    expect(moved.slots[0]).toBeNull();
    expect(moved.slots[3]).toBe('c1');
  });
  it('replaces the occupant of a filled target slot', () => {
    const start = dropCard(emptyDeck(), 1, 'c1');
    const replaced = dropCard(start, 1, 'c2');
    expect(replaced.slots[1]).toBe('c2');
  });
  it('is a no-op for an out-of-range index', () => {
    const d = emptyDeck();
    expect(dropCard(d, 9, 'c1')).toEqual(d);
  });
});

describe('removeSlot', () => {
  it('empties the slot', () => {
    const start = dropCard(emptyDeck(), 0, 'c1');
    expect(removeSlot(start, 0).slots[0]).toBeNull();
  });
  it('is a no-op for an out-of-range index', () => {
    const d = emptyDeck();
    expect(removeSlot(d, 9)).toEqual(d);
  });
});

describe('toggleSlotLb', () => {
  it('sets the LB to the clicked level', () => {
    expect(toggleSlotLb(emptyDeck(), 0, 2).slotLb[0]).toBe(2);
  });
  it('steps down by one when clicking the current top level', () => {
    const at3 = toggleSlotLb(emptyDeck(), 0, 3);
    expect(toggleSlotLb(at3, 0, 3).slotLb[0]).toBe(2);
  });
  it('clamps within 0..4', () => {
    const at1 = toggleSlotLb(emptyDeck(), 0, 1);
    expect(toggleSlotLb(at1, 0, 1).slotLb[0]).toBe(0); // 1 → step down → 0
  });
  it('is a no-op for an out-of-range index', () => {
    const d = emptyDeck();
    expect(toggleSlotLb(d, 9, 2)).toEqual(d);
  });
});

describe('isValidDeckState', () => {
  it('accepts a well-formed deck', () => {
    expect(isValidDeckState(emptyDeck())).toBe(true);
    expect(isValidDeckState({ slots: ['c1', null, null, null, null, null], slotLb: [4, 4, 4, 4, 4, 4] })).toBe(true);
  });
  it('rejects wrong slot length', () => {
    expect(isValidDeckState({ slots: [null], slotLb: [4] })).toBe(false);
  });
  it('rejects wrong member types', () => {
    expect(isValidDeckState({ slots: [1, null, null, null, null, null], slotLb: [4, 4, 4, 4, 4, 4] })).toBe(false);
    expect(isValidDeckState({ slots: [null, null, null, null, null, null], slotLb: [9, 4, 4, 4, 4, 4] })).toBe(false);
  });
  it('rejects non-objects', () => {
    expect(isValidDeckState(null)).toBe(false);
    expect(isValidDeckState('x')).toBe(false);
    expect(isValidDeckState({})).toBe(false);
  });
});

describe('card-type maps', () => {
  it('cover all 7 card types', () => {
    const types = ['speed', 'stamina', 'power', 'guts', 'wit', 'friend', 'group'] as const;
    for (const t of types) {
      expect(TYPE_COLORS[t]).toMatch(/^#[0-9a-f]{6}$/i);
      expect(TYPE_LABEL[t]).toMatch(/^[A-Z]{3}$/);
    }
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run src/features/inheritance/deckOps.test.ts`
Expected: FAIL — "Failed to resolve import './deckOps'".

- [ ] **Step 3: Write the implementation**

Create `src/features/inheritance/deckOps.ts`:

```ts
// src/features/inheritance/deckOps.ts
/** M1.5 "Your deck" — pure, immutable deck state + ops (no React/DOM).
 *  Semantics lifted from the handoff prototype (addCard/dropOn/removeSlot/toggleSlotLb).
 *  This deck is its OWN model — NOT CmPlan.lockedDeckSlots (that is M4's suggester concept). */
import type { CardType, LimitBreak } from '@/core/types';

export const DECK_SLOTS = 6;
export const DEFAULT_SLOT_LB: LimitBreak = 4;

export interface DeckState {
  /** length 6; null = empty. cardId = SupportCardRecord.cardId. */
  slots: Array<string | null>;
  /** length 6; per-slot limit break, parallel to slots. */
  slotLb: LimitBreak[];
}

/** Support-card type → display color (prototype's 5 + friend/group). */
export const TYPE_COLORS: Record<CardType, string> = {
  speed: '#3b82f6',
  stamina: '#ef4444',
  power: '#ec4899',
  guts: '#f59e0b',
  wit: '#10b981',
  friend: '#f472b6',
  group: '#a78bfa',
};

/** Support-card type → 3-letter uppercase tag shown on the slot tile. */
export const TYPE_LABEL: Record<CardType, string> = {
  speed: 'SPD',
  stamina: 'STA',
  power: 'POW',
  guts: 'GUT',
  wit: 'WIT',
  friend: 'FRD',
  group: 'GRP',
};

const inRange = (i: number) => Number.isInteger(i) && i >= 0 && i < DECK_SLOTS;
const clampLb = (n: number): LimitBreak => Math.max(0, Math.min(4, n)) as LimitBreak;

export function emptyDeck(): DeckState {
  return { slots: Array(DECK_SLOTS).fill(null), slotLb: Array(DECK_SLOTS).fill(DEFAULT_SLOT_LB) };
}

export function clearDeck(): DeckState {
  return emptyDeck();
}

export function addCard(s: DeckState, cardId: string, lb: LimitBreak = DEFAULT_SLOT_LB): DeckState {
  if (s.slots.includes(cardId)) return s;
  const i = s.slots.indexOf(null);
  if (i === -1) return s;
  const slots = s.slots.slice();
  const slotLb = s.slotLb.slice();
  slots[i] = cardId;
  slotLb[i] = clampLb(lb);
  return { slots, slotLb };
}

export function dropCard(s: DeckState, index: number, cardId: string, lb: LimitBreak = DEFAULT_SLOT_LB): DeckState {
  if (!inRange(index)) return s;
  const slots = s.slots.slice();
  const slotLb = s.slotLb.slice();
  const existing = slots.indexOf(cardId);
  if (existing !== -1) slots[existing] = null; // move
  slots[index] = cardId;
  slotLb[index] = clampLb(lb);
  return { slots, slotLb };
}

export function removeSlot(s: DeckState, index: number): DeckState {
  if (!inRange(index)) return s;
  const slots = s.slots.slice();
  slots[index] = null; // slotLb left as-is; next add/drop overwrites it
  return { slots, slotLb: s.slotLb.slice() };
}

export function toggleSlotLb(s: DeckState, index: number, level: 1 | 2 | 3 | 4): DeckState {
  if (!inRange(index)) return s;
  const slotLb = s.slotLb.slice();
  slotLb[index] = clampLb(slotLb[index] === level ? level - 1 : level);
  return { slots: s.slots.slice(), slotLb };
}

export function isValidDeckState(v: unknown): v is DeckState {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  const { slots, slotLb } = o;
  if (!Array.isArray(slots) || slots.length !== DECK_SLOTS) return false;
  if (!Array.isArray(slotLb) || slotLb.length !== DECK_SLOTS) return false;
  const slotsOk = slots.every((x) => x === null || typeof x === 'string');
  const lbOk = slotLb.every((x) => typeof x === 'number' && Number.isInteger(x) && x >= 0 && x <= 4);
  return slotsOk && lbOk;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run src/features/inheritance/deckOps.test.ts`
Expected: PASS (all describe blocks green).

- [ ] **Step 5: Commit**

```bash
git add src/features/inheritance/deckOps.ts src/features/inheritance/deckOps.test.ts
git commit -m "feat(m1): pure 6-slot deck ops + card-type maps (M1.5)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Persistence hooks (`useDeckState.ts`)

**Files:**
- Create: `src/features/inheritance/useDeckState.ts`
- Test: `src/features/inheritance/useDeckState.test.ts`

**Interfaces:**
- Consumes: `DeckState`, `emptyDeck`, `isValidDeckState` from `./deckOps`; `LimitBreak` from `@/core/types`.
- Produces: `DeckTemplate` (`{ name: string; slots: Array<string|null>; slotLb: LimitBreak[] }`), `useDeckState(planId: string | undefined): [DeckState, (next: DeckState) => void]`, `useDeckTemplates(): { templates: DeckTemplate[]; save(name, state): void; remove(name): void; get(name): DeckTemplate | undefined }`.

- [ ] **Step 1: Write the failing tests**

Create `src/features/inheritance/useDeckState.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useDeckState, useDeckTemplates } from './useDeckState';
import { addCard, emptyDeck } from './deckOps';

afterEach(cleanup);
beforeEach(() => localStorage.clear());

describe('useDeckState', () => {
  it('starts empty when nothing is stored', () => {
    const { result } = renderHook(() => useDeckState('plan-1'));
    expect(result.current[0]).toEqual(emptyDeck());
  });

  it('autosaves changes to scb_deck:<planId>', () => {
    const { result } = renderHook(() => useDeckState('plan-1'));
    act(() => result.current[1](addCard(emptyDeck(), 'c1')));
    expect(result.current[0].slots[0]).toBe('c1');
    expect(JSON.parse(localStorage.getItem('scb_deck:plan-1')!).slots[0]).toBe('c1');
  });

  it('loads a stored deck on mount', () => {
    localStorage.setItem('scb_deck:plan-1', JSON.stringify(addCard(emptyDeck(), 'c9')));
    const { result } = renderHook(() => useDeckState('plan-1'));
    expect(result.current[0].slots[0]).toBe('c9');
  });

  it('falls back to empty on a corrupt stored value', () => {
    localStorage.setItem('scb_deck:plan-1', '{not json');
    const { result } = renderHook(() => useDeckState('plan-1'));
    expect(result.current[0]).toEqual(emptyDeck());
  });

  it('swaps decks when planId changes', () => {
    localStorage.setItem('scb_deck:plan-1', JSON.stringify(addCard(emptyDeck(), 'a')));
    localStorage.setItem('scb_deck:plan-2', JSON.stringify(addCard(emptyDeck(), 'b')));
    const { result, rerender } = renderHook(({ id }) => useDeckState(id), { initialProps: { id: 'plan-1' } });
    expect(result.current[0].slots[0]).toBe('a');
    rerender({ id: 'plan-2' });
    expect(result.current[0].slots[0]).toBe('b');
  });

  it('does not write when planId is undefined', () => {
    const { result } = renderHook(() => useDeckState(undefined));
    act(() => result.current[1](addCard(emptyDeck(), 'c1')));
    expect(result.current[0].slots[0]).toBe('c1');
    expect(localStorage.length).toBe(0);
  });
});

describe('useDeckTemplates', () => {
  it('saves and reads back a template', () => {
    const { result } = renderHook(() => useDeckTemplates());
    act(() => result.current.save('aggro', addCard(emptyDeck(), 'c1')));
    expect(result.current.templates).toHaveLength(1);
    expect(result.current.get('aggro')!.slots[0]).toBe('c1');
    expect(JSON.parse(localStorage.getItem('scb_profiles')!)).toHaveLength(1);
  });

  it('upserts by name (replaces a same-name template)', () => {
    const { result } = renderHook(() => useDeckTemplates());
    act(() => result.current.save('x', addCard(emptyDeck(), 'c1')));
    act(() => result.current.save('x', addCard(emptyDeck(), 'c2')));
    expect(result.current.templates).toHaveLength(1);
    expect(result.current.get('x')!.slots[0]).toBe('c2');
  });

  it('removes a template', () => {
    const { result } = renderHook(() => useDeckTemplates());
    act(() => result.current.save('x', emptyDeck()));
    act(() => result.current.remove('x'));
    expect(result.current.templates).toHaveLength(0);
  });

  it('reads [] from a corrupt scb_profiles', () => {
    localStorage.setItem('scb_profiles', '{not json');
    const { result } = renderHook(() => useDeckTemplates());
    expect(result.current.templates).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run src/features/inheritance/useDeckState.test.ts`
Expected: FAIL — "Failed to resolve import './useDeckState'".

- [ ] **Step 3: Write the implementation**

Create `src/features/inheritance/useDeckState.ts`:

```ts
// src/features/inheritance/useDeckState.ts
/** M1.5 deck persistence (local-first, P2). Guarded localStorage like
 *  useStaminaWarnThreshold — a corrupt/missing value can never break the panel.
 *   - working deck autosaves per active plan:  scb_deck:<planId>
 *   - named templates:                         scb_profiles  (JSON array) */
import { useEffect, useRef, useState } from 'react';
import type { LimitBreak } from '@/core/types';
import { type DeckState, emptyDeck, isValidDeckState } from './deckOps';

const deckKey = (planId: string) => `scb_deck:${planId}`;
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

  const persist = (next: DeckTemplate[]) => {
    setTemplates(next);
    try {
      localStorage.setItem(TEMPLATES_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable */
    }
  };

  const save = (name: string, state: DeckState) => {
    const entry: DeckTemplate = { name, slots: state.slots.slice(), slotLb: state.slotLb.slice() };
    persist(templates.filter((t) => t.name !== name).concat(entry));
  };
  const remove = (name: string) => persist(templates.filter((t) => t.name !== name));
  const get = (name: string) => templates.find((t) => t.name === name);

  return { templates, save, remove, get };
}
```

Note: `isValidDeckState(t)` also passes for a `DeckTemplate` because the extra `name` field does not affect the `slots`/`slotLb` checks.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run src/features/inheritance/useDeckState.test.ts`
Expected: PASS.

If `useRef` import errors (it is `useRef`, not `useRef` from a sub-path), confirm the import line reads `import { useEffect, useRef, useState } from 'react';`.

- [ ] **Step 5: Commit**

```bash
git add src/features/inheritance/useDeckState.ts src/features/inheritance/useDeckState.test.ts
git commit -m "feat(m1): per-plan deck autosave + named templates hooks (M1.5)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Presentational panel + CSS (`YourDeckCard.tsx`)

**Files:**
- Create: `src/features/inheritance/YourDeckCard.tsx`
- Test: `src/features/inheritance/YourDeckCard.test.tsx`
- Modify: `src/features/inheritance/inheritance.css` (append `.inh-deck-*` rules)

**Interfaces:**
- Consumes: `DeckState`, `dropCard`, `removeSlot`, `toggleSlotLb`, `clearDeck` from `./deckOps`; `DeckTemplate` from `./useDeckState`.
- Produces: `DeckCardInfo` (`{ typeLabel: string; typeColor: string; name: string }`), `YourDeckCardProps`, `YourDeckCard` component.

- [ ] **Step 1: Write the failing tests**

Create `src/features/inheritance/YourDeckCard.test.tsx`:

```tsx
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { YourDeckCard, type DeckCardInfo } from './YourDeckCard';
import { addCard, dropCard, emptyDeck, removeSlot } from './deckOps';

afterEach(cleanup);

const resolveCard = (id: string): DeckCardInfo | undefined =>
  id === 'c1' ? { typeLabel: 'SPD', typeColor: '#3b82f6', name: 'Sky-High Crescendo' } : undefined;

function renderCard(over: Partial<React.ComponentProps<typeof YourDeckCard>> = {}) {
  const onChange = vi.fn();
  const props = {
    state: emptyDeck(),
    onChange,
    resolveCard,
    templates: [],
    onSaveTemplate: vi.fn(),
    onLoadTemplate: vi.fn(),
    onDeleteTemplate: vi.fn(),
    ...over,
  };
  render(<YourDeckCard {...props} />);
  return { ...props };
}

describe('YourDeckCard', () => {
  it('renders the title and 6 empty slots', () => {
    renderCard();
    expect(screen.getByText('Your deck')).toBeInTheDocument();
    // 6 empty slot numbers 1..6
    for (let n = 1; n <= 6; n++) expect(screen.getByText(String(n))).toBeInTheDocument();
  });

  it('renders a filled slot with its type label and LB diamonds', () => {
    renderCard({ state: addCard(emptyDeck(), 'c1') });
    expect(screen.getByText('SPD')).toBeInTheDocument();
    expect(screen.getAllByLabelText(/Limit break [1-4]/)).toHaveLength(4);
  });

  it('removing a slot fires onChange with that slot emptied', () => {
    const { onChange } = renderCard({ state: addCard(emptyDeck(), 'c1') });
    fireEvent.click(screen.getByLabelText('Remove'));
    expect(onChange).toHaveBeenCalledWith(removeSlot(addCard(emptyDeck(), 'c1'), 0));
  });

  it('clicking an LB diamond fires onChange', () => {
    const { onChange } = renderCard({ state: addCard(emptyDeck(), 'c1') });
    fireEvent.click(screen.getByLabelText('Limit break 2'));
    expect(onChange).toHaveBeenCalled();
  });

  it('Clear fires onChange with an empty deck', () => {
    const { onChange } = renderCard({ state: addCard(emptyDeck(), 'c1') });
    fireEvent.click(screen.getByText('Clear'));
    expect(onChange).toHaveBeenCalledWith(emptyDeck());
  });

  it('dropping a card fires onChange with dropCard()', () => {
    const { onChange } = renderCard();
    const slot = screen.getByTestId('deck-slot-0');
    const dataTransfer = { getData: (k: string) => (k === 'text/card-id' ? 'c1' : '') };
    fireEvent.drop(slot, { dataTransfer });
    expect(onChange).toHaveBeenCalledWith(dropCard(emptyDeck(), 0, 'c1'));
  });

  it('Save fires onSaveTemplate with the typed name', () => {
    const { onSaveTemplate } = renderCard();
    fireEvent.change(screen.getByPlaceholderText('Template name'), { target: { value: 'aggro' } });
    fireEvent.click(screen.getByText('Save'));
    expect(onSaveTemplate).toHaveBeenCalledWith('aggro');
  });

  it('selecting a template fires onLoadTemplate; Del is disabled until selection', () => {
    const { onLoadTemplate } = renderCard({
      templates: [{ name: 'aggro', slots: emptyDeck().slots, slotLb: emptyDeck().slotLb }],
    });
    expect(screen.getByText('Del')).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Load template'), { target: { value: 'aggro' } });
    expect(onLoadTemplate).toHaveBeenCalledWith('aggro');
    expect(screen.getByText('Del')).not.toBeDisabled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run src/features/inheritance/YourDeckCard.test.tsx`
Expected: FAIL — "Failed to resolve import './YourDeckCard'".

- [ ] **Step 3: Write the component**

Create `src/features/inheritance/YourDeckCard.tsx`:

```tsx
// src/features/inheritance/YourDeckCard.tsx
/** M1.5 "Your deck" — provider-free 6-slot support-card deck panel.
 *  The page resolves cardId → DeckCardInfo and passes it in (this component never
 *  calls useGameData/GameIcon, per the M1 provider-free convention). Drag-drop uses
 *  standard HTML5 DnD ('text/card-id') so M1.6's card pool plugs in with no coupling. */
import { useState } from 'react';
import { clearDeck, dropCard, removeSlot, toggleSlotLb, type DeckState } from './deckOps';
import type { DeckTemplate } from './useDeckState';

export interface DeckCardInfo {
  typeLabel: string;
  typeColor: string;
  name: string;
}

export interface YourDeckCardProps {
  state: DeckState;
  onChange: (next: DeckState) => void;
  resolveCard: (cardId: string) => DeckCardInfo | undefined;
  templates: DeckTemplate[];
  onSaveTemplate: (name: string) => void;
  onLoadTemplate: (name: string) => void;
  onDeleteTemplate: (name: string) => void;
}

const NEUTRAL: DeckCardInfo = { typeLabel: '?', typeColor: 'var(--fg-muted)', name: 'Unknown card' };

export function YourDeckCard({
  state,
  onChange,
  resolveCard,
  templates,
  onSaveTemplate,
  onLoadTemplate,
  onDeleteTemplate,
}: YourDeckCardProps) {
  const [name, setName] = useState('');
  const [selected, setSelected] = useState('');
  const [dragIndex, setDragIndex] = useState(-1);

  const handleDrop = (i: number) => (e: React.DragEvent) => {
    e.preventDefault();
    setDragIndex(-1);
    const cardId = e.dataTransfer.getData('text/card-id');
    if (cardId) onChange(dropCard(state, i, cardId));
  };

  return (
    <div className="panel inh-deck">
      <div className="inh-deck-head">
        <h2 className="inh-deck-title">
          Your deck <span className="inh-deck-sub">— 6 support slots</span>
        </h2>
        <div className="inh-deck-tools">
          <input
            type="text"
            className="inh-deck-tplname"
            value={name}
            placeholder="Template name"
            onChange={(e) => setName(e.target.value)}
          />
          <button
            type="button"
            className="cmp-small-btn"
            disabled={!name.trim()}
            onClick={() => {
              onSaveTemplate(name.trim());
              setName('');
            }}
          >
            Save
          </button>
          <select
            className="inh-deck-tplsel"
            aria-label="Load template"
            value={selected}
            onChange={(e) => {
              const v = e.target.value;
              setSelected(v);
              if (v) onLoadTemplate(v);
            }}
          >
            <option value="">Load template…</option>
            {templates.map((t) => (
              <option key={t.name} value={t.name}>
                {t.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="cmp-small-btn"
            disabled={!selected}
            onClick={() => {
              if (selected) {
                onDeleteTemplate(selected);
                setSelected('');
              }
            }}
          >
            Del
          </button>
          <button type="button" className="cmp-small-btn" onClick={() => onChange(clearDeck())}>
            Clear
          </button>
        </div>
      </div>

      <div className="inh-deck-slots">
        {state.slots.map((cardId, i) => {
          const info = cardId ? resolveCard(cardId) ?? NEUTRAL : null;
          const dragging = dragIndex === i;
          return (
            <div
              key={i}
              data-testid={`deck-slot-${i}`}
              className={`inh-deck-slot${dragging ? ' drag-over' : ''}${info ? ' is-filled' : ''}`}
              style={info ? { borderLeftColor: info.typeColor } : undefined}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragIndex !== i) setDragIndex(i);
              }}
              onDragLeave={() => {
                if (dragIndex === i) setDragIndex(-1);
              }}
              onDrop={handleDrop(i)}
            >
              {info ? (
                <>
                  <button
                    type="button"
                    className="inh-deck-remove"
                    aria-label="Remove"
                    onClick={() => onChange(removeSlot(state, i))}
                  >
                    ×
                  </button>
                  <div className="inh-deck-slot-body">
                    <span className="inh-deck-type" style={{ background: info.typeColor }} title={info.name}>
                      {info.typeLabel}
                    </span>
                    <div className="inh-deck-lb">
                      <span className="inh-deck-lb-label">LB</span>
                      <span className="inh-deck-lb-diamonds" title="Limit break level">
                        {([1, 2, 3, 4] as const).map((level) => (
                          <button
                            key={level}
                            type="button"
                            className={`inh-deck-diamond${state.slotLb[i] >= level ? ' is-on' : ''}`}
                            aria-label={`Limit break ${level}`}
                            onClick={() => onChange(toggleSlotLb(state, i, level))}
                          />
                        ))}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="inh-deck-empty">
                  <span className="inh-deck-plus">＋</span>
                  {i + 1}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Append the CSS**

Add to the end of `src/features/inheritance/inheritance.css`:

```css
/* "Your deck" card (M1.5) */
.inh-deck {
  position: sticky;
  top: 0.5rem;
  z-index: 5;
  box-shadow: 0 6px 18px rgb(36 54 78 / 0.08);
}
.inh-deck-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.inh-deck-title { margin: 0; font-size: 1rem; }
.inh-deck-sub { color: var(--fg-muted); font-weight: 400; font-size: 0.8rem; }
.inh-deck-tools { display: flex; gap: 0.35rem; align-items: center; flex-wrap: wrap; }
.inh-deck-tplname { width: 8.5rem; padding: 0.25rem 0.45rem; font-size: 0.78rem; }
.inh-deck-tplsel { width: auto; padding: 0.25rem 0.4rem; font-size: 0.78rem; }

.inh-deck-slots {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 0.5rem;
  margin-top: 0.55rem;
}
@media (max-width: 640px) {
  .inh-deck-slots { grid-template-columns: repeat(3, 1fr); }
}
.inh-deck-slot {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-height: 86px;
  padding: 0.45rem;
  border: 1.5px dashed var(--border);
  border-left: 4px solid transparent;
  border-radius: 10px;
  background: var(--bg-2);
}
.inh-deck-slot.is-filled { background: var(--bg-1); }
.inh-deck-slot.drag-over { border-color: var(--accent); background: #eef4ff; }
.inh-deck-remove {
  position: absolute;
  top: 0.2rem;
  right: 0.3rem;
  border: none;
  background: transparent;
  color: var(--fg-muted);
  cursor: pointer;
  font-size: 0.95rem;
  line-height: 1;
  padding: 0;
}
.inh-deck-slot-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
}
.inh-deck-type {
  width: 2.4rem;
  height: 2.4rem;
  border-radius: 7px;
  color: #fff;
  font-size: 0.78rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
}
.inh-deck-lb { display: flex; align-items: center; gap: 0.25rem; }
.inh-deck-lb-label { color: var(--fg-muted); font-size: 0.6rem; font-weight: 800; }
.inh-deck-lb-diamonds { display: inline-flex; gap: 3px; align-items: center; }
.inh-deck-diamond {
  width: 9px;
  height: 14px;
  padding: 0;
  border: 0;
  cursor: pointer;
  clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%);
  background: #d7dce4;
}
.inh-deck-diamond.is-on { background: linear-gradient(160deg, #ffe488, #e8a008); }
.inh-deck-empty {
  margin: auto;
  text-align: center;
  color: var(--fg-muted);
  font-size: 0.72rem;
}
.inh-deck-plus { display: block; font-size: 1rem; line-height: 1; }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm vitest run src/features/inheritance/YourDeckCard.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/inheritance/YourDeckCard.tsx src/features/inheritance/YourDeckCard.test.tsx src/features/inheritance/inheritance.css
git commit -m "feat(m1): YourDeckCard panel + deck styles (M1.5)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Wire into the page (`InheritancePage.tsx`)

**Files:**
- Modify: `src/features/inheritance/InheritancePage.tsx`
- Modify: `src/features/inheritance/InheritancePage.test.tsx`

**Interfaces:**
- Consumes: `useDeckState`, `useDeckTemplates` from `./useDeckState`; `YourDeckCard`, `DeckCardInfo` from `./YourDeckCard`; `addCard` from `./deckOps`; `TYPE_COLORS`, `TYPE_LABEL` from `./deckOps`; `useGameData` from `@/features/data/gameData` (exposes `cardById: Map<string, SupportCardRecord>`).
- Produces: the rendered deck panel; an internal `addCardToDeck(cardId)` handler (the M1.6 fill seam).

- [ ] **Step 1: Update the page test (failing)**

The existing `InheritancePage.test.tsx` renders `<InheritancePage deps={deps} />` directly and mocks `@/app/ActivePlanContext` and `@/features/parents/useUmas` — but **not** `useGameData`, which Task 4 adds to the page. Add a `useGameData` mock next to the existing `vi.mock(...)` calls (above the `import { InheritancePage }` line):

```tsx
vi.mock('@/features/data/gameData', () => ({
  useGameData: () => ({ cardById: new Map() }),
}));
```

Then add a test (inside the existing `describe('InheritancePage', ...)`) asserting the deck panel renders. There is no `renderPage` helper — render the page directly like the existing test:

```tsx
it('renders the Your deck panel with 6 empty slots', () => {
  render(<InheritancePage deps={deps} />);
  expect(screen.getByText('Your deck')).toBeInTheDocument();
  for (let n = 1; n <= 6; n++) expect(screen.getByText(String(n))).toBeInTheDocument();
});
```

(`cardById` is an empty Map, so every slot is empty and renders its number 1–6.)

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run src/features/inheritance/InheritancePage.test.tsx`
Expected: FAIL — "Your deck" not found (still the placeholder).

- [ ] **Step 3: Wire the page**

In `src/features/inheritance/InheritancePage.tsx`:

1. Add imports:
```tsx
import { useGameData } from '@/features/data/gameData';
import { YourDeckCard, type DeckCardInfo } from './YourDeckCard';
import { useDeckState, useDeckTemplates } from './useDeckState';
import { addCard, TYPE_COLORS, TYPE_LABEL } from './deckOps';
```

2. Inside `InheritancePage`, after the existing `useActivePlan()` / `useUmas()` lines, add:
```tsx
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
```

3. Replace `<Placeholder title="Your deck" phase="M1.5" />` with:
```tsx
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
```

Note on `void addCardToDeck;`: M1.6 will wire the support-card pool's Add button to `addCardToDeck`; the `void` reference keeps `noUnusedLocals` happy without a throwaway button. If the project's lint forbids `void expr`, instead export the handler shape now by leaving a `// M1.6: wire addCardToDeck to the card pool's Add button` comment and prefix the const with `_`: `const _addCardToDeck = ...`. Pick whichever the existing codebase already uses (grep for `void ` / `_unused` patterns).

- [ ] **Step 4: Run the page test + typecheck**

Run: `pnpm vitest run src/features/inheritance/InheritancePage.test.tsx`
Expected: PASS.

Run: `pnpm typecheck`
Expected: no errors. (`useGameData` requires the provider — the page is already inside it at runtime; tests use the file's existing provider wrapper.)

- [ ] **Step 5: Commit**

```bash
git add src/features/inheritance/InheritancePage.tsx src/features/inheritance/InheritancePage.test.tsx
git commit -m "feat(m1): wire Your-deck card into the workbench center column (M1.5)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Full verification + module-doc note

**Files:**
- Modify: `docs/modules/module-1-inheritance.md` (add an M1.5 landing note)

- [ ] **Step 1: Full typecheck + build + targeted tests**

Run: `pnpm typecheck`
Expected: clean.

Run: `pnpm build`
Expected: typecheck + vite build succeed.

Run: `pnpm vitest run src/features/inheritance/`
Expected: all inheritance tests pass (the 4 new files + existing M1.1/M1.2).

- [ ] **Step 2: Record the landing in the module doc**

Append to the "Next (Plans 3–5)" / card list area of `docs/modules/module-1-inheritance.md` a short note:

```markdown
## M1.5 "Your deck" card (2026-06-26)

The center-column **"Your deck"** panel landed: a 6-slot support-card deck with
drag-drop (HTML5 DnD `text/card-id`), per-slot limit-break diamond steppers,
remove/clear, and named templates. State is a dedicated `DeckState` (NOT
`CmPlan.lockedDeckSlots` — that is M4's suggester concept), **autosaved per active
plan** to `localStorage` (`scb_deck:<planId>`), with templates in `scb_profiles`.
Files: `deckOps.ts` (pure), `useDeckState.ts` (persistence), `YourDeckCard.tsx`
(provider-free panel). The fill seam `addCardToDeck(cardId)` + the drop target are
built and tested; the interactive drag *source* / "+ Add" button arrive with **M1.6**
(support-card pool). Spec/plan: 2026-06-26-m1-5-your-deck-card.
```

- [ ] **Step 3: Commit**

```bash
git add docs/modules/module-1-inheritance.md
git commit -m "docs(m1): record M1.5 Your-deck card landing

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review notes (for the implementer)

- **Spec coverage:** Task 1 = `deckOps.ts` + type maps; Task 2 = `useDeckState`/`useDeckTemplates` (autosave + templates); Task 3 = `YourDeckCard` + CSS visuals + HTML5-DnD drop; Task 4 = page wiring + `addCardToDeck` seam + `resolveCard`; Task 5 = verification + doc. M1.6/M1.7 are explicitly out of scope (spec §"Out of scope").
- **Type names are consistent across tasks:** `DeckState`, `DeckCardInfo`, `DeckTemplate`, `addCard`, `dropCard`, `removeSlot`, `toggleSlotLb`, `clearDeck`, `emptyDeck`, `isValidDeckState`, `TYPE_COLORS`, `TYPE_LABEL`, `useDeckState`, `useDeckTemplates`.
- **No new dependencies.** `@testing-library/react`'s `renderHook`/`act` are already used in the repo (used by other hook tests) — if `renderHook` is not exported from the installed version, fall back to a tiny test component that calls the hook. Verify with `pnpm vitest run src/features/inheritance/useDeckState.test.ts` at Task 2.
