/**
 * Inventory: card search, add (persisted via @/db), LB editing, removal.
 * Drives InventoryPanel through useInventory with '@/db' mocked.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { InventoryPanel } from '@/features/inventory/InventoryPanel';
import { useInventory } from '@/features/inventory/useInventory';
import { addOwnedCard, removeOwnedCard, updateOwnedCard } from '@/db';

vi.mock('@/features/data/gameData', async () => {
  const { fixtureGameData } = await import('@/features/testing/fixtureGameData');
  return { useGameData: () => fixtureGameData() };
});

vi.mock('@/core/coverage', () => ({
  classifyHintTier: vi.fn(() => 'hint_weak' as const),
}));

vi.mock('@/db', () => ({
  listOwnedCards: vi.fn(async () => [{ id: 1, cardId: '30028', limitBreak: 2 }]),
  addOwnedCard: vi.fn(async () => 2),
  updateOwnedCard: vi.fn(async () => undefined),
  removeOwnedCard: vi.fn(async () => undefined),
}));

function Harness() {
  const inv = useInventory();
  return (
    <InventoryPanel
      inventory={inv.items}
      error={inv.error}
      onAdd={inv.add}
      onSetLimitBreak={inv.setLimitBreak}
      onRemove={inv.remove}
    />
  );
}

afterEach(cleanup);

describe('InventoryPanel', () => {
  it('lists owned cards with their limit break selected', async () => {
    render(<Harness />);
    const lb2 = await screen.findByRole('button', { name: 'LB 2 for Kitasan Black' });
    expect(lb2).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'LB 4 for Kitasan Black' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('searches by character or card name and persists an add at LB0', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await screen.findByRole('list', { name: 'Owned cards' });

    const search = screen.getByLabelText('Add support card');
    await user.type(search, 'tracen'); // card name match for Tazuna
    const result = screen.getByRole('button', { name: /Tazuna Hayakawa/ });
    await user.click(result);

    expect(addOwnedCard).toHaveBeenCalledWith({ cardId: '30016', limitBreak: 0 });
    expect(
      await screen.findByRole('button', { name: 'LB 0 for Tazuna Hayakawa' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('disables results that are already owned', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await screen.findByRole('list', { name: 'Owned cards' });
    await user.type(screen.getByLabelText('Add support card'), 'kitasan');
    expect(screen.getByRole('button', { name: /Kitasan Black.*owned/ })).toBeDisabled();
  });

  it('updates limit break via the LB chips', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(await screen.findByRole('button', { name: 'LB 4 for Kitasan Black' }));
    expect(updateOwnedCard).toHaveBeenCalledWith(1, { limitBreak: 4 });
    expect(screen.getByRole('button', { name: 'LB 4 for Kitasan Black' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('removes an owned card', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(await screen.findByRole('button', { name: 'Remove Kitasan Black' }));
    expect(removeOwnedCard).toHaveBeenCalledWith(1);
    expect(screen.queryByRole('button', { name: 'LB 2 for Kitasan Black' })).not.toBeInTheDocument();
  });
});
