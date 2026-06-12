import 'fake-indexeddb/auto'; // must precede any dexie import
import { beforeEach, describe, expect, it } from 'vitest';
import type { Parent } from '@/core/types';
import { FIXTURE_PLAN } from '@/core/fixtures';
import { db } from './db';
import { exportBlob, importBlob, type ExportBlobV1 } from './exportImport';
import type { MatchLog } from './types';

const PARENT: Parent = {
  id: 'parent-1',
  umaId: '100101',
  blueSpark: { stat: 'spd', stars: 3 },
  pinkSpark: { aptitude: 'long', stars: 2 },
  whiteSparks: [{ skillId: '200012', stars: 1 }],
  grandparents: [{ umaId: '100201' }, undefined],
  source: 'mine',
};

const MATCH_LOG: Omit<MatchLog, 'id'> = {
  cmPlanId: FIXTURE_PLAN.id,
  date: '2026-07-30',
  notes: 'lost to a closer',
};

function emptyBlob(): ExportBlobV1 {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    ownedCards: [],
    parents: [],
    cmPlans: [],
    matchLogs: [],
    settings: [],
  };
}

async function seed(): Promise<void> {
  await db.ownedCards.bulkAdd([
    { cardId: '30028', limitBreak: 3 },
    { cardId: '30016', limitBreak: 4 },
  ]);
  await db.parents.put(PARENT);
  await db.cmPlans.put(FIXTURE_PLAN);
  await db.matchLogs.add({ ...MATCH_LOG });
  await db.settings.put({ key: 'preferredServer', value: 'global' });
}

async function clearAll(): Promise<void> {
  await Promise.all(db.tables.map((t) => t.clear()));
}

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('export → clear → import (replace)', () => {
  it('preserves all tables through a JSON round-trip', async () => {
    await seed();
    const blob = await exportBlob();
    expect(blob.version).toBe(1);
    expect(new Date(blob.exportedAt).getTime()).not.toBeNaN();

    // The real flow serializes to a downloadable JSON file — undefined tuple
    // slots become null on the wire; import must normalize them back.
    const wire: unknown = JSON.parse(JSON.stringify(blob));
    await clearAll();
    expect(await db.cmPlans.count()).toBe(0);

    const { imported } = await importBlob(wire, 'replace');
    expect(imported).toEqual({ ownedCards: 2, parents: 1, cmPlans: 1, matchLogs: 1, settings: 1 });

    expect(await db.ownedCards.toArray()).toEqual(blob.ownedCards); // ids preserved
    expect(await db.parents.get('parent-1')).toEqual(PARENT);
    const plan = await db.cmPlans.get(FIXTURE_PLAN.id);
    expect(plan).toEqual(FIXTURE_PLAN);
    expect(plan?.chosenParents).toEqual([undefined, undefined]); // not [null, null]
    expect(await db.matchLogs.toArray()).toEqual(blob.matchLogs);
    expect((await db.settings.get('preferredServer'))?.value).toBe('global');
  });

  it('replace clears rows that are not in the blob', async () => {
    await seed();
    const blob = { ...emptyBlob(), cmPlans: [FIXTURE_PLAN] };
    await importBlob(blob, 'replace');
    expect(await db.ownedCards.count()).toBe(0);
    expect(await db.parents.count()).toBe(0);
    expect(await db.settings.count()).toBe(0);
    expect(await db.cmPlans.count()).toBe(1);
  });
});

describe('import (merge)', () => {
  it('upserts by primary key and keeps unrelated rows', async () => {
    await seed();
    const existingId = (await db.ownedCards.toArray())[0]?.id;
    expect(existingId).toBeDefined();

    const blob: ExportBlobV1 = {
      ...emptyBlob(),
      ownedCards: [
        { id: existingId, cardId: '30028', limitBreak: 4 }, // upsert existing
        { cardId: '10001', limitBreak: 0 }, // new, id assigned
      ],
      cmPlans: [{ ...FIXTURE_PLAN, name: 'Merged Cup' }],
    };
    const { imported } = await importBlob(blob, 'merge');
    expect(imported['ownedCards']).toBe(2);

    expect(await db.ownedCards.count()).toBe(3); // 2 seeded + 1 new
    expect((await db.ownedCards.get(existingId as number))?.limitBreak).toBe(4);
    expect((await db.cmPlans.get(FIXTURE_PLAN.id))?.name).toBe('Merged Cup');
    // Tables absent from the blob are untouched in merge mode.
    expect(await db.parents.count()).toBe(1);
    expect((await db.settings.get('preferredServer'))?.value).toBe('global');
  });
});

describe('malformed input', () => {
  it.each([
    [null, /blob must be an object/],
    ['{}', /blob must be an object/],
    [{ ...emptyBlob(), version: 2 }, /unsupported version 2/],
    [{ version: 1, exportedAt: 'now' }, /blob\.ownedCards must be an array/],
    [
      { ...emptyBlob(), ownedCards: [{ cardId: 30028, limitBreak: 1 }] },
      /blob\.ownedCards\[0\]\.cardId must be a string/,
    ],
    [
      { ...emptyBlob(), ownedCards: [{ cardId: '30028', limitBreak: 5 }] },
      /blob\.ownedCards\[0\]\.limitBreak must be an integer 0–4/,
    ],
    [
      { ...emptyBlob(), parents: [{ ...PARENT, blueSpark: { stat: 'spd', stars: 4 } }] },
      /blob\.parents\[0\]\.blueSpark\.stars must be 1 \| 2 \| 3/,
    ],
    [
      {
        ...emptyBlob(),
        cmPlans: [{ ...FIXTURE_PLAN, targetSkills: [{ skillId: '200331', priority: 0 }] }],
      },
      /blob\.cmPlans\[0\]\.targetSkills\[0\]\.priority must be 1 \| 2 \| 3/,
    ],
    [
      { ...emptyBlob(), matchLogs: [{ cmPlanId: 'p', date: 20260730 }] },
      /blob\.matchLogs\[0\]\.date must be a string/,
    ],
  ])('rejects %j with a descriptive error', async (input, message) => {
    await expect(importBlob(input, 'replace')).rejects.toThrow(message);
  });

  it('leaves existing data untouched when validation fails', async () => {
    await seed();
    await expect(importBlob({ version: 1 }, 'replace')).rejects.toThrow(/Malformed/);
    expect(await db.ownedCards.count()).toBe(2);
    expect(await db.cmPlans.count()).toBe(1);
  });
});
