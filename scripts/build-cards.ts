/**
 * public/data/support_cards.json — SupportCardRecord[] for the Global
 * support cards.
 *
 * Skill sources (provenance §4, §4.1):
 * - hint pool = master hintSkills (single_mode_hint_gain), with per-skill
 *   hint levels from Tachyons-lab hints_table (= hint_value_2);
 * - event skills = UNION of master flat eventSkills, GameTora chain/random
 *   (event-skill-sources.json) and Tachyons-lab all_events (chain_events →
 *   'chain', dates → 'date_event', random_events → 'random_event', including
 *   'sg' direct grants by category). Precedence when a skill appears in
 *   several categories: chain > date_event > random_event.
 * - Residual: skills only in the master flat list (Tachyons-lab classifies
 *   them under bond-line special_events) default to 'random_event' here and
 *   are re-typed to 'date_event' by data-overrides/card_source_overrides.json.
 *
 * After overrides, assertTachyonsParity() cross-checks the emitted records
 * against the Tachyons-lab source so this class of gap (Phase 1 review
 * critical finding: dropped chain choices / date events / grants) fails the
 * build instead of shipping silently.
 */
import type { CardSkill, CardType, SkillSourceType, SupportCardRecord } from '@/core/types';
import type { Calibration } from '@/core/foresight';
import { buildPerLevel } from './lib/lerp';
import { projectReleaseDate } from './lib/foresight-build';
import { extractTachyonsEventSkills, extractTachyonsHintLevels, indexTachyonsById } from './lib/tachyons';
import type { EventSkillSourcesJson, GtCard, MasterCardsJson, TachyonsDataJson } from './lib/upstream-types';

/** Verified against umalator support-card-loader.ts supportCardTypeMap (5 = "intelligence" = wit). */
const CARD_TYPE: Record<number, CardType> = {
  1: 'speed',
  2: 'stamina',
  3: 'power',
  4: 'guts',
  5: 'wit',
  6: 'friend',
  7: 'group',
};

const CARD_RARITY: Record<number, 'R' | 'SR' | 'SSR'> = { 1: 'R', 2: 'SR', 3: 'SSR' };

export function buildCards(inputs: {
  master: MasterCardsJson;
  gametoraCards: GtCard[];
  eventSources: EventSkillSourcesJson;
  tachyons: TachyonsDataJson;
  /** Keys of the master skills extract — the Global-released cutover. */
  releasedSkillIds: ReadonlySet<string>;
  dataVersion: string;
}): SupportCardRecord[] {
  const { master, gametoraCards, eventSources, tachyons, releasedSkillIds, dataVersion } = inputs;
  const gtById = new Map<number, GtCard>(gametoraCards.map((c) => [c.support_id, c]));
  const tachyonsById = indexTachyonsById(tachyons);

  // P4: GameTora eventData spans JP+Global; skills missing from the Global
  // master extract are not obtainable on Global and must not slip in.
  const dropped = new Set<string>();
  const isReleased = (id: number): boolean => {
    if (releasedSkillIds.has(String(id))) return true;
    dropped.add(String(id));
    return false;
  };

  const records: SupportCardRecord[] = [];
  for (const card of Object.values(master)) {
    const cardId = String(card.id);
    const rarity = CARD_RARITY[card.rarity];
    const type = CARD_TYPE[card.supportCardType];
    if (rarity === undefined || type === undefined) {
      throw new Error(`card ${cardId}: unknown rarity ${card.rarity} / type ${card.supportCardType}`);
    }
    const gt = gtById.get(card.id);
    if (!gt?.effects) {
      throw new Error(`card ${cardId}: no GameTora effects matrix — upstream data drifted?`);
    }

    const sources = eventSources[cardId];
    const tachyonsCard = tachyonsById.get(card.id);
    const tachyonsEvents = extractTachyonsEventSkills(tachyonsCard);
    const hintLevelsBySkill = extractTachyonsHintLevels(tachyonsCard);

    const chain = new Set<number>([...(sources?.chain_event_skills ?? []), ...tachyonsEvents.chain]);
    const date = tachyonsEvents.date;
    const random = new Set<number>([...(sources?.random_event_skills ?? []), ...tachyonsEvents.random]);

    const skills: CardSkill[] = [];
    for (const hint of [...card.hintSkills].sort((a, b) => a.id - b.id)) {
      if (!isReleased(hint.id)) continue;
      const entry: CardSkill = { skillId: String(hint.id), sourceType: 'hint_pool' };
      // hint_pool only (types.ts contract): hint levels granted per take,
      // from Tachyons-lab hints_table = master.mdb hint_value_2. The Tachyons
      // pin lags the umalator data pin, so cards newer than the Tachyons
      // snapshot (e.g. 20049/30102-30106 at v0.16.1) have no hints_table row —
      // fall back to 1, the verified Global invariant (every Global pool hint
      // grants exactly 1 level, 1282 rows / 2026-06-12, see outputs.test.ts).
      entry.hintLevels = hintLevelsBySkill.get(hint.id) ?? 1;
      skills.push(entry);
    }

    // Event skills = master flat list ∪ GameTora chain/random ∪ Tachyons-lab
    // chain/dates/random (incl. 'sg' direct grants). Precedence for skills in
    // several categories: chain > date_event > random_event (chain is the
    // most reliable source; e.g. Twin Turbo 30026 dual-lists 200532 as chain
    // AND random — counted as chain).
    const eventIds = new Set<number>([
      ...card.eventSkills.map((s) => s.id),
      ...chain,
      ...date,
      ...random,
    ]);
    for (const id of [...eventIds].sort((a, b) => a - b)) {
      if (!isReleased(id)) continue;
      // Master-flat-only skills (Tachyons-lab special_events bond-line hints)
      // fall through to 'random_event' — re-typed by card_source_overrides.
      const sourceType: SkillSourceType = chain.has(id)
        ? 'chain'
        : date.has(id)
          ? 'date_event'
          : 'random_event';
      skills.push({ skillId: String(id), sourceType });
    }

    records.push({
      cardId,
      nameEn: card.name,
      charName: card.charaName,
      rarity,
      type,
      perLevel: buildPerLevel(gt.effects, rarity),
      skills,
      hintPoolSize: skills.filter((s) => s.sourceType === 'hint_pool').length,
      server: 'global',
      dataVersion,
    });
  }

  if (dropped.size > 0) {
    console.warn(
      `build-cards: dropped ${dropped.size} JP-ahead skill id(s) not in the Global ` +
        `release cutover (P4): ${[...dropped].sort().join(', ')}`,
    );
  }

  records.sort((a, b) => Number(a.cardId) - Number(b.cardId));
  return records;
}

/** Recount after overrides may have re-typed sources (kept derived — types.ts). */
export function recomputeHintPoolSizes(cards: SupportCardRecord[]): void {
  for (const card of cards) {
    card.hintPoolSize = card.skills.filter((s) => s.sourceType === 'hint_pool').length;
  }
}

const GT_RARITY: Record<number, 'R' | 'SR' | 'SSR'> = { 1: 'R', 2: 'SR', 3: 'SSR' };
const GT_TYPE: Record<string, CardType> = {
  speed: 'speed', stamina: 'stamina', power: 'power', guts: 'guts',
  intelligence: 'wit', friend: 'friend', group: 'group',
};

/** JP-ahead cards: gametora rows absent from the Global master extract (server:'jp'). */
export function buildJpCards(inputs: {
  gametoraCards: GtCard[];
  masterIds: ReadonlySet<number>;
  eventSources: EventSkillSourcesJson;
  releasedSkillIds: ReadonlySet<string>;
  cal: Calibration | null;
  dataVersion: string;
}): SupportCardRecord[] {
  const { gametoraCards, masterIds, eventSources, releasedSkillIds, cal, dataVersion } = inputs;
  const records: SupportCardRecord[] = [];
  let skipped = 0;
  for (const gt of gametoraCards) {
    if (masterIds.has(gt.support_id)) continue; // Global card → handled by buildCards
    const rarity = GT_RARITY[gt.rarity];
    const type = GT_TYPE[gt.type];
    if (rarity === undefined || type === undefined || !gt.effects) { skipped++; continue; }

    const skills: CardSkill[] = [];
    for (const id of [...(gt.hints?.hint_skills ?? [])].sort((a, b) => a - b)) {
      if (releasedSkillIds.has(String(id))) skills.push({ skillId: String(id), sourceType: 'hint_pool', hintLevels: 1 });
    }
    const src = eventSources[String(gt.support_id)];
    const chain = new Set<number>(src?.chain_event_skills ?? []);
    const eventIds = new Set<number>([...chain, ...(src?.random_event_skills ?? []), ...(gt.event_skills ?? [])]);
    for (const id of [...eventIds].sort((a, b) => a - b)) {
      if (!releasedSkillIds.has(String(id))) continue;
      skills.push({ skillId: String(id), sourceType: chain.has(id) ? 'chain' : 'random_event' });
    }

    const { releaseDate, predicted } = projectReleaseDate(gt.release, gt.release_en, cal);
    const rec: SupportCardRecord = {
      cardId: String(gt.support_id),
      nameEn: gt.title_en ?? gt.title_ja ?? gt.char_name,
      charName: gt.char_name,
      rarity, type,
      perLevel: buildPerLevel(gt.effects, rarity),
      skills,
      hintPoolSize: skills.filter((s) => s.sourceType === 'hint_pool').length,
      server: 'jp',
      dataVersion,
    };
    if (releaseDate !== undefined) rec.releaseDate = releaseDate;
    if (predicted) rec.releaseDatePredicted = true;
    records.push(rec);
  }
  if (skipped > 0) console.warn(`build-cards: skipped ${skipped} JP card(s) missing effects/rarity/type`);
  records.sort((a, b) => Number(a.cardId) - Number(b.cardId));
  return records;
}

const EVENT_SOURCE_TYPES: ReadonlySet<SkillSourceType> = new Set(['chain', 'date_event', 'random_event']);

/**
 * Build-time oracle (run AFTER overrides, provenance §4.1): every Global-
 * released skill the Tachyons-lab dataset attributes to a card must appear on
 * the emitted record with a compatible sourceType, and the hint pool +
 * per-skill hint levels must match hints_table exactly. The Phase 1 review
 * proved the previous "no overrides needed" analysis was circular (both
 * diffed sides shared the GameTora parser blind spot) — this assertion checks
 * against an independent source so an upstream refresh that reopens the gap
 * fails `pnpm data:build` instead of shipping an under-reporting matrix.
 *
 * Throws with the full mismatch list. Cards absent from Tachyons-lab (e.g.
 * data-overrides/card_additions.json records newer than the Tachyons pin)
 * are skipped.
 */
export function assertTachyonsParity(
  cards: readonly SupportCardRecord[],
  tachyons: TachyonsDataJson,
  releasedSkillIds: ReadonlySet<string>,
): void {
  const cardsById = new Map(cards.map((c) => [c.cardId, c]));
  const problems: string[] = [];

  for (const tachyonsCard of indexTachyonsById(tachyons).values()) {
    const record = cardsById.get(String(tachyonsCard.id));
    if (record === undefined) {
      problems.push(`card ${tachyonsCard.id}: in Tachyons-lab but missing from emitted data`);
      continue;
    }
    if (record.server !== 'global') continue;
    // A skill can legitimately appear twice on a card — once in the hint pool
    // and once as an event source (e.g. a chain event granting a hint for a
    // pool skill) — so group entries by skillId rather than assuming one each.
    const bySkillId = new Map<string, CardSkill[]>();
    for (const entry of record.skills) {
      const list = bySkillId.get(entry.skillId) ?? [];
      list.push(entry);
      bySkillId.set(entry.skillId, list);
    }

    // Hint pool: exact set + hint-level parity.
    const tachyonsHints = extractTachyonsHintLevels(tachyonsCard);
    const recordPool = record.skills.filter((s) => s.sourceType === 'hint_pool');
    for (const [skillId, hintLevels] of tachyonsHints) {
      if (!releasedSkillIds.has(String(skillId))) continue;
      const entry = (bySkillId.get(String(skillId)) ?? []).find((s) => s.sourceType === 'hint_pool');
      if (entry === undefined) {
        problems.push(`card ${record.cardId}: hint-pool skill ${skillId} missing or not hint_pool`);
      } else if (entry.hintLevels !== hintLevels) {
        problems.push(
          `card ${record.cardId}: skill ${skillId} hintLevels ${entry.hintLevels} != Tachyons ${hintLevels}`,
        );
      }
    }
    for (const entry of recordPool) {
      if (!tachyonsHints.has(Number(entry.skillId))) {
        problems.push(`card ${record.cardId}: hint-pool skill ${entry.skillId} not in Tachyons hints_table`);
      }
    }

    // Event skills: membership for all four categories; chain must stay chain,
    // dates must not degrade below date_event. special_events membership is
    // satisfied via the master flat list + card_source_overrides re-typing.
    const events = extractTachyonsEventSkills(tachyonsCard);
    const expectType = (ids: Set<number>, allowed: readonly SkillSourceType[], label: string): void => {
      for (const id of ids) {
        if (!releasedSkillIds.has(String(id))) continue;
        const entry = (bySkillId.get(String(id)) ?? []).find((s) => EVENT_SOURCE_TYPES.has(s.sourceType));
        if (entry === undefined) {
          problems.push(`card ${record.cardId}: ${label} skill ${id} missing from emitted event skills`);
        } else if (!allowed.includes(entry.sourceType)) {
          problems.push(
            `card ${record.cardId}: ${label} skill ${id} emitted as ${entry.sourceType}, expected ${allowed.join('/')}`,
          );
        }
      }
    };
    expectType(events.chain, ['chain'], 'chain-event');
    expectType(events.date, ['chain', 'date_event'], 'date-event');
    expectType(events.random, ['chain', 'date_event', 'random_event'], 'random-event');
    expectType(events.special, ['chain', 'date_event', 'random_event'], 'special-event');
  }

  if (problems.length > 0) {
    throw new Error(
      `Tachyons-lab parity check failed (${problems.length} problem(s)) — emitted support cards ` +
        `disagree with the independent event-reward source:\n  ${problems.join('\n  ')}`,
    );
  }
}
