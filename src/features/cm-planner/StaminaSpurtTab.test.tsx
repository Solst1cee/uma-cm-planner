import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { VacuumResult } from '@/sim';
import type { VacuumOpts } from '@/sim/types';
import type { StaminaSpurtDeps } from './StaminaSpurtTab';
import { StaminaSpurtTab } from './StaminaSpurtTab';

// GameIcon pulls the game-data context (and would throw without a provider) — stub it,
// the debuff icons are decorative beside their visible labels.
vi.mock('@/features/data/GameIcon', () => ({ GameIcon: () => null }));

afterEach(cleanup);

// ---------------------------------------------------------------------------
// Fixture plan
// ---------------------------------------------------------------------------
const plan = {
  id: 'p',
  name: 'p',
  planNumber: 1,
  cmRef: {
    kind: 'cm' as const,
    cmId: 'CM15' as const,
    cmNumber: 15,
    courseId: '10906',
    surface: 'turf' as const,
    distance: 2200,
  },
  umaId: '100101',
  uniqueSkillId: 'u',
  role: 'ace' as const,
  strategy: 'front' as const,
  statProfile: {
    stats: { spd: 1200, sta: 700, pow: 900, gut: 400, wit: 600 },
    mood: 0 as const,
  },
  sparkGoals: { pink: [], blue: {} },
  wishlist: [],
  parents: {},
  patch: { version: 't' },
  server: 'global' as const,
  dataVersion: 't',
};

// ---------------------------------------------------------------------------
// Fake vacuum dep: aFullSpurtRate = clamp((sta - 400 + downhillBonus) / 600, 0, 1)
// downhill saving lowers the stamina need by 60 (so the downhill RANGE is exercised).
// This gives a monotonic function so requiredStaminaForSpurt binary search works.
// no downhill: sta=970 → 95% (threshold) ; sta=700 → 50%
// downhill:    sta=910 → 95%  (60 less stamina needed)
// ---------------------------------------------------------------------------
function makeFakeResult(sta: number, opts?: VacuumOpts, aFinalHp?: number[]): VacuumResult {
  const bonus = opts?.downhill ? 60 : 0;
  const aFullSpurtRate = Math.min(1, Math.max(0, (sta - 400 + bonus) / 600));
  return {
    mean: 0, median: 0, min: 0, max: 0, nsamples: 2, results: [],
    aFirstPlaceRate: 0.5, bFirstPlaceRate: 0.5,
    aStaminaSurvival: aFullSpurtRate,
    bStaminaSurvival: aFullSpurtRate,
    aFullSpurtRate,
    bFullSpurtRate: aFullSpurtRate,
    aFinalHp: aFinalHp ?? [], bFinalHp: [],
  };
}

/** Build a fake vacuum that records opts from the FIRST call (the current-stats check),
 *  not subsequent binary-search calls. The binary-search calls use different sta values
 *  and may overwrite with different opts. */
function makeDepsWithCapture(): { deps: StaminaSpurtDeps; captured: { firstOpts?: VacuumOpts } } {
  const captured: { firstOpts?: VacuumOpts } = {};
  let callCount = 0;
  const vacuum: StaminaSpurtDeps['vacuum'] = (build, _b, _race, _n, _seed, opts) => {
    callCount++;
    if (callCount === 1) captured.firstOpts = opts; // main `cur` call
    return Promise.resolve(makeFakeResult(build.stats.sta, opts));
  };
  return { deps: { vacuum, nsamples: 2 }, captured };
}

function makeDeps(): StaminaSpurtDeps {
  return {
    vacuum: (build, _b, _race, _n, _seed, opts) => Promise.resolve(makeFakeResult(build.stats.sta, opts)),
    nsamples: 2,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('StaminaSpurtTab', () => {
  it('does not run on mount (run-on-demand)', () => {
    const vacuumSpy = vi.fn().mockResolvedValue(makeFakeResult(700));
    render(<StaminaSpurtTab plan={plan} deps={{ vacuum: vacuumSpy, nsamples: 2 }} />);
    // dep must not have been called before the user clicks Run
    expect(vacuumSpy).not.toHaveBeenCalled();
  });

  it('shows a "Changed detected" prompt when an input changes after a run', async () => {
    render(<StaminaSpurtTab plan={plan} deps={makeDeps()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Run' }));
    await waitFor(() => {
      expect(screen.getByText('Spurt rate')).toBeInTheDocument();
    }, { timeout: 5000 });

    // Fresh run — no stale prompt yet.
    expect(screen.queryByText(/Changed detected/i)).not.toBeInTheDocument();

    // Editing a target threshold makes the displayed result stale.
    fireEvent.change(screen.getByLabelText(/full spurt rate/i), { target: { value: '90' } });
    expect(screen.getByText(/Changed detected/i)).toBeInTheDocument();
  });

  it('marks results stale and rebuilds when aptitude targets change', async () => {
    const seenDistanceGrades: string[] = [];
    const deps: StaminaSpurtDeps = {
      vacuum: (build, _b, _race, _n, _seed, opts) => {
        seenDistanceGrades.push(build.aptitudes.distance);
        return Promise.resolve(makeFakeResult(build.stats.sta, opts));
      },
      nsamples: 2,
    };
    const { rerender } = render(<StaminaSpurtTab plan={plan} deps={deps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Run' }));
    await waitFor(() => {
      expect(screen.getByText('Spurt rate')).toBeInTheDocument();
    }, { timeout: 5000 });
    expect(seenDistanceGrades).toContain('S');

    const updatedPlan = {
      ...plan,
      sparkGoals: {
        ...plan.sparkGoals,
        pink: [{ aptKey: { kind: 'distance' as const, key: 'medium' as const }, target: 'B' as const }],
      },
    };
    rerender(<StaminaSpurtTab plan={updatedPlan} deps={deps} />);

    expect(screen.getByText(/Changed detected/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Re-run' }));
    await waitFor(() => expect(seenDistanceGrades).toContain('B'), { timeout: 5000 });
  });

  it('Run reports spurt rate and required stamina', async () => {
    render(<StaminaSpurtTab plan={plan} deps={makeDeps()} />);

    // Spurt rate should not be visible before Run
    expect(screen.queryByText('Spurt rate')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Run' }));

    // Wait for results to render
    await waitFor(() => {
      expect(screen.getByText('Spurt rate')).toBeInTheDocument();
    }, { timeout: 5000 });

    // sta=700 → spurtRate = (700-400)/600*100 ≈ 50%
    // Both "Spurt rate" and "Stamina survival" may show 50%; use getAllByText
    expect(screen.getAllByText(/50%/).length).toBeGreaterThanOrEqual(1);

    // Two "Stamina needed" lines now appear (full spurt + survival).
    expect(screen.getAllByText(/Stamina needed/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/Stamina needed for 95% full spurt rate/i)).toBeInTheDocument();
    expect(screen.getByText(/Stamina needed for 95% stamina survival/i)).toBeInTheDocument();

    // sta needed for 95% = 400 + 0.95*600 = 970 (appears in headlines + breakdown)
    expect(screen.getAllByText(/970/).length).toBeGreaterThanOrEqual(1);

    // The breakdown lists base + the downhill-saving range; no debuff row when 0 debuffs.
    expect(screen.getByText(/Base \(no downhill\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Downhill saving/i)).toBeInTheDocument();
    expect(screen.queryByText(/^Debuffs/i)).not.toBeInTheDocument();

    // Downhill saving is shown as a RANGE: with-downhill 910 .. no-downhill 970.
    expect(screen.getByText('910–970')).toBeInTheDocument();
  });

  it('full-spurt target input changes the required-stamina target', async () => {
    render(<StaminaSpurtTab plan={plan} deps={makeDeps()} />);

    // Set the full-spurt target to 90%
    const thresholdInput = screen.getByLabelText(/full spurt rate/i);
    fireEvent.change(thresholdInput, { target: { value: '90' } });

    fireEvent.click(screen.getByRole('button', { name: 'Run' }));

    // Wait for results with the 90% full-spurt header
    await waitFor(() => {
      expect(screen.getByText(/Stamina needed for 90% full spurt rate/i)).toBeInTheDocument();
    }, { timeout: 5000 });

    // sta needed for 90% = 400 + 0.9*600 = 940 (appears in headline + breakdown)
    expect(screen.getAllByText(/940/).length).toBeGreaterThanOrEqual(1);

    // Re-run at 50% target — sta needed = lo (since current sta=700 already gives 50%)
    fireEvent.change(thresholdInput, { target: { value: '50' } });
    fireEvent.click(screen.getByRole('button', { name: 'Re-run' }));

    await waitFor(() => {
      expect(screen.getByText(/Stamina needed for 50% full spurt rate/i)).toBeInTheDocument();
    }, { timeout: 5000 });

    // sta=100 (lo bound) already gives 0% < 50%, sta=700 gives 50% >= 50%
    // binary search should find sta=700 or less
    // Actually sta=700 gives exactly 50% so binary search might land at or near 700
  });

  it('current readout is conservative (no downhill) and downhill is not a toggle', async () => {
    const { deps, captured } = makeDepsWithCapture();
    render(<StaminaSpurtTab plan={plan} deps={deps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Run' }));

    await waitFor(() => {
      expect(screen.getByText('Spurt rate')).toBeInTheDocument();
    }, { timeout: 5000 });

    // The current readout (first vacuum call) does NOT bank on downhill RNG — downhill
    // shows up only as a breakdown range, never as a toggle.
    expect(captured.firstOpts?.downhill).toBeFalsy();
    expect(screen.queryByRole('checkbox', { name: /downhill/i })).not.toBeInTheDocument();
  });

  it('debuff inputs inject debuffs into the first vacuum call opts', async () => {
    const { deps, captured } = makeDepsWithCapture();
    render(<StaminaSpurtTab plan={plan} deps={deps} />);

    // Set 2 white debuffs
    const whiteInput = screen.getByLabelText(/Expected white stamina debuffs/i);
    fireEvent.change(whiteInput, { target: { value: '2' } });

    // Set 1 gold debuff
    const goldInput = screen.getByLabelText(/Expected gold stamina debuffs/i);
    fireEvent.change(goldInput, { target: { value: '1' } });

    fireEvent.click(screen.getByRole('button', { name: 'Run' }));

    await waitFor(() => {
      expect(screen.getByText('Spurt rate')).toBeInTheDocument();
    }, { timeout: 5000 });

    // First call opts should have injectedDebuffs with 3 entries (2 white + 1 gold)
    expect(captured.firstOpts?.injectedDebuffs?.uma1).toHaveLength(3);
  });

  it('shows speed guard when plan speed is 0', () => {
    const zeroPlan = {
      ...plan,
      statProfile: { ...plan.statProfile, stats: { ...plan.statProfile.stats, spd: 0 } },
    };
    render(<StaminaSpurtTab plan={zeroPlan} deps={makeDeps()} />);
    expect(screen.getByText(/set a speed stat/i)).toBeInTheDocument();
    // Run button should not be visible (guard kicks in)
    expect(screen.queryByRole('button', { name: /run/i })).not.toBeInTheDocument();
  });

  it('renders finish-HP histogram with bars after Run when aFinalHp is non-empty', async () => {
    // Provide a fake vacuum that returns 30 HP samples spread across 0..800
    const fakeHp = Array.from({ length: 30 }, (_, i) => i * 27); // 0..783
    const deps: StaminaSpurtDeps = {
      vacuum: (build, _b, _race, _n, _seed, opts) =>
        Promise.resolve(makeFakeResult(build.stats.sta, opts, fakeHp)),
      nsamples: 2,
    };
    render(<StaminaSpurtTab plan={plan} deps={deps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Run' }));

    // Wait for the histogram section to appear
    await waitFor(() => {
      expect(screen.getByLabelText(/histogram of finish HP/i)).toBeInTheDocument();
    }, { timeout: 5000 });

    // The histogram SVG should contain rect bars
    const svg = screen.getByLabelText(/histogram of finish HP/i);
    const bars = svg.querySelectorAll('rect');
    expect(bars.length).toBeGreaterThan(0);

    // Per-target finish-HP stats lines should be present (full spurt + survival).
    expect(screen.getAllByText(/min.*median.*max/i).length).toBeGreaterThanOrEqual(1);
  });
});
