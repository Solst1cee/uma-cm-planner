import { expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { RaceOverlay } from './RaceOverlay';
import type { RaceCompareRun } from '@/sim';

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
});

it('omits hp lines when showHp is false', () => {
  const { container } = render(<svg><RaceOverlay run={run} distance={1200} showHp={false} skillName={(id) => id} /></svg>);
  expect(container.querySelectorAll('.ro-hp').length).toBe(0);
});
