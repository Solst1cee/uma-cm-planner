import 'fake-indexeddb/auto'; // must precede any dexie import
import { beforeEach, describe, expect, it } from 'vitest';
import type { Parent } from '@/core/types';
import { db, deleteParent, getParent, listParents, saveParent } from './index';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

/** Minimal valid draft (no id) — spread-and-override per test. */
const draft: Omit<Parent, 'id'> = {
  umaId: '100201',
  blueSpark: { stat: 'spd', stars: 3 },
  pinkSpark: { aptitude: 'turf', stars: 2 },
  whiteSparks: [{ skillId: '200332', stars: 2 }],
  source: 'mine',
};

describe('parent CRUD', () => {
  it('saveParent generates a uuid when the id is absent and persists the record', async () => {
    const saved = await saveParent(draft);
    expect(saved.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(saved).toEqual({ ...draft, id: saved.id });
    expect(await getParent(saved.id)).toEqual(saved);
  });

  it('saveParent upserts by id (no duplicate rows)', async () => {
    const saved = await saveParent(draft);
    await saveParent({ ...saved, notes: 'now with notes', source: 'friend_rental' });
    expect(await listParents()).toHaveLength(1);
    const reloaded = await getParent(saved.id);
    expect(reloaded?.notes).toBe('now with notes');
    expect(reloaded?.source).toBe('friend_rental');
  });

  it('round-trips nested optional fields (green spark, grandparents, affinity hint)', async () => {
    const full: Omit<Parent, 'id'> = {
      ...draft,
      greenSpark: { skillId: '900021', stars: 2, sourceCardId: '100201' },
      whiteSparks: [
        { skillId: '200332', stars: 2 },
        { skillId: '200012', stars: 1 },
      ],
      grandparents: [
        undefined,
        {
          umaId: '100101',
          blueSpark: { stat: 'sta', stars: 1 },
          whiteSparks: [{ skillId: '200014', stars: 3 }],
        },
      ],
      affinityHint: 152,
      notes: 'rental from friend list',
      source: 'friend_rental',
      importSource: 'manual',
    };
    const saved = await saveParent(full);
    expect(await getParent(saved.id)).toEqual({ ...full, id: saved.id });
  });

  it('listParents returns every saved parent', async () => {
    const a = await saveParent(draft);
    const b = await saveParent({ ...draft, umaId: '100101' });
    const ids = (await listParents()).map((p) => p.id);
    expect(ids).toHaveLength(2);
    expect(ids).toEqual(expect.arrayContaining([a.id, b.id]));
  });

  it('getParent returns undefined for a missing id', async () => {
    expect(await getParent('nope')).toBeUndefined();
  });

  it('deleteParent removes only the targeted parent', async () => {
    const a = await saveParent(draft);
    const b = await saveParent({ ...draft, umaId: '100101' });
    await deleteParent(a.id);
    expect(await getParent(a.id)).toBeUndefined();
    expect((await listParents()).map((p) => p.id)).toEqual([b.id]);
  });
});
