// src/features/inheritance/YourDeckCard.tsx
/** M1.5 "Your deck" — provider-free 6-slot support-card deck panel.
 *  The page resolves cardId → DeckCardInfo and passes it in (this component never
 *  calls useGameData/GameIcon, per the M1 provider-free convention). Drag-drop uses
 *  standard HTML5 DnD ('text/card-id') so M1.6's card pool plugs in with no coupling. */
import { useState } from 'react';
import type { DragEvent } from 'react';
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

  const handleDrop = (i: number) => (e: DragEvent) => {
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
  );
}
