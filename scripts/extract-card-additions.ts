/**
 * ONE-OFF, documented generator for data-overrides/card_additions.json
 * (docs/provenance.md §3.2): builds full SupportCardRecord entries for
 * Global-released support cards that the pinned upstream (umalator-global
 * c1fa2107, data tag 2026-06-05) does not carry yet — as of 2026-06-12 the
 * 2026-06-11 banner SSRs 30102/30103/30104.
 *
 * Inputs (all local, no network):
 * - spikes/repos/umalator-global/db/master.mdb        — live GLOBAL master.mdb
 *   (resource_version 10006400, fetched 2026-06-12, provenance §6b), queried
 *   via node:sqlite (Node 24 built-in): support_card_data + text_data
 *   (names/type) and single_mode_hint_gain (hint pools + hint_value_2).
 * - spikes/repos/umalator-global/db/extract/hint-effects.json — passive rows
 *   (types 17/18/19) for the perLevel matrices (mechanics-notes §9 level-cap rule).
 * - pinned upstream skills.json (released cutover, P4 filter) +
 *   support-cards.json (which ids are missing) +
 *   gametora/event-skill-sources.json (chain/random event skills — the
 *   GameTora catalog already carries these cards from their JP release).
 *
 * Usage:  pnpm exec tsx scripts/extract-card-additions.ts
 * Output: data-overrides/card_additions.json (committed; build merges it
 *         before overrides — see scripts/lib/card-additions.ts).
 * Re-run only when refreshing the spikes master.mdb; delete entries (or the
 * whole file's records) once the upstream pin catches up.
 */
import { join } from 'node:path';
// Node 24 built-in (emits an ExperimentalWarning — fine for a one-off script).
import { DatabaseSync } from 'node:sqlite';
import type { CardSkill, CardType, SupportCardRecord } from '@/core/types';
import { buildPerLevel, EFFECT_HINT_FREQUENCY, EFFECT_HINT_LEVELS, EFFECT_SPECIALTY_PRIORITY } from './lib/lerp';
import { OVERRIDES_DIR, readJson, REPO_ROOT, SPIKES_UPSTREAM_DIR, writeJsonDeterministic } from './lib/io';
import type { EventSkillSourcesJson, MasterCardsJson, MasterSkillsJson } from './lib/upstream-types';

/** Provenance §6b — the spikes master.mdb snapshot these records derive from. */
const MDB_RESOURCE_VERSION = '10006400';
const ADDITIONS_DATA_VERSION = `global-mdb-${MDB_RESOURCE_VERSION}`;

const MDB_PATH = join(SPIKES_UPSTREAM_DIR, 'db', 'master.mdb');
const HINT_EFFECTS_PATH = join(SPIKES_UPSTREAM_DIR, 'db', 'extract', 'hint-effects.json');

interface HintEffectRow {
  id: number;
  rarity: number;
  type: number;
  init: number;
  limit_lv5: number;
  limit_lv10: number;
  limit_lv15: number;
  limit_lv20: number;
  limit_lv25: number;
  limit_lv30: number;
  limit_lv35: number;
  limit_lv40: number;
  limit_lv45: number;
  limit_lv50: number;
}

const CARD_RARITY: Record<number, 'R' | 'SR' | 'SSR'> = { 1: 'R', 2: 'SR', 3: 'SSR' };

/**
 * Ported from upstream scripts/data-extract/extract-support-cards.ts
 * deriveSupportCardType (jalbarrang/umalator-global c1fa2107, retrieved
 * 2026-06-12): raw type 2/3 = friend/group; otherwise command_id picks the
 * training stat (101 speed, 105 stamina, 102 power, 103 guts, 106 wit).
 */
function deriveCardType(rawType: number, commandId: number): CardType {
  if (rawType === 2) return 'friend';
  if (rawType === 3) return 'group';
  const byCommand: Record<number, CardType> = { 101: 'speed', 105: 'stamina', 102: 'power', 103: 'guts', 106: 'wit' };
  const type = byCommand[commandId];
  if (type === undefined) throw new Error(`unknown command_id ${commandId} (raw type ${rawType})`);
  return type;
}

function main(): void {
  const masterCards = readJson<MasterCardsJson>(
    join(SPIKES_UPSTREAM_DIR, 'src', 'modules', 'data', 'json', 'support-cards.json'),
  );
  const releasedSkillIds = new Set(
    Object.keys(readJson<MasterSkillsJson>(join(SPIKES_UPSTREAM_DIR, 'src', 'modules', 'data', 'json', 'skills.json'))),
  );
  const eventSources = readJson<EventSkillSourcesJson>(
    join(SPIKES_UPSTREAM_DIR, 'src', 'modules', 'data', 'json', 'gametora', 'event-skill-sources.json'),
  );
  const hintEffects = readJson<HintEffectRow[]>(HINT_EFFECTS_PATH);

  const db = new DatabaseSync(MDB_PATH, { readOnly: true });
  try {
    const mdbCards = db
      .prepare(
        `SELECT sc.id,
                COALESCE(card_name.text, '')  AS name,
                COALESCE(chara_name.text, '') AS charaName,
                sc.rarity,
                sc.support_card_type          AS rawType,
                sc.command_id                 AS commandId
         FROM support_card_data sc
         LEFT JOIN text_data card_name  ON card_name.category  = 76 AND card_name."index"  = sc.id
         LEFT JOIN text_data chara_name ON chara_name.category = 77 AND chara_name."index" = sc.id
         ORDER BY sc.id`,
      )
      .all() as Array<{ id: number; name: string; charaName: string; rarity: number; rawType: number; commandId: number }>;

    // Target = cards in the live mdb that the pinned upstream extract lacks.
    const missing = mdbCards.filter((c) => masterCards[String(c.id)] === undefined);
    console.log(`mdb has ${mdbCards.length} cards; pinned upstream has ${Object.keys(masterCards).length}; ` +
      `generating ${missing.length} addition(s): ${missing.map((c) => c.id).join(', ')}`);

    const hintStmt = db.prepare(
      `SELECT DISTINCT hg.hint_value_1 AS skillId, hg.hint_value_2 AS hintLevels
       FROM single_mode_hint_gain hg
       JOIN support_card_data sc ON sc.id = hg.support_card_id AND sc.skill_set_id = hg.hint_id
       WHERE hg.hint_gain_type = 0 AND hg.support_card_id = ?
       ORDER BY hg.hint_value_1`,
    );

    const records: Array<SupportCardRecord & { _comment: string }> = [];
    for (const card of missing) {
      const rarity = CARD_RARITY[card.rarity];
      if (rarity === undefined) throw new Error(`card ${card.id}: unknown rarity ${card.rarity}`);

      // perLevel from the mdb extract rows (types 17/18/19), rebuilt into the
      // [effect_type, lv1, lv5, ..., lv50] matrix shape buildPerLevel expects.
      const effectRows = hintEffects
        .filter((r) => r.id === card.id && [EFFECT_HINT_LEVELS, EFFECT_HINT_FREQUENCY, EFFECT_SPECIALTY_PRIORITY].includes(r.type))
        .map((r) => [
          r.type,
          r.init,
          r.limit_lv5,
          r.limit_lv10,
          r.limit_lv15,
          r.limit_lv20,
          r.limit_lv25,
          r.limit_lv30,
          r.limit_lv35,
          r.limit_lv40,
          r.limit_lv45,
          r.limit_lv50,
        ]);

      const skills: CardSkill[] = [];
      const droppedIds: number[] = [];
      const hintRows = hintStmt.all(card.id) as Array<{ skillId: number; hintLevels: number }>;
      for (const row of hintRows) {
        if (!releasedSkillIds.has(String(row.skillId))) {
          droppedIds.push(row.skillId);
          continue;
        }
        skills.push({ skillId: String(row.skillId), sourceType: 'hint_pool', hintLevels: row.hintLevels });
      }
      // Event skills from the pinned GameTora eventData (these cards shipped
      // on JP long ago, so the 2026-06-05 catalog already carries them).
      // Same parser caveat as provenance §4.1: chain skill-CHOICES / date
      // events would be missing — acceptable for stat-type SSRs (no dates);
      // re-verify when the upstream pin catches up and these additions die.
      const sources = eventSources[String(card.id)];
      const chain = new Set(sources?.chain_event_skills ?? []);
      const eventIds = [...new Set([...chain, ...(sources?.random_event_skills ?? [])])].sort((a, b) => a - b);
      for (const id of eventIds) {
        if (!releasedSkillIds.has(String(id))) {
          droppedIds.push(id);
          continue;
        }
        skills.push({ skillId: String(id), sourceType: chain.has(id) ? 'chain' : 'random_event' });
      }

      records.push({
        _comment:
          `Generated ${new Date().toISOString().slice(0, 10)} by scripts/extract-card-additions.ts from ` +
          `GLOBAL master.mdb v${MDB_RESOURCE_VERSION} + pinned GameTora eventData (chain/random only — ` +
          `Tachyons-lab pin predates this card).` +
          (droppedIds.length > 0 ? ` Dropped non-released skill ids (P4): ${droppedIds.join(', ')}.` : ''),
        cardId: String(card.id),
        nameEn: card.name,
        charName: card.charaName,
        rarity,
        type: deriveCardType(card.rawType, card.commandId),
        perLevel: buildPerLevel(effectRows, rarity),
        skills,
        hintPoolSize: skills.filter((s) => s.sourceType === 'hint_pool').length,
        server: 'global',
        dataVersion: ADDITIONS_DATA_VERSION,
      });
    }

    const outPath = join(OVERRIDES_DIR, 'card_additions.json');
    writeJsonDeterministic(outPath, {
      _comment:
        'Full SupportCardRecord entries for Global cards missing from the pinned upstream ' +
        '(upstream-pin lag, docs/provenance.md §3.2). Generated by scripts/extract-card-additions.ts ' +
        `against master.mdb v${MDB_RESOURCE_VERSION}; schema-validated and inserted BEFORE overrides ` +
        'by scripts/build-all.ts. Delete entries when the upstream pin catches up (duplicate ids fail the build).',
      records,
    });
    console.log(`wrote ${records.length} record(s) → ${outPath.replace(REPO_ROOT, '').replace(/\\/g, '/')}`);
  } finally {
    db.close();
  }
}

const isMain = (process.argv[1] ?? '').replace(/\\/g, '/').endsWith('scripts/extract-card-additions.ts');
if (isMain) {
  try {
    main();
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  }
}
