import { expect, test } from 'vitest';
import { classifyAccelTiming } from './accelCheck';

test('classifyAccelTiming buckets by where the skill fires', () => {
  // course: distance 1600, final straight starts at 1300
  expect(classifyAccelTiming(1350, 1300, 1600)).toBe('optimal'); // in final straight
  expect(classifyAccelTiming(800, 1300, 1600)).toBe('mid');      // mid race
  expect(classifyAccelTiming(150, 1300, 1600)).toBe('early');    // too early
  expect(classifyAccelTiming(null, 1300, 1600)).toBe('none');    // never fires
});

test('classifyAccelTiming: exactly at finalStraightStart is optimal', () => {
  expect(classifyAccelTiming(1300, 1300, 1600)).toBe('optimal');
});

test('classifyAccelTiming: exactly at the midpoint (distance * 0.5) is mid', () => {
  // 800 === 1600 * 0.5 → 'mid'
  expect(classifyAccelTiming(800, 1300, 1600)).toBe('mid');
});

test('classifyAccelTiming: one metre before midpoint is early', () => {
  expect(classifyAccelTiming(799, 1300, 1600)).toBe('early');
});
