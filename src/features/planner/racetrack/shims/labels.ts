/**
 * Local stand-in for umalator's `@/i18n` default export, scoped to the racetrack
 * namespace the vendored SVG layers use. Strings copied verbatim from
 * umalator-global src/i18n/index.ts (racetrack.*). Avoids pulling in i18next.
 */
const LABELS: Record<string, string> = {
  'racetrack.straight': 'Straight',
  'racetrack.corner': 'Corner {{n}}',
  'racetrack.uphill': 'Uphill',
  'racetrack.downhill': 'Downhill',
  'racetrack.phase0': 'Early-race',
  'racetrack.phase1': 'Mid-race',
  'racetrack.phase2': 'Late-race',
  'racetrack.phase3': 'Last spurt',
  'racetrack.short.straight': '→',
  'racetrack.short.corner': 'C{{n}}',
  'racetrack.short.uphill': '↗',
  'racetrack.short.downhill': '↘',
};

function interpolate(tpl: string, fields?: Record<string, string | number>): string {
  if (!fields) return tpl;
  return tpl.replace(/\{\{(\w+)\}\}/g, (_m, k: string) => String(fields[k] ?? ''));
}

export default {
  t(key: string, fields?: Record<string, string | number>): string {
    const tpl = LABELS[key];
    return tpl != null ? interpolate(tpl, fields) : key;
  },
};
