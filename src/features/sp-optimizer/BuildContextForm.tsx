import { useState } from 'react';

import type { BuyableSkill, CaptureBundle } from '@/core/spOptimizer';
import type { Stat } from '@/core/types';
import type { Grade } from '@/sim/types';
import { GameIcon } from '@/features/data/GameIcon';
import { useGameData } from '@/features/data/gameData';

const DEFAULT_STATS: Record<Stat, number> = { spd: 1000, sta: 800, pow: 800, gut: 400, wit: 600 };

export interface BuildContextFormProps {
  onAnalyze: (bundle: CaptureBundle) => void;
  initialCandidates?: BuyableSkill[];
  initialSpBudget?: number;
  initialCourseId?: string;
  dataVersion?: string;
  /** Clock injected so the component stays testable/deterministic. */
  now?: () => string;
}

export function BuildContextForm({
  onAnalyze, initialCandidates, initialSpBudget, initialCourseId, dataVersion = 'global-c1fa2107', now,
}: BuildContextFormProps) {
  const { skillById } = useGameData();
  const [spBudget, setSpBudget] = useState(initialSpBudget ?? 1000);
  const [courseId, setCourseId] = useState(initialCourseId ?? '10101');
  const [candidates, setCandidates] = useState<BuyableSkill[]>(initialCandidates ?? []);
  const [draftId, setDraftId] = useState('');
  const [draftCost, setDraftCost] = useState('');
  const [source] = useState<'manual' | 'ocr'>(
    initialCandidates && initialCandidates.length > 0 ? 'ocr' : 'manual',
  );

  function addCandidate() {
    const id = draftId.trim();
    if (!id || candidates.some((c) => c.skillId === id)) return;
    setCandidates((prev) => [...prev, { skillId: id, rarity: 'white', screenSpCost: Number(draftCost) || 0, matchTier: 'manual' }]);
    setDraftId('');
    setDraftCost('');
  }

  function setCost(skillId: string, cost: number) {
    setCandidates((prev) => prev.map((c) => (c.skillId === skillId ? { ...c, screenSpCost: cost } : c)));
  }

  function removeCandidate(skillId: string) {
    setCandidates((prev) => prev.filter((c) => c.skillId !== skillId));
  }

  function analyze() {
    const bundle: CaptureBundle = {
      schemaVersion: 1,
      source,
      capturedAt: now ? now() : new Date().toISOString(),
      server: 'global',
      dataVersion,
      seed: 12345,
      context: {
        umaId: '',
        stats: { ...DEFAULT_STATS },
        aptitudes: { distance: 'A' as Grade, surface: 'A' as Grade, strategy: 'A' as Grade },
        strategy: 'pace',
        courseId,
        spBudget,
        ownedSkills: [],
        pinned: [],
        candidates,
      },
    };
    onAnalyze(bundle);
  }

  return (
    <div className="sp-form">
      <label>
        Available SP
        <input type="number" value={spBudget} onChange={(e) => setSpBudget(Number(e.target.value))} />
      </label>
      <label>
        Course id
        <input value={courseId} onChange={(e) => setCourseId(e.target.value)} />
      </label>

      <fieldset>
        <legend>Buyable skill</legend>
        <label>
          Skill id
          <input value={draftId} onChange={(e) => setDraftId(e.target.value)} />
        </label>
        <label>
          On-screen SP cost
          <input type="number" value={draftCost} onChange={(e) => setDraftCost(e.target.value)} />
        </label>
        <button type="button" onClick={addCandidate}>Add skill</button>
      </fieldset>

      <ul className="sp-candidates">
        {candidates.map((c) => {
          const skill = skillById.get(c.skillId);
          const name = skill?.nameEn ?? `Skill ${c.skillId}`;
          return (
            <li key={c.skillId} className="sp-candidate-row">
              {skill && <GameIcon kind="skill" id={skill.iconId} size={20} alt="" />}
              <span className="sp-candidate-name">{name}</span>
              {c.matchTier && c.matchTier !== 'manual' && (
                <span className="sp-tier-badge" data-tier={c.matchTier}>{c.matchTier}</span>
              )}
              <input
                type="number"
                className="sp-candidate-cost"
                aria-label={`Cost for ${name}`}
                value={c.screenSpCost}
                onChange={(e) => setCost(c.skillId, Number(e.target.value))}
              />
              <button type="button" className="sp-candidate-remove" aria-label={`Remove ${name}`} onClick={() => removeCandidate(c.skillId)}>✕</button>
            </li>
          );
        })}
      </ul>

      <button type="button" className="sp-analyze" onClick={analyze} disabled={candidates.length === 0}>
        Analyze
      </button>
    </div>
  );
}
