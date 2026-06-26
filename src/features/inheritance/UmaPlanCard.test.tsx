// src/features/inheritance/UmaPlanCard.test.tsx
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { UmaPlanCard } from './UmaPlanCard';

afterEach(cleanup);

const baseProps = {
  name: 'Mejiro McQueen',
  epithet: 'Patrician Maiden',
  portrait: <span data-testid="portrait" />,
  aptChips: [
    { label: 'Turf', grade: 'A' as const },
    { label: 'Medium', grade: 'A' as const },
    { label: 'Late', grade: 'A' as const },
  ],
  umaItems: [{ id: '900', name: 'Gold Ship' }],
  onPickUma: () => {},
};

describe('UmaPlanCard', () => {
  it('renders portrait, name, epithet, and aptitude chips', () => {
    render(<UmaPlanCard {...baseProps} />);
    expect(screen.getByTestId('portrait')).toBeInTheDocument();
    expect(screen.getByText('Mejiro McQueen')).toBeInTheDocument();
    expect(screen.getByText('Patrician Maiden')).toBeInTheDocument();
    expect(screen.getByText('Turf A')).toBeInTheDocument();
    expect(screen.getByText('Medium A')).toBeInTheDocument();
    expect(screen.getByText('Late A')).toBeInTheDocument();
  });

  it('toggles the swap picker and emits the picked uma id', () => {
    const onPickUma = vi.fn();
    render(<UmaPlanCard {...baseProps} onPickUma={onPickUma} />);
    // Picker hidden until Change is clicked.
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Change' }));
    const box = screen.getByRole('searchbox');
    fireEvent.change(box, { target: { value: 'Gold' } });
    fireEvent.click(screen.getByRole('button', { name: /Gold Ship/ }));
    expect(onPickUma).toHaveBeenCalledWith('900');
    // Picker closes after a pick.
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  });
});
