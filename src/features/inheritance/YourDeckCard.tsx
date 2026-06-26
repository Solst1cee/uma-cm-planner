// src/features/inheritance/YourDeckCard.tsx
/** M1.5 "Your deck" — provider-free 6-slot support-card deck panel.
 *  The page resolves cardId → DeckCardInfo and passes it in (this component never
 *  calls useGameData/GameIcon, per the M1 provider-free convention). Drag-drop uses
 *  standard HTML5 DnD ('text/card-id') so M1.6's card pool plugs in with no coupling. */
import { useEffect, useRef, useState } from 'react';
import type { DragEvent, KeyboardEvent } from 'react';
import { useDismissOnOutside } from '@/features/cm-planner/useDismissOnOutside';
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
    const cardId = e.dataTransfer.getData('text/card-id');
    if (cardId) onChange(dropCard(state, i, cardId));
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
                  <li key={t.name}>
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
                  </li>
                ))}
                {templates.length === 0 && <li className="inh-deck-combo-empty">No saved templates</li>}
              </ul>
            )}
          </div>
          <button
            type="button"
            className="cmp-small-btn"
            disabled={!activeName}
            onClick={() => activeName && onDeleteTemplate(activeName)}
          >
            Del
          </button>
          <button type="button" className="cmp-small-btn" onClick={() => onChange(clearDeck())}>
            Clear
          </button>
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
        })}
        </div>
      </div>
    </div>
  );
}
