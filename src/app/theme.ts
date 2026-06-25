/**
 * Theme preference: a tiny pure module so it is unit-testable without a DOM
 * paint. Default is light (roadmap P1). 'system' resolves via prefers-color-scheme
 * at read time; the matcher is injectable so tests don't depend on jsdom (which
 * has no matchMedia).
 */
export type ThemePref = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'cmp.theme';

type ReadableStorage = Pick<Storage, 'getItem'>;
type WritableStorage = Pick<Storage, 'setItem'>;

export function readThemePref(storage: ReadableStorage = localStorage): ThemePref {
  const v = storage.getItem(THEME_STORAGE_KEY);
  return v === 'dark' || v === 'system' ? v : 'light';
}

export function writeThemePref(pref: ThemePref, storage: WritableStorage = localStorage): void {
  storage.setItem(THEME_STORAGE_KEY, pref);
}

export function systemPrefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

export function resolveTheme(
  pref: ThemePref,
  prefersDark: () => boolean = systemPrefersDark,
): ResolvedTheme {
  if (pref === 'system') return prefersDark() ? 'dark' : 'light';
  return pref;
}

export function applyTheme(
  resolved: ResolvedTheme,
  root: HTMLElement = document.documentElement,
): void {
  root.setAttribute('data-theme', resolved);
}

export function initTheme(root: HTMLElement = document.documentElement): ResolvedTheme {
  const resolved = resolveTheme(readThemePref());
  applyTheme(resolved, root);
  return resolved;
}
