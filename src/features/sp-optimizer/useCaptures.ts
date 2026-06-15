import { useCallback, useEffect, useState } from 'react';

import type { CaptureBundle } from '@/core/spOptimizer';
import { deleteCapture, listCaptures, saveCapture } from '@/db';
import type { StoredCapture } from '@/db/types';

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export interface CapturesState {
  items: StoredCapture[] | null; // null = initial load in flight
  error: string | null;
  save: (label: string, bundle: CaptureBundle) => Promise<StoredCapture | null>;
  remove: (id: string) => void;
}

export function useCaptures(): CapturesState {
  const [items, setItems] = useState<StoredCapture[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listCaptures()
      .then((rows) => { if (!cancelled) setItems(rows); })
      .catch((err: unknown) => { if (!cancelled) { setError(message(err)); setItems([]); } });
    return () => { cancelled = true; };
  }, []);

  const save = useCallback(async (label: string, bundle: CaptureBundle) => {
    try {
      const saved = await saveCapture({ label, bundle });
      setItems((prev) => [...(prev ?? []), saved]);
      return saved;
    } catch (err) { setError(message(err)); return null; }
  }, []);

  const remove = useCallback((id: string) => {
    deleteCapture(id)
      .then(() => setItems((prev) => (prev ?? []).filter((c) => c.id !== id)))
      .catch((err: unknown) => setError(message(err)));
  }, []);

  return { items, error, save, remove };
}
