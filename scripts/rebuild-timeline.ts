/**
 * Focused timeline-only rebuild: regenerate public/data/timeline.json from the
 * already-built cm_presets.json + cm_tracks.json + data-overrides/timeline_overrides.json.
 * Unlike `pnpm data:build` it needs no scripts/borrowed/ inputs, so it runs in a
 * worktree. Assumes the other public/data/*.json are current.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { CmPreset, CmTrack, JpCmDate, TimelineEntry } from '@/core/types';
import { buildTimeline } from './build-timeline';
import { UPSTREAM_COMMIT } from './fetch-borrowed';
import { OVERRIDES_DIR, PUBLIC_DATA_DIR, readJson, writeJsonDeterministic } from './lib/io';

const DATA_VERSION = `global-${UPSTREAM_COMMIT.slice(0, 8)}`;

export function rebuildTimeline(): void {
  const presets = readJson<CmPreset[]>(join(PUBLIC_DATA_DIR, 'cm_presets.json'));
  const tracksPath = join(PUBLIC_DATA_DIR, 'cm_tracks.json');
  const tracks = existsSync(tracksPath) ? readJson<{ tracks: CmTrack[] }>(tracksPath).tracks : [];
  const overrides =
    readJson<{ entries?: Array<Partial<TimelineEntry> & { id: string }> }>(
      join(OVERRIDES_DIR, 'timeline_overrides.json'),
    ).entries ?? [];

  const jpSchedulePath = join(OVERRIDES_DIR, 'jp-schedule.json');
  const jpSchedule = existsSync(jpSchedulePath) ? readJson<{ cms?: JpCmDate[] }>(jpSchedulePath) : {};
  const timeline = buildTimeline({ presets, overrides, tracks, jpCms: jpSchedule.cms ?? [], dataVersion: DATA_VERSION });
  writeJsonDeterministic(join(PUBLIC_DATA_DIR, 'timeline.json'), timeline);
  const predicted = timeline.entries.filter((e) => e.tier === 'prediction').length;
  console.log(`timeline.json rebuilt: ${timeline.entries.length} entries (${predicted} predicted).`);
}

const isMain = (process.argv[1] ?? '').replace(/\\/g, '/').endsWith('scripts/rebuild-timeline.ts');
if (isMain) rebuildTimeline();
