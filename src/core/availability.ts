import type { Server } from './types';

/**
 * Is a server-versioned record available on Global as of `asOfISO` (yyyy-mm-dd)?
 * Dated records gate on releaseDate (inclusive); undated records fall back to
 * server ('global' = on Global now, 'jp' = preview, not yet). The reference
 * date is supplied by the caller (planner → CM start date; a generic view →
 * today + horizon). See the 2026-06-19 data-timeline-currency spec.
 */
export function isReleasedBy(
  record: { releaseDate?: string; server: Server },
  asOfISO: string,
): boolean {
  if (record.releaseDate !== undefined) return record.releaseDate <= asOfISO;
  return record.server === 'global';
}
