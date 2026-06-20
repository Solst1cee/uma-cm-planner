import 'fake-indexeddb/auto'; // must precede any dexie import
import { beforeEach, describe, expect, it } from 'vitest';
import Dexie from 'dexie';
import type { CmPlan } from '@/core/types';
import { FIXTURE_PLAN } from '@/core/fixtures';
import {
  DB_NAME,
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

describe('v3→v4 migration: cmRef normalization', () => {
  it('rewrites a legacy CM-backed cmRef to kind:cm', async () => {
    // Seed the db at v3 (bypassing v4 upgrade) via a bare Dexie instance.
    await db.delete();
    const v3 = new Dexie(DB_NAME);
    v3.version(3).stores({ ownedCards: '++id, cardId', parents: 'id, umaId', cmPlans: 'id, name', matchLogs: '++id, cmPlanId, date', settings: 'key', captures: 'id, label' });
    await v3.open();
    const legacyCm = { ...FIXTURE_PLAN, id: 'mig-cm', cmRef: { cmId: 'CM15', cmNumber: 15, courseId: '10906', surface: 'turf', distance: 2200, condition: 'good', weather: 'cloudy', season: 'summer' } };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (v3.table('cmPlans') as Dexie.Table<any, string>).put(legacyCm);
    await v3.close();

    // Re-open via the app db (v4): upgrade should normalize cmRef (keeping geometry).
    await db.open();
    const migrated = await db.cmPlans.get('mig-cm');
    expect(migrated?.cmRef).toEqual({ kind: 'cm', cmId: 'CM15', cmNumber: 15, courseId: '10906', surface: 'turf', distance: 2200 });
  });

  it('rewrites a legacy custom cmRef (cmNumber:0) to kind:custom', async () => {
    await db.delete();
    const v3 = new Dexie(DB_NAME);
    v3.version(3).stores({ ownedCards: '++id, cardId', parents: 'id, umaId', cmPlans: 'id, name', matchLogs: '++id, cmPlanId, date', settings: 'key', captures: 'id, label' });
    await v3.open();
    const legacyCustom = { ...FIXTURE_PLAN, id: 'mig-custom', cmRef: { cmId: 'CM0', cmNumber: 0, courseId: '10906', surface: 'turf', distance: 2200, condition: 'good', weather: 'cloudy', season: 'summer' } };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (v3.table('cmPlans') as Dexie.Table<any, string>).put(legacyCustom);
    await v3.close();

    await db.open();
    const migrated = await db.cmPlans.get('mig-custom');
    expect(migrated?.cmRef).toEqual({ kind: 'custom', courseId: '10906', surface: 'turf', distance: 2200, ground: 'good', weather: 'cloudy', season: 'summer' });
  });
});
