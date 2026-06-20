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
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { CmPreset, CmTrack, SkillRecord, SupportCardRecord, TimelineEntry, UmaRecord } from '@/core/types';
import { buildAffinity } from './build-affinity';
import { assertTachyonsParity, buildCards, recomputeHintPoolSizes } from './build-cards';
import { buildCmPresets } from './build-cm-presets';
import { buildIcons } from './build-icons';
import { buildSkills } from './build-skills';
import { buildSparkRates } from './build-spark-rates';
import { buildTimeline } from './build-timeline';
import { buildUmas } from './build-umas';
import { borrowedFilesPresent, copyFromSpikes, DATA_VERSION } from './fetch-borrowed';
import { loadCardAdditions } from './lib/card-additions';
import { loadSkillAdditions } from './lib/skill-additions';
import { loadUpcomingCards } from './lib/upcoming-cards';
import { OVERRIDES_DIR, PUBLIC_DATA_DIR, readBorrowedJson, readJson, writeJsonDeterministic } from './lib/io';
import type {
  CourseDataJson,
  EventSkillSourcesJson,
  GtCard,
  GtCharacterCard,
  GtSkill,
  MasterCardsJson,
  MasterSkillsJson,
  TachyonsDataJson,
  UmalatorUmasJson,
  UpstreamCmPreset,
} from './lib/upstream-types';
import { applyOverrides, loadOverrideFiles } from './merge-overrides';

export async function buildAll(opts: { fromSpikes: boolean }): Promise<void> {
  if (opts.fromSpikes) {
    copyFromSpikes();
  } else if (!borrowedFilesPresent()) {
    throw new Error(
      'scripts/borrowed/ is missing inputs — run `pnpm data:fetch` (network) or ' +
        '`pnpm data:build -- --from-spikes` (local clone).',
    );
  }

  const masterSkills = readBorrowedJson<MasterSkillsJson>('skills.json');
  const releasedSkillIds = new Set(Object.keys(masterSkills));
  const tachyons = readBorrowedJson<TachyonsDataJson>('tachyons-data.json');
  let skills = buildSkills({
    master: masterSkills,
    gametora: readBorrowedJson<GtSkill[]>('gametora/skills.json'),
    dataVersion: DATA_VERSION,
  });
  // Additions: full records for upcoming (server:'jp') skills not yet in the Global cutover
  // — inserted BEFORE overrides so overrides can still patch them.
  const skillAdditions = loadSkillAdditions(join(OVERRIDES_DIR, 'skill_additions.json'), {
    existingSkillIds: new Set(skills.map((s) => s.skillId)),
  });
  if (skillAdditions.length > 0) {
    skills = [...skills, ...skillAdditions].sort((a, b) => Number(a.skillId) - Number(b.skillId));
    console.log(`applied skill_additions.json → ${skillAdditions.length} upcoming skill(s)`);
  }
  let cards = buildCards({
    master: readBorrowedJson<MasterCardsJson>('support-cards.json'),
    gametoraCards: readBorrowedJson<GtCard[]>('gametora/support-cards.json'),
    eventSources: readBorrowedJson<EventSkillSourcesJson>('gametora/event-skill-sources.json'),
    tachyons,
    releasedSkillIds,
    dataVersion: DATA_VERSION,
  });
  // Additions: full records for Global cards newer than the upstream pin
  // (provenance §3.2) — inserted BEFORE overrides so overrides can patch them.
  const additions = loadCardAdditions(join(OVERRIDES_DIR, 'card_additions.json'), {
    existingCardIds: new Set(cards.map((c) => c.cardId)),
    releasedSkillIds,
  });
  if (additions.length > 0) {
    cards = [...cards, ...additions].sort((a, b) => Number(a.cardId) - Number(b.cardId));
    console.log(`applied card_additions.json → ${additions.length} record(s): ${additions.map((c) => c.cardId).join(', ')}`);
  }
  // Upcoming: full records for announced/anticipated Global cards not yet released
  // (server:'jp' + releaseDate) — preview, gated by CM date in the UI (P4). Inserted
  // after card_additions, before overrides so overrides can still patch them.
  const upcomingCards = loadUpcomingCards(join(OVERRIDES_DIR, 'upcoming_cards.json'), {
    existingCardIds: new Set(cards.map((c) => c.cardId)),
  });
  if (upcomingCards.length > 0) {
    cards = [...cards, ...upcomingCards].sort((a, b) => Number(a.cardId) - Number(b.cardId));
    console.log(`applied upcoming_cards.json → ${upcomingCards.length} upcoming card(s)`);
  }
  let presets = buildCmPresets({
    presets: readBorrowedJson<UpstreamCmPreset[]>('cm-presets.json'),
    courses: readBorrowedJson<CourseDataJson>('course_data.json'),
    dataVersion: DATA_VERSION,
  });
  let umas = buildUmas({
    umas: readBorrowedJson<UmalatorUmasJson>('umas.json'),
    gametoraChars: readBorrowedJson<GtCharacterCard[]>('gametora/character-cards.json'),
    dataVersion: DATA_VERSION,
  });
  const sparkRates = buildSparkRates();
  const relation = readBorrowedJson<{ relation_type: number; relation_point: number }[]>('relation.json');
  const relationMember = readBorrowedJson<{ id: number; relation_type: number; chara_id: number }[]>('relation_member.json');
  const affinity = buildAffinity({ relation, relationMember, dataVersion: DATA_VERSION });

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
      case 'umas':
        umas = applyOverrides<UmaRecord>(umas, override, 'umaId', override.fileName);
        break;
      default:
        throw new Error(`${override.fileName}: unknown _target "${override._target}"`);
    }
    console.log(`applied ${override.fileName} → ${override._target}`);
  }
  recomputeHintPoolSizes(cards); // hintPoolSize is derived; overrides may re-type sources
  // Timeline: built after cm_preset overrides are applied so patched presets flow in.
  // Read directly (not via loadOverrideFiles) — timeline_overrides.json is insert-capable.
  const timelineOverrides = (readJson<{ entries?: Array<Partial<TimelineEntry> & { id: string }> }>(join(OVERRIDES_DIR, 'timeline_overrides.json')).entries ?? []);
  // cm_tracks.json is generated out-of-band by `pnpm timeline:import`; read it if
  // present so synthesis can append predicted CMs (empty → no predictions).
  const cmTracksPath = join(PUBLIC_DATA_DIR, 'cm_tracks.json');
  const tracks = existsSync(cmTracksPath)
    ? readJson<{ tracks: CmTrack[] }>(cmTracksPath).tracks
    : [];
  const timeline = buildTimeline({ presets, overrides: timelineOverrides, tracks, dataVersion: DATA_VERSION });

  // Build-time oracle (provenance §4.1): emitted cards must agree with the
  // independent Tachyons-lab event-reward source — catches regressions of the
  // Phase-1 critical finding (dropped chain choices / date events / grants).
  assertTachyonsParity(cards, tachyons, releasedSkillIds);

  writeJsonDeterministic(join(PUBLIC_DATA_DIR, 'skills.json'), skills);
  writeJsonDeterministic(join(PUBLIC_DATA_DIR, 'support_cards.json'), cards);
  writeJsonDeterministic(join(PUBLIC_DATA_DIR, 'spark_rates.json'), sparkRates);
  writeJsonDeterministic(join(PUBLIC_DATA_DIR, 'cm_presets.json'), presets);
  writeJsonDeterministic(join(PUBLIC_DATA_DIR, 'umas.json'), umas);
  writeJsonDeterministic(join(PUBLIC_DATA_DIR, 'affinity.json'), affinity);
  writeJsonDeterministic(join(PUBLIC_DATA_DIR, 'timeline.json'), timeline);

  console.log(
    `public/data written: ${skills.length} skills, ${cards.length} support cards, ` +
      `${presets.length} cm presets, ${umas.length} umas, spark_rates (${sparkRates.dataVersion}), ` +
      `${affinity.groups.length} affinity groups, ${timeline.entries.length} timeline entries.`,
  );

  // Icons run LAST — they read the id lists from the JSON just written above.
  // Self-skips with a warning if the gitignored source dump is absent (CI):
  // the 5 outputs above must still build (provenance §2/§7).
  await buildIcons({ dataVersion: DATA_VERSION });
}

const isMain = (process.argv[1] ?? '').replace(/\\/g, '/').endsWith('scripts/build-all.ts');
if (isMain) {
  buildAll({ fromSpikes: process.argv.includes('--from-spikes') }).catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  });
}
