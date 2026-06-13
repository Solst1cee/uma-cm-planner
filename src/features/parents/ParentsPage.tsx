/**
 * Parents page (plan §6 step 4): saved-parents list (spark summary chips,
 * mine/rental badge), add/edit via ParentForm, two-step delete confirm.
 * Mobile-first; persistence through the parents API (P2 local-first).
 */
import { useState } from 'react';
import type { Parent, UmaRecord } from '@/core/types';
import type { ParentDraft } from '@/db';
import { useGameData } from '@/features/data/gameData';
import { ParentForm } from './ParentForm';
import { useParents } from './useParents';
import { useUmas } from './useUmas';
import { aptitudeLabel, starsGlyph, STAT_LABEL } from './sparkMeta';
import './parents.css';

function ParentListItem({
  parent,
  umaById,
  skillName,
  onEdit,
  confirming,
  onDeleteRequest,
  onDeleteConfirm,
  onDeleteCancel,
}: {
  parent: Parent;
  umaById: Map<string, UmaRecord>;
  skillName: (id: string) => string;
  onEdit: () => void;
  confirming: boolean;
  onDeleteRequest: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
}) {
  const uma = umaById.get(parent.umaId);
  const name = uma?.nameEn ?? `Uma ${parent.umaId}`;
  const gpCount = parent.grandparents?.filter((g) => g !== undefined).length ?? 0;
  return (
    <li className="parent-row">
      <div className="owned-main">
        <span className="owned-name">
          {name}
          {uma?.epithet !== undefined && <span className="muted small"> {uma.epithet}</span>}
        </span>
        <span className={`badge source-${parent.source}`}>
          {parent.source === 'mine' ? 'Mine' : 'Rental'}
        </span>
        <button type="button" className="icon-btn" aria-label={`Edit ${name}`} onClick={onEdit}>
          ✎
        </button>
        <button
          type="button"
          className="icon-btn"
          aria-label={`Delete ${name}`}
          onClick={onDeleteRequest}
        >
          ✕
        </button>
      </div>
      <div className="spark-chips" aria-label={`Sparks of ${name}`}>
        <span className="chip-sm spark-blue">
          {STAT_LABEL[parent.blueSpark.stat]} {starsGlyph(parent.blueSpark.stars)}
        </span>
        <span className="chip-sm spark-pink">
          {aptitudeLabel(parent.pinkSpark.aptitude)} {starsGlyph(parent.pinkSpark.stars)}
        </span>
        {parent.greenSpark && (
          <span className="chip-sm spark-green">
            {skillName(parent.greenSpark.skillId)} {starsGlyph(parent.greenSpark.stars)}
          </span>
        )}
        {parent.whiteSparks.map((sp) => (
          <span key={sp.skillId} className="chip-sm">
            {skillName(sp.skillId)} {starsGlyph(sp.stars)}
          </span>
        ))}
        {gpCount > 0 && (
          <span className="chip-sm">
            {gpCount} grandparent{gpCount > 1 ? 's' : ''}
          </span>
        )}
        {parent.affinityHint !== undefined && (
          <span className="chip-sm">affinity ≤ {parent.affinityHint}</span>
        )}
      </div>
      {parent.notes !== undefined && <p className="muted small parent-notes">{parent.notes}</p>}
      {confirming && (
        <div className="confirm-row">
          <span className="small">Delete this parent? Plans referencing it lose the slot.</span>
          <button type="button" onClick={onDeleteConfirm}>
            Confirm delete
          </button>
          <button type="button" onClick={onDeleteCancel}>
            Cancel
          </button>
        </div>
      )}
    </li>
  );
}

export function ParentsPage() {
  const { skillById } = useGameData();
  const { umaById } = useUmas();
  const parents = useParents();
  const [editing, setEditing] = useState<Parent | 'new' | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const skillName = (id: string) => skillById.get(id)?.nameEn ?? `Skill ${id}`;

  const handleSave = async (draft: ParentDraft) => {
    const saved = await parents.save(draft);
    if (saved !== null) setEditing(null);
  };

  return (
    <div className="page">
      <section className="panel" aria-labelledby="parents-h">
        <h2 id="parents-h">Parents</h2>
        <p className="muted small">
          Trained veterans and rental candidates for inheritance. Pick two on the Skill
          Planner to feed spark coverage.
        </p>
        {parents.error !== null && (
          <p className="error" role="alert">
            Parents error: {parents.error}
          </p>
        )}

        {editing === null ? (
          <button type="button" onClick={() => setEditing('new')}>
            Add parent
          </button>
        ) : (
          <ParentForm
            key={editing === 'new' ? 'new' : editing.id}
            initial={editing === 'new' ? undefined : editing}
            onSave={(draft) => void handleSave(draft)}
            onCancel={() => setEditing(null)}
          />
        )}

        {parents.items === null ? (
          <p className="muted">Loading parents…</p>
        ) : parents.items.length === 0 ? (
          <p className="muted">No parents yet — add your trained veterans or rental finds.</p>
        ) : (
          <ul className="parent-list" aria-label="Saved parents">
            {parents.items.map((p) => (
              <ParentListItem
                key={p.id}
                parent={p}
                umaById={umaById}
                skillName={skillName}
                onEdit={() => {
                  setEditing(p);
                  setConfirmingId(null);
                }}
                confirming={confirmingId === p.id}
                onDeleteRequest={() => setConfirmingId(p.id)}
                onDeleteConfirm={() => {
                  parents.remove(p.id);
                  setConfirmingId(null);
                }}
                onDeleteCancel={() => setConfirmingId(null)}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
