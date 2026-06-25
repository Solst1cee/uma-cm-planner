import { describe, expect, it } from 'vitest';
import {
  THEME_STORAGE_KEY,
  applyTheme,
  readThemePref,
  resolveTheme,
  writeThemePref,
} from './theme';

function fakeStorage(initial: Record<string, string> = {}) {
  const m = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  };
}

describe('theme prefs', () => {
  it('defaults to light when unset', () => {
    expect(readThemePref(fakeStorage())).toBe('light');
  });
  it('reads stored dark / system prefs', () => {
    expect(readThemePref(fakeStorage({ [THEME_STORAGE_KEY]: 'dark' }))).toBe('dark');
    expect(readThemePref(fakeStorage({ [THEME_STORAGE_KEY]: 'system' }))).toBe('system');
  });
  it('falls back to light on a garbage value', () => {
    expect(readThemePref(fakeStorage({ [THEME_STORAGE_KEY]: 'neon' }))).toBe('light');
  });
  it('round-trips via writeThemePref', () => {
    const s = fakeStorage();
    writeThemePref('dark', s);
    expect(readThemePref(s)).toBe('dark');
  });
  it('resolves system via the injected matcher', () => {
    expect(resolveTheme('system', () => true)).toBe('dark');
    expect(resolveTheme('system', () => false)).toBe('light');
    expect(resolveTheme('dark', () => false)).toBe('dark');
    expect(resolveTheme('light', () => true)).toBe('light');
  });
  it('applyTheme sets data-theme on the root', () => {
    const el = document.createElement('html');
    applyTheme('dark', el);
    expect(el.getAttribute('data-theme')).toBe('dark');
  });
});
