import { describe, expect, it } from 'vitest';
import { skillKind } from '@/features/sp-optimizer/skillKind';
import type { SkillTechnicalDetail } from '@/features/cm-planner/skillTechnicalDetails';

const detail = (type: number): SkillTechnicalDetail =>
  ({ alternatives: [{ effects: [{ type, modifier: 10000 }] }] } as unknown as SkillTechnicalDetail);

describe('skillKind', () => {
  it('labels an acceleration effect', () => {
    expect(skillKind(detail(31)).label).toBe('accel');
  });
  it('labels a recovery effect', () => {
    expect(skillKind(detail(9)).label).toBe('recover');
  });
  it('refines a speed effect on a corner condition to "corner"', () => {
    expect(skillKind(detail(27), 'corner==1').label).toBe('corner');
  });
  it('returns a neutral fallback for empty detail', () => {
    expect(skillKind(undefined).label).toBe('skill');
  });
});
