/**
 * M1.7 — career training-event DETAILS for the coverage matrix's Event popup.
 *
 * Reads the gitignored GameTora character snapshots (scripts/borrowed/gametora-chara/,
 * fetched by fetch-gametora-chara-events.ts — PATH B provenance, docs/provenance.md §10),
 * keeps every event that can grant a skill, picks the GLOBAL-period variant from the
 * event's JP history, renders rewards + win-conditions to display text (race names via
 * node:sqlite over the spikes master.mdb when available), merges
 * data-overrides/uma_event_details_overrides.json LAST (P5), and emits
 * public/data/uma_event_details.json.
 *
 * Usage: pnpm tsx scripts/build-uma-event-details.ts
 */
import { existsSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { OVERRIDES_DIR, PUBLIC_DATA_DIR, REPO_ROOT, SPIKES_UPSTREAM_DIR, readJson, writeJsonDeterministic } from './lib/io';
import { CACHE_DIR } from './fetch-gametora-chara-events';

// ---------------------------------------------------------------------------
// Types (GameTora eventData, en locale)
// ---------------------------------------------------------------------------

export interface GtReward { t?: string | null; v?: string | number | null; d?: unknown; r?: unknown }
export interface GtChoice { o?: string; r?: GtReward[] }
export interface GtEvent {
  i?: number; n?: string; c?: GtChoice[];
  conditions?: unknown[];
  history?: Array<{ period?: string; data?: GtEvent }>;
  did_not_exist?: string;
}

export interface EventDetailReward { label: string; skillId?: string }
export interface EventDetailChoice { option: string; rewards: EventDetailReward[] }
export interface UmaEventDetail {
  name: string;
  category: string;
  /** True when a JP history variant was used — JP-current rewards differ. */
  jpCurrentDiffers?: boolean;
  conditions?: string[];
  choices: EventDetailChoice[];
}
export type UmaEventDetailsJson = Record<string, UmaEventDetail[]>;

export interface UmaEventDetailsOverrides {
  addByUma?: Record<string, UmaEventDetail[]>;
  /** Event names to drop per uma (exact match). */
  removeByUma?: Record<string, string[]>;
}

// ---------------------------------------------------------------------------
// Global-period selection
// ---------------------------------------------------------------------------

/** Global's position on the JP content timeline, in JP-anniversary years.
 *  Global launched 2025-06-26; the foresight JP→Global gap is ~1441 d (~3.95 y),
 *  so Global today (2026-07) sits at JP-equivalent ~1.4 y — past JP's 1st anni,
 *  before its 2nd. Bump this as Global advances (or when an event's rewards
 *  visibly change in-game). Verified against Taiki Shuttle's "Beyond the Mile"
 *  (Global shows the pre_3rd_anni variant: SP +30, two skill hints). */
export const GLOBAL_JP_EQUIVALENT_YEARS = 1.4;

const PERIOD_RANK: Record<string, number> = {
  pre_half_anni: 0.5,
  pre_first_anni: 1,
  pre_1_5_anni: 1.5,
  pre_2nd_anni: 2,
  pre_2_5_anni: 2.5,
  pre_3rd_anni: 3,
  pre_3_5_anni: 3.5,
  pre_4th_anni: 4,
  pre_4_5_anni: 4.5,
  pre_5th_anni: 5,
};
const rankOf = (period: string | undefined): number =>
  period !== undefined ? PERIOD_RANK[period] ?? Number.POSITIVE_INFINITY : Number.POSITIVE_INFINITY;

/**
 * Pick the event variant that matches Global's point on the JP timeline.
 * - `did_not_exist: P` ⇒ the event was absent before anni rank(P); if Global
 *   hasn't reached that point, the event doesn't exist on Global → null.
 * - A `history` entry `{period: P}` holds the data valid BEFORE anni rank(P);
 *   the applicable variant is the entry with the smallest rank > T, else the
 *   current (top-level) data.
 */
export function pickGlobalVariant(
  event: GtEvent,
  t: number = GLOBAL_JP_EQUIVALENT_YEARS,
): { data: GtEvent; jpCurrentDiffers: boolean } | null {
  if (event.did_not_exist !== undefined && t < rankOf(event.did_not_exist)) return null;
  const applicable = (event.history ?? [])
    .filter((h) => h.data && rankOf(h.period) > t)
    .sort((a, b) => rankOf(a.period) - rankOf(b.period))[0];
  if (applicable?.data) return { data: applicable.data, jpCurrentDiffers: true };
  return { data: event, jpCurrentDiffers: false };
}

// ---------------------------------------------------------------------------
// Reward rendering
// ---------------------------------------------------------------------------

const STAT_LABEL: Record<string, string> = {
  sp: 'Speed', st: 'Stamina', po: 'Power', gu: 'Guts', in: 'Wit',
  pt: 'Skill points', en: 'Energy', mo: 'Mood', fa: 'Fans',
  '5s': 'All stats', bo: 'Bond', bo_ch: 'Bond', rs: 'Random stat(s)',
};
/** Codes that reference a skill id in `d`. sk = hint, sg = direct grant. */
const SKILL_CODES = new Set(['sk', 'sg', 'hp']);

export type SkillNameLookup = (skillId: string) => string | undefined;

export function renderReward(r: GtReward, skillName: SkillNameLookup): EventDetailReward[] {
  // Branch container: a reward whose `r` is a nested reward list.
  if (Array.isArray(r.r)) {
    return (r.r as GtReward[]).flatMap((sub) => renderReward(sub, skillName));
  }
  const t = r.t ?? '';
  const v = r.v !== null && r.v !== undefined ? String(r.v) : '';
  if (SKILL_CODES.has(t)) {
    const skillId = String(r.d ?? '');
    const name = skillName(skillId) ?? `skill ${skillId}`;
    const label =
      t === 'sg' ? `Obtain ${name}` :
      v ? `${name} hint ${v}` : `${name} hint`;
    return [{ label, skillId }];
  }
  const stat = STAT_LABEL[t];
  if (stat !== undefined) return [{ label: v ? `${stat} ${v}` : stat }];
  if (t === 'no') return [{ label: 'Nothing happens' }];
  if (t === 'ct' && typeof r.d === 'string') return [{ label: r.d }];
  if (t === '') return [];
  // Unknown code — surface it raw rather than guessing (P3).
  return [{ label: `(${t}${v ? ` ${v}` : ''})` }];
}

// ---------------------------------------------------------------------------
// Condition rendering
// ---------------------------------------------------------------------------

export type RaceNameLookup = (raceId: string) => string | undefined;

const YEAR_LABEL: Record<string, string> = { '1': 'Junior', '2': 'Classic', '3': 'Senior' };

/** "101801|2" | 101801 → "Mile Championship (Classic)" (name via lookup, else "#id"). */
export function raceRef(value: unknown, raceName: RaceNameLookup): string {
  const s = String(value);
  const [id = '', year] = s.split('|');
  const name = raceName(id) ?? `race #${id}`;
  const yearLabel = year !== undefined ? YEAR_LABEL[year] : undefined;
  return yearLabel !== undefined ? `${name} (${yearLabel})` : name;
}

export function renderCondition(cond: unknown, raceName: RaceNameLookup): string {
  if (!Array.isArray(cond) || cond.length === 0) return String(cond);
  const [type, ...args] = cond as [string, ...unknown[]];
  switch (type) {
    case 'win': return `Win the ${raceRef(args[0], raceName)}`;
    case 'win_or': return `Win the ${args.map((a) => raceRef(a, raceName)).join(' or the ')}`;
    case 'participate': return `Run in the ${raceRef(args[0], raceName)}`;
    case 'do_not_participate': return `Do not run in the ${raceRef(args[0], raceName)}`;
    case 'pick_and_win': return `Choose and win the ${raceRef(args[0], raceName)}`;
    case 'dont_pick_and_win': return `Win the ${raceRef(args[0], raceName)} without choosing it`;
    case 'win_on_streak': return `Win the ${raceRef(args[0], raceName)} while on a win streak`;
    case 'triple_crown': return 'Win the Triple Crown';
    case 'triple_tiara': return 'Win the Triple Tiara';
    case 'spring_triple_crown': return 'Win the Spring Triple Crown';
    case 'autumn_triple_crown_senior': return 'Win the Autumn Triple Crown (Senior)';
    case 'autumn_triple_crown_same_year': return 'Win the Autumn Triple Crown in one year';
    case 'win_g1': {
      const n = args[0];
      if (typeof n === 'number') return `Win ${n} G1 races`;
      return `Win G1 races (${JSON.stringify(n)})`;
    }
    case 'obj': return 'Clear a career objective';
    case 'ct': return String(args[0] ?? '');
    default:
      // Unmapped condition — raw but honest.
      return `${type}: ${args.map((a) => JSON.stringify(a)).join(', ')}`;
  }
}

// ---------------------------------------------------------------------------
// Event assembly
// ---------------------------------------------------------------------------

function hasSkillReward(data: GtEvent): boolean {
  return (data.c ?? []).some((ch) =>
    (ch?.r ?? []).some((r) => r && (SKILL_CODES.has(r.t ?? '') ||
      (Array.isArray(r.r) && (r.r as GtReward[]).some((sub) => SKILL_CODES.has(sub?.t ?? ''))))));
}

export function buildEventDetails(
  eventDataByCategory: Record<string, unknown>,
  skillName: SkillNameLookup,
  raceName: RaceNameLookup,
  t: number = GLOBAL_JP_EQUIVALENT_YEARS,
): UmaEventDetail[] {
  const out: UmaEventDetail[] = [];
  for (const [category, lst] of Object.entries(eventDataByCategory)) {
    if (!Array.isArray(lst)) continue;
    for (const raw of lst) {
      if (!raw || typeof raw !== 'object') continue;
      const picked = pickGlobalVariant(raw as GtEvent, t);
      if (!picked) continue; // not on Global yet
      const { data, jpCurrentDiffers } = picked;
      if (!hasSkillReward(data)) continue;
      const conditions = (data.conditions ?? (raw as GtEvent).conditions ?? [])
        .map((c) => renderCondition(c, raceName));
      out.push({
        name: data.n ?? (raw as GtEvent).n ?? '(unnamed event)',
        category,
        ...(jpCurrentDiffers ? { jpCurrentDiffers: true } : {}),
        ...(conditions.length > 0 ? { conditions } : {}),
        choices: (data.c ?? []).map((ch) => ({
          option: ch?.o ?? '',
          rewards: (ch?.r ?? []).flatMap((r) => renderReward(r, skillName)),
        })),
      });
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export function applyDetailOverrides(base: UmaEventDetailsJson, ov: UmaEventDetailsOverrides): UmaEventDetailsJson {
  const out: UmaEventDetailsJson = {};
  for (const [uma, evs] of Object.entries(base)) out[uma] = evs.slice();
  for (const [uma, add] of Object.entries(ov.addByUma ?? {})) out[uma] = [...(out[uma] ?? []), ...add];
  for (const [uma, names] of Object.entries(ov.removeByUma ?? {})) {
    const drop = new Set(names);
    if (out[uma]) out[uma] = out[uma].filter((e) => !drop.has(e.name));
  }
  return out;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

function loadRaceNames(): RaceNameLookup {
  // The spikes master.mdb lives in the MAIN checkout — when running inside a
  // .claude/worktrees/<x> worktree, fall back to the main repo root (3 up).
  const candidates = [
    join(SPIKES_UPSTREAM_DIR, 'db', 'master.mdb'),
    join(REPO_ROOT, '..', '..', '..', 'spikes', 'repos', 'umalator-global', 'db', 'master.mdb'),
  ];
  const mdb = candidates.find((p) => existsSync(p));
  if (!mdb) {
    console.warn('master.mdb not found — condition race names fall back to "race #id"');
    return () => undefined;
  }
  // Lazy require (via createRequire — this file is ESM) keeps node:sqlite out
  // of vitest's module graph when tests import the pure helpers above.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(mdb, { readOnly: true });
  // text_data category 28 = race names (verified: 101801 → "Mile Championship").
  const rows = db.prepare('select "index" as id, text from text_data where category = 28').all() as
    Array<{ id: number | bigint; text: string }>;
  db.close();
  const byId = new Map(rows.map((r) => [String(r.id), r.text]));
  return (raceId) => byId.get(raceId);
}

function main(): void {
  const skills = readJson<Array<{ skillId: string; nameEn: string }>>(join(PUBLIC_DATA_DIR, 'skills.json'));
  const skillNameById = new Map(skills.map((s) => [s.skillId, s.nameEn]));
  const skillName: SkillNameLookup = (id) => skillNameById.get(id);
  const raceName = loadRaceNames();

  const result: UmaEventDetailsJson = {};
  for (const file of readdirSync(CACHE_DIR)) {
    if (!file.endsWith('.json')) continue;
    const umaId = file.replace(/\.json$/, '');
    const page = readJson<{ pageProps?: { eventData?: { en?: string } } }>(join(CACHE_DIR, file));
    const raw = page.pageProps?.eventData?.en;
    if (!raw) continue;
    const eventData = JSON.parse(raw) as Record<string, unknown>;
    const details = buildEventDetails(eventData, skillName, raceName);
    if (details.length > 0) result[umaId] = details;
  }

  const ovPath = join(OVERRIDES_DIR, 'uma_event_details_overrides.json');
  const merged = applyDetailOverrides(
    result,
    existsSync(ovPath) ? readJson<UmaEventDetailsOverrides>(ovPath) : {},
  );

  const outPath = join(PUBLIC_DATA_DIR, 'uma_event_details.json');
  writeJsonDeterministic(outPath, merged);
  const umas = Object.keys(merged).length;
  const events = Object.values(merged).reduce((n, evs) => n + evs.length, 0);
  console.log(`uma_event_details.json: ${umas} umas, ${events} skill-granting events → ${outPath}`);
}

const entry = process.argv[1] ?? '';
if (entry.endsWith('build-uma-event-details.ts')) {
  main();
}
