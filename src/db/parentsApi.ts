/**
 * Parent (trained veteran / rental legacy) storage API — Phase 2, plan §6
 * step 4. Thin wrappers over the Dexie singleton, mirroring ./api.ts
 * conventions: no game logic here (P6 — mechanics live in src/core).
 */
import type { Parent } from '@/core/types';
import { db } from './db';

/** A Parent being created — `saveParent` assigns the id when absent. */
export type ParentDraft = Omit<Parent, 'id'> & { id?: string };

export function listParents(): Promise<Parent[]> {
  return db.parents.toArray();
}

export function getParent(id: string): Promise<Parent | undefined> {
  return db.parents.get(id);
}

/**
 * Upsert by `parent.id`; generates a `crypto.randomUUID()` id when absent
 * (or empty). Resolves with the record as stored.
 */
export async function saveParent(parent: ParentDraft): Promise<Parent> {
  const record: Parent = { ...parent, id: parent.id || crypto.randomUUID() };
  await db.parents.put(record);
  return record;
}

export function deleteParent(id: string): Promise<void> {
  return db.parents.delete(id);
}

/** Upsert many parents by id in one transaction (UmaExtractor import). Returns the count written. */
export async function bulkUpsertParents(parents: Parent[]): Promise<number> {
  if (parents.length === 0) return 0;
  await db.parents.bulkPut(parents);
  return parents.length;
}
