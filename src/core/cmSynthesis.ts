/**
 * Build-time CM-schedule synthesis: from the merged (imported ⊕ overrides)
 * timeline + the uma.guide track rotation (cm_tracks.json), generate *predicted*
 * upcoming Champions Meetings so the timeline shows CM16+ ahead of official
 * confirmation. PREDICTION ONLY (P3): monthly cadence, no courseId, tier
 * 'prediction'. Overrides win — any CM number already present is skipped.
 */
import type { CmTrack, TimelineEntry } from './types';
import { addMonths } from './timeline';

export interface SynthesizeOpts {
  /** Months between consecutive CMs (Global runs ~one zodiac cup/month). Default 1. */
  monthsPerCm?: number;
  /** How many CMs past the anchor to predict. Default 3. */
  horizon?: number;
  dataVersion: string;
  /** Source URL stamped on predicted entries. Default the uma.guide CM schedule. */
  sourceUrl?: string;
}

const UMA_GUIDE_URL = 'https://uma.guide/cm-schedule/';

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function synthesizeUpcomingCms(
  merged: TimelineEntry[],
  tracks: CmTrack[],
  opts: SynthesizeOpts,
): TimelineEntry[] {
  const monthsPerCm = opts.monthsPerCm ?? 1;
  const horizon = opts.horizon ?? 3;
  const sourceUrl = opts.sourceUrl ?? UMA_GUIDE_URL;

  // Collect every present CM number (so overrides/confirmed CMs are never
  // duplicated) and the date anchor = highest number that also has a finals date.
  const present = new Set<number>();
  let anchor: { num: number; finals: string } | null = null;
  for (const e of merged) {
    const num = e.cm?.cmNumber;
    if (e.type !== 'cm' || num === undefined) continue;
    present.add(num);
    const finals = e.dates.finals;
    if (finals !== undefined && (anchor === null || num > anchor.num)) {
      anchor = { num, finals };
    }
  }
  if (anchor === null) return [];

  const byIndex = new Map(tracks.map((t) => [t.index, t]));

  // The horizon counts CM *slots* (not fresh predictions) forward from the start
  // of the confirmed run within the rotation — so manually overriding a later CM
  // (CM16) does NOT slide the window outward; the override is subtracted from the
  // prediction set, never extends it ("overrides win"). `base` is the lowest
  // present CM that exists in the rotation; the window is (anchor, base+horizon].
  let base = anchor.num;
  for (const n of present) {
    if (byIndex.has(n) && n < base) base = n;
  }

  const out: TimelineEntry[] = [];
  for (let n = anchor.num + 1; n <= base + horizon; n++) {
    if (present.has(n)) continue;
    const track = byIndex.get(n);
    if (track === undefined) continue;
    out.push({
      id: `cm${n}-${slug(track.cupName)}-predicted`,
      type: 'cm',
      title: track.cupName,
      dates: { finals: addMonths(anchor.finals, (n - anchor.num) * monthsPerCm) },
      cm: {
        cmNumber: n,
        // No courseId — track direction / inner-outer unknown until official (P3).
        trackSummary: `${track.racetrack} ${track.surface} ${track.distance}m (${track.distanceClass})`,
      },
      tier: 'prediction',
      status: 'unconfirmed',
      source: { kind: 'umaguide', url: sourceUrl },
      server: 'global',
      dataVersion: opts.dataVersion,
    });
  }
  return out;
}
