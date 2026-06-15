/**
 * M4 §0 — pure race-track geometry + skill activation bands (no engine, no React).
 *
 * `trackSegments` turns a course's corner geometry into ordered straight/corner
 * segments sized as % of the course. `activationBands` places every wishlist
 * skill + the unique on that track by parsing a START anchor out of the skill's
 * raw `conditions` DSL.
 *
 * SLICE NOTE (P3 honesty): band START comes from a small set of positional
 * tokens; band WIDTH is an APPROXIMATE fixed default until skill duration data
 * lands (every band carries `approximate: true`). The full engine region-algebra
 * is intentionally NOT re-implemented here — `skillConditionToBand` is the seam
 * a later part upgrades (duration → real width, or engine-sourced regions).
 */
import type { SkillRecord } from '@/core/types';

export interface CourseGeometry {
  distance: number;
  /** Engine `turn`: 1 = right-handed, 2 = left-handed. */
  turn: number;
  corners: Array<{ start: number; length: number }>;
  straights: Array<{ start: number; end: number }>;
  slopes: Array<{ start: number; length: number; slope: number }>;
}

export interface TrackSegment {
  kind: 'straight' | 'corner';
  startPct: number;
  widthPct: number;
}

export interface ActivationBand {
  skillId: string;
  label: string;
  startPct: number;
  widthPct: number;
  isUnique: boolean;
  /** Width (and unparsed-condition start) are approximate; surface this in the UI. */
  approximate: boolean;
}

type BandSkill = Pick<SkillRecord, 'skillId' | 'nameEn' | 'conditions'>;

/** Default activation-band width in metres until real duration data is sourced. */
export const DEFAULT_BAND_WIDTH_M = 200;

/** Metres → % of course distance, clamped to 0..100. */
export function pctOf(metres: number, distance: number): number {
  if (distance <= 0) return 0;
  const pct = (metres / distance) * 100;
  if (pct < 0) return 0;
  if (pct > 100) return 100;
  return pct;
}

/**
 * Ordered segments covering [0, distance]. Corners come from the geometry;
 * the gaps around them are straights (robust even if `straights` is partial).
 */
export function trackSegments(geom: CourseGeometry): TrackSegment[] {
  const { distance } = geom;
  const corners = [...geom.corners].sort((a, b) => a.start - b.start);
  const segments: TrackSegment[] = [];
  let cursor = 0;
  const push = (kind: TrackSegment['kind'], from: number, to: number) => {
    if (to <= from) return;
    segments.push({ kind, startPct: pctOf(from, distance), widthPct: pctOf(to - from, distance) });
  };
  for (const c of corners) {
    const end = c.start + c.length;
    if (c.start > cursor) push('straight', cursor, c.start);
    push('corner', Math.max(c.start, cursor), end);
    cursor = Math.max(cursor, end);
  }
  if (cursor < distance) push('straight', cursor, distance);
  return segments;
}

/**
 * START position (metres) of a skill's activation, parsed from the dominant
 * positional token in `conditions`, or null when none is recognised. Mirrors
 * the engine's own metre formulas for the common tokens only.
 */
export function activationAnchor(conditions: string, geom: CourseGeometry): number | null {
  const { distance } = geom;
  const clamp = (m: number) => Math.max(0, Math.min(distance, m));

  const dr = conditions.match(/distance_rate\s*>=?\s*(\d+(?:\.\d+)?)/);
  if (dr) return clamp((distance * Number(dr[1])) / 100);

  const rd = conditions.match(/remain_distance\s*<=?\s*(\d+(?:\.\d+)?)/);
  if (rd) return clamp(distance - Number(rd[1]));

  if (/is_finalcorner\s*==?\s*1/.test(conditions)) {
    const corners = [...geom.corners].sort((a, b) => a.start - b.start);
    const last = corners[corners.length - 1];
    if (last) return clamp(last.start);
  }

  const phase = conditions.match(/\bphase\s*(?:>=?|==)\s*(\d+)/);
  if (/is_lastspurt\s*==?\s*1/.test(conditions) || (phase && Number(phase[1]) >= 2)) {
    return clamp((distance * 2) / 3);
  }

  if (/(?<!final)corner\s*[!=]=\s*\d+/.test(conditions)) {
    const corners = [...geom.corners].sort((a, b) => a.start - b.start);
    const first = corners[0];
    if (first) return clamp(first.start);
  }

  return null;
}

/** One skill → an activation band (start parsed, width approximate). */
export function skillConditionToBand(
  skill: BandSkill,
  geom: CourseGeometry,
  opts: { isUnique: boolean },
): ActivationBand {
  const startM = activationAnchor(skill.conditions, geom) ?? 0;
  const widthM = Math.min(DEFAULT_BAND_WIDTH_M, geom.distance - startM);
  return {
    skillId: skill.skillId,
    label: skill.nameEn,
    startPct: pctOf(startM, geom.distance),
    widthPct: pctOf(widthM, geom.distance),
    isUnique: opts.isUnique,
    approximate: true,
  };
}

/**
 * The unique (always) + every wishlist skill, deduped, as activation bands.
 * Ids missing from `skillById` are skipped.
 */
export function activationBands(
  wishlistIds: string[],
  uniqueSkillId: string | undefined,
  geom: CourseGeometry,
  skillById: ReadonlyMap<string, BandSkill>,
): ActivationBand[] {
  const bands: ActivationBand[] = [];
  const seen = new Set<string>();
  const add = (id: string | undefined, isUnique: boolean) => {
    if (!id || seen.has(id)) return;
    const skill = skillById.get(id);
    if (!skill) return;
    seen.add(id);
    bands.push(skillConditionToBand(skill, geom, { isUnique }));
  };
  add(uniqueSkillId, true);
  for (const id of wishlistIds) add(id, false);
  return bands;
}
