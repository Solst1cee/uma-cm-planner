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
    renderPanel();
    await user.type(screen.getByLabelText('Add target skill'), 'CORNER');
    expect(screen.getByRole('button', { name: /Corner Adept ○/ })).toBeInTheDocument();
    expect(screen.queryByText('Right Turns ○')).not.toBeInTheDocument();
  });

  it('never offers JP-server skills for a Global plan (P4)', async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.type(screen.getByLabelText('Add target skill'), 'jp-only');
    expect(screen.queryByText(/JP-Only Example/)).not.toBeInTheDocument();
    expect(screen.getByText('No matching skills.')).toBeInTheDocument();
  });

  it('adds a picked skill at priority 1', async () => {
    const user = userEvent.setup();
    const onChange = renderPanel();
    await user.type(screen.getByLabelText('Add target skill'), 'corner');
    await user.click(screen.getByRole('button', { name: /Corner Adept ○/ }));
    const next = onChange.mock.lastCall?.[0];
    expect(next?.targetSkills).toContainEqual({ skillId: '200332', priority: 1 });
    expect(next?.targetSkills).toHaveLength(FIXTURE_PLAN.targetSkills.length + 1);
  });

  it('disables results that are already targets', async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.type(screen.getByLabelText('Add target skill'), 'right turns');
    // Right Turns ◎ (200014) is already a target → disabled; ○ is not.
    const results = within(screen.getByRole('list', { name: 'Skill search results' }));
    expect(results.getByRole('button', { name: /Right Turns ◎/ })).toBeDisabled();
    expect(results.getByRole('button', { name: /Right Turns ○/ })).toBeEnabled();
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
    expect(next?.targetSkills).toContainEqual({ skillId: '200331', priority: 2 });
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
    expect(next?.targetSkills).toContainEqual({ skillId: '210061', priority: 1 });
  });

  it('removes a target skill', async () => {
    const user = userEvent.setup();
    const onChange = renderPanel();
    await user.click(screen.getByRole('button', { name: 'Remove Right Turns ◎' }));
    const next = onChange.mock.lastCall?.[0];
    expect(next?.targetSkills.map((t) => t.skillId)).toEqual(['200331', '210061']);
  });
});

describe('PlanHeaderPanel scenario selector', () => {
  it('marks scenario 4 as the app default and others as overrides', async () => {
    const user = userEvent.setup();
    const onChange = renderPanel();
    await user.selectOptions(screen.getByLabelText('Scenario'), '1');
    expect(onChange.mock.lastCall?.[0]?.scenario).toEqual({ id: 1, isDefault: false });
    await user.selectOptions(screen.getByLabelText('Scenario'), '4');
    expect(onChange.mock.lastCall?.[0]?.scenario).toEqual({ id: 4, isDefault: true });
  });
});
