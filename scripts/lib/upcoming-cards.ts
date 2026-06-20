/**
 * data-overrides/upcoming_cards.json — full SupportCardRecord entries for
 * UPCOMING (server:'jp') support cards not yet released on Global, so a
 * card-source view can include them (gated by the CM date via isReleasedBy)
 * when the user opts in. Each entry MUST carry server:'jp' + a releaseDate.
 * Mirrors card-additions.ts (INSERT whole records, not patch) but for preview
 * cards. Skills are validated by FORMAT only (not the Global cutover) — an
 * upcoming card may grant upcoming skills curated in skill_additions.json.
 * P3 (no fabrication) / P4 (server-tagged preview) / P5 (hand-maintained).
 */
import { existsSync } from 'node:fs';
import type { CardSkill, SupportCardRecord } from '@/core/types';
import { readJson } from './io';

export interface UpcomingCardsFile {
  _comment?: string;
  records: SupportCardRecord[];
}

const CARD_RARITIES = new Set(['R', 'SR', 'SSR']);
const CARD_TYPES = new Set(['speed', 'stamina', 'power', 'guts', 'wit', 'friend', 'group']);
const SOURCE_TYPES = new Set(['chain', 'hint_pool', 'random_event', 'date_event']);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Deep-copy with documentation keys ('_'-prefixed) stripped (same convention as card-additions). */
function stripMeta<T>(value: T): T {
  if (Array.isArray(value)) return value.map(stripMeta) as T;
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) if (!k.startsWith('_')) out[k] = stripMeta(v);
    return out as T;
  }
  return value;
}

function validate(record: SupportCardRecord, problems: string[]): void {
  const where = `upcoming_cards record "${record.cardId}"`;
  const fail = (msg: string): void => {
    problems.push(`${where}: ${msg}`);
  };

  if (typeof record.cardId !== 'string' || !/^\d+$/.test(record.cardId)) fail('cardId must be a numeric string');
  if (typeof record.nameEn !== 'string' || record.nameEn.length === 0) fail('nameEn missing');
  if (typeof record.charName !== 'string' || record.charName.length === 0) fail('charName missing');
  if (!CARD_RARITIES.has(record.rarity)) fail(`bad rarity "${record.rarity}"`);
  if (!CARD_TYPES.has(record.type)) fail(`bad type "${record.type}"`);
  if (record.server !== 'jp') fail(`server must be "jp" (upcoming preview — released cards go in card_additions, P4)`);
  if (typeof record.releaseDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(record.releaseDate)) {
    fail('releaseDate (ISO yyyy-mm-dd) is required for upcoming cards');
  }
  if (typeof record.dataVersion !== 'string' || record.dataVersion.length === 0) fail('dataVersion missing');

  if (!Array.isArray(record.perLevel) || record.perLevel.length !== 5) {
    fail('perLevel must have exactly 5 entries (LB 0-4)');
  } else {
    record.perLevel.forEach((p, i) => {
      if (p.limitBreak !== i) fail(`perLevel[${i}].limitBreak must be ${i}`);
      for (const key of ['hintFrequency', 'hintLevels', 'specialtyPriority'] as const) {
        if (typeof p[key] !== 'number' || p[key] < 0) fail(`perLevel[${i}].${key} must be a number >= 0`);
      }
    });
  }

  if (!Array.isArray(record.skills)) {
    fail('skills must be an array');
    return;
  }
  for (const skill of record.skills as CardSkill[]) {
    if (!SOURCE_TYPES.has(skill.sourceType)) fail(`skill ${skill.skillId}: bad sourceType "${skill.sourceType}"`);
    // Format only — an upcoming card may grant upcoming (non-cutover) skills.
    if (typeof skill.skillId !== 'string' || !/^\d+$/.test(skill.skillId)) fail(`skill ${skill.skillId}: skillId must be a numeric string`);
    if (skill.hintLevels !== undefined) {
      if (skill.sourceType !== 'hint_pool') fail(`skill ${skill.skillId}: hintLevels is hint_pool-only`);
      if (typeof skill.hintLevels !== 'number' || skill.hintLevels < 1) {
        fail(`skill ${skill.skillId}: hintLevels must be a number >= 1`);
      }
    }
  }
  const poolCount = record.skills.filter((s) => s.sourceType === 'hint_pool').length;
  if (record.hintPoolSize !== poolCount) {
    fail(`hintPoolSize ${record.hintPoolSize} != hint_pool entry count ${poolCount}`);
  }
}

/**
 * Load, strip `_`-doc keys, and schema-validate the upcoming-cards file.
 * Returns [] when the file does not exist (the mechanism is optional).
 * Throws (aggregated) on any schema violation, duplicate id within the file,
 * or collision with an id the generator already emitted (it released → move
 * the entry to card_additions or delete it).
 */
export function loadUpcomingCards(
  path: string,
  opts: { existingCardIds: ReadonlySet<string> },
): SupportCardRecord[] {
  if (!existsSync(path)) return [];
  const parsed = readJson<UpcomingCardsFile>(path);
  if (!Array.isArray(parsed.records)) {
    throw new Error('upcoming_cards.json: "records" must be an array of full SupportCardRecord entries');
  }
  const problems: string[] = [];
  const seen = new Set<string>();
  const records = parsed.records.map((raw) => stripMeta(raw));
  for (const record of records) {
    validate(record, problems);
    if (seen.has(record.cardId)) problems.push(`upcoming_cards record "${record.cardId}": duplicate id in file`);
    seen.add(record.cardId);
    if (opts.existingCardIds.has(record.cardId)) {
      problems.push(
        `upcoming_cards record "${record.cardId}": already emitted as a Global card — ` +
          'it released; move it to card_additions.json or delete this entry.',
      );
    }
  }
  if (problems.length > 0) throw new Error(`upcoming_cards.json failed validation:\n  ${problems.join('\n  ')}`);
  return records;
}
