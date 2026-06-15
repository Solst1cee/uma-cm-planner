import { mergeTimeline, sortTimeline } from '@/core/timeline';
import { synthesizeUpcomingCms } from '@/core/cmSynthesis';
import { slug } from '@/core/slug';
import type { CmPreset, CmTrack, TimelineEntry } from '@/core/types';

/**
 * Each cm_preset → a `cm` TimelineEntry (real data; tier/status by server, P4),
 * overrides merged, then synthesized *predicted* CMs (cm_tracks rotation, monthly
 * cadence) appended — predictions never overwrite a present CM number.
 */
export function buildTimeline(inputs: {
  presets: CmPreset[];
  overrides: Array<Partial<TimelineEntry> & { id: string }>;
  tracks?: CmTrack[];
  dataVersion: string;
  horizon?: number;
}): { dataVersion: string; entries: TimelineEntry[] } {
  const base: TimelineEntry[] = inputs.presets.map((p) => ({
    id: `cm-${slug(p.name)}-${p.date}`,
    type: 'cm' as const,
    title: p.name,
    dates: { finals: p.date },
    cm: { courseId: p.courseId, trackSummary: `${p.distance}m ${p.surface}` },
    tier: (p.server === 'global' ? 'official' : 'datamined') as 'official' | 'datamined',
    status: (p.server === 'global' ? 'confirmed' : 'unconfirmed') as 'confirmed' | 'unconfirmed',
    source: { kind: 'umalator' as const, url: 'https://github.com/jalbarrang/umalator-global' },
    server: p.server,
    dataVersion: inputs.dataVersion,
  }));
  const merged = mergeTimeline(base, inputs.overrides);
  const predicted = synthesizeUpcomingCms(merged, inputs.tracks ?? [], {
    dataVersion: inputs.dataVersion,
    horizon: inputs.horizon,
  });
  return { dataVersion: inputs.dataVersion, entries: sortTimeline([...merged, ...predicted]) };
}
