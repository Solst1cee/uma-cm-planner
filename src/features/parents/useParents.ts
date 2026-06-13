/**
 * Saved-parents state, mirrored from Dexie via the parents API. Every
 * mutation persists immediately (P2 local-first) and updates local state
 * from the db result — same pattern as useInventory.
 */
import { useCallback, useEffect, useState } from 'react';
import type { Parent } from '@/core/types';
import { deleteParent, listParents, saveParent, type ParentDraft } from '@/db';

export interface ParentsState {
  /** null while the initial load is in flight. */
  items: Parent[] | null;
  error: string | null;
  /** Upsert; resolves with the stored record, or null when the write failed. */
  save: (draft: ParentDraft) => Promise<Parent | null>;
  remove: (id: string) => void;
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function useParents(): ParentsState {
  const [items, setItems] = useState<Parent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listParents()
      .then((rows) => {
        if (!cancelled) setItems(rows);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(message(err));
          setItems([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback(async (draft: ParentDraft): Promise<Parent | null> => {
    try {
      const saved = await saveParent(draft);
      setItems((prev) => {
        const list = prev ?? [];
        const i = list.findIndex((p) => p.id === saved.id);
        return i === -1 ? [...list, saved] : list.map((p) => (p.id === saved.id ? saved : p));
      });
      setError(null);
      return saved;
    } catch (err: unknown) {
      setError(message(err));
      return null;
    }
  }, []);

  const remove = useCallback((id: string) => {
    deleteParent(id)
      .then(() => {
        setItems((prev) => (prev ?? []).filter((p) => p.id !== id));
        setError(null);
      })
      .catch((err: unknown) => setError(message(err)));
  }, []);

  return { items, error, save, remove };
}
