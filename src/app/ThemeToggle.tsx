/** Light / Dark / System control for the settings menu. Self-contained: reads
 *  and writes the preference via theme.ts and applies it globally on click. */
import { useEffect, useState } from 'react';
import {
  type ThemePref,
  applyTheme,
  readThemePref,
  resolveTheme,
  writeThemePref,
} from '@/app/theme';

const OPTIONS: { value: ThemePref; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

export function ThemeToggle() {
  const [pref, setPref] = useState<ThemePref>(() => readThemePref());

  // While 'system' is selected, re-apply live when the OS preference flips.
  useEffect(() => {
    if (pref !== 'system' || typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme(resolveTheme('system'));
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [pref]);

  const choose = (next: ThemePref) => {
    setPref(next);
    writeThemePref(next);
    applyTheme(resolveTheme(next));
  };

  return (
    <div className="ds-seg ds-miniseg" role="group" aria-label="Theme">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          className={o.value === pref ? 'on' : undefined}
          aria-pressed={o.value === pref}
          onClick={() => choose(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
