/** A "?" help button + popup for a collapsible panel header.
 *
 *  The popup is rendered through a portal to <body> with fixed positioning, so it is
 *  NOT clipped by the card's `overflow: hidden` (the bug this fixes). It opens to the
 *  bottom-right of the button (expanding right + down), clamped to stay on-screen.
 *
 *  Clicks on the button are stopped from bubbling so they never toggle the header's
 *  collapse. Dismiss = pointerdown outside both the button and the (portaled) popup, or Esc.
 */
import './skill-trace/skill-trace.css';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const POP_W = 280; // matches .cmp-trace-help-pop width

export function HeaderHelp({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  // Anchor the fixed popup to the button's bottom-left; keep it within the viewport.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = btnRef.current?.getBoundingClientRect();
      if (!r) return;
      const left = Math.max(8, Math.min(r.left, window.innerWidth - POP_W - 8));
      setPos({ top: r.bottom + 4, left });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  // Dismiss on outside pointerdown / Esc — "inside" = the button OR the portaled popup.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="cmp-trace-help-btn"
        aria-label={label}
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        ?
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            ref={popRef}
            className="cmp-trace-help-pop"
            style={{ position: 'fixed', top: pos.top, left: pos.left, right: 'auto' }}
            role="dialog"
            aria-label={label}
          >
            {children}
          </div>,
          document.body,
        )}
    </>
  );
}
