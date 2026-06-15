import { db } from '@/db/db';
import type { CaptureBundle } from '@/core/spOptimizer';
import type { StoredCapture } from '@/db/types';

export interface CaptureDraft {
  id?: string;
  label: string;
  bundle: CaptureBundle;
}

export function listCaptures(): Promise<StoredCapture[]> {
  return db.captures.toArray();
}

export function getCapture(id: string): Promise<StoredCapture | undefined> {
  return db.captures.get(id);
}

/** Upsert by id; generates a `crypto.randomUUID()` id when absent. */
export async function saveCapture(draft: CaptureDraft): Promise<StoredCapture> {
  const record: StoredCapture = {
    id: draft.id || crypto.randomUUID(),
    label: draft.label,
    bundle: draft.bundle,
  };
  await db.captures.put(record);
  return record;
}

export function deleteCapture(id: string): Promise<void> {
  return db.captures.delete(id);
}
