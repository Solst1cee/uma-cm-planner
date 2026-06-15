/**
 * Dexie database, schema version 1 (plan §4 "Storage schema (Dexie)").
 *
 * Deviation from the plan snippet, by design: `parents` and `cmPlans` use
 * string-uuid primary keys ('id', not '++id') because Parent.id / CmPlan.id
 * are strings in the frozen contract (@/core/types).
 */
import Dexie, { type Table } from 'dexie';
import type { CmPlan, OwnedCard, Parent } from '@/core/types';
import type { MatchLog, SettingRecord, StoredCapture } from './types';

export const DB_NAME = 'uma-cm-planner';

export class UmaCmPlannerDb extends Dexie {
  // `declare` (not `!:`) — with useDefineForClassFields, an emitted field
  // definition would clobber the table props Dexie assigns in the constructor.
  declare ownedCards: Table<OwnedCard, number>;
  declare parents: Table<Parent, string>;
  declare cmPlans: Table<CmPlan, string>;
  declare matchLogs: Table<MatchLog, number>;
  declare settings: Table<SettingRecord, string>;
  declare captures: Table<StoredCapture, string>;

  constructor(name: string = DB_NAME) {
    super(name);
    this.version(1).stores({
      ownedCards: '++id, cardId',
      parents: 'id, umaId',
      cmPlans: 'id, name, month',
      matchLogs: '++id, cmPlanId, date',
      settings: 'key',
    });
    // v2: drop the `month` index from cmPlans (month field removed from CmPlan).
    this.version(2).stores({
      ownedCards: '++id, cardId',
      parents: 'id, umaId',
      cmPlans: 'id, name',
      matchLogs: '++id, cmPlanId, date',
      settings: 'key',
    });
    // v3: M2 captures store (CaptureBundle persistence).
    this.version(3).stores({
      captures: 'id, label',
    });
  }
}

/** App-wide singleton. Tests reset it via `await db.delete(); await db.open();`. */
export const db = new UmaCmPlannerDb();
