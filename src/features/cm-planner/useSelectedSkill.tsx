/**
 * Cross-panel "which skill is highlighted" state for the §0 track + skill chart.
 * This is TRANSIENT UI state — it is NOT persisted to the CmPlan (distinct from
 * the wishlist). Selecting a skill row highlights its band on the track and
 * vice-versa.
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

interface SelectedSkillValue {
  selectedSkillId: string | null;
  setSelectedSkillId: (id: string | null) => void;
}

const SelectedSkillContext = createContext<SelectedSkillValue | null>(null);

export function SelectedSkillProvider({ children }: { children: ReactNode }) {
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const value = useMemo(() => ({ selectedSkillId, setSelectedSkillId }), [selectedSkillId]);
  return <SelectedSkillContext.Provider value={value}>{children}</SelectedSkillContext.Provider>;
}

export function useSelectedSkill(): SelectedSkillValue {
  const ctx = useContext(SelectedSkillContext);
  if (!ctx) throw new Error('useSelectedSkill must be used within a SelectedSkillProvider');
  return ctx;
}
