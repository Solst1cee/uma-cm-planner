import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SpOptimizerPage } from '@/features/sp-optimizer/SpOptimizerPage';

const mockGameDataStatus = vi.hoisted(() => ({ status: 'ready' as 'ready' | 'fixture' | 'loading' }));

vi.mock('@/features/data/gameData', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/data/gameData')>();
  const { fixtureGameData } = await import('@/features/testing/fixtureGameData');
  return { ...actual, useGameData: () => ({ ...fixtureGameData(), status: mockGameDataStatus.status }) };
});

vi.mock('@/db', () => ({
  listCaptures: vi.fn(async () => []),
  saveCapture: vi.fn(async (d: { label: string; bundle: unknown }) => ({ id: 'id1', ...d })),
  deleteCapture: vi.fn(async () => undefined),
}));

// The page runs the ASYNC main-thread seam (rankBasketsWithEngine), which in
// production awaits the wasm engine init before ranking. jsdom has no wasm, so
// mock the seam to resolve immediately — no engine touched (keeps the jsdom
// test green without real wasm; see rankBaskets.init.test.ts for the real-seam
// init guard).
vi.mock('@/features/sp-optimizer/rankBaskets', () => ({
  rankBasketsWithEngine: vi.fn(() =>
    Promise.resolve({
      mode: 'exact',
      baskets: [{ skills: ['200332'], score: 1, spUsed: 110, spLeft: 0, descriptor: 'd' }],
      candidates: [{ skillId: '200332', rarity: 'white', deltaL: 1, screenSpCost: 110, lPerSp: 9, pinned: false }],
      greedyScore: 0,
    }),
  ),
}));

const activePlan = {
  id: 'plan-active', name: 'Active plan', planNumber: 1,
  umaId: '100101', strategy: 'pace',
  statProfile: { stats: { spd: 1100, sta: 700, pow: 900, gut: 400, wit: 650 }, mood: 2 },
  cmRef: { courseId: '10906' },
  wishlist: [{ skillId: '200332', priority: 1, source: 'targeted' }],
};
const savedPlan = {
  id: 'plan-saved', name: 'Saved plan', planNumber: 2,
  umaId: '100101', strategy: 'late',
  statProfile: { stats: { spd: 900, sta: 800, pow: 700, gut: 300, wit: 500 }, mood: 0 },
  cmRef: { courseId: '10906' },
  wishlist: [
    { skillId: '200332', priority: 1, source: 'targeted' }, // on the carried screen → locks
    { skillId: '200012', priority: 1, source: 'targeted' }, // not on screen → not yet buyable
  ],
};

vi.mock('@/app/ActivePlanContext', () => ({
  useActivePlan: () => ({
    plan: activePlan,
    savedPlans: [activePlan, savedPlan],
    deleteSavedPlan: vi.fn(), deleteAllSavedPlans: vi.fn(), importSavedPlans: vi.fn(),
    setPlan: vi.fn(), flushPendingSave: vi.fn(), loadError: null,
  }),
}));

// The shared inventory card pulls the lazy course catalog (engine chunk) on
// mount — stub it to a single pick button; the M2 test only cares about the
// popover wiring + the seed-from-picked-plan handler.
vi.mock('@/features/cm-planner/PlanInventoryCard', () => ({
  PlanInventoryCard: (props: { onLoadPlanIntoSlot: (id: string, slot: 'uma1' | 'uma2') => void }) => (
    <button type="button" onClick={() => props.onLoadPlanIntoSlot('plan-saved', 'uma1')}>pick plan-saved</button>
  ),
}));

beforeEach(() => {
  mockGameDataStatus.status = 'ready' as const;
});

afterEach(cleanup);

describe('SpOptimizerPage', () => {
  it('seeds the form from the M4 wishlist and can Analyze', async () => {
    const user = userEvent.setup();
    render(<SpOptimizerPage />);

    await user.click(screen.getByRole('button', { name: /Carry from M4/i }));
    await user.click(screen.getByRole('button', { name: 'Analyze' }));
    // analyze() is async now (awaits the main-thread engine-init seam), so the
    // results render on a later tick — findBy waits for it.
    expect(await screen.findByText('Suggested baskets')).toBeInTheDocument();
  });

  it('imports a raw career capture and preserves its SP and discounted cost', async () => {
    const user = userEvent.setup();
    render(<SpOptimizerPage />);
    const raw = {
      capturedAt: '2026-07-10T12:00:00', spBudget: 777,
      stats: { spd: 1000, sta: 800, pow: 700, gut: 400, wit: 900 },
      aptitudes: {
        surface: { turf: 'A', dirt: 'G' }, distance: { short: 'G', mile: 'A', middle: 'S', long: 'B' },
        style: { front: 'G', pace: 'A', late: 'S', end: 'B' },
      },
      strategy: 'late',
      skills: [{ skillId: 200012, isAcquired: 0, needPoint: 71, hintLv: 4 }],
    };
    const json = JSON.stringify(raw);
    const file = new File([json], 'career-capture.json', { type: 'application/json' });
    Object.defineProperty(file, 'text', { value: vi.fn(async () => json) });

    await user.upload(screen.getByLabelText(/Import capture/i), file);

    expect(await screen.findByDisplayValue('777')).toBeInTheDocument();
    expect(screen.getByLabelText('Available SP')).toHaveValue(777);
    // Cost is read-only text now; the captured hint level shows on the stepper.
    expect(screen.getByText('71')).toBeInTheDocument();
    expect(screen.getByText('Lv 4')).toBeInTheDocument();
  });

  it('shows the two tabs and the F2 placeholder on the compare tab', async () => {
    const user = userEvent.setup();
    render(<SpOptimizerPage />);
    await user.click(screen.getByRole('tab', { name: /Compare vs veteran/i }));
    expect(screen.getByText(/coming in F2/i)).toBeInTheDocument();
  });

  it('marks the result stale after a pin and clears it on Re-analyze', async () => {
    const user = userEvent.setup();
    render(<SpOptimizerPage />);
    await user.click(screen.getByRole('button', { name: /Carry from M4/i }));
    await user.click(screen.getByRole('button', { name: /^Analyze$|Re-analyze/i }));
    await screen.findByText('Suggested baskets');
    await user.click(screen.getByRole('button', { name: /Lock 200332/i }));
    expect(screen.getByText(/changes detected/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Re-analyze/i }));
    await screen.findByText('Suggested baskets');
    expect(screen.queryByText(/changes detected/i)).not.toBeInTheDocument();
  });

  it('keeps the hint stepper live after analysis — stepping reprices the cost and marks stale', async () => {
    const user = userEvent.setup();
    render(<SpOptimizerPage />);
    await user.click(screen.getByRole('button', { name: /Carry from M4/i }));
    await user.click(screen.getByRole('button', { name: 'Analyze' }));
    await screen.findByText('Suggested baskets');

    // Carried 200332 starts at base 110, hint 0 (banner also shows 110 — scope to the cell).
    const costCell = () => screen.getByRole('button', { name: 'Hint up for 200332' }).closest('td')!;
    expect(costCell().querySelector('.sp-cost-value')).toHaveTextContent('110');
    await user.click(screen.getByRole('button', { name: 'Hint up for 200332' }));

    // Lv1 = −10% → ceil(110 × 0.9) = 99, live before Re-analyze.
    expect(costCell().querySelector('.sp-cost-value')).toHaveTextContent('99');
    expect(screen.getByText('Lv 1')).toBeInTheDocument();
    expect(screen.getByText(/changes detected/i)).toBeInTheDocument();
  });

  it('red projection accent appears when the hint diverges from the capture and clears when stepped back', async () => {
    const user = userEvent.setup();
    render(<SpOptimizerPage />);
    await user.click(screen.getByRole('button', { name: /Carry from M4/i }));

    const costCell = () => screen.getByRole('button', { name: 'Hint up for 200332' }).closest('td')!;
    expect(costCell()).not.toHaveClass('is-edited');

    await user.click(screen.getByRole('button', { name: 'Hint up for 200332' }));
    expect(costCell()).toHaveClass('is-edited');

    await user.click(screen.getByRole('button', { name: 'Hint down for 200332' }));
    expect(costCell()).not.toHaveClass('is-edited'); // back at the captured level
  });

  it('Fast Learner toggle reprices rows from base and marks stale', async () => {
    const user = userEvent.setup();
    render(<SpOptimizerPage />);
    await user.click(screen.getByRole('button', { name: /Carry from M4/i }));
    await user.click(screen.getByRole('button', { name: 'Analyze' }));
    await screen.findByText('Suggested baskets');

    await user.click(screen.getByLabelText('Fast Learner'));
    // 110 base @ hint 0 with FL −10% → 99.
    const cell = screen.getByRole('button', { name: 'Hint up for 200332' }).closest('td')!;
    expect(cell.querySelector('.sp-cost-value')).toHaveTextContent('99');
    expect(screen.getByText(/changes detected/i)).toBeInTheDocument();
  });

  it('cycling the lock cell twice excludes the skill from re-analysis but keeps its row', async () => {
    const { rankBasketsWithEngine } = await import('@/features/sp-optimizer/rankBaskets');
    const user = userEvent.setup();
    render(<SpOptimizerPage />);
    await user.click(screen.getByRole('button', { name: /Carry from M4/i }));
    await user.click(screen.getByRole('button', { name: 'Analyze' }));
    await screen.findByText('Suggested baskets');

    const lockBtn = screen.getByRole('button', { name: /Lock 200332/i });
    await user.click(lockBtn); // → pinned
    await user.click(lockBtn); // → excluded
    expect(lockBtn).toHaveTextContent('✕');
    expect(lockBtn.closest('tr')).toHaveClass('is-excluded');
    expect(screen.getByText(/changes detected/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Re-analyze/i }));
    const lastCall = vi.mocked(rankBasketsWithEngine).mock.calls.at(-1)!;
    const analyzedBundle = lastCall[0] as { context: { candidates: { skillId: string }[]; pinned: string[] } };
    expect(analyzedBundle.context.candidates.map((c) => c.skillId)).not.toContain('200332');
    expect(analyzedBundle.context.pinned).not.toContain('200332');
  });

  it('Load uma plan is disabled until a build exists, then a pick prefills locks WITHOUT touching the capture', async () => {
    const user = userEvent.setup();
    render(<SpOptimizerPage />);
    const loadBtn = screen.getByRole('button', { name: /choose…/i });
    expect(loadBtn).toBeDisabled(); // no build yet — nothing to prefill into

    await user.click(screen.getByRole('button', { name: /Carry from M4/i }));
    await user.click(loadBtn);
    await user.click(screen.getByText('pick plan-saved'));

    // Capture interface untouched: the carried build's stats + SP stay.
    expect(screen.getByText(/SPD 1100/)).toBeInTheDocument();
    expect(screen.getByLabelText('Available SP')).toHaveValue(1200);
    // The matching wishlist skill is now locked; the off-screen one is reported.
    expect(screen.getByRole('button', { name: /Lock 200332/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/1 matched/)).toBeInTheDocument();
    expect(screen.getByText(/1 not yet buyable/)).toBeInTheDocument();
    // Button shows the loaded plan's name; popover closed.
    expect(screen.getByRole('button', { name: /Saved plan/i })).toBeInTheDocument();
    expect(screen.queryByText('pick plan-saved')).not.toBeInTheDocument();
  });

  it('Carry from M4 seeds from the active plan\'s target stats (not hardcoded defaults)', async () => {
    const user = userEvent.setup();
    render(<SpOptimizerPage />);
    await user.click(screen.getByRole('button', { name: /Carry from M4/i }));
    expect(screen.getByText(/SPD 1100/)).toBeInTheDocument();
  });

  it('"How this simulation works" help popup opens from the caveat line', async () => {
    const user = userEvent.setup();
    render(<SpOptimizerPage />);
    expect(screen.queryByRole('dialog', { name: /How this simulation works/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /How this simulation works/i }));
    const pop = screen.getByRole('dialog', { name: /How this simulation works/i });
    expect(pop).toHaveTextContent(/200 solo races/);
    expect(pop).toHaveTextContent(/No opponents in the sim/);
    expect(pop).toHaveTextContent(/Noise floor/);
  });

  it('shows fixture-data alert when status is fixture', () => {
    mockGameDataStatus.status = 'fixture' as const;
    render(<SpOptimizerPage />);
    expect(screen.getByText(/placeholder data.*illustrative/i)).toHaveAttribute('role', 'alert');
  });
});
