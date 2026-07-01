/**
 * Build-time foresight: assemble the shared-CM window and project Global release
 * dates for JP-ahead records. Reuses @/core/foresight (no new date math). P3.
 */
import { calibratePace, projectGlobalDate, type Calibration, type SharedCm } from '@/core/foresight';
import type { JpCmDate } from '@/core/types';

/** A confirmed Global CM date, keyed by CM number (from timeline_overrides). */
export interface ConfirmedCm {
  cmNumber: number;
  global: string;
}

/** Join jp-schedule CMs to confirmed Global CM dates by cmNumber, then calibrate. */
export function buildForesightCalibration(jpCms: JpCmDate[], confirmed: ConfirmedCm[]): Calibration | null {
  const globalByNum = new Map(confirmed.map((c) => [c.cmNumber, c.global]));
  const shared: SharedCm[] = [];
  for (const jp of jpCms) {
    const global = globalByNum.get(jp.cmNumber);
    if (global !== undefined) shared.push({ cmNumber: jp.cmNumber, jp: jp.jpDate, global });
  }
  return calibratePace(shared);
}

/** Resolve a Global release date for a JP record: announced wins, else project, else none. */
export function projectReleaseDate(
  jpDate: string | undefined,
  announcedGlobal: string | undefined,
  cal: Calibration | null,
): { releaseDate?: string; predicted: boolean } {
  if (announcedGlobal !== undefined) return { releaseDate: announcedGlobal, predicted: false };
  if (jpDate === undefined || cal === null) return { predicted: false };
  return { releaseDate: projectGlobalDate(jpDate, cal), predicted: true };
}
