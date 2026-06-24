import { expect, test } from 'vitest';
import { loadAccelSkillIds, loadSkillEffectValues } from './skillTechnicalDetails';

test('loadAccelSkillIds returns a non-empty set including a known accel skill', async () => {
  const ids = await loadAccelSkillIds();
  expect(ids.size).toBeGreaterThan(100);
  // 10091 "Red Ace" is a type-31 (acceleration) unique (introspected 2026-06-24)
  expect(ids.has('10091')).toBe(true);
  // a pure speed skill with no accel effect should be absent — pick one verified at impl time
});

test('loadSkillEffectValues maps accel ids to a numeric magnitude', async () => {
  const vals = await loadSkillEffectValues();
  const v = vals.get('10091');
  expect(typeof v).toBe('number');
  expect(v).not.toBe(0);
});
