/** Race conditions the planner models (ground/weather/season). Time-of-day is not modeled. */
export type Ground = 'firm' | 'good' | 'soft' | 'heavy';
export type Weather = 'sunny' | 'cloudy' | 'rainy' | 'snowy';
export type Season = 'spring' | 'summer' | 'fall' | 'winter';

export interface RaceConditions {
  ground: Ground;
  weather: Weather;
  season: Season;
}

/** Northern-hemisphere season from a 1-based month. */
function seasonForMonth(month: number): Season {
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'fall';
  return 'winter';
}

/**
 * Assumed conditions for a CM with none curated (P3): season from the finals
 * month, default good/sunny. Editable in the chooser; flaggable as assumed.
 */
export function defaultConditions(finalsISO: string | undefined): RaceConditions {
  const m = finalsISO && /^\d{4}-(\d{2})-/.test(finalsISO) ? Number(finalsISO.slice(5, 7)) : NaN;
  return { ground: 'good', weather: 'sunny', season: Number.isNaN(m) ? 'spring' : seasonForMonth(m) };
}
