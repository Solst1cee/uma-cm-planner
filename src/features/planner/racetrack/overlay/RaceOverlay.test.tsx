import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { RaceOverlay, placeRungs } from './RaceOverlay';
import type { RaceCompareRun, RaceActivation } from '@/sim';

const run: RaceCompareRun = {
  uma1Frames: [{ t: 0, pos: 0, v: 18, hp: 100 }, { t: 1, pos: 600, v: 20, hp: 60 }, { t: 2, pos: 1200, v: 16, hp: 10 }],
  uma2Frames: [{ t: 0, pos: 0, v: 17, hp: 100 }, { t: 1, pos: 580, v: 19, hp: 65 }, { t: 2, pos: 1180, v: 15, hp: 20 }],
  uma1Acts: [{ skillId: 'S1', start: 600, end: 650 }],   // duration → zone
  uma2Acts: [{ skillId: 'S2', start: 300, end: 300 }],   // instant → marker
  gap: [{ pos: 0, bashin: 0 }, { pos: 600, bashin: 1.2 }, { pos: 1200, bashin: -0.4 }],
};

it('renders both velocity lines, hp lines (when showHp), markers and gap', () => {
  const { container } = render(
    <svg><RaceOverlay run={run} distance={1200} showHp skillName={(id) => id} /></svg>,
  );
  expect(container.querySelectorAll('.ro-velo.is-uma1, .ro-velo.is-uma2').length).toBe(2);
  expect(container.querySelectorAll('.ro-hp').length).toBe(2);
  expect(container.querySelector('.ro-zone')).toBeTruthy();   // S1 duration
  expect(container.querySelector('.ro-marker')).toBeTruthy(); // S2 instant
  expect(container.querySelector('.ro-gap')).toBeTruthy();
  // each activation is labelled with its skill name
  const labels = Array.from(container.querySelectorAll('.ro-mark-label')).map((n) => n.textContent);
  expect(labels).toEqual(expect.arrayContaining(['S1', 'S2']));
});

it('omits hp lines when showHp is false', () => {
  const { container } = render(<svg><RaceOverlay run={run} distance={1200} showHp={false} skillName={(id) => id} /></svg>);
  expect(container.querySelectorAll('.ro-hp').length).toBe(0);
});

describe('placeRungs (greedy rung-stacking)', () => {
  const id = (s: string) => s;                 // skillId is the label
  const act = (skillId: string, start: number, end: number): RaceActivation => ({ skillId, start, end });
  // distance === boxW → metersPerUnit = 1, so meter intervals map 1:1 to layout units.

  it('stacks two overlapping duration bars onto separate rungs', () => {
    const { placed, rungs } = placeRungs([act('S1', 600, 650), act('S2', 640, 690)], 1200, 1200, id);
    expect(rungs).toBe(2);
    expect(placed[0]!.rung).toBe(0);   // sorted by start: S1 first
    expect(placed[1]!.rung).toBe(1);   // overlaps S1 → bumped up a rung
  });

  it('keeps two far-apart activations on the same rung', () => {
    const { placed, rungs } = placeRungs([act('S1', 200, 250), act('S2', 900, 950)], 1200, 1200, id);
    expect(rungs).toBe(1);
    expect(placed[0]!.rung).toBe(0);
    expect(placed[1]!.rung).toBe(0);
  });

  it("stacks two near long-named INSTANT markers — proves the label extent (not just bar width) is honored", () => {
    // Instant markers have ~0 bar width; they only collide because labelMeters reserves horizontal space.
    const longName = () => 'x'.repeat(20);
    const { rungs } = placeRungs([act('A', 600, 600), act('B', 610, 610)], 1200, 1200, longName);
    expect(rungs).toBe(2);
  });

  it('returns nothing for a non-positive distance', () => {
    expect(placeRungs([act('S1', 600, 650)], 0, 1200, id)).toEqual({ placed: [], rungs: 0 });
  });
});
