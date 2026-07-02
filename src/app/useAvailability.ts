import { useMemo } from 'react';
import { useActivePlan } from '@/app/ActivePlanContext';
import { useGameData } from '@/features/data/gameData';
import { availabilityTier, visibleAtHorizon, type AvailabilityTier, type PlanningHorizon } from '@/core/availability';
import type { Server, TimelineEntry } from '@/core/types';

const todayISO = () => new Date().toISOString().slice(0, 10);
const cmDate = (e: TimelineEntry) => e.dates.start ?? e.dates.finals ?? '';

export function useAvailability() {
  const { plan, horizon, setHorizon } = useActivePlan();
  const { timeline } = useGameData();
  return useMemo(() => {
    const today = todayISO();
    const cms = ((timeline as TimelineEntry[] | undefined) ?? []).filter(
      (e) => e.type === 'cm' && e.cm?.cmNumber !== undefined && cmDate(e) !== '',
    );
    const planCmNumber = plan?.cmRef.kind === 'cm' ? plan.cmRef.cmNumber : undefined;
    const planCmISO = cmDate(cms.find((e) => e.cm!.cmNumber === planCmNumber) ?? ({ dates: {} } as TimelineEntry)) || today;
    let cutoffISO = today;
    if (horizon.kind === 'cm') {
      const chosen = cms.find((e) => e.cm!.cmNumber === horizon.cmNumber);
      cutoffISO = chosen ? cmDate(chosen) : today; // stale cmNumber → today (≈ current)
    } else if (horizon.kind === 'allJp') {
      cutoffISO = planCmISO; // tiers still labeled against the plan's CM
    }
    const tierOf = (r: { server: Server; releaseDate?: string; releaseDatePredicted?: boolean }): AvailabilityTier =>
      availabilityTier(r, cutoffISO, today);
    const visible = (r: { server: Server; releaseDate?: string; releaseDatePredicted?: boolean }) =>
      visibleAtHorizon(tierOf(r), horizon);
    const futureCms = cms
      .filter((e) => cmDate(e) >= today)
      .sort((a, b) => cmDate(a).localeCompare(cmDate(b)))
      .map((e) => ({ cmNumber: e.cm!.cmNumber!, title: e.title, date: cmDate(e), predicted: e.tier === 'prediction' }));
    return { horizon, setHorizon, cutoffISO, todayISO: today, planCmISO, tierOf, visible, futureCms };
  }, [plan, horizon, setHorizon, timeline]);
}

export type { PlanningHorizon };
