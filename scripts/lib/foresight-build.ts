/**
 * Build-time foresight: project Global release dates for JP-ahead records.
 * The calibration join lives in @/core/foresight (`calibrateFromConfirmed`) and
 * is shared with cmSynthesis so record dates and predicted CM dates stay on one
 * clock (no new date math here). P3.
 */
import { calibrateFromConfirmed, projectGlobalDate, type Calibration, type ConfirmedCm } from '@/core/foresight';
import type { JpCmDate } from '@/core/types';

export type { ConfirmedCm } from '@/core/foresight';

/** Join jp-schedule CMs to confirmed Global CM dates by cmNumber, then calibrate. */
export function buildForesightCalibration(jpCms: JpCmDate[], confirmed: ConfirmedCm[]): Calibration | null {
  return calibrateFromConfirmed(jpCms, confirmed);
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
