/**
 * Build-time CM-schedule synthesis: from the merged (imported ⊕ overrides)
 * timeline + the uma.guide track rotation (cm_tracks.json), generate *predicted*
 * upcoming Champions Meetings so the timeline shows CM16+ ahead of official
 * confirmation. PREDICTION ONLY (P3): monthly cadence, no courseId, tier
 * 'prediction'. Overrides win — any CM number already present is skipped.
 */
import type { CmTrack, JpCmDate, TimelineEntry } from './types';
import { addMonths } from './timeline';
import { calibrateFromConfirmed, projectGlobalDate, type ConfirmedCm } from './foresight';
import { slug } from './slug';

export interface SynthesizeOpts {
  /** Months between consecutive CMs (Global runs ~one zodiac cup/month). Default 1. */
  monthsPerCm?: number;
  /** How many CMs past the anchor to predict. Default 3. */
  horizon?: number;
  dataVersion: string;
  /** Source URL stamped on predicted entries. Default the uma.guide CM schedule. */
  sourceUrl?: string;
  /** JP CM dates (data-overrides/jp-schedule.json) for pace projection; absent ⇒ +1-month fallback. */
  jpCms?: JpCmDate[];
}

const UMA_GUIDE_URL = 'https://uma.guide/cm-schedule/';

export function synthesizeUpcomingCms(
  merged: TimelineEntry[],
  tracks: CmTrack[],
  opts: SynthesizeOpts,
): TimelineEntry[] {
  const monthsPerCm = opts.monthsPerCm ?? 1;
  const horizon = opts.horizon ?? 3;
  const sourceUrl = opts.sourceUrl ?? UMA_GUIDE_URL;

  // Collect every present CM number (so overrides/predicted CMs are never
  // duplicated) and the CONFIRMED entries with finals dates. The anchor and the
  // calibration both use confirmed CMs only — a hand-authored prediction entry
  // (tier 'prediction' with a finals date) must never set the clock, or the
  // timeline's dates diverge from build-all's confirmed-only record projections.
  const present = new Set<number>();
  const confirmed: ConfirmedCm[] = [];
  let anchor: { num: number; finals: string } | null = null;
  for (const e of merged) {
    const num = e.cm?.cmNumber;
    if (e.type !== 'cm' || num === undefined) continue;
    present.add(num);
    const finals = e.dates.finals;
    if (finals === undefined || e.status !== 'confirmed') continue;
    confirmed.push({ cmNumber: num, global: finals });
    if (anchor === null || num > anchor.num) anchor = { num, finals };
  }
  if (anchor === null) return [];

  // Rolling JP→Global pace from confirmed-∩-JP CMs, via the shared foresight
  // join (one clock). null ⇒ too few shared CMs ⇒ +1-month fallback.
  const jpByNum = new Map((opts.jpCms ?? []).map((c) => [c.cmNumber, c.jpDate]));
  const cal = calibrateFromConfirmed(opts.jpCms ?? [], confirmed);

  // Predict `horizon` CMs beyond the latest confirmed CM (the anchor). The window
  // slides forward as CMs are confirmed, so it always shows the next `horizon`
  // ahead. `present` skips any number already on the timeline — a duplicate of the
  // anchor, or a numbered-but-undated CM that falls in range (never overwrite real
  // data; "overrides win"). Dates are measured from the anchor's (latest) finals.
  const byIndex = new Map(tracks.map((t) => [t.index, t]));
  const out: TimelineEntry[] = [];
  for (let n = anchor.num + 1; n <= anchor.num + horizon; n++) {
    if (present.has(n)) continue;
    const track = byIndex.get(n);
    if (track === undefined) continue;
    out.push({
      id: `cm${n}-${slug(track.cupName)}-predicted`,
      type: 'cm',
      title: track.cupName,
      dates: {
        finals:
          cal && jpByNum.has(n)
            ? projectGlobalDate(jpByNum.get(n)!, cal)
            : addMonths(anchor.finals, (n - anchor.num) * monthsPerCm),
      },
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
