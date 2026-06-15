import { mergeTimeline } from '@/core/timeline';
import type { CmPreset, TimelineEntry } from '@/core/types';

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** Each cm_preset → a `cm` TimelineEntry (real data; tier/status by server, P4). */
export function buildTimeline(inputs: {
  presets: CmPreset[];
  overrides: Array<Partial<TimelineEntry> & { id: string }>;
  dataVersion: string;
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
  return { dataVersion: inputs.dataVersion, entries: mergeTimeline(base, inputs.overrides) };
}
