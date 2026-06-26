import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { UmaPlanCard } from './UmaPlanCard';

afterEach(cleanup);

const baseProps = {
  planName: 'Cancer Cup — Late ace',
  name: 'Mejiro McQueen',
  epithet: 'Patrician Maiden',
  note: 'Save SP for Arc Maestro',
  portrait: <span data-testid="portrait" />,
  aptChips: [
    { label: 'Turf', grade: 'A' as const },
    { label: 'Medium', grade: 'A' as const },
    { label: 'Late', grade: 'A' as const },
  ],
  inventory: <div data-testid="inventory" />,
  inventoryOpen: false,
  onToggleInventory: () => {},
  onCloseInventory: () => {},
};

describe('UmaPlanCard', () => {
  it('renders the "Uma plan" header, plan name, portrait, uma name, epithet, chips, and note', () => {
    render(<UmaPlanCard {...baseProps} />);
    expect(screen.getByText('Uma plan')).toBeInTheDocument();
    expect(screen.getByText('Cancer Cup — Late ace')).toBeInTheDocument();
    expect(screen.getByTestId('portrait')).toBeInTheDocument();
    expect(screen.getByText('Mejiro McQueen')).toBeInTheDocument();
    expect(screen.getByText('Patrician Maiden')).toBeInTheDocument();
    expect(screen.getByText('Turf A')).toBeInTheDocument();
    expect(screen.getByText('Medium A')).toBeInTheDocument();
    expect(screen.getByText('Late A')).toBeInTheDocument();
    expect(screen.getByText('Save SP for Arc Maestro')).toBeInTheDocument();
  });

  it('hides the inventory popover until open; the icon button toggles it', () => {
    const onToggleInventory = vi.fn();
    const { rerender } = render(
      <UmaPlanCard {...baseProps} inventoryOpen={false} onToggleInventory={onToggleInventory} />,
    );
    expect(screen.queryByTestId('inventory')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Choose plan from inventory' }));
    expect(onToggleInventory).toHaveBeenCalled();
    // Controlled: opening is driven by the prop.
    rerender(<UmaPlanCard {...baseProps} inventoryOpen onToggleInventory={onToggleInventory} />);
    expect(screen.getByTestId('inventory')).toBeInTheDocument();
  });

  it('closes the popover on an outside pointerdown', () => {
    const onCloseInventory = vi.fn();
    render(<UmaPlanCard {...baseProps} inventoryOpen onCloseInventory={onCloseInventory} />);
    fireEvent.pointerDown(document.body);
    expect(onCloseInventory).toHaveBeenCalled();
  });
});
