/**
 * Data pipeline orchestrator (plan §6 build step 1):
 * scripts/borrowed/ (pinned upstream JSON) → normalize → merge
 * data-overrides/ LAST → emit public/data/ (git-tracked, generated — never
 * edit by hand, P5).
 *
 * Usage:
 *   pnpm data:build                  — requires scripts/borrowed/ (pnpm data:fetch)
 *   pnpm data:build -- --from-spikes — (re)copy inputs from the local Phase-0 clone first
 */
import { join } from 'node:path';
import type { CmPreset, SkillRecord, SupportCardRecord } from '@/core/types';
import { buildCards, recomputeHintPoolSizes } from './build-cards';
import { buildCmPresets } from './build-cm-presets';
import { buildSkills } from './build-skills';
import { buildSparkRates } from './build-spark-rates';
import { borrowedFilesPresent, copyFromSpikes, UPSTREAM_COMMIT } from './fetch-borrowed';
import { OVERRIDES_DIR, PUBLIC_DATA_DIR, readBorrowedJson, writeJsonDeterministic } from './lib/io';
import type {
  CourseDataJson,
  EventSkillSourcesJson,
  GtCard,
  GtSkill,
  MasterCardsJson,
  MasterSkillsJson,
  UpstreamCmPreset,
} from './lib/upstream-types';
import { applyOverrides, loadOverrideFiles } from './merge-overrides';

const DATA_VERSION = `global-${UPSTREAM_COMMIT.slice(0, 8)}`; // "global-c1fa2107"

export function buildAll(opts: { fromSpikes: boolean }): void {
  if (opts.fromSpikes) {
    copyFromSpikes();
  } else if (!borrowedFilesPresent()) {
    throw new Error(
      'scripts/borrowed/ is missing inputs — run `pnpm data:fetch` (network) or ' +
        '`pnpm data:build -- --from-spikes` (local clone).',
    );
  }

  const masterSkills = readBorrowedJson<MasterSkillsJson>('skills.json');
  let skills = buildSkills({
    master: masterSkills,
    gametora: readBorrowedJson<GtSkill[]>('gametora/skills.json'),
    dataVersion: DATA_VERSION,
  });
  let cards = buildCards({
    master: readBorrowedJson<MasterCardsJson>('support-cards.json'),
    gametoraCards: readBorrowedJson<GtCard[]>('gametora/support-cards.json'),
    eventSources: readBorrowedJson<EventSkillSourcesJson>('gametora/event-skill-sources.json'),
    releasedSkillIds: new Set(Object.keys(masterSkills)),
    dataVersion: DATA_VERSION,
  });
  let presets = buildCmPresets({
    presets: readBorrowedJson<UpstreamCmPreset[]>('cm-presets.json'),
    courses: readBorrowedJson<CourseDataJson>('course_data.json'),
  });
  const sparkRates = buildSparkRates();

  // Overrides win, applied LAST (P5). spark_rates is already hand-encoded
  // (mechanics-notes) and is not override-targetable.
  for (const override of loadOverrideFiles(OVERRIDES_DIR)) {
    switch (override._target) {
      case 'skills':
        skills = applyOverrides<SkillRecord>(skills, override, 'skillId', override.fileName);
        break;
      case 'support_cards':
        cards = applyOverrides<SupportCardRecord>(cards, override, 'cardId', override.fileName);
        break;
      case 'cm_presets':
        presets = applyOverrides<CmPreset>(presets, override, 'name', override.fileName);
        break;
      default:
        throw new Error(`${override.fileName}: unknown _target "${override._target}"`);
    }
    console.log(`applied ${override.fileName} → ${override._target}`);
  }
  recomputeHintPoolSizes(cards); // hintPoolSize is derived; overrides may re-type sources

  writeJsonDeterministic(join(PUBLIC_DATA_DIR, 'skills.json'), skills);
  writeJsonDeterministic(join(PUBLIC_DATA_DIR, 'support_cards.json'), cards);
  writeJsonDeterministic(join(PUBLIC_DATA_DIR, 'spark_rates.json'), sparkRates);
  writeJsonDeterministic(join(PUBLIC_DATA_DIR, 'cm_presets.json'), presets);

  console.log(
    `public/data written: ${skills.length} skills, ${cards.length} support cards, ` +
      `${presets.length} cm presets, spark_rates (${sparkRates.dataVersion}).`,
  );
}

const isMain = (process.argv[1] ?? '').replace(/\\/g, '/').endsWith('scripts/build-all.ts');
if (isMain) {
  try {
    buildAll({ fromSpikes: process.argv.includes('--from-spikes') });
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  }
}
