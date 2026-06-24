import { describe, expect, test } from 'vitest';
import { describePositioning, requiresWitCheck, witCheckPassChance } from './skillConditions';

describe('describePositioning', () => {
  test('order_rate → exact place for CM (9) and LoH (12)', () => {
    // round(0.4×9)=4, round(0.4×12)=5
    expect(describePositioning('order_rate<=40&phase>=2')).toBe('CM ≤4 · LoH ≤5');
    // round(0.5×9)=5 (Math.round(4.5)=5), round(0.5×12)=6 — matches GameTora's "CM >5, LoH >6"
    expect(describePositioning('order_rate>50')).toBe('CM >5 · LoH >6');
  });
  test('absolute order is an exact place already', () => {
    expect(describePositioning('order==1')).toBe('place =1');
    expect(describePositioning('order>=3')).toBe('place ≥3');
  });
  test('bashin diff', () => {
    expect(describePositioning('bashin_diff_infront<=1&remain_distance<=200')).toBe('within 1 ahead');
  });
  test('alternatives joined with slash', () => {
    // round(0.2×9)=2, round(0.2×12)=2  /  round(0.5×9)=5, round(0.5×12)=6
    expect(describePositioning('order_rate<=20@order_rate<=50')).toBe('CM ≤2 · LoH ≤2 / CM ≤5 · LoH ≤6');
  });
  test('no positional token', () => {
    expect(describePositioning('phase>=2&is_lastspurt==1')).toBe('—');
  });
  test('empty', () => {
    expect(describePositioning('')).toBe('—');
  });
});

describe('requiresWitCheck', () => {
  test('random tokens require a wit check', () => {
    expect(requiresWitCheck('all_corner_random==1')).toBe(true);
    expect(requiresWitCheck('phase_random==1&order_rate<=40')).toBe(true);
    expect(requiresWitCheck('straight_random==1')).toBe(true);
    expect(requiresWitCheck('corner_random==2')).toBe(true);
  });
  test('deterministic conditions do not', () => {
    expect(requiresWitCheck('order_rate<=40&phase>=2')).toBe(false);
    expect(requiresWitCheck('')).toBe(false);
  });
});

describe('witCheckPassChance', () => {
  // formula from engine runner.ts:1523 — max(100 - 9000/wit, 20)
  test('typical wit', () => {
    expect(witCheckPassChance(1200)).toBe(93); // 100 - 7.5
    expect(witCheckPassChance(900)).toBe(90);  // 100 - 10
  });
  test('floors at 20', () => {
    expect(witCheckPassChance(100)).toBe(20); // 100 - 90 = 10 -> floor 20
    expect(witCheckPassChance(1)).toBe(20);
  });
});
