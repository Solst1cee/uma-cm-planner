/**
 * Pure parser for uma.guide/cm-schedule/ Vue SSR HTML.
 * Source: https://uma.guide/cm-schedule/
 * Retrieved: 2026-06-15
 *
 * Markup pattern (Vue SSR with data-v-e0dbb41a scope attributes):
 *   <div class="cm-item" data-v-e0dbb41a>
 *     <span class="cm-number" data-v-e0dbb41a>#3</span>
 *     <div class="cm-info" data-v-e0dbb41a>
 *       <span class="cm-name" data-v-e0dbb41a>Cancer Cup</span>
 *       <span class="cm-details" data-v-e0dbb41a>Tokyo · 1600m · <span class="dist-tag dist-mile" data-v-e0dbb41a>Mile</span></span>
 *     </div>
 *     <span class="surface-tag turf" data-v-e0dbb41a>Turf</span>
 *   </div>
 *
 * The · separator is U+00B7 (middle dot, \xb7).
 */
import type { CmTrack } from '@/core/types';

/**
 * Parse the uma.guide CM schedule HTML into an ordered array of CmTrack records.
 * Sorted ascending by index.
 */
export function parseUmaGuideSchedule(html: string): CmTrack[] {
  // Match the full cm-item structure in one pass.
  // Group 1: cm-number (digits after #)
  // Group 2: cm-name text
  // Group 3: cm-details text node before the inner dist-tag span (e.g. "Tokyo · 1600m · ")
  // Group 4: dist-tag class suffix (mile|medium|long|sprint)
  // Group 5: surface-tag class (turf|dirt)
  const re =
    /<div class="cm-item"[^>]*>\s*<span class="cm-number"[^>]*>#(\d+)<\/span>\s*<div class="cm-info"[^>]*>\s*<span class="cm-name"[^>]*>([^<]+)<\/span>\s*<span class="cm-details"[^>]*>([^<]*)<span class="dist-tag dist-(\w+)"[^>]*>[^<]+<\/span><\/span>\s*<\/div>\s*<span class="surface-tag (\w+)"[^>]*>/g;

  const tracks: CmTrack[] = [];
  let m: RegExpExecArray | null;

  while ((m = re.exec(html)) !== null) {
    const index = parseInt(m[1]!, 10);
    const cupName = m[2]!.trim();

    // Details text is like "Tokyo \xb7 1600m \xb7 " — split on U+00B7 middle dot
    const detailsParts = m[3]!.split('·');
    const racetrack = detailsParts[0]?.trim() ?? '';
    const distRaw = detailsParts[1]?.trim() ?? '';
    const distMatch = distRaw.match(/(\d+)/);
    const distance = distMatch ? parseInt(distMatch[1]!, 10) : 0;

    const distanceClassRaw = m[4]!.toLowerCase();
    const distanceClass = isDistanceClass(distanceClassRaw) ? distanceClassRaw : 'medium';

    const surfaceRaw = m[5]!.toLowerCase();
    const surface = isSurface(surfaceRaw) ? surfaceRaw : 'turf';

    tracks.push({ index, cupName, racetrack, distance, distanceClass, surface });
  }

  // Sort ascending by index (fixture is already ordered, but be explicit)
  tracks.sort((a, b) => a.index - b.index);

  return tracks;
}

function isDistanceClass(s: string): s is CmTrack['distanceClass'] {
  return s === 'sprint' || s === 'mile' || s === 'medium' || s === 'long';
}

function isSurface(s: string): s is CmTrack['surface'] {
  return s === 'turf' || s === 'dirt';
}
