import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { ComponentProps } from 'react';
import { YourDeckCard, type DeckCardInfo } from './YourDeckCard';
import { addCard, dropCard, emptyDeck, removeSlot } from './deckOps';

afterEach(cleanup);

const resolveCard = (id: string): DeckCardInfo | undefined =>
  id === 'c1' ? { typeLabel: 'SPD', typeColor: '#3b82f6', name: 'Sky-High Crescendo' } : undefined;

function renderCard(over: Partial<ComponentProps<typeof YourDeckCard>> = {}) {
  const onChange = vi.fn();
  const props = {
    state: emptyDeck(),
    onChange,
    resolveCard,
    templates: [],
    onSaveTemplate: vi.fn(),
    onLoadTemplate: vi.fn(),
    onDeleteTemplate: vi.fn(),
    ...over,
  };
  render(<YourDeckCard {...props} />);
  return { ...props };
}

describe('YourDeckCard', () => {
  it('renders the title and 6 empty slots', () => {
    renderCard();
    expect(screen.getByText('Deck')).toBeInTheDocument();
    // 6 empty slot numbers 1..6
    for (let n = 1; n <= 6; n++) expect(screen.getByText(String(n))).toBeInTheDocument();
  });

  it('renders a filled slot with its type label and LB diamonds', () => {
    renderCard({ state: addCard(emptyDeck(), 'c1') });
    expect(screen.getByText('SPD')).toBeInTheDocument();
    expect(screen.getAllByLabelText(/Limit break [1-4]/)).toHaveLength(4);
  });

  it('removing a slot fires onChange with that slot emptied', () => {
    const { onChange } = renderCard({ state: addCard(emptyDeck(), 'c1') });
    fireEvent.click(screen.getByLabelText('Remove'));
    expect(onChange).toHaveBeenCalledWith(removeSlot(addCard(emptyDeck(), 'c1'), 0));
  });

  it('clicking an LB diamond fires onChange', () => {
    const { onChange } = renderCard({ state: addCard(emptyDeck(), 'c1') });
    fireEvent.click(screen.getByLabelText('Limit break 2'));
    expect(onChange).toHaveBeenCalled();
  });

  it('Clear fires onChange with an empty deck', () => {
    const { onChange } = renderCard({ state: addCard(emptyDeck(), 'c1') });
    fireEvent.click(screen.getByText('Clear'));
    expect(onChange).toHaveBeenCalledWith(emptyDeck());
  });

  it('dropping a card fires onChange with dropCard()', () => {
    const { onChange } = renderCard();
    const slot = screen.getByTestId('deck-slot-0');
    const dataTransfer = { getData: (k: string) => (k === 'text/card-id' ? 'c1' : '') };
    fireEvent.drop(slot, { dataTransfer });
    expect(onChange).toHaveBeenCalledWith(dropCard(emptyDeck(), 0, 'c1'));
  });

  it('Save fires onSaveTemplate with the typed name', () => {
    const { onSaveTemplate } = renderCard();
    fireEvent.change(screen.getByPlaceholderText('Template name'), { target: { value: 'aggro' } });
    fireEvent.click(screen.getByText('Save'));
    expect(onSaveTemplate).toHaveBeenCalledWith('aggro');
  });

  it('selecting a template fires onLoadTemplate; Del is disabled until selection', () => {
    const { onLoadTemplate } = renderCard({
      templates: [{ name: 'aggro', slots: emptyDeck().slots, slotLb: emptyDeck().slotLb }],
    });
    expect(screen.getByText('Del')).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Load template'), { target: { value: 'aggro' } });
    expect(onLoadTemplate).toHaveBeenCalledWith('aggro');
    expect(screen.getByText('Del')).not.toBeDisabled();
  });
});
