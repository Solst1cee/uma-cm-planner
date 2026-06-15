import { useState } from 'react';

import type { BuyableSkill, CaptureBundle } from '@/core/spOptimizer';
import type { Stat } from '@/core/types';
import type { Grade } from '@/sim/types';

const DEFAULT_STATS: Record<Stat, number> = { spd: 1000, sta: 800, pow: 800, gut: 400, wit: 600 };

export interface BuildContextFormProps {
  onAnalyze: (bundle: CaptureBundle) => void;
  dataVersion?: string;
  /** Clock injected so the component stays testable/deterministic. */
  now?: () => string;
}

export function BuildContextForm({ onAnalyze, dataVersion = 'global-c1fa2107', now }: BuildContextFormProps) {
  const [spBudget, setSpBudget] = useState(1000);
  const [courseId, setCourseId] = useState('10101');
  const [candidates, setCandidates] = useState<BuyableSkill[]>([]);
  const [draftId, setDraftId] = useState('');
  const [draftCost, setDraftCost] = useState('');

  function addCandidate() {
    if (!draftId.trim()) return;
    setCandidates((prev) => [
      ...prev,
      { skillId: draftId.trim(), rarity: 'white', screenSpCost: Number(draftCost) || 0 },
    ]);
    setDraftId('');
    setDraftCost('');
  }

  function analyze() {
    const bundle: CaptureBundle = {
      schemaVersion: 1,
      source: 'manual',
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
        {candidates.map((c) => (
          <li key={c.skillId}>{c.skillId} — {c.screenSpCost} SP</li>
        ))}
      </ul>

      <button type="button" className="sp-analyze" onClick={analyze}>Analyze</button>
    </div>
  );
}
