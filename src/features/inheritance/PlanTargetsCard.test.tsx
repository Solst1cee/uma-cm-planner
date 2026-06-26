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
  blueTotal: 9,
  pinkComputable: true,
  pinkRows: [
    { label: 'Medium', stars: 4 },
    { label: 'Late Surger', stars: 1 },
  ],
  pinkTotal: 5,
  midRunRows: [],
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
  it('renders blue/pink spark chips, the wishlist headline, and rows', () => {
    render(<PlanTargetsCard {...baseProps()} />);
    expect(screen.getByText('Plan targets')).toBeInTheDocument();
    expect(screen.getByText(/Stamina ★6/)).toBeInTheDocument();
    expect(screen.getByText(/Medium ★4/)).toBeInTheDocument();
    expect(screen.getByText(/Late Surger ★1/)).toBeInTheDocument();
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

  it('warns when the pink budget is exceeded and shows the mid-run readout', () => {
    render(
      <PlanTargetsCard
        {...baseProps({ pinkTotal: 22, midRunRows: [{ label: 'Medium', steps: 1 }] })}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(/22\/18★ pink/);
    expect(screen.getByText('Mid-run spark')).toBeInTheDocument();
    expect(screen.getByText('Medium ×1')).toBeInTheDocument();
  });

  it('explains, instead of "none required", when the uma is unresolved', () => {
    render(<PlanTargetsCard {...baseProps({ pinkComputable: false, pinkRows: [], midRunRows: [] })} />);
    expect(screen.getByText(/Select this plan's uma/)).toBeInTheDocument();
    expect(screen.queryByText('none required')).not.toBeInTheDocument();
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
    expect(screen.queryByText(/Stamina ★/)).not.toBeInTheDocument();
  });
});
