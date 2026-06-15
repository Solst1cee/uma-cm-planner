import 'fake-indexeddb/auto'; // must precede any dexie import
import { beforeEach, describe, expect, it } from 'vitest';
import type { CmPlan } from '@/core/types';
import { FIXTURE_PLAN } from '@/core/fixtures';
import {
  addOwnedCard,
  db,
  deletePlan,
  getPlan,
  getSetting,
  listOwnedCards,
  listPlans,
  removeOwnedCard,
  savePlan,
  setSetting,
  updateOwnedCard,
} from './index';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('owned-card CRUD', () => {
  it('adds a card and returns its auto-increment id', async () => {
    const id = await addOwnedCard({ cardId: '30028', limitBreak: 3 });
    expect(typeof id).toBe('number');
    expect(await listOwnedCards()).toEqual([{ id, cardId: '30028', limitBreak: 3 }]);
  });

  it('updates a card by id and reports the update count', async () => {
    const id = await addOwnedCard({ cardId: '30028', limitBreak: 0 });
    expect(await updateOwnedCard(id, { limitBreak: 4 })).toBe(1);
    expect((await listOwnedCards())[0]?.limitBreak).toBe(4);
  });

  it('returns 0 when updating a nonexistent id', async () => {
    expect(await updateOwnedCard(9999, { limitBreak: 1 })).toBe(0);
  });

  it('removes a card', async () => {
    const id = await addOwnedCard({ cardId: '30016', limitBreak: 2 });
    await removeOwnedCard(id);
    expect(await listOwnedCards()).toEqual([]);
  });
});

describe('plan helpers', () => {
  it('savePlan upserts by id', async () => {
    await savePlan(FIXTURE_PLAN);
    await savePlan({ ...FIXTURE_PLAN, name: 'Renamed Cup' });
    const plan = await getPlan(FIXTURE_PLAN.id);
    expect(plan?.name).toBe('Renamed Cup');
    expect(await listPlans()).toHaveLength(1);
  });

  it('listPlans sorts by name', async () => {
    const later: CmPlan = { ...FIXTURE_PLAN, id: 'plan-later', name: 'Z Cup' };
    const earlier: CmPlan = { ...FIXTURE_PLAN, id: 'plan-earlier', name: 'A Cup' };
    await savePlan(later);
    await savePlan(earlier);
    expect((await listPlans()).map((p) => p.id)).toEqual(['plan-earlier', 'plan-later']);
  });

  it('deletePlan removes the plan', async () => {
    await savePlan(FIXTURE_PLAN);
    await deletePlan(FIXTURE_PLAN.id);
    expect(await getPlan(FIXTURE_PLAN.id)).toBeUndefined();
  });
});

describe('settings', () => {
  it('returns undefined for a missing key', async () => {
    expect(await getSetting('missing')).toBeUndefined();
  });

  it('round-trips and overwrites values', async () => {
    await setSetting('preferredServer', 'global');
    expect(await getSetting<string>('preferredServer')).toBe('global');
    await setSetting('preferredServer', 'jp');
    expect(await getSetting<string>('preferredServer')).toBe('jp');
  });

  it('stores structured values', async () => {
    await setSetting('ui', { sidebar: true, zoom: 1.25 });
    expect(await getSetting('ui')).toEqual({ sidebar: true, zoom: 1.25 });
  });
});
