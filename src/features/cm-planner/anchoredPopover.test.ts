// src/features/cm-planner/anchoredPopover.test.ts
import { describe, expect, it } from 'vitest';
import { placeRightOf } from './anchoredPopover';

const rect = (over: Partial<DOMRect>): DOMRect =>
  ({ top: 100, left: 200, right: 240, bottom: 120, width: 40, height: 20, x: 200, y: 100, toJSON: () => ({}), ...over } as DOMRect);

const vp = { w: 1000, h: 800 };

describe('placeRightOf', () => {
  it('places 6px right of the anchor, top-aligned', () => {
    expect(placeRightOf(rect({}), 320, vp)).toEqual({ top: 100, left: 246 });
  });
  it('flips to the left of the anchor when it would overflow the viewport', () => {
    // right = 906; 906 + 320 + 8 > 1000 → flip: left = anchor.left − w − 6.
    const r = rect({ left: 860, right: 900 });
    expect(placeRightOf(r, 320, vp)).toEqual({ top: 100, left: 534 });
  });
  it('clamps the flipped left to 8px', () => {
    const r = rect({ left: 100, right: 990 });
    expect(placeRightOf(r, 320, vp).left).toBe(8);
  });
  it('clamps top to 8px', () => {
    expect(placeRightOf(rect({ top: -30 }), 320, vp).top).toBe(8);
  });
});
