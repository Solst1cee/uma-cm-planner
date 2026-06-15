import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { BuyableSkill } from '@/core/spOptimizer';
import { BuildContextForm } from '@/features/sp-optimizer/BuildContextForm';

vi.mock('@/features/data/gameData', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/data/gameData')>();
  const { fixtureGameData } = await import('@/features/testing/fixtureGameData');
  return { ...actual, useGameData: () => fixtureGameData() };
});

afterEach(cleanup);

describe('BuildContextForm', () => {
  it('emits a manual CaptureBundle with the entered SP and one candidate', async () => {
    const user = userEvent.setup();
    const onAnalyze = vi.fn();
    render(<BuildContextForm onAnalyze={onAnalyze} />);

    await user.clear(screen.getByLabelText('Available SP'));
    await user.type(screen.getByLabelText('Available SP'), '500');
    await user.type(screen.getByLabelText('Skill id'), '200332');
    await user.type(screen.getByLabelText('On-screen SP cost'), '120');
    await user.click(screen.getByRole('button', { name: 'Add skill' }));
    await user.click(screen.getByRole('button', { name: 'Analyze' }));

    const bundle = onAnalyze.mock.calls[0]![0];
    expect(bundle.source).toBe('manual');
    expect(bundle.context.spBudget).toBe(500);
    expect(bundle.context.candidates[0].skillId).toBe('200332');
    expect(bundle.context.candidates[0].screenSpCost).toBe(120);
  });

  it('pre-fills from initialCandidates/initialSpBudget and emits source:ocr', async () => {
    const user = userEvent.setup();
    const onAnalyze = vi.fn();
    const seed: BuyableSkill[] = [{ skillId: '200332', rarity: 'white', screenSpCost: 110, matchTier: 'exact' }];
    render(<BuildContextForm onAnalyze={onAnalyze} initialCandidates={seed} initialSpBudget={2285} initialCourseId="10105" />);

    expect(screen.getByLabelText('Available SP')).toHaveValue(2285);
    expect(screen.getByLabelText('Course id')).toHaveValue('10105');
    await user.click(screen.getByRole('button', { name: 'Analyze' }));
    const bundle = onAnalyze.mock.calls[0]![0];
    expect(bundle.source).toBe('ocr');
    expect(bundle.context.candidates[0].skillId).toBe('200332');
  });

  it('respects an explicit initialSource (wishlist seed → manual)', async () => {
    const user = userEvent.setup();
    const onAnalyze = vi.fn();
    const seed: BuyableSkill[] = [{ skillId: '200332', rarity: 'white', screenSpCost: 110, matchTier: 'manual' }];
    render(<BuildContextForm onAnalyze={onAnalyze} initialCandidates={seed} initialSource="manual" />);
    await user.click(screen.getByRole('button', { name: 'Analyze' }));
    expect(onAnalyze.mock.calls[0]![0].source).toBe('manual');
  });

  it('lets you correct a candidate cost and remove a row', async () => {
    const user = userEvent.setup();
    const onAnalyze = vi.fn();
    const seed: BuyableSkill[] = [
      { skillId: '200332', rarity: 'white', screenSpCost: 110, matchTier: 'exact' },
      { skillId: '200331', rarity: 'gold', screenSpCost: 160, matchTier: 'fuzzy', prereqSkillId: '200332' },
    ];
    render(<BuildContextForm onAnalyze={onAnalyze} initialCandidates={seed} initialSpBudget={2285} />);

    const costInputs = screen.getAllByLabelText(/^Cost for /);
    await user.clear(costInputs[0]!);
    await user.type(costInputs[0]!, '128');
    const removeButtons = screen.getAllByRole('button', { name: /^Remove/ });
    await user.click(removeButtons[1]!);

    await user.click(screen.getByRole('button', { name: 'Analyze' }));
    const bundle = onAnalyze.mock.calls[0]![0];
    expect(bundle.context.candidates).toHaveLength(1);
    expect(bundle.context.candidates[0].skillId).toBe('200332');
    expect(bundle.context.candidates[0].screenSpCost).toBe(128);
  });
});
