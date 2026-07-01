import { describe, it, expect } from 'vitest';
import { calibratePace, projectGlobalDate, type SharedCm } from './foresight';

// CM10-15: JP start dates (jp-schedule) + real confirmed Global finals.
const SHARED: SharedCm[] = [
  { cmNumber: 10, jp: '2022-02-18', global: '2026-03-06' },
  { cmNumber: 11, jp: '2022-03-22', global: '2026-03-30' },
  { cmNumber: 12, jp: '2022-04-22', global: '2026-04-23' },
  { cmNumber: 13, jp: '2022-05-24', global: '2026-05-14' },
  { cmNumber: 14, jp: '2022-06-14', global: '2026-06-04' },
  { cmNumber: 15, jp: '2022-07-14', global: '2026-06-24' },
];

describe('calibratePace (reproduces GameTora Foresight numbers)', () => {
  it('computes ~1.33x pace and ~1441-day gap over CM10-15', () => {
    const cal = calibratePace(SHARED)!;
    expect(cal).not.toBeNull();
    // JP span 146d / Global span 110d = 1.3273 (GameTora: avg JA 29.2 / avg server 22 = 1.33x)
    expect(cal.pace).toBeCloseTo(1.327, 2);
    expect(cal.gapDays).toBe(1441); // GameTora: "1441.8 days behind JA"
    expect(cal.windowSteps).toBe(5);
    expect(cal.anchorJp).toBe('2022-07-14');
    expect(cal.anchorGlobal).toBe('2026-06-24');
  });

  it('uses only the last `window` shared CMs', () => {
    const cal = calibratePace(SHARED, 3)!; // last 3 = CM13,14,15
    expect(cal.windowSteps).toBe(2);
    expect(cal.anchorGlobal).toBe('2026-06-24');
  });

  it('returns null with fewer than 2 shared CMs', () => {
    expect(calibratePace([])).toBeNull();
    expect(calibratePace([SHARED[0]!])).toBeNull();
  });
});

describe('projectGlobalDate', () => {
  it('projects the next JP CM onto the compressed Global timeline', () => {
    const cal = calibratePace(SHARED)!;
    // CM16 Leo JP 2022-08-13 = anchor + 30d; /1.3273 = 22.6d after 2026-06-24 = 2026-07-16
    expect(projectGlobalDate('2022-08-13', cal)).toBe('2026-07-16');
  });

  it('round-trips the anchor CM to ~its real Global date', () => {
    const cal = calibratePace(SHARED)!;
    expect(projectGlobalDate('2022-07-14', cal)).toBe('2026-06-24');
  });
});
