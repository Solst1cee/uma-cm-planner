// src/features/cm-planner/StatInput.test.tsx
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { StatInput } from './StatInputField';

afterEach(cleanup);

describe('StatInput', () => {
  it('clears to empty instead of leaving a 0', () => {
    render(<StatInput value={1200} label="SPD" onValueChange={vi.fn()} />);
    const input = screen.getByLabelText('SPD') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '' } });
    expect(input.value).toBe('');
  });

  it('strips a leading zero when typing into a cleared field', () => {
    const onValueChange = vi.fn();
    render(<StatInput value={0} label="SPD" onValueChange={onValueChange} />);
    const input = screen.getByLabelText('SPD') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '01200' } });
    expect(input.value).toBe('1200');
    expect(onValueChange).toHaveBeenLastCalledWith(1200);
  });

  it('normalizes an empty field to 0 on blur', () => {
    const onValueChange = vi.fn();
    render(<StatInput value={500} label="SPD" onValueChange={onValueChange} />);
    const input = screen.getByLabelText('SPD') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);
    expect(input.value).toBe('0');
    expect(onValueChange).toHaveBeenLastCalledWith(0);
  });

  it('re-syncs when the external value changes (plan load)', () => {
    const { rerender } = render(<StatInput value={500} label="SPD" onValueChange={vi.fn()} />);
    rerender(<StatInput value={900} label="SPD" onValueChange={vi.fn()} />);
    expect((screen.getByLabelText('SPD') as HTMLInputElement).value).toBe('900');
  });
});
