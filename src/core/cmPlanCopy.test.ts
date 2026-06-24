import { expect, test } from 'vitest';
import { copyPlanInto } from './cmPlanCopy';
import { makeDefaultPlan } from '@/app/ActivePlanContext';

test('copyPlanInto deep-clones with a fresh id and resets planNumber', () => {
  const src = makeDefaultPlan();
  const copy = copyPlanInto(src);
  expect(copy.id).not.toBe(src.id);
  expect(copy.planNumber).toBe(1);
  expect(copy.wishlist).toEqual(src.wishlist);
  expect(copy.wishlist).not.toBe(src.wishlist);          // deep, not shared ref
  copy.statProfile.stats.spd = 9999;
  expect(src.statProfile.stats.spd).not.toBe(9999);      // no aliasing
});
