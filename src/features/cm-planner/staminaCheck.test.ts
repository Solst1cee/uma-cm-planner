import { expect, test } from 'vitest';
import { staminaVerdict } from './staminaCheck';

test('staminaVerdict flags a build that bottoms out at 0 HP before the line', () => {
  const frames = [
    { t: 0, v: 20, pos: 0, hp: 100 },
    { t: 5, v: 20, pos: 800, hp: 40 },
    { t: 9, v: 18, pos: 1500, hp: 0 },
    { t: 11, v: 15, pos: 1600, hp: 0 },
  ];
  const v = staminaVerdict(frames, 1600);
  expect(v.finishes).toBe(false);
  expect(v.minHp).toBe(0);
  expect(v.minHpPos).toBe(1500);
});

test('staminaVerdict passes a build that keeps HP > 0 to the line', () => {
  const frames = [{ t: 0, v: 20, pos: 0, hp: 100 }, { t: 10, v: 20, pos: 1600, hp: 12 }];
  expect(staminaVerdict(frames, 1600).finishes).toBe(true);
});

test('staminaVerdict reports the correct minHpPos when multiple frames tie for minimum', () => {
  const frames = [
    { t: 0, v: 20, pos: 0, hp: 100 },
    { t: 3, v: 19, pos: 600, hp: 5 },
    { t: 6, v: 18, pos: 1200, hp: 5 },
    { t: 9, v: 17, pos: 1800, hp: 20 },
  ];
  const v = staminaVerdict(frames, 1800);
  expect(v.finishes).toBe(true);
  expect(v.minHp).toBe(5);
  expect(v.minHpPos).toBe(600); // first occurrence wins
});

test('staminaVerdict returns the distance field unchanged', () => {
  const frames = [{ t: 0, v: 10, pos: 0, hp: 50 }];
  expect(staminaVerdict(frames, 2400).distance).toBe(2400);
});

test('staminaVerdict treats hp just above 0 as finishing', () => {
  const frames = [
    { t: 0, v: 20, pos: 0, hp: 100 },
    { t: 5, v: 20, pos: 1000, hp: 0.001 },
  ];
  expect(staminaVerdict(frames, 1000).finishes).toBe(true);
});
