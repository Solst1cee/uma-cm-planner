/** P3 marker (availability #4b): which rebalance versions a sim ran with.
 *  Renders nothing when no patch was active — the default, honest-silent state. */
import type { ActivePatchNote } from '@/core/rebalancePatches';

function label(n: ActivePatchNote): string {
  if (n.pinLag) return `Δ ${n.name}: simmed with v${n.ver} — confirmed patch, engine pin pending`;
  const arrival = n.arrival ? ` — arrives ${n.predicted ? '~' : ''}${n.arrival}` : '';
  return `Δ ${n.name}: simmed with v${n.ver}${n.pinned ? ' (pinned)' : ''}${arrival}`;
}

export function PatchedSimNote({ notes }: { notes: ActivePatchNote[] }) {
  if (notes.length === 0) return null;
  return (
    <div className="cmp-patched-note small" role="note">
      {notes.map((n) => (
        <span key={n.skillId} className="cmp-patched-chip">{label(n)}</span>
      ))}
    </div>
  );
}
