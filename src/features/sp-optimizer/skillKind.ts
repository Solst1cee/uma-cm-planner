/**
 * Module 2 Type-chip helper. Classifies a skill's dominant engine effect into
 * a short category label ("speed"/"accel"/"recover"/"stat"/…), refined to
 * "corner"/"straight"/"position" when the activation condition names a
 * course-position gate. `skillKind` is pure; `useSkillKinds` lazy-loads the
 * engine technical details for a set of skill ids and memoizes the result.
 */
import { useEffect, useMemo, useState } from 'react';
import { describeEffect, type EffectTone } from '@/features/cm-planner/skillTechFormat';
import {
  loadSkillTechnicalDetail,
  type SkillTechnicalDetail,
} from '@/features/cm-planner/skillTechnicalDetails';

export interface SkillKind {
  label: string;
  tone: EffectTone;
}

const TONE_LABEL: Partial<Record<EffectTone, string>> = {
  'target-speed': 'speed',
  'current-speed': 'speed',
  acceleration: 'accel',
  recovery: 'recover',
  stat: 'stat',
  movement: 'position',
  duration: 'duration',
  start: 'start',
  debuff: 'debuff',
};

/**
 * Dominant effect → short category label + tone; refined by the condition
 * string (course-position gates win over the raw effect-type label).
 *
 * Adaptation note (Task 3 brief): `SkillTechnicalDetail` carries no top-level
 * `conditions` field — the condition string lives at `summary.conditions`
 * (a `SkillSummary` field, already `@`-joined across alternatives by
 * `rawToSummary`/`skillRecordToSummary`). Callers pass `detail.summary.conditions`
 * (or a `SkillRecord.conditions` they already have) as the second argument;
 * `skillKind` itself stays detail-shape-agnostic and just takes a string.
 */
export function skillKind(detail: SkillTechnicalDetail | undefined, conditions?: string): SkillKind {
  const effects = detail?.alternatives?.[0]?.effects ?? [];
  // Pick the first effect that produces a positive, non-neutral display.
  const primary = effects.map((e) => describeEffect(e)).find((d) => d && d.tone !== 'special') ?? null;
  let tone: EffectTone = primary?.tone ?? 'special';
  let label = TONE_LABEL[tone] ?? 'skill';

  const cond = conditions ?? '';
  if (/corner/.test(cond)) {
    label = 'corner';
    tone = 'movement';
  } else if (/straight/.test(cond)) {
    label = 'straight';
    tone = 'movement';
  } else if (/order|blocked|infront|behind/.test(cond)) {
    label = 'position';
    tone = 'movement';
  }
  return { label, tone };
}

/** Lazy-load technical details for a set of skill ids → their kinds (missing ids omitted). */
export function useSkillKinds(skillIds: string[]): Map<string, SkillKind> {
  const key = useMemo(() => [...new Set(skillIds)].sort().join(','), [skillIds]);
  const [kinds, setKinds] = useState<Map<string, SkillKind>>(new Map());
  useEffect(() => {
    let live = true;
    const ids = key ? key.split(',') : [];
    void Promise.all(ids.map(async (id) => [id, await loadSkillTechnicalDetail(id)] as const)).then((pairs) => {
      if (!live) return;
      const m = new Map<string, SkillKind>();
      for (const [id, detail] of pairs) {
        if (detail) m.set(id, skillKind(detail, detail.summary.conditions));
      }
      setKinds(m);
    });
    return () => {
      live = false;
    };
  }, [key]);
  return kinds;
}
