/**
 * Resolve CmPlan.chosenParents (Parent ids) against the Dexie parents store.
 *
 * Freshness contract (FINDING 3): parent spark/affinity edits happen on the
 * /parents route via saveParent (Dexie) and do NOT produce a new plan object —
 * ChosenParentsPicker only writes the two parent IDs into the plan. So a plan
 * identity change alone would not reflect an in-place parent edit. We therefore
 * re-query listParents() (a) when the chosen ids change, and (b) whenever the
 * document becomes visible again — returning to the planner from /parents (or
 * from another tab) re-reads the store and shows the fresh sparks. The re-fetch
 * is a tiny indexed-table read; cheap insurance against stale spark data.
 */
import { useCallback, useEffect, useState } from 'react';
import type { CmPlan, Parent } from '@/core/types';
import { listParents } from '@/db';

export interface ChosenParents {
  /** Index-aligned with plan.parents [a, b]; undefined = empty slot, missing record, or still loading. */
  slots: [Parent | undefined, Parent | undefined];
  /** Resolved records only — the shape the core functions take. */
  parents: Parent[];
  loading: boolean;
  error: string | null;
}

const EMPTY: ChosenParents = {
  slots: [undefined, undefined],
  parents: [],
  loading: false,
  error: null,
};

export function useChosenParents(plan: CmPlan): ChosenParents {
  const [state, setState] = useState<ChosenParents>({ ...EMPTY, loading: true });
  const id0 = plan.parents.a;
  const id1 = plan.parents.b;

  // Resolve the two chosen ids against the current store contents. Returns a
  // cleanup that cancels the in-flight read so a stale resolve can't land.
  const resolve = useCallback(() => {
    if (id0 === undefined && id1 === undefined) {
      setState(EMPTY);
      return () => {};
    }
    let cancelled = false;
    setState((prev) => (prev.loading ? prev : { ...prev, loading: true }));
    listParents()
      .then((all) => {
        if (cancelled) return;
        const byId = new Map(all.map((p) => [p.id, p]));
        const slots: [Parent | undefined, Parent | undefined] = [
          id0 !== undefined ? byId.get(id0) : undefined,
          id1 !== undefined ? byId.get(id1) : undefined,
        ];
        setState({
          slots,
          parents: slots.filter((p): p is Parent => p !== undefined),
          loading: false,
          error: null,
        });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({ ...EMPTY, error: err instanceof Error ? err.message : String(err) });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id0, id1]);

  // Re-resolve when the chosen ids change (and on mount).
  useEffect(() => resolve(), [resolve]);

  // FINDING 3: also re-resolve when the page becomes visible again, so an
  // in-place parent edit made on /parents (which never touches the plan) shows
  // fresh sparks on return without needing a remount.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') resolve();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [resolve]);

  return state;
}
