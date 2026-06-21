/** Close an open popover/confirm-toolbar on outside click (pointerdown) and — when `esc` is set —
 *  the Escape key. No-op while `open` is false. Extracted so every planner popover dismisses
 *  identically instead of each re-implementing the ref.contains + listener dance. */
import { useEffect, type RefObject } from 'react';

export function useDismissOnOutside<T extends HTMLElement>(
  ref: RefObject<T | null>,
  open: boolean,
  onClose: () => void,
  opts: { esc?: boolean } = {},
): void {
  const { esc = false } = opts;
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener('pointerdown', onDown);
    let onKey: ((e: KeyboardEvent) => void) | undefined;
    if (esc) {
      onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
      document.addEventListener('keydown', onKey);
    }
    return () => {
      document.removeEventListener('pointerdown', onDown);
      if (onKey) document.removeEventListener('keydown', onKey);
    };
    // ref is a stable container; onClose is captured for the lifetime of this open-window — re-register only on open/esc.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, esc]);
}
