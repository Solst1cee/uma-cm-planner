import { afterEach, describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  DEFAULT_STAMINA_WARN_THRESHOLD,
  DEFAULT_STAMINA_SPURT_TARGET,
  clampThreshold,
  useStaminaWarnThreshold,
  useStaminaSpurtTarget,
} from './useStaminaWarnThreshold';

const KEY = 'cmp.staminaWarnThreshold';
const SPURT_KEY = 'cmp.staminaSpurtTarget';
afterEach(() => localStorage.clear());

describe('clampThreshold', () => {
  it('clamps to [0,1] and falls back to default for non-finite input', () => {
    expect(clampThreshold(1.5)).toBe(1);
    expect(clampThreshold(-0.2)).toBe(0);
    expect(clampThreshold(0.8)).toBe(0.8);
    expect(clampThreshold(Number.NaN)).toBe(DEFAULT_STAMINA_WARN_THRESHOLD);
  });
});

describe('useStaminaWarnThreshold', () => {
  it('defaults to 0.95 when nothing is stored', () => {
    const { result } = renderHook(() => useStaminaWarnThreshold());
    expect(result.current[0]).toBe(0.95);
  });

  it('persists a new value to localStorage', () => {
    const { result } = renderHook(() => useStaminaWarnThreshold());
    act(() => result.current[1](0.8));
    expect(result.current[0]).toBe(0.8);
    expect(localStorage.getItem(KEY)).toBe('0.8');
    // a fresh mount reads the stored value back
    const { result: r2 } = renderHook(() => useStaminaWarnThreshold());
    expect(r2.current[0]).toBe(0.8);
  });

  it('clamps a malformed / out-of-range stored value back to default or range', () => {
    localStorage.setItem(KEY, 'not-a-number');
    expect(renderHook(() => useStaminaWarnThreshold()).result.current[0]).toBe(0.95);
    localStorage.setItem(KEY, '5');
    expect(renderHook(() => useStaminaWarnThreshold()).result.current[0]).toBe(1);
  });

  it('treats a blank stored value as default (not Number("")===0, which would disable the warning)', () => {
    localStorage.setItem(KEY, '   ');
    expect(renderHook(() => useStaminaWarnThreshold()).result.current[0]).toBe(0.95);
  });
});

describe('useStaminaSpurtTarget', () => {
  it('defaults to its own value and persists under a separate key', () => {
    const { result } = renderHook(() => useStaminaSpurtTarget());
    expect(result.current[0]).toBe(DEFAULT_STAMINA_SPURT_TARGET);
    act(() => result.current[1](0.8));
    expect(result.current[0]).toBe(0.8);
    expect(localStorage.getItem(SPURT_KEY)).toBe('0.8');
    // independent from the survival/warn key
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});
