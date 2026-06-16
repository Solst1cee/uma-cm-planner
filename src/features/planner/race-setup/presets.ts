/**
 * Curated CM presets for the race-setup chooser. Conditions are the real
 * Global CM conditions (cross-checked against public/data/cm_presets.json +
 * cm_tracks.json). Selecting a preset fills the track + conditions.
 *
 * Only CM15/CM16 for now; this list grows (or sources from the data pipeline)
 * as more Global CMs are confirmed.
 */
export type Ground = 'firm' | 'good' | 'soft' | 'heavy';
export type Weather = 'sunny' | 'cloudy' | 'rainy' | 'snowy';
export type Season = 'spring' | 'summer' | 'fall' | 'winter';

export interface RacePreset {
  cmId: string;
  cmNumber: number;
  cupName: string;
  label: string;
  courseId: string;
  racetrack: string;
  surface: 'turf' | 'dirt';
  distance: number;
  distanceClass: 'sprint' | 'mile' | 'medium' | 'long';
  direction: 'right' | 'left';
  inOut?: 'inner' | 'outer';
  ground: Ground;
  season: Season;
  weather: Weather;
}

export const PRESETS: RacePreset[] = [
  {
    cmId: 'CM15',
    cmNumber: 15,
    cupName: 'Cancer Cup',
    label: 'CM15 — Cancer Cup',
    courseId: '10906',
    racetrack: 'Hanshin',
    surface: 'turf',
    distance: 2200,
    distanceClass: 'medium',
    direction: 'right',
    inOut: 'inner',
    ground: 'good',
    season: 'summer',
    weather: 'cloudy',
  },
  {
    cmId: 'CM16',
    cmNumber: 16,
    cupName: 'Leo Cup',
    label: 'CM16 — Leo Cup',
    courseId: '10501',
    racetrack: 'Nakayama',
    surface: 'turf',
    distance: 1200,
    distanceClass: 'sprint',
    direction: 'right',
    ground: 'firm',
    season: 'summer',
    weather: 'sunny',
  },
];
