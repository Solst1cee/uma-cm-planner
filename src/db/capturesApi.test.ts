import 'fake-indexeddb/auto'; // must precede any dexie import
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { db } from '@/db/db';
import { deleteCapture, listCaptures, saveCapture } from '@/db';
import type { CaptureBundle } from '@/core/spOptimizer';

const CTX: CaptureBundle['context'] = {
  umaId: '', stats: { spd: 1, sta: 1, pow: 1, gut: 1, wit: 1 },
  aptitudes: { distance: 'A', surface: 'A', strategy: 'A' },
  strategy: 'pace', courseId: '10101', spBudget: 300,
  ownedSkills: [], pinned: [], candidates: [],
};
const BUNDLE: CaptureBundle = {
  schemaVersion: 1, source: 'manual', capturedAt: '2026-06-15T00:00:00.000Z',
  server: 'global', dataVersion: 'global-76214c82', context: CTX,
};

beforeEach(async () => { await db.delete(); await db.open(); });
afterEach(async () => { await db.delete(); });

describe('capturesApi', () => {
  it('saves a capture with a generated id and a label', async () => {
    const saved = await saveCapture({ label: 'CM14 ace', bundle: BUNDLE });
    expect(saved.id).toMatch(/.+/);
    expect((await listCaptures())[0]?.label).toBe('CM14 ace');
  });

  it('deletes a capture', async () => {
    const saved = await saveCapture({ label: 'x', bundle: BUNDLE });
    await deleteCapture(saved.id);
    expect(await listCaptures()).toEqual([]);
  });
});
