import { describe, expect, it } from 'vitest';
import { pinkAptitudeRequirement } from '@/core/aptitudeInheritance';

describe('pinkAptitudeRequirement', () => {
  it.each([
    ['B', 'A', 1],
    ['C', 'A', 4],
    ['D', 'A', 7],
    ['E', 'A', 10],
  ] as const)('uses cumulative thresholds for %s -> %s', (base, target, stars) => {
    expect(pinkAptitudeRequirement(base, target)).toMatchObject({
      stars,
      careerStartGrade: target,
      reachesTargetAtCareerStart: true,
      inRunStepsNeeded: 0,
    });
  });

  it('caps career-start inheritance at +4 ranks and reports remaining in-run steps', () => {
    expect(pinkAptitudeRequirement('G', 'A')).toMatchObject({
      stars: 10,
      steps: 4,
      careerStartGrade: 'C',
      reachesTargetAtCareerStart: false,
      inRunStepsNeeded: 2,
    });
  });

  it('treats S as A at career start plus a required in-run step', () => {
    expect(pinkAptitudeRequirement('C', 'S')).toMatchObject({
      stars: 4,
      careerStartGrade: 'A',
      reachesTargetAtCareerStart: false,
      inRunStepsNeeded: 1,
    });
    expect(pinkAptitudeRequirement('A', 'S')).toMatchObject({
      stars: 1,
      steps: 0,
      careerStartGrade: 'A',
      reachesTargetAtCareerStart: false,
      inRunStepsNeeded: 1,
    });
  });

  it('requires no stars when the base already meets the target', () => {
    expect(pinkAptitudeRequirement('A', 'A')).toMatchObject({
      stars: 0,
      careerStartGrade: 'A',
      reachesTargetAtCareerStart: true,
      inRunStepsNeeded: 0,
    });
  });
});
