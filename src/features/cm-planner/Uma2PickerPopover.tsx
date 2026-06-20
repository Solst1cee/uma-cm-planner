/** Inventory-style popover (anchored under the trigger, NOT a full-screen modal — the rest of
 *  the page stays interactive) for choosing uma2. Lists eligible saved plans as selectable rows
 *  (portrait + name + stats), plus a "no comparison" option. Closing is handled by the caller
 *  (click-outside / Esc on the trigger wrapper). */
import type { CmPlan } from '@/core/types';
import { GameIcon } from '@/features/data/GameIcon';
import { statLine } from './planSummary';

export function Uma2PickerPopover({
  plans, selectedId, onSelect,
}: {
  plans: CmPlan[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="cmp-plan-card cmp-uma2-pop" role="dialog" aria-label="Select comparison plan">
      <div className="cmp-uma2-list">
        <button
          type="button"
          className={`cmp-uma2-row ${selectedId === '' ? 'is-active' : ''}`.trim()}
          onClick={() => onSelect('')}
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
            onClick={() => onSelect(p.id)}
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
  );
}
