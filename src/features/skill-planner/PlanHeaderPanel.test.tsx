/** Plan header: skill search filtering, add, priority cycling, remove. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import type { CmPlan } from '@/core/types';
import { FIXTURE_PLAN } from '@/core/fixtures';
import { PlanHeaderPanel } from '@/features/skill-planner/PlanHeaderPanel';

vi.mock('@/features/data/gameData', async () => {
  const { fixtureGameData } = await import('@/features/testing/fixtureGameData');
  return { useGameData: () => fixtureGameData() };
});

afterEach(cleanup);

function renderPanel(plan: CmPlan = FIXTURE_PLAN) {
  const onChange = vi.fn<(next: CmPlan) => void>();
  render(<PlanHeaderPanel plan={plan} onChange={onChange} />);
  return onChange;
}

describe('PlanHeaderPanel skill search', () => {
  it('filters by EN name, case-insensitively', async () => {
    const user = userEvent.setup();
    renderPanel({ ...FIXTURE_PLAN, wishlist: [] });
    await user.type(screen.getByLabelText('Search skills by name'), 'CORNER');
    expect(screen.getByRole('button', { name: /Corner Adept ○/ })).toBeInTheDocument();
    expect(screen.queryByText('Right Turns ○')).not.toBeInTheDocument();
  });

  it('never offers JP-server skills for a Global plan (P4)', async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.type(screen.getByLabelText('Search skills by name'), 'jp-only');
    expect(screen.queryByText(/JP-Only Example/)).not.toBeInTheDocument();
    expect(screen.getByText('No matching skills.')).toBeInTheDocument();
  });

  it('adds a picked skill at priority 1', async () => {
    const user = userEvent.setup();
    const onChange = renderPanel({ ...FIXTURE_PLAN, wishlist: [] });
    await user.type(screen.getByLabelText('Search skills by name'), 'corner');
    await user.click(screen.getByRole('button', { name: /Corner Adept ○/ }));
    const next = onChange.mock.lastCall?.[0];
    expect(next?.wishlist).toContainEqual(expect.objectContaining({ skillId: '200332', priority: 1 }));
    expect(next?.wishlist).toHaveLength(1);
  });

  it('adds a highlighted result with arrow keys and Enter', async () => {
    const user = userEvent.setup();
    const onChange = renderPanel({ ...FIXTURE_PLAN, wishlist: [] });
    await user.type(screen.getByLabelText('Search skills by name'), 'right turns');
    await user.keyboard('{ArrowDown}{Enter}');

    const next = onChange.mock.lastCall?.[0];
    expect(next?.wishlist).toContainEqual(expect.objectContaining({ skillId: '200014', priority: 1 }));
  });

  it('hides lower variants when a higher target is already selected', async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.type(screen.getByLabelText('Search skills by name'), 'right turns');
    const results = within(screen.getByRole('list', { name: 'Skill search results' }));
    expect(results.queryByRole('button', { name: /Right Turns ◎/ })).not.toBeInTheDocument();
    expect(results.queryByRole('button', { name: /Right Turns ○/ })).not.toBeInTheDocument();
    expect(screen.getByText('No matching skills.')).toBeInTheDocument();
  });
});

describe('PlanHeaderPanel priority stars', () => {
  it('cycles priority 1 → 2 on tap', async () => {
    const user = userEvent.setup();
    const onChange = renderPanel();
    await user.click(
      screen.getByRole('button', {
        name: 'Priority 1 for Professor of Curvature — tap to cycle',
      }),
    );
    const next = onChange.mock.lastCall?.[0];
    expect(next?.wishlist).toContainEqual(expect.objectContaining({ skillId: '200331', priority: 2 }));
  });

  it('wraps priority 3 → 1', async () => {
    const user = userEvent.setup();
    const onChange = renderPanel();
    await user.click(
      screen.getByRole('button', {
        name: 'Priority 3 for Shooting for the Top — tap to cycle',
      }),
    );
    const next = onChange.mock.lastCall?.[0];
    expect(next?.wishlist).toContainEqual(expect.objectContaining({ skillId: '210061', priority: 1 }));
  });

  it('removes a target skill', async () => {
    const user = userEvent.setup();
    const onChange = renderPanel();
    await user.click(screen.getByRole('button', { name: 'Remove Right Turns ◎' }));
    const next = onChange.mock.lastCall?.[0];
    expect(next?.wishlist.map((t) => t.skillId)).toEqual(['200331', '210061']);
  });
});

describe('PlanHeaderPanel CM picker', () => {
  // fixtureGameData has two presets sharing the plan's (courseId, surface,
  // distance) key: 'Old JP Cup (2024-07-15)' [jp] and 'Fixture Cup (2026-07)'
  // [global, matching FIXTURE_PLAN.month].

  it('selects the preset matching plan.month, not an earlier race-key collision', () => {
    renderPanel();
    expect(screen.getByLabelText('Champions Meeting')).toHaveDisplayValue(
      'Fixture Cup (2026-07)',
    );
  });

  it('labels JP-history presets in the picker (P4)', () => {
    renderPanel();
    expect(
      screen.getByRole('option', { name: 'Old JP Cup (2024-07-15) (JP history)' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'Fixture Cup (2026-07)' }),
    ).toBeInTheDocument();
  });

  it('applying a preset writes month and race onto the plan', async () => {
    const user = userEvent.setup();
    const onChange = renderPanel();
    // value '0' = Old JP Cup (2024-07-15).
    await user.selectOptions(screen.getByLabelText('Champions Meeting'), '0');
    const next = onChange.mock.lastCall?.[0];
    expect(next?.name).toBe('Old JP Cup');
    expect(next?.cmRef.courseId).toBe(FIXTURE_PLAN.cmRef.courseId);
  });

  it('switches to editable race fields on "Custom race…" and stays there', async () => {
    const user = userEvent.setup();
    const onChange = renderPanel();
    const select = screen.getByLabelText('Champions Meeting');

    expect(screen.queryByLabelText('Course id')).not.toBeInTheDocument();
    await user.selectOptions(select, 'custom');
    // Mode change only — no plan mutation, and no snap-back to the matched preset.
    expect(onChange).not.toHaveBeenCalled();
    expect(select).toHaveDisplayValue('Custom race…');
    expect(screen.getByLabelText('Course id')).toHaveValue(FIXTURE_PLAN.cmRef.courseId);

    // The custom fields actually edit plan.cmRef.
    await user.type(screen.getByLabelText('Course id'), '9');
    expect(onChange.mock.lastCall?.[0]?.cmRef.courseId).toBe(
      `${FIXTURE_PLAN.cmRef.courseId}9`,
    );
    await user.selectOptions(screen.getByLabelText('Surface'), 'dirt');
    expect(onChange.mock.lastCall?.[0]?.cmRef.surface).toBe('dirt');

    // Still in custom mode until a preset is explicitly picked again.
    expect(select).toHaveDisplayValue('Custom race…');
    await user.selectOptions(select, '1'); // value '1' = Fixture Cup (2026-07)
    expect(screen.queryByLabelText('Course id')).not.toBeInTheDocument();
    expect(select).toHaveDisplayValue('Fixture Cup (2026-07)');
  });
});

describe('PlanHeaderPanel scenario selector', () => {
  it('updates scenarioId when scenario is changed', async () => {
    const user = userEvent.setup();
    const onChange = renderPanel();
    await user.selectOptions(screen.getByLabelText('Scenario'), '1');
    expect(onChange.mock.lastCall?.[0]?.scenarioId).toBe(1);
    await user.selectOptions(screen.getByLabelText('Scenario'), '4');
    expect(onChange.mock.lastCall?.[0]?.scenarioId).toBe(4);
  });
});
