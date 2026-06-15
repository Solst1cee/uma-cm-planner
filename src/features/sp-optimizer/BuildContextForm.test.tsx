import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { BuildContextForm } from '@/features/sp-optimizer/BuildContextForm';

afterEach(cleanup);

describe('BuildContextForm', () => {
  it('emits a CaptureBundle with the entered SP and one candidate', async () => {
    const user = userEvent.setup();
    const onAnalyze = vi.fn();
    render(<BuildContextForm onAnalyze={onAnalyze} />);

    await user.clear(screen.getByLabelText('Available SP'));
    await user.type(screen.getByLabelText('Available SP'), '500');
    await user.type(screen.getByLabelText('Skill id'), '200332');
    await user.type(screen.getByLabelText('On-screen SP cost'), '120');
    await user.click(screen.getByRole('button', { name: 'Add skill' }));
    await user.click(screen.getByRole('button', { name: 'Analyze' }));

    expect(onAnalyze).toHaveBeenCalledTimes(1);
    const bundle = onAnalyze.mock.calls[0]![0];
    expect(bundle.schemaVersion).toBe(1);
    expect(bundle.source).toBe('manual');
    expect(bundle.context.spBudget).toBe(500);
    expect(bundle.context.candidates).toHaveLength(1);
    expect(bundle.context.candidates[0].skillId).toBe('200332');
    expect(bundle.context.candidates[0].screenSpCost).toBe(120);
  });
});
