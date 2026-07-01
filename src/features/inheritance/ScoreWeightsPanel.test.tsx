// src/features/inheritance/ScoreWeightsPanel.test.tsx
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ScoreWeightsPanel } from './ScoreWeightsPanel';
import { DEFAULT_SCENARIO } from '@/core/cardScore';

afterEach(cleanup);

// The panel defaults to collapsed — expand it before asserting on its body.
const expand = () => fireEvent.click(screen.getByText('Scoring weights'));

describe('ScoreWeightsPanel', () => {
  it('shows the active-type speed weight and emits a change', () => {
    const onChange = vi.fn();
    render(<ScoreWeightsPanel scenario={DEFAULT_SCENARIO} onChange={onChange} onReset={vi.fn()} />);
    expand();
    fireEvent.click(screen.getByRole('button', { name: /customize settings/i }));
    const spd = screen.getByLabelText(/^speed weight$/i);
    fireEvent.change(spd, { target: { value: '2.7' } });
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.lastCall![0].speed.stats[0]).toBe(2.7);
  });
  it('switches the active type tab', () => {
    render(<ScoreWeightsPanel scenario={DEFAULT_SCENARIO} onChange={vi.fn()} onReset={vi.fn()} />);
    expand();
    // Tabs now live inside the Customize area — open it first.
    fireEvent.click(screen.getByRole('button', { name: /customize settings/i }));
    fireEvent.click(screen.getByRole('button', { name: /^stamina$/i }));
    expect(screen.getByLabelText(/^speed weight$/i)).toHaveValue(DEFAULT_SCENARIO.stamina.stats[0]);
  });
  it('reset button calls onReset', () => {
    const onReset = vi.fn();
    render(<ScoreWeightsPanel scenario={DEFAULT_SCENARIO} onChange={vi.fn()} onReset={onReset} />);
    expand();
    fireEvent.click(screen.getByRole('button', { name: /reset/i }));
    expect(onReset).toHaveBeenCalled();
  });
});
