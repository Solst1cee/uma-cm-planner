/** M1 "Your uma plan" card (handoff README §"1. Your uma plan panel").
 *  Shows the active plan's uma (portrait + name/epithet + pink aptitude chips).
 *  The action is an inventory-icon button that pops the shared PlanInventoryCard
 *  as a dismiss-on-outside popover; picking a row there switches the plan.
 *
 *  Provider-free: the portrait and the `inventory` popover content are passed in
 *  as ReactNodes by the page (GameIcon / PlanInventoryCard need providers, which
 *  this component must not require so it stays unit-testable). Open state is
 *  controlled so the page can close it after a pick. */
import { useRef, type ReactNode } from 'react';
import { useDismissOnOutside } from '@/features/cm-planner/useDismissOnOutside';
import type { AptChip } from './umaPlanApt';

const BackpackIcon = () => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    focusable="false"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.7}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9.5 6V5a2.5 2.5 0 0 1 5 0v1" />
    <path d="M6.5 8.5C6.5 6.57 8.07 5 10 5h4c1.93 0 3.5 1.57 3.5 3.5V19a2 2 0 0 1-2 2H8.5a2 2 0 0 1-2-2V8.5Z" />
    <path d="M6.5 14H5.5A1.5 1.5 0 0 0 4 15.5v1A1.5 1.5 0 0 0 5.5 18h1" />
    <path d="M17.5 14h1A1.5 1.5 0 0 1 20 15.5v1A1.5 1.5 0 0 1 18.5 18h-1" />
    <path d="M6.5 11h11" />
    <path d="M10 9v2.5M14 9v2.5" />
    <path d="M9 15h6v3a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 18z" />
  </svg>
);

export interface UmaPlanCardProps {
  name: string;
  epithet?: string;
  portrait: ReactNode;
  aptChips: AptChip[];
  /** The wired PlanInventoryCard, rendered inside the popover when open. */
  inventory: ReactNode;
  inventoryOpen: boolean;
  onToggleInventory: () => void;
  onCloseInventory: () => void;
}

export function UmaPlanCard({
  name,
  epithet,
  portrait,
  aptChips,
  inventory,
  inventoryOpen,
  onToggleInventory,
  onCloseInventory,
}: UmaPlanCardProps) {
  // The dismiss ref wraps the card AND the popover so clicks inside either stay
  // open; the popover is a sibling of the card (cmp-plan-card has overflow:hidden,
  // which would otherwise clip an absolutely-positioned child).
  const rootRef = useRef<HTMLDivElement>(null);
  useDismissOnOutside(rootRef, inventoryOpen, onCloseInventory, { esc: true });

  return (
    <div className="inh-uma-wrap" ref={rootRef}>
      <section className="cmp-plan-card inh-uma-card">
        <header className="cmp-plan-card-head">
          <span>Uma plan</span>
          <button
            type="button"
            className="cmp-inventory-icon-btn inh-uma-inv-btn"
            aria-label="Choose plan from inventory"
            aria-expanded={inventoryOpen}
            title="Choose plan from inventory"
            onClick={onToggleInventory}
          >
            <BackpackIcon />
          </button>
        </header>
        <div className="cmp-plan-card-body inh-uma-body">
          <div className="inh-uma-main">
            <span className="inh-uma-portrait">{portrait}</span>
            <div className="inh-uma-meta">
              <span className="inh-uma-name">{name}</span>
              {epithet && <span className="inh-uma-epithet">{epithet}</span>}
            </div>
          </div>
          {aptChips.length > 0 && (
            <div className="spark-chips inh-uma-apts">
              {aptChips.map((c) => (
                <span key={c.label} className="badge spark-pink">
                  {c.label} {c.grade}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>
      {inventoryOpen && <div className="inh-inventory-popover">{inventory}</div>}
    </div>
  );
}
