/**
 * public/data/cm_presets.json — CmPreset[] from umalator cm-presets.json
 * (31 CM race definitions, provenance §3) joined with course_data.json for
 * surface + distance.
 *
 * P4: the upstream list spans the JP CM history AND the Global rounds since
 * launch. Each record carries `server` so JP-only rounds are labelable as
 * preview-only and never silently feed Global plan defaults.
 */
import type { CmPreset, Server } from '@/core/types';
import type { CourseDataJson, UpstreamCmPreset } from './lib/upstream-types';

/**
 * Global server launch (provenance §3.1, 2025-06-26). Derivation rule
 * (Phase 1 review follow-up, 2026-06-12): presets dated on/after launch are
 * the rounds umalator-global (a Global-focused tool) tracked live on Global
 * (2025-07-25 … 2026-01-22, 5 records); everything earlier is JP CM history
 * (the zodiac-named 2022-2023 rounds and the distance-class rounds up to
 * 2025-06-21, which predates launch). ISO dates compare correctly as strings.
 */
const GLOBAL_LAUNCH_DATE = '2025-06-26';

function serverFor(date: string): Server {
  return date >= GLOBAL_LAUNCH_DATE ? 'global' : 'jp';
}

/** Deterministic code-point compare — locale-independent, unlike localeCompare (pipeline promise: io.ts). */
function codePointCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// Enum value names from umalator sunday-tools course/definitions.ts (engine
// vocabulary; lowercased for our data files).
const SEASON: Record<number, string> = { 1: 'spring', 2: 'summer', 3: 'autumn', 4: 'winter', 5: 'sakura' };
const GROUND: Record<number, string> = { 1: 'firm', 2: 'good', 3: 'soft', 4: 'heavy' };
const WEATHER: Record<number, string> = { 1: 'sunny', 2: 'cloudy', 3: 'rainy', 4: 'snowy' };
const TIME: Record<number, string> = { 1: 'morning', 2: 'midday', 3: 'evening', 4: 'night' };

function mapEnum(table: Record<number, string>, value: number | undefined, what: string): string | undefined {
  if (value === undefined || value === 0) return undefined;
  const name = table[value];
  if (name === undefined) throw new Error(`cm preset: unknown ${what} value ${value}`);
  return name;
}

export function buildCmPresets(inputs: {
  presets: UpstreamCmPreset[];
  courses: CourseDataJson;
  dataVersion: string;
}): CmPreset[] {
  const { presets, courses, dataVersion } = inputs;
  const records: CmPreset[] = [];

  for (const preset of presets) {
    const course = courses[String(preset.courseId)];
    if (course === undefined) {
      throw new Error(`cm preset "${preset.name}": courseId ${preset.courseId} not in course_data.json`);
    }
    if (course.surface !== 1 && course.surface !== 2) {
      throw new Error(`cm preset "${preset.name}": unexpected surface ${course.surface}`);
    }
    const record: CmPreset = {
      name: preset.name,
      date: preset.date,
      server: serverFor(preset.date),
      dataVersion,
      courseId: String(preset.courseId),
      surface: course.surface === 1 ? 'turf' : 'dirt', // course_data: 1=turf, 2=dirt (provenance §3)
      distance: course.distance,
    };
    const season = mapEnum(SEASON, preset.season, 'season');
    const ground = mapEnum(GROUND, preset.ground, 'ground');
    const weather = mapEnum(WEATHER, preset.weather, 'weather');
    const time = mapEnum(TIME, preset.time, 'time');
    if (season !== undefined) record.season = season;
    if (ground !== undefined) record.ground = ground;
    if (weather !== undefined) record.weather = weather;
    if (time !== undefined) record.time = time;
    records.push(record);
  }

  records.sort((a, b) => codePointCompare(a.date, b.date) || codePointCompare(a.name, b.name));
  return records;
}
