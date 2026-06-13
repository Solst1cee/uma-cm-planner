/**
 * Compact two-slot parent selector for the Skill Planner page (plan §10:
 * CmPlan.chosenParents is the cross-module contract). Takes no props —
 * reads the active plan, lists saved parents, writes parent ids back via
 * setPlan.
 */
import { useEffect, useState } from 'react';
import type { Parent, UmaRecord } from '@/core/types';
import { useActivePlan } from '@/app/ActivePlanContext';
import { listParents } from '@/db';
import { sparkSummary } from './sparkMeta';
import { useUmas, umaName } from './useUmas';
import './parents.css';

const SLOTS = [0, 1] as const;

function optionLabel(p: Parent, umaById: Map<string, UmaRecord>): string {
  const rental = p.source === 'friend_rental' ? ' (rental)' : '';
  return `${umaName(umaById, p.umaId)}${rental} — ${sparkSummary(p)}`;
}

export function ChosenParentsPicker() {
  const { plan, setPlan } = useActivePlan();
  const { umaById } = useUmas();
  const [parents, setParents] = useState<Parent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listParents()
      .then((rows) => {
        if (!cancelled) setParents(rows);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setParents([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (plan === null) return null;
  const chosen = plan.chosenParents;

  const setSlot = (slot: 0 | 1, id: string | undefined) => {
    const next: [string?, string?] = [chosen[0], chosen[1]];
    next[slot] = id;
    setPlan({ ...plan, chosenParents: next });
  };

  return (
    <div className="chosen-parents">
      {error !== null && (
        <p className="error chosen-parents-note" role="alert">
          Parents error: {error}
        </p>
      )}
      {SLOTS.map((slot) => {
        const value = chosen[slot] ?? '';
        const known = value === '' || (parents?.some((p) => p.id === value) ?? true);
        const otherValue = chosen[slot === 0 ? 1 : 0];
        return (
          <label className="field" key={slot}>
            <span>Parent {slot + 1}</span>
            <select
              value={value}
              disabled={parents === null}
              onChange={(e) => setSlot(slot, e.target.value === '' ? undefined : e.target.value)}
            >
              <option value="">— none —</option>
              {!known && <option value={value}>(missing parent)</option>}
              {(parents ?? []).map((p) => (
                <option key={p.id} value={p.id} disabled={otherValue === p.id}>
                  {optionLabel(p, umaById)}
                </option>
              ))}
            </select>
          </label>
        );
      })}
      {parents !== null && parents.length === 0 && (
        <p className="muted small chosen-parents-note">
          No saved parents yet — add them on the Parents page.
        </p>
      )}
    </div>
  );
}
