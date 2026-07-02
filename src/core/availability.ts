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

/** Availability tier of a record relative to a cutoff date (a CM's date). */
export type AvailabilityTier = 'now' | 'upcoming' | 'future';

/** The app-wide planning-horizon lens (spec 2026-07-02-planning-horizon). */
export type PlanningHorizon =
  | { kind: 'current' }
  | { kind: 'cm'; cmNumber: number }
  | { kind: 'allJp' };

/**
 * now      = available on Global today (server global, or dated ≤ today);
 * upcoming = JP-ahead, arriving by the cutoff (releaseDate ≤ cutoffISO);
 * future   = JP-ahead after the cutoff, or undated JP.
 */
export function availabilityTier(
  record: { server: Server; releaseDate?: string },
  cutoffISO: string,
  todayISO: string,
): AvailabilityTier {
  if (record.server === 'global') return 'now';
  if (record.releaseDate === undefined) return 'future';
  if (record.releaseDate <= todayISO) return 'now';
  if (record.releaseDate <= cutoffISO) return 'upcoming';
  return 'future';
}

/** Which tiers a horizon reveals: current→now · cm→now+upcoming · allJp→all. */
export function visibleAtHorizon(tier: AvailabilityTier, horizon: PlanningHorizon): boolean {
  if (horizon.kind === 'allJp') return true;
  if (horizon.kind === 'cm') return tier !== 'future';
  return tier === 'now';
}
