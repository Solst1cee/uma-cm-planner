import 'fake-indexeddb/auto'; // must precede any dexie import
import { beforeEach, describe, expect, it } from 'vitest';
import type { Parent } from '@/core/types';
import { FIXTURE_PLAN } from '@/core/fixtures';
import { db } from './db';
import { exportBlob, importBlob, type ExportBlobV2 } from './exportImport';
import type { MatchLog } from './types';
import type { CaptureBundle } from '@/core/spOptimizer';
import { saveCapture } from '@/db';

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

const PLAN_WITH_NOTES = { ...FIXTURE_PLAN, notes: 'test plan note' };

const BUNDLE_FIXTURE: CaptureBundle = {
  schemaVersion: 1,
  source: 'manual',
  capturedAt: '2026-06-15T00:00:00.000Z',
  server: 'global',
  dataVersion: 'global-76214c82',
  context: {
    umaId: '',
    stats: { spd: 1, sta: 1, pow: 1, gut: 1, wit: 1 },
    aptitudes: { distance: 'A', surface: 'A', strategy: 'A' },
    strategy: 'pace',
    courseId: '10101',
    spBudget: 300,
    ownedSkills: [],
    pinned: [],
    candidates: [],
  },
};

function emptyBlob(): ExportBlobV2 {
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    ownedCards: [],
    parents: [],
    cmPlans: [],
    matchLogs: [],
    settings: [],
    captures: [],
  };
}

async function seed(): Promise<void> {
  await db.ownedCards.bulkAdd([
    { cardId: '30028', limitBreak: 3 },
    { cardId: '30016', limitBreak: 4 },
  ]);
  await db.parents.put(PARENT);
  await db.cmPlans.put(PLAN_WITH_NOTES);
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
    expect(blob.version).toBe(2);
    expect(new Date(blob.exportedAt).getTime()).not.toBeNaN();

    // The real flow serializes to a downloadable JSON file — undefined tuple
    // slots become null on the wire; import must normalize them back.
    const wire: unknown = JSON.parse(JSON.stringify(blob));
    await clearAll();
    expect(await db.cmPlans.count()).toBe(0);

    const { imported } = await importBlob(wire, 'replace');
    expect(imported).toEqual({ ownedCards: 2, parents: 1, cmPlans: 1, matchLogs: 1, settings: 1, captures: 0 });

    expect(await db.ownedCards.toArray()).toEqual(blob.ownedCards); // ids preserved
    expect(await db.parents.get('parent-1')).toEqual(PARENT);
    const plan = await db.cmPlans.get(FIXTURE_PLAN.id);
    expect(blob.cmPlans[0]?.notes).toBe('test plan note');
    expect(plan).toEqual(PLAN_WITH_NOTES);
    expect(plan?.parents).toEqual({});
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
  // Merge NEVER deletes: rows absent from the blob are kept; string-keyed
  // tables upsert by primary key; ownedCards dedupe by cardId (higher
  // limitBreak wins); matchLogs append with fresh local ids.

  it('upserts keyed tables and dedupes ownedCards by cardId, keeping the higher limitBreak', async () => {
    await seed(); // ownedCards: 30028 LB3, 30016 LB4

    const blob: ExportBlobV2 = {
      ...emptyBlob(),
      ownedCards: [
        { cardId: '30028', limitBreak: 4 }, // already owned at LB3 → upgraded in place
        { cardId: '10001', limitBreak: 0 }, // new card → added with a fresh local id
      ],
      cmPlans: [{ ...FIXTURE_PLAN, name: 'Merged Cup' }],
    };
    const { imported } = await importBlob(blob, 'merge');
    expect(imported['ownedCards']).toBe(2); // 1 upgrade + 1 add

    const cards = await db.ownedCards.toArray();
    expect(cards).toHaveLength(3); // 2 seeded + 1 new — merge never deletes
    expect(cards.find((c) => c.cardId === '30028')?.limitBreak).toBe(4); // upgraded
    expect(cards.find((c) => c.cardId === '30016')?.limitBreak).toBe(4); // untouched
    expect((await db.cmPlans.get(FIXTURE_PLAN.id))?.name).toBe('Merged Cup');
    // Tables absent from the blob are untouched in merge mode.
    expect(await db.parents.count()).toBe(1);
    expect((await db.settings.get('preferredServer'))?.value).toBe('global');
  });

  it('cross-device merge: colliding auto-increment ids never overwrite unrelated local rows', async () => {
    // Device A (this db): seed assigns ownedCards ids 1 (30028 LB3) and
    // 2 (30016 LB4), and matchLog id 1. Device B counted its OWN ids 1..2 —
    // by-id upsert would clobber A's 30016 and A's match log.
    await seed();

    const deviceB: ExportBlobV2 = {
      ...emptyBlob(),
      ownedCards: [
        { id: 1, cardId: '30028', limitBreak: 1 }, // collides with A's id 1; LOWER LB
        { id: 2, cardId: '10001', limitBreak: 2 }, // collides with A's id 2 = 30016!
      ],
      matchLogs: [{ id: 1, cmPlanId: 'plan-from-device-B', date: '2026-08-01' }],
    };
    // Round-trip through JSON, like a real cross-device transfer file.
    const { imported } = await importBlob(JSON.parse(JSON.stringify(deviceB)), 'merge');
    expect(imported['ownedCards']).toBe(1); // only 10001 written (30028 keeps A's higher LB3)

    const cards = await db.ownedCards.toArray();
    expect(cards).toHaveLength(3);
    expect(cards.find((c) => c.cardId === '30028')?.limitBreak).toBe(3); // local higher LB kept
    expect(cards.find((c) => c.cardId === '30016')?.limitBreak).toBe(4); // NOT clobbered by B's id 2
    const added = cards.find((c) => c.cardId === '10001');
    expect(added?.limitBreak).toBe(2);
    expect(added?.id).not.toBe(2); // exported id stripped, fresh local id assigned

    // B's log appended under a fresh id; A's log id 1 untouched.
    const logs = await db.matchLogs.toArray();
    expect(logs).toHaveLength(2);
    expect(logs.find((l) => l.id === 1)?.cmPlanId).toBe(FIXTURE_PLAN.id);
    expect(logs.find((l) => l.cmPlanId === 'plan-from-device-B')?.id).not.toBe(1);
  });

  it('dedupes duplicate cardIds within the blob itself, keeping the higher limitBreak', async () => {
    const blob: ExportBlobV2 = {
      ...emptyBlob(),
      ownedCards: [
        { cardId: '30028', limitBreak: 1 },
        { cardId: '30028', limitBreak: 3 },
        { cardId: '30028', limitBreak: 2 },
      ],
    };
    const { imported } = await importBlob(blob, 'merge');
    expect(imported['ownedCards']).toBe(1);
    expect(await db.ownedCards.toArray()).toEqual([
      expect.objectContaining({ cardId: '30028', limitBreak: 3 }),
    ]);
  });
});

describe('malformed input', () => {
  it.each([
    [null, /blob must be an object/],
    ['{}', /blob must be an object/],
    [{ ...emptyBlob(), version: 1 }, /unsupported version 1/],
    [{ version: 2, exportedAt: 'now' }, /blob\.ownedCards must be an array/],
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
        cmPlans: [{ ...FIXTURE_PLAN, wishlist: [{ skillId: '200331', priority: 0, source: 'targeted' }] }],
      },
      /blob\.cmPlans\[0\]\.wishlist\[0\]\.priority must be 1 \| 2 \| 3/,
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
    await expect(importBlob({ version: 3 }, 'replace')).rejects.toThrow(/Malformed/);
    expect(await db.ownedCards.count()).toBe(2);
    expect(await db.cmPlans.count()).toBe(1);
  });
});

describe('export/import captures', () => {
  it('round-trips captures and tolerates an absent captures key', async () => {
    await saveCapture({ label: 'roundtrip', bundle: BUNDLE_FIXTURE });
    const blob = await exportBlob();
    expect(blob.captures).toHaveLength(1);

    const { captures, ...legacy } = JSON.parse(JSON.stringify(blob));
    await db.delete(); await db.open();
    const result = await importBlob(legacy, 'replace');
    expect(result.imported.captures ?? 0).toBe(0);
  });
});
