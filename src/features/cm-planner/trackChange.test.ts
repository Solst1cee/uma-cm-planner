import { describe, expect, it } from 'vitest';
import type { CmRefV2 } from '@/core/types';
import { tracksDiffer, trackChangeNeedsConfirm } from './trackChange';

const cm = (courseId: string): CmRefV2 =>
  ({ kind: 'cm', cmId: 'CM15', cmNumber: 15, courseId, surface: 'turf', distance: 2200 } as unknown as CmRefV2);

describe('tracksDiffer', () => {
  it('is false for equal courseIds', () => {
    expect(tracksDiffer(cm('10906'), cm('10906'))).toBe(false);
  });
  it('is true for different courseIds', () => {
    expect(tracksDiffer(cm('10906'), cm('10501'))).toBe(true);
  });
});

describe('trackChangeNeedsConfirm', () => {
  it('confirms when auto-apply on, prior track exists, and the course changes', () => {
    expect(trackChangeNeedsConfirm({ autoApply: true, hadPriorTrack: true, prevCourseId: '10906', nextCourseId: '10501' })).toBe(true);
  });
  it('does not confirm when the course is unchanged', () => {
    expect(trackChangeNeedsConfirm({ autoApply: true, hadPriorTrack: true, prevCourseId: '10906', nextCourseId: '10906' })).toBe(false);
  });
  it('does not confirm when auto-apply is off', () => {
    expect(trackChangeNeedsConfirm({ autoApply: false, hadPriorTrack: true, prevCourseId: '10906', nextCourseId: '10501' })).toBe(false);
  });
  it('does not confirm on the first load (no prior track)', () => {
    expect(trackChangeNeedsConfirm({ autoApply: true, hadPriorTrack: false, prevCourseId: '10906', nextCourseId: '10501' })).toBe(false);
  });
});
