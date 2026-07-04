// src/features/cm-planner/anchoredPopover.ts
/**
 * Shared fixed-position placement for popups anchored to the RIGHT of an
 * element (HeaderHelp 'right', SkillDetailPopover, the coverage CombinedPct
 * popup). One math, three call sites — no drift.
 *
 * Rules (exactly the hand-rolled originals): 6px gap to the anchor's right;
 * flip to the anchor's left when the popup would overflow the viewport width
 * (with an 8px margin); clamp left and top to ≥8px. No bottom clamp — callers
 * that need a vertical nudge apply it on the returned top.
 */
export function placeRightOf(
  anchor: DOMRect,
  width: number,
  viewport: { w: number; h: number },
): { top: number; left: number } {
  const right = anchor.right + 6;
  const left = right + width + 8 > viewport.w ? Math.max(8, anchor.left - width - 6) : right;
  return { top: Math.max(8, anchor.top), left };
}
