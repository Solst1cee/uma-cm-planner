/**
 * Resolve CmPlan.chosenParents (Parent ids) against the Dexie parents store.
 *
 * The effect depends on the plan OBJECT IDENTITY, not just the two ids: the
 * parents picker persists every edit through setPlan (its contract), so any
 * spark/affinity edit produces a new plan object and re-resolves here. The
 * re-fetch is a tiny indexed-table read — cheap insurance against showing
 * stale spark data after an in-place parent edit.
 */
import { useEffect, useState } from 'react';
import type { CmPlan, Parent } from '@/core/types';
import { listParents } from '@/db';

export interface ChosenParents {
  /** Index-aligned with plan.chosenParents; undefined = empty slot, missing record, or still loading. */
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

  useEffect(() => {
    const [id0, id1] = plan.chosenParents;
    if (id0 === undefined && id1 === undefined) {
      setState(EMPTY);
      return;
    }
    let cancelled = false;
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
  }, [plan]);

  return state;
}
