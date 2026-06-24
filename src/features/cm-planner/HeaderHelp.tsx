/** A "?" help button + dismiss-on-outside popup for a collapsible panel header.
 *  Reuses the skill-trace help-popup styling. Clicks are stopped from bubbling so
 *  pressing the button (or interacting with the popup) never toggles the header's
 *  collapse. Dismiss is pointerdown-based (useDismissOnOutside), so the click-level
 *  stopPropagation here doesn't interfere with click-outside-to-close. */
import './skill-trace/skill-trace.css';
import { useRef, useState, type ReactNode } from 'react';
import { useDismissOnOutside } from './useDismissOnOutside';

export function HeaderHelp({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismissOnOutside(ref, open, () => setOpen(false), { esc: true });
  return (
    <div className="cmp-trace-help" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="cmp-trace-help-btn"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        ?
      </button>
      {open && (
        <div className="cmp-trace-help-pop" role="dialog" aria-label={label}>
          {children}
        </div>
      )}
    </div>
  );
}
