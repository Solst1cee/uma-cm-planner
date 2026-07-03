import { describe, it, expect } from 'vitest';
import type { JpSchedule } from './types';
import schedule from '../../data-overrides/jp-schedule.json';

const jp = schedule as unknown as JpSchedule;

describe('jp-schedule.json', () => {
  it('parses as a JpSchedule with sorted CM rows and ISO dates', () => {
    expect(Array.isArray(jp.cms)).toBe(true);
    const nums = jp.cms.map((c) => c.cmNumber);
    expect(nums).toEqual([...nums].sort((a, b) => a - b)); // sorted, no dupes handled below
    expect(new Set(nums).size).toBe(nums.length);
    for (const c of jp.cms) {
      expect(c.jpDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(c.cupName.length).toBeGreaterThan(0);
    }
  });

  it('carries the CM10-15 JP dates used by the pace self-validation', () => {
    const byNum = new Map(jp.cms.map((c) => [c.cmNumber, c.jpDate]));
    expect(byNum.get(10)).toBe('2022-02-18');
    expect(byNum.get(11)).toBe('2022-03-22');
    expect(byNum.get(12)).toBe('2022-04-22');
    expect(byNum.get(13)).toBe('2022-05-24');
    expect(byNum.get(14)).toBe('2022-06-14');
    expect(byNum.get(15)).toBe('2022-07-14');
  });
});
