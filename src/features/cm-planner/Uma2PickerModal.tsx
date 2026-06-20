/** Inventory-style popup for choosing uma2 (the comparison plan). Lists the eligible saved
 *  plans as selectable rows (portrait + name + stat line), plus a "no comparison" option. */
import { useEffect } from 'react';
import type { CmPlan, Stat } from '@/core/types';
import { GameIcon } from '@/features/data/GameIcon';

const STAT_ORDER: Stat[] = ['spd', 'sta', 'pow', 'gut', 'wit'];
const statLine = (p: CmPlan): string => STAT_ORDER.map((s) => p.statProfile.stats[s]).join(' / ');

export function Uma2PickerModal({
  plans, selectedId, onSelect, onClose,
}: {
  plans: CmPlan[];
  selectedId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const pick = (id: string) => { onSelect(id); onClose(); };

  return (
    <div className="cmp-uma2-overlay" role="presentation" onClick={onClose}>
      <div
        className="cmp-plan-card cmp-uma2-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Select comparison plan"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="cmp-plan-card-head">
          <span>Select comparison plan</span>
          <button type="button" className="cmp-uma2-close" aria-label="Close" onClick={onClose}>×</button>
        </header>
        <div className="cmp-plan-card-body cmp-uma2-list">
          <button
            type="button"
            className={`cmp-uma2-row ${selectedId === '' ? 'is-active' : ''}`.trim()}
            onClick={() => pick('')}
          >
            <span className="cmp-uma2-none">No comparison (course only)</span>
          </button>
          {plans.length === 0 && (
            <p className="muted small">No other saved plans — save another plan to compare.</p>
          )}
          {plans.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`cmp-uma2-row ${p.id === selectedId ? 'is-active' : ''}`.trim()}
              onClick={() => pick(p.id)}
            >
              {p.umaId ? (
                <GameIcon kind="uma" id={p.umaId} size={34} alt="" />
              ) : (
                <span className="cmp-inventory-portrait">uma</span>
              )}
              <div className="cmp-inventory-plan-main">
                <strong>{p.name || p.id}</strong>
                <span>{statLine(p)}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
