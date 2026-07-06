import { expect, it } from 'vitest';
import { resolveParent2 } from './resolveParent2';
import type { CmPlan, Parent } from '@/core/types';

const OWNED: Parent = { id: 'o1', umaId: '100101', blueSpark: { stat: 'spd', stars: 1 },
  pinkSpark: { aptitude: 'turf', stars: 1 }, whiteSparks: [], source: 'mine' };
const base = (over: Partial<CmPlan>): CmPlan => ({ parents: { b: undefined }, ...over } as CmPlan);
const roster = new Map([[OWNED.id, OWNED]]);

it('owned mode resolves the roster parent from parents.b', () => {
  const r = resolveParent2(base({ parents: { b: 'o1' } }), roster);
  expect(r).toEqual({ kind: 'owned', parent: OWNED });
});
it('absent mode defaults to owned; no parents.b ⇒ none', () => {
  expect(resolveParent2(base({ parents: {} }), roster)).toEqual({ kind: 'none' });
});
it('draft mode returns a synthetic parent with the forced-score affinityHint', () => {
  const r = resolveParent2(base({ parent2Mode: 'draft',
    rentalDraft: { forcedTier: 'single', filters: [] } }), roster);
  expect(r.kind).toBe('draft');
  if (r.kind === 'draft') expect(r.synthetic.affinityHint).toBe(100);
});
it('rental mode returns the recorded parent', () => {
  const rec: Parent = { ...OWNED, id: 'r1', source: 'friend_rental' };
  const r = resolveParent2(base({ parent2Mode: 'rental', rentalRecorded: rec }), roster);
  expect(r).toEqual({ kind: 'rental', parent: rec });
});
