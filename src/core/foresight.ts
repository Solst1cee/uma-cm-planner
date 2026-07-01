/**
 * Foresight: predict Global dates from JP dates by calibrating a *rolling* pace
 * from the last N shared Champions Meetings (JP↔Global), then compressing the
 * interval from the most recent shared CM. Generalizes predictGlobalDate from
 * fixed launch anchors to rolling CM anchors (GameTora's Foresight method).
 * PREDICTION ONLY (P3). Pure (P6).
 */
import { predictGlobalDate } from './timeline';

const DAY = 86_400_000;

/** A CM present on both servers with real dates. */
export interface SharedCm {
  cmNumber: number;
  jp: string; // YYYY-MM-DD, JP date
  global: string; // YYYY-MM-DD, confirmed Global date
}

export interface Calibration {
  /** JP days per Global day over the window (>1 ⇒ Global compresses JP). */
  pace: number;
  /** global[last] − jp[last]: how far behind JP the latest shared CM is. */
  gapDays: number;
  anchorJp: string;
  anchorGlobal: string;
  /** CM-to-CM steps used (window length − 1). */
  windowSteps: number;
}

/**
 * Rolling calibration over the last `window` (default 6) shared CMs.
 * pace = (jp[last] − jp[first]) / (global[last] − global[first])
 *      = total JP span / total Global span (== GameTora's avg JA gap / avg server gap).
 * Returns null with < 2 shared CMs or a non-positive Global span (caller falls back).
 */
export function calibratePace(shared: SharedCm[], window = 6): Calibration | null {
  const sorted = [...shared].sort((a, b) => a.cmNumber - b.cmNumber);
  const w = sorted.slice(-window);
  if (w.length < 2) return null;
  const first = w[0];
  const last = w[w.length - 1];
  if (first === undefined || last === undefined) return null;
  const jpSpan = (Date.parse(last.jp) - Date.parse(first.jp)) / DAY;
  const globalSpan = (Date.parse(last.global) - Date.parse(first.global)) / DAY;
  if (globalSpan <= 0) return null;
  return {
    pace: jpSpan / globalSpan,
    gapDays: Math.round((Date.parse(last.global) - Date.parse(last.jp)) / DAY),
    anchorJp: last.jp,
    anchorGlobal: last.global,
    windowSteps: w.length - 1,
  };
}

/** Project a JP date to Global using the rolling calibration (reuses predictGlobalDate). */
export function projectGlobalDate(jpISO: string, cal: Calibration): string {
  return predictGlobalDate(jpISO, cal.pace, cal.anchorJp, cal.anchorGlobal);
}
