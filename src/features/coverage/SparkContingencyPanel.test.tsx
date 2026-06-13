/**
 * Contingency view rendering contract: one static branch line per
 * SparkContingency, the proc-branch assumption shown verbatim, and the P3
 * footnote. The math is mocked — computeContingencies is covered by core
 * contingency tests.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { CmPlan, Parent, SparkContingency } from '@/core/types';
import { FIXTURE_PLAN } from '@/core/fixtures';
import { buildCoverageMatrix } from '@/core/coverage';
import { SparkContingencyPanel } from '@/features/coverage/SparkContingencyPanel';

vi.mock('@/features/data/gameData', async () => {
  const { fixtureGameData } = await import('@/features/testing/fixtureGameData');
  return { useGameData: () => fixtureGameData() };
});

const mocked = vi.hoisted(() => ({
  parents: [
    {
      id: 'p1',
      umaId: '100201',
      blueSpark: { stat: 'spd', stars: 3 },
      pinkSpark: { aptitude: 'turf', stars: 3 },
      whiteSparks: [{ skillId: '200332', stars: 3 }],
      source: 'mine',
    },
  ],
  contingencies: [] as unknown[],
}));

vi.mock('@/db', () => ({
  listParents: vi.fn(async () => mocked.parents as unknown as Parent[]),
}));

vi.mock('@/core/coverage', () => ({
  buildCoverageMatrix: vi.fn(() => []),
}));

vi.mock('@/core/contingency', () => ({
  computeContingencies: vi.fn(() => mocked.contingencies as SparkContingency[]),
}));

const CONTINGENCY: SparkContingency = {
  skillId: '200332', // Corner Adept ○ in the fixture skills
  sparkPct: 17.4,
  approximate: true,
  spIfProc: 77,
  spIfProcAssumption:
    'Assumes the spark grants hint Lv 3 — white skill-spark payout distribution unverified (mechanics-notes §10).',
  spIfMiss: 110,
  deltaSp: 33,
};

const PLAN: CmPlan = { ...FIXTURE_PLAN, chosenParents: ['p1', undefined] };

beforeEach(() => {
  mocked.contingencies = [CONTINGENCY];
});

afterEach(cleanup);

describe('SparkContingencyPanel', () => {
  it('renders one branch line per contingency with the assumption and P3 footnote', async () => {
    render(<SparkContingencyPanel plan={PLAN} inventory={[]} />);
    const line = await screen.findByText(
      (_, el) =>
        el?.classList.contains('contingency-line') === true &&
        el.textContent ===
          'Corner Adept ○: spark ≈17% → if procs: 77 SP; if not: 110 SP (+33 SP)',
    );
    expect(line).toBeInTheDocument();
    expect(screen.getByText(CONTINGENCY.spIfProcAssumption)).toBeInTheDocument();
    expect(
      screen.getByText(
        /probability of the spark proccing at least once across both inspiration events — estimation, not a guarantee/,
      ),
    ).toBeInTheDocument();
    // The static-v1 caveat: no SP-budget math until Module 2.
    expect(screen.getByText(/lands with Module 2/)).toBeInTheDocument();
    // The panel fed parents + rates into the coverage build.
    expect(vi.mocked(buildCoverageMatrix)).toHaveBeenCalledWith(
      expect.objectContaining({
        parents: mocked.parents,
        rates: expect.objectContaining({ inspirationEvents: 2 }),
      }),
    );
  });

  it('omits the ≈ prefix for non-approximate spark chances', async () => {
    mocked.contingencies = [{ ...CONTINGENCY, approximate: false }];
    render(<SparkContingencyPanel plan={PLAN} inventory={[]} />);
    expect(
      await screen.findByText(
        (_, el) =>
          el?.classList.contains('contingency-line') === true &&
          el.textContent ===
            'Corner Adept ○: spark 17% → if procs: 77 SP; if not: 110 SP (+33 SP)',
      ),
    ).toBeInTheDocument();
  });

  it('explains when no parents are chosen', () => {
    render(<SparkContingencyPanel plan={FIXTURE_PLAN} inventory={[]} />);
    expect(screen.getByText(/pick parents above/)).toBeInTheDocument();
  });

  it('shows the empty state when no targets are spark-covered', async () => {
    mocked.contingencies = [];
    render(<SparkContingencyPanel plan={PLAN} inventory={[]} />);
    expect(await screen.findByText(/No spark-covered targets/)).toBeInTheDocument();
  });
});
