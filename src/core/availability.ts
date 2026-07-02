import type { Server } from './types';

/** Availability tier of a record relative to a cutoff date (a CM's date). */
export type AvailabilityTier = 'now' | 'upcoming' | 'future';

/** The app-wide planning-horizon lens (spec 2026-07-02-planning-horizon). */
export type PlanningHorizon =
  | { kind: 'current' }
  | { kind: 'cm'; cmNumber: number }
  | { kind: 'allJp' };

/**
 * now      = available on Global today (server global, or an *announced* date
 *            that's elapsed — a foresight-PROJECTED date having elapsed is
 *            still a guess, per P4/P3, so it does NOT count as 'now');
 * upcoming = JP-ahead, arriving by the cutoff (releaseDate ≤ cutoffISO) —
 *            this also catches a predicted-elapsed date, since its date is
 *            always ≤ today ≤ cutoff;
 * future   = JP-ahead after the cutoff, or undated JP.
 */
export function availabilityTier(
  record: { server: Server; releaseDate?: string; releaseDatePredicted?: boolean },
  cutoffISO: string,
  todayISO: string,
): AvailabilityTier {
  if (record.server === 'global') return 'now';
  if (record.releaseDate === undefined) return 'future';
  if (record.releaseDate <= todayISO && record.releaseDatePredicted !== true) return 'now';
  if (record.releaseDate <= cutoffISO) return 'upcoming';
  return 'future';
}

/** Which tiers a horizon reveals: current→now · cm→now+upcoming · allJp→all. */
export function visibleAtHorizon(tier: AvailabilityTier, horizon: PlanningHorizon): boolean {
  if (horizon.kind === 'allJp') return true;
  if (horizon.kind === 'cm') return tier !== 'future';
  return tier === 'now';
}
