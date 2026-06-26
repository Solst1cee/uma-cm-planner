import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { PlanTargetsCard, type PlanTargetsCardProps } from './PlanTargetsCard';

afterEach(cleanup);

const baseProps = (over: Partial<PlanTargetsCardProps> = {}): PlanTargetsCardProps => ({
  collapsed: false,
  onToggleCollapsed: () => {},
  blueRows: [
    { stat: 'sta', label: 'Stamina', stars: 6 },
    { stat: 'pow', label: 'Power', stars: 3 },
  ],
  pinkRows: [
    { label: 'Turf', grade: 'A' },
    { label: 'Long', grade: 'S' },
  ],
  availableBlueStats: [{ stat: 'spd', label: 'Speed' }],
  wishlist: [
    { skillId: '100', name: 'Arc Maestro', sp: 160, gold: true },
    { skillId: '200', name: 'Professor of Curvature', sp: 160, gold: false },
  ],
  summary: { count: 2, totalSp: 320 },
  onSetBlueStars: () => {},
  onDeleteBlue: () => {},
  onAddBlue: () => {},
  ...over,
});

describe('PlanTargetsCard', () => {
  it('renders blue/pink sparks, the wishlist headline, and rows', () => {
    render(<PlanTargetsCard {...baseProps()} />);
    expect(screen.getByText('Plan targets')).toBeInTheDocument();
    expect(screen.getByText('Stamina')).toBeInTheDocument();
    expect(screen.getByText('6★')).toBeInTheDocument();
    expect(screen.getByText('Turf')).toBeInTheDocument();
    expect(screen.getByText(/Wishlist \(2 skills · 320 SP\)/)).toBeInTheDocument();
    expect(screen.getByText('Arc Maestro')).toBeInTheDocument();
  });

  it('steppers and delete emit the right blue mutations', () => {
    const onSetBlueStars = vi.fn();
    const onDeleteBlue = vi.fn();
    render(<PlanTargetsCard {...baseProps({ onSetBlueStars, onDeleteBlue })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Increase Stamina' }));
    expect(onSetBlueStars).toHaveBeenCalledWith('sta', 7);
    fireEvent.click(screen.getByRole('button', { name: 'Decrease Power' }));
    expect(onSetBlueStars).toHaveBeenCalledWith('pow', 2);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Stamina' }));
    expect(onDeleteBlue).toHaveBeenCalledWith('sta');
  });

  it('the add-stat select adds a blue spark', () => {
    const onAddBlue = vi.fn();
    render(<PlanTargetsCard {...baseProps({ onAddBlue })} />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Add blue spark' }), {
      target: { value: 'spd' },
    });
    expect(onAddBlue).toHaveBeenCalledWith('spd');
  });

  it('collapses the body when collapsed', () => {
    render(<PlanTargetsCard {...baseProps({ collapsed: true })} />);
    expect(screen.getByText('Plan targets')).toBeInTheDocument();
    expect(screen.queryByText('Stamina')).not.toBeInTheDocument();
  });
});
