/**
 * Convenience storage API used by the UI. Thin wrappers over the Dexie
 * singleton — no game logic here (P6: mechanics live in src/core).
 */
import type { CmPlan, OwnedCard } from '@/core/types';
import { db } from './db';

// --- Owned cards -----------------------------------------------------------

export function listOwnedCards(): Promise<OwnedCard[]> {
  return db.ownedCards.toArray();
}

export function addOwnedCard(card: Omit<OwnedCard, 'id'>): Promise<number> {
  return db.ownedCards.add(card);
}

/** Resolves with the number of rows updated (0 when `id` does not exist). */
export function updateOwnedCard(
  id: number,
  patch: Partial<Omit<OwnedCard, 'id'>>,
): Promise<number> {
  return db.ownedCards.update(id, patch);
}

export function removeOwnedCard(id: number): Promise<void> {
  return db.ownedCards.delete(id);
}

// --- CM plans ---------------------------------------------------------------

/** Sorted by month (indexed) so the UI lists upcoming CMs in order. */
export function listPlans(): Promise<CmPlan[]> {
  return db.cmPlans.orderBy('month').toArray();
}

export function getPlan(id: string): Promise<CmPlan | undefined> {
  return db.cmPlans.get(id);
}

/** Upsert by `plan.id`. */
export async function savePlan(plan: CmPlan): Promise<void> {
  await db.cmPlans.put(plan);
}

export function deletePlan(id: string): Promise<void> {
  return db.cmPlans.delete(id);
}

// --- Settings ---------------------------------------------------------------

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const row = await db.settings.get(key);
  return row === undefined ? undefined : (row.value as T);
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value });
}
