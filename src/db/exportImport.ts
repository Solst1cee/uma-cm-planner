/**
 * Single-blob JSON export/import for backup and device transfer (plan §4, P2).
 *
 * Import modes:
 * - 'replace' restores the snapshot exactly (clears every table first;
 *   auto-increment ids preserved).
 * - 'merge' NEVER deletes: existing rows absent from the blob are kept.
 *   String-keyed tables (parents, cmPlans, settings) upsert by primary key —
 *   stable across devices. Auto-increment ids (ownedCards, matchLogs) are
 *   device-local counters, so exported ids are STRIPPED on merge: ownedCards
 *   are deduped by cardId (higher limitBreak wins), matchLogs are appended as
 *   new rows (re-importing the same blob twice duplicates logs).
 *
 * Validation is hand-rolled (no schema dep): required fields and discriminants
 * are checked strictly; optional fields get top-level type checks. Errors name
 * the offending path so the UI can show actionable messages.
 *
 * JSON caveat: `undefined` tuple slots serialize as `null`
 * (e.g. Parent.grandparents), so the parser accepts
 * `null` there and normalizes it back to `undefined`.
 */
import type { CmPlan, LimitBreak, OwnedCard, Parent, ParentRef } from '@/core/types';
import { db } from './db';
import type { MatchLog, SettingRecord, StoredCapture } from './types';
import { listCaptures } from '@/db/capturesApi';

export interface ExportBlobV2 {
  version: 2;
  /** ISO timestamp of the export. */
  exportedAt: string;
  ownedCards: OwnedCard[];
  parents: Parent[];
  cmPlans: CmPlan[];
  matchLogs: MatchLog[];
  settings: SettingRecord[];
  captures: StoredCapture[];
}

/** @deprecated Use ExportBlobV2. v1 blobs have the old CmPlan shape (month/race/targetSkills). */
export type ExportBlobV1 = ExportBlobV2;

export type ImportMode = 'replace' | 'merge';

export interface ImportResult {
  /**
   * Rows written per table. In merge mode, `ownedCards` counts actual writes
   * (new cards + limit-break upgrades) — blob copies that lose the
   * higher-limitBreak dedupe write nothing and are not counted.
   */
  imported: Record<string, number>;
}

export async function exportBlob(): Promise<ExportBlobV2> {
  // Single read transaction so the snapshot is consistent across tables.
  const [ownedCards, parents, cmPlans, matchLogs, settings, captures] = await db.transaction(
    'r',
    [db.ownedCards, db.parents, db.cmPlans, db.matchLogs, db.settings, db.captures],
    () =>
      Promise.all([
        db.ownedCards.toArray(),
        db.parents.toArray(),
        db.cmPlans.toArray(),
        db.matchLogs.toArray(),
        db.settings.toArray(),
        listCaptures(),
      ]),
  );
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    ownedCards,
    parents,
    cmPlans,
    matchLogs,
    settings,
    captures,
  };
}

/** Drop a device-local auto-increment id so the target db assigns a fresh one. */
function stripId<T extends { id?: number }>(row: T): T {
  if (row.id === undefined) return row;
  const copy = { ...row };
  delete copy.id;
  return copy;
}

/**
 * Merge-mode ownedCards reconciliation. Exported ids are per-device
 * auto-increment counters (both devices count 1..n), so upserting by exported
 * id would overwrite unrelated local rows — instead, dedupe by the natural
 * key cardId, keeping the higher limitBreak (within the blob AND against the
 * existing inventory). Never deletes. Returns rows written.
 */
async function mergeOwnedCards(incoming: OwnedCard[]): Promise<number> {
  const bestIncoming = new Map<string, LimitBreak>();
  for (const row of incoming) {
    const prev = bestIncoming.get(row.cardId);
    if (prev === undefined || row.limitBreak > prev) bestIncoming.set(row.cardId, row.limitBreak);
  }
  const existingByCardId = new Map((await db.ownedCards.toArray()).map((r) => [r.cardId, r]));
  let written = 0;
  for (const [cardId, limitBreak] of bestIncoming) {
    const existing = existingByCardId.get(cardId);
    if (existing === undefined) {
      await db.ownedCards.add({ cardId, limitBreak }); // fresh local id
      written += 1;
    } else if (existing.id !== undefined && limitBreak > existing.limitBreak) {
      await db.ownedCards.update(existing.id, { limitBreak }); // upgrade in place
      written += 1;
    }
    // else: local copy already at >= limitBreak — keep it, write nothing.
  }
  return written;
}

export async function importBlob(data: unknown, mode: ImportMode): Promise<ImportResult> {
  const blob = parseExportBlobV2(data);
  let ownedCardsWritten = blob.ownedCards.length;
  await db.transaction(
    'rw',
    [db.ownedCards, db.parents, db.cmPlans, db.matchLogs, db.settings, db.captures],
    async () => {
      if (mode === 'replace') {
        await Promise.all([
          db.ownedCards.clear(),
          db.parents.clear(),
          db.cmPlans.clear(),
          db.matchLogs.clear(),
          db.settings.clear(),
          db.captures.clear(),
        ]);
        // Exact snapshot restore: auto-increment tables keep exported ids.
        await Promise.all([
          db.ownedCards.bulkPut(blob.ownedCards),
          db.matchLogs.bulkPut(blob.matchLogs),
        ]);
      } else {
        // Merge never deletes. Auto-increment ids are device-local: strip
        // them so cross-device merges union instead of clobbering by id.
        ownedCardsWritten = await mergeOwnedCards(blob.ownedCards);
        await db.matchLogs.bulkAdd(blob.matchLogs.map(stripId));
      }
      // String-keyed tables: primary keys are stable across devices — upsert.
      await Promise.all([
        db.parents.bulkPut(blob.parents),
        db.cmPlans.bulkPut(blob.cmPlans),
        db.settings.bulkPut(blob.settings),
        db.captures.bulkPut(blob.captures),
      ]);
    },
  );
  return {
    imported: {
      ownedCards: ownedCardsWritten,
      parents: blob.parents.length,
      cmPlans: blob.cmPlans.length,
      matchLogs: blob.matchLogs.length,
      settings: blob.settings.length,
      captures: blob.captures.length,
    },
  };
}

// ---------------------------------------------------------------------------
// Structural validation (hand-rolled guards)
// ---------------------------------------------------------------------------

type Rec = Record<string, unknown>;

function typeName(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'an array';
  return `a ${typeof v}`;
}

function fail(path: string, expected: string, got: unknown): never {
  throw new Error(`Malformed export blob: ${path} must be ${expected}, got ${typeName(got)}`);
}

function isRecord(v: unknown): v is Rec {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function asRecord(v: unknown, path: string): Rec {
  if (!isRecord(v)) fail(path, 'an object', v);
  return v;
}

function asArray(v: unknown, path: string): unknown[] {
  if (!Array.isArray(v)) fail(path, 'an array', v);
  return v;
}

function reqString(row: Rec, key: string, path: string): string {
  const v = row[key];
  if (typeof v !== 'string') fail(`${path}.${key}`, 'a string', v);
  return v;
}

function optString(row: Rec, key: string, path: string): void {
  const v = row[key];
  if (v !== undefined && typeof v !== 'string') fail(`${path}.${key}`, 'a string or absent', v);
}

function reqNumber(row: Rec, key: string, path: string): number {
  const v = row[key];
  if (typeof v !== 'number' || !Number.isFinite(v)) fail(`${path}.${key}`, 'a finite number', v);
  return v;
}

function optNumber(row: Rec, key: string, path: string): void {
  const v = row[key];
  if (v !== undefined && typeof v !== 'number') fail(`${path}.${key}`, 'a number or absent', v);
}

/** Optional auto-increment id (present when re-importing an export). */
function optId(row: Rec, path: string): void {
  const v = row['id'];
  if (v !== undefined && (typeof v !== 'number' || !Number.isInteger(v))) {
    fail(`${path}.id`, 'an integer or absent', v);
  }
}

function reqStars(row: Rec, path: string): 1 | 2 | 3 {
  const v = row['stars'];
  if (v !== 1 && v !== 2 && v !== 3) fail(`${path}.stars`, '1 | 2 | 3', v);
  return v;
}

function reqOneOf<T extends string>(row: Rec, key: string, values: readonly T[], path: string): T {
  const v = row[key];
  if (typeof v !== 'string' || !(values as readonly string[]).includes(v)) {
    fail(`${path}.${key}`, `one of ${values.map((x) => `'${x}'`).join(' | ')}`, v);
  }
  return v as T;
}

const STATS = ['spd', 'sta', 'pow', 'gut', 'wit'] as const;

function parseOwnedCard(v: unknown, path: string): OwnedCard {
  const row = asRecord(v, path);
  optId(row, path);
  reqString(row, 'cardId', path);
  const lb = reqNumber(row, 'limitBreak', path);
  if (!Number.isInteger(lb) || lb < 0 || lb > 4) fail(`${path}.limitBreak`, 'an integer 0–4', lb);
  return row as unknown as OwnedCard;
}

function parseSkillSpark(v: unknown, path: string): { skillId: string; stars: 1 | 2 | 3 } {
  const row = asRecord(v, path);
  return { skillId: reqString(row, 'skillId', path), stars: reqStars(row, path) };
}

function parseParent(v: unknown, path: string): Parent {
  const row = asRecord(v, path);
  reqString(row, 'id', path);
  reqString(row, 'umaId', path);

  const blue = asRecord(row['blueSpark'], `${path}.blueSpark`);
  reqOneOf(blue, 'stat', STATS, `${path}.blueSpark`);
  reqStars(blue, `${path}.blueSpark`);

  const pink = asRecord(row['pinkSpark'], `${path}.pinkSpark`);
  reqString(pink, 'aptitude', `${path}.pinkSpark`);
  reqStars(pink, `${path}.pinkSpark`);

  if (row['greenSpark'] !== undefined) {
    parseSkillSpark(row['greenSpark'], `${path}.greenSpark`);
  }

  asArray(row['whiteSparks'], `${path}.whiteSparks`).forEach((s, i) =>
    parseSkillSpark(s, `${path}.whiteSparks[${i}]`),
  );

  reqOneOf(row, 'source', ['mine', 'friend_rental'] as const, path);
  optString(row, 'notes', path);
  optString(row, 'rating', path);
  optNumber(row, 'affinityHint', path);

  if (row['grandparents'] !== undefined) {
    const gps = asArray(row['grandparents'], `${path}.grandparents`);
    if (gps.length > 2) fail(`${path}.grandparents`, 'an array of at most 2 entries', gps);
    // JSON turns undefined tuple slots into null — normalize back.
    row['grandparents'] = gps.map((gp, i) => {
      if (gp === null || gp === undefined) return undefined;
      const ref = asRecord(gp, `${path}.grandparents[${i}]`);
      reqString(ref, 'umaId', `${path}.grandparents[${i}]`);
      return ref as unknown as ParentRef;
    });
  }

  return row as unknown as Parent;
}

function parseCmPlan(v: unknown, path: string): CmPlan {
  const row = asRecord(v, path);
  reqString(row, 'id', path);
  reqString(row, 'name', path);
  optString(row, 'notes', path);
  reqNumber(row, 'planNumber', path);
  optString(row, 'remark', path);

  const cmRef = asRecord(row['cmRef'], `${path}.cmRef`);
  reqString(cmRef, 'cmId', `${path}.cmRef`);
  reqNumber(cmRef, 'cmNumber', `${path}.cmRef`);
  reqString(cmRef, 'courseId', `${path}.cmRef`);
  reqOneOf(cmRef, 'surface', ['turf', 'dirt'] as const, `${path}.cmRef`);
  reqNumber(cmRef, 'distance', `${path}.cmRef`);
  optString(cmRef, 'condition', `${path}.cmRef`);
  optString(cmRef, 'weather', `${path}.cmRef`);
  optString(cmRef, 'season', `${path}.cmRef`);

  optNumber(row, 'scenarioId', path);
  reqString(row, 'umaId', path);
  reqString(row, 'uniqueSkillId', path);
  reqOneOf(row, 'role', ['ace', 'debuffer', 'hybrid'] as const, path);
  reqOneOf(row, 'strategy', ['front', 'pace', 'late', 'end'] as const, path);

  const statProfile = asRecord(row['statProfile'], `${path}.statProfile`);
  asRecord(statProfile['stats'], `${path}.statProfile.stats`);
  const mood = statProfile['mood'];
  if (mood !== -2 && mood !== -1 && mood !== 0 && mood !== 1 && mood !== 2) {
    fail(`${path}.statProfile.mood`, '-2 | -1 | 0 | 1 | 2', mood);
  }

  const sparkGoals = asRecord(row['sparkGoals'], `${path}.sparkGoals`);
  asArray(sparkGoals['pink'], `${path}.sparkGoals.pink`);
  asRecord(sparkGoals['blue'], `${path}.sparkGoals.blue`);

  // Variable length 1–7+ by contract; priority drives weighting, not count.
  asArray(row['wishlist'], `${path}.wishlist`).forEach((t, i) => {
    const ts = asRecord(t, `${path}.wishlist[${i}]`);
    reqString(ts, 'skillId', `${path}.wishlist[${i}]`);
    const p = ts['priority'];
    if (p !== 1 && p !== 2 && p !== 3) fail(`${path}.wishlist[${i}].priority`, '1 | 2 | 3', p);
    reqOneOf(ts, 'source', ['targeted'] as const, `${path}.wishlist[${i}]`);
  });

  asArray(row['lockedDeckSlots'], `${path}.lockedDeckSlots`).forEach((s, i) => {
    const slot = asRecord(s, `${path}.lockedDeckSlots[${i}]`);
    const n = reqNumber(slot, 'slot', `${path}.lockedDeckSlots[${i}]`);
    if (!Number.isInteger(n) || n < 0 || n > 5) {
      fail(`${path}.lockedDeckSlots[${i}].slot`, 'an integer 0–5', n);
    }
    optString(slot, 'cardId', `${path}.lockedDeckSlots[${i}]`);
  });

  const parents = asRecord(row['parents'], `${path}.parents`);
  optString(parents, 'a', `${path}.parents`);
  optString(parents, 'b', `${path}.parents`);

  const patch = asRecord(row['patch'], `${path}.patch`);
  reqString(patch, 'version', `${path}.patch`);
  reqOneOf(row, 'server', ['global', 'jp'] as const, path);
  reqString(row, 'dataVersion', path);

  return row as unknown as CmPlan;
}

function parseMatchLog(v: unknown, path: string): MatchLog {
  const row = asRecord(v, path);
  optId(row, path);
  reqString(row, 'cmPlanId', path);
  reqString(row, 'date', path);
  optString(row, 'notes', path);
  return row as unknown as MatchLog;
}

function parseSetting(v: unknown, path: string): SettingRecord {
  const row = asRecord(v, path);
  reqString(row, 'key', path);
  // `value` may be absent: JSON.stringify drops undefined properties.
  return { key: row['key'] as string, value: row['value'] };
}

/**
 * Validate an unknown value as an ExportBlobV2, normalizing JSON artifacts.
 * Throws a descriptive Error on bad input.
 */
export function parseExportBlobV2(data: unknown): ExportBlobV2 {
  const root = asRecord(data, 'blob');
  if (root['version'] !== 2) {
    throw new Error(
      `Malformed export blob: unsupported version ${JSON.stringify(root['version'])} (expected 2)`,
    );
  }
  reqString(root, 'exportedAt', 'blob');
  return {
    version: 2,
    exportedAt: root['exportedAt'] as string,
    ownedCards: asArray(root['ownedCards'], 'blob.ownedCards').map((r, i) =>
      parseOwnedCard(r, `blob.ownedCards[${i}]`),
    ),
    parents: asArray(root['parents'], 'blob.parents').map((r, i) =>
      parseParent(r, `blob.parents[${i}]`),
    ),
    cmPlans: asArray(root['cmPlans'], 'blob.cmPlans').map((r, i) =>
      parseCmPlan(r, `blob.cmPlans[${i}]`),
    ),
    matchLogs: asArray(root['matchLogs'], 'blob.matchLogs').map((r, i) =>
      parseMatchLog(r, `blob.matchLogs[${i}]`),
    ),
    settings: asArray(root['settings'], 'blob.settings').map((r, i) =>
      parseSetting(r, `blob.settings[${i}]`),
    ),
    captures: asArray(root['captures'] ?? [], 'blob.captures') as StoredCapture[],
  };
}

/** @deprecated Use parseExportBlobV2. */
export const parseExportBlobV1 = parseExportBlobV2;
