/**
 * Owned-card inventory state, mirrored from Dexie. Every mutation persists
 * immediately (P2 local-first) and updates local state from the db result.
 */
import { useCallback, useEffect, useState } from 'react';
import type { LimitBreak, OwnedCard } from '@/core/types';
import { addOwnedCard, listOwnedCards, removeOwnedCard, updateOwnedCard } from '@/db';

export interface InventoryApi {
  /** null while the initial load is in flight. */
  items: OwnedCard[] | null;
  error: string | null;
  add: (cardId: string, limitBreak: LimitBreak) => void;
  setLimitBreak: (id: number, limitBreak: LimitBreak) => void;
  remove: (id: number) => void;
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function useInventory(): InventoryApi {
  const [items, setItems] = useState<OwnedCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listOwnedCards()
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

  const add = useCallback((cardId: string, limitBreak: LimitBreak) => {
    addOwnedCard({ cardId, limitBreak })
      .then((id) => {
        setItems((prev) => [...(prev ?? []), { id, cardId, limitBreak }]);
        setError(null);
      })
      .catch((err: unknown) => setError(message(err)));
  }, []);

  const setLimitBreak = useCallback((id: number, limitBreak: LimitBreak) => {
    updateOwnedCard(id, { limitBreak })
      .then(() => {
        setItems((prev) =>
          (prev ?? []).map((c) => (c.id === id ? { ...c, limitBreak } : c)),
        );
        setError(null);
      })
      .catch((err: unknown) => setError(message(err)));
  }, []);

  const remove = useCallback((id: number) => {
    removeOwnedCard(id)
      .then(() => {
        setItems((prev) => (prev ?? []).filter((c) => c.id !== id));
        setError(null);
      })
      .catch((err: unknown) => setError(message(err)));
  }, []);

  return { items, error, add, setLimitBreak, remove };
}
