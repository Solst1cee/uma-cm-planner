// src/features/inheritance/YourDeckCard.tsx
/** M1.5 "Your deck" — provider-free 6-slot support-card deck panel.
 *  The page resolves cardId → DeckCardInfo and passes it in (this component never
 *  calls useGameData/GameIcon, per the M1 provider-free convention). Drag-drop uses
 *  standard HTML5 DnD ('text/card-id') so M1.6's card pool plugs in with no coupling. */
import { useEffect, useRef, useState } from 'react';
import type { DragEvent, KeyboardEvent, ReactNode } from 'react';
import { useDismissOnOutside } from '@/features/cm-planner/useDismissOnOutside';
import { clearDeck, dropCard, moveSlot, removeSlot, toggleSlotLb, DEFAULT_SLOT_LB, type DeckState } from './deckOps';
import { duplicateCharSlots } from './deckConflicts';
import type { LimitBreak } from '@/core/types';
import type { DeckTemplate } from './useDeckState';

export interface DeckCardInfo {
  typeLabel: string;
  typeColor: string;
  name: string;
  /** Character name — used to detect same-character duplicates within the deck. */
  charName?: string;
  /** True when this card is the trainee's own character (greyed, but allowed from a template). */
  sameAsTrainee?: boolean;
  /** Real in-game card icon node (provider-free: built by the page). Falls back
   *  to the type-letter square when absent. */
  icon?: ReactNode;
}

export interface YourDeckCardProps {
  state: DeckState;
  onChange: (next: DeckState) => void;
  resolveCard: (cardId: string) => DeckCardInfo | undefined;
  templates: DeckTemplate[];
  /** Name of the template the deck currently autosaves into ('' = unnamed working deck). */
  activeName: string;
  /** Commit the name field — create the active template under this name, rename it, or ('') detach. */
  onRename: (name: string) => void;
  /** Load an existing template by name and make it active. */
  onSelectTemplate: (name: string) => void;
  /** Start a "New" deck: keep the current cards, blank the name (detach from any template). */
  onNewTemplate: () => void;
  /** Delete the active template. */
  onDeleteTemplate: (name: string) => void;
  /** Click a filled slot's icon → show that card's detail (in the right sidebar). */
  onSelect?: (cardId: string) => void;
}

const NEUTRAL: DeckCardInfo = { typeLabel: '?', typeColor: 'var(--fg-muted)', name: 'Unknown card' };

export function YourDeckCard({
  state,
  onChange,
  resolveCard,
  templates,
  activeName,
  onRename,
  onSelectTemplate,
  onNewTemplate,
  onDeleteTemplate,
  onSelect,
}: YourDeckCardProps) {
  const [draftName, setDraftName] = useState(activeName);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dragIndex, setDragIndex] = useState(-1);
  const comboRef = useRef<HTMLDivElement>(null);
  useDismissOnOutside(comboRef, menuOpen, () => setMenuOpen(false), { esc: true });

  // Keep the editable field in sync when the active template changes externally (load / New).
  useEffect(() => setDraftName(activeName), [activeName]);

  const commitName = () => {
    const v = draftName.trim();
    // No-op cases revert the field to the active name:
    //  - unchanged (just whitespace normalisation)
    //  - cleared to empty (clearing the field must NOT detach — use the "New" item for that)
    if (v === activeName || v === '') {
      setDraftName(activeName);
      return;
    }
    // Typing an existing template's name switches to it rather than overwriting it.
    if (templates.some((t) => t.name === v)) {
      onSelectTemplate(v);
      return;
    }
    onRename(v); // a fresh, unique name → create / rename
  };
  const onNameKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commitName();
      e.currentTarget.blur();
    }
  };

  const handleDrop = (i: number) => (e: DragEvent) => {
    e.preventDefault();
    setDragIndex(-1);
    // Reorder: a drag that started on another deck slot carries its index → swap.
    const slotIdx = e.dataTransfer.getData('text/slot-index');
    if (slotIdx !== '') {
      const from = Number(slotIdx);
      if (Number.isInteger(from)) onChange(moveSlot(state, from, i));
      return;
    }
    const cardId = e.dataTransfer.getData('text/card-id');
    if (!cardId) return;
    const rawLbStr = e.dataTransfer.getData('text/card-lb');
    const rawLb = rawLbStr !== '' ? Number(rawLbStr) : NaN;
    const lb = Number.isInteger(rawLb) && rawLb >= 0 && rawLb <= 4 ? (rawLb as LimitBreak) : undefined;
    onChange(lb !== undefined ? dropCard(state, i, cardId, lb) : dropCard(state, i, cardId));
  };

  return (
    <div className="inh-deck">
      <div className="inh-deck-head">Deck</div>
      <div className="inh-deck-body">
        <div className="inh-deck-tools">
          <div className="inh-deck-combo" ref={comboRef}>
            <input
              type="text"
              className="inh-deck-tplname"
              value={draftName}
              placeholder="Unsaved deck — type to name"
              onChange={(e) => setDraftName(e.target.value)}
              onBlur={commitName}
              onKeyDown={onNameKey}
            />
            <button
              type="button"
              className="inh-deck-combo-caret"
              aria-label="Templates"
              aria-expanded={menuOpen}
              // preventDefault keeps the name input focused so a half-typed draft is not
              // blur-committed as a stray template when the menu is toggled.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setMenuOpen((o) => !o)}
            >
              ▾
            </button>
            {menuOpen && (
              <ul className="inh-deck-combo-menu" role="listbox">
                <li>
                  <button
                    type="button"
                    className="inh-deck-combo-item inh-deck-combo-new"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setDraftName(activeName); // discard any half-typed draft
                      onNewTemplate();
                      setMenuOpen(false);
                    }}
                  >
                    ＋ New
                  </button>
                </li>
                {templates.map((t) => (
                  <li key={t.name} className="inh-deck-combo-row">
                    <button
                      type="button"
                      className={`inh-deck-combo-item${t.name === activeName ? ' is-active' : ''}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        onSelectTemplate(t.name);
                        setMenuOpen(false);
                      }}
                    >
                      {t.name}
                    </button>
                    <button
                      type="button"
                      className="inh-deck-combo-del"
                      aria-label={`Delete ${t.name}`}
                      title={`Delete ${t.name}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => onDeleteTemplate(t.name)}
                    >
                      ×
                    </button>
                  </li>
                ))}
                {templates.length === 0 && <li className="inh-deck-combo-empty">No saved templates</li>}
              </ul>
            )}
          </div>
          <button type="button" className="cmp-small-btn" onClick={() => onChange(clearDeck())}>
            Clear
          </button>
        </div>

        <div className="inh-deck-slots">
        {(() => {
        // Resolve every filled slot once so we can detect same-character duplicates.
        const infos = state.slots.map((cardId) => (cardId ? resolveCard(cardId) ?? NEUTRAL : null));
        const dupSlots = duplicateCharSlots(infos.map((x) => x?.charName));
        return state.slots.map((cardId, i) => {
          const info = infos[i] ?? null;
          const dragging = dragIndex === i;
          // A slot is "conflicting" (greyed) when it's the trainee's own character
          // or a duplicate of a character already placed earlier in the deck.
          const conflict = !!info && (info.sameAsTrainee || dupSlots.has(i));
          return (
            <div
              key={i}
              data-testid={`deck-slot-${i}`}
              title={
                conflict
                  ? info?.sameAsTrainee
                    ? 'Same character as the trainee — no rainbow value'
                    : 'Duplicate character — only one per deck counts'
                  : undefined
              }
              className={`inh-deck-slot${dragging ? ' drag-over' : ''}${info ? ' is-filled' : ''}${conflict ? ' is-conflict' : ''}`}
              // Filled: a solid type-coloured frame (soft tint on the thin sides,
              // full colour on the 4px left accent) — matches the card icon, no
              // dashed "white line". CSS flips the style to solid when filled.
              style={
                info
                  ? {
                      borderColor: `color-mix(in srgb, ${info.typeColor} 42%, var(--border))`,
                      borderLeftColor: info.typeColor,
                    }
                  : undefined
              }
              // A filled slot is draggable onto another slot to swap positions.
              draggable={info != null}
              onDragStart={(e) => {
                if (!cardId) return;
                e.dataTransfer.setData('text/slot-index', String(i));
                e.dataTransfer.setData('text/card-id', cardId);
                e.dataTransfer.setData('text/card-lb', String(state.slotLb[i] ?? DEFAULT_SLOT_LB));
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragEnd={() => setDragIndex(-1)}
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
                  {conflict && (
                    <span className="inh-deck-slot-badge">
                      {info.sameAsTrainee ? 'Trainee' : 'Dup'}
                    </span>
                  )}
                  <button
                    type="button"
                    className="inh-deck-remove"
                    aria-label="Remove"
                    onClick={() => onChange(removeSlot(state, i))}
                  >
                    ×
                  </button>
                  <div className="inh-deck-slot-body">
                    {/* The icon doubles as a "show details" button (opens the sidebar card). */}
                    <button
                      type="button"
                      className="inh-deck-icon-btn"
                      aria-label={`${info.name} details`}
                      onClick={() => cardId && onSelect?.(cardId)}
                    >
                      {info.icon ? (
                        <span className="inh-deck-icon" title={info.name}>{info.icon}</span>
                      ) : (
                        <span className="inh-deck-type" style={{ background: info.typeColor }} title={info.name}>
                          {info.typeLabel}
                        </span>
                      )}
                    </button>
                    <div className="inh-deck-lb">
                      <span className="inh-deck-lb-label">LB</span>
                      <span className="inh-deck-lb-diamonds" title="Limit break level">
                        {([1, 2, 3, 4] as const).map((level) => (
                          <button
                            key={level}
                            type="button"
                            className={`inh-deck-diamond${(state.slotLb[i] ?? 0) >= level ? ' is-on' : ''}`}
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
        });
        })()}
        </div>
      </div>
    </div>
  );
}
