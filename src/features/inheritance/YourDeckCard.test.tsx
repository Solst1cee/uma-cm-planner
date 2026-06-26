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
    activeName: '',
    onRename: vi.fn(),
    onSelectTemplate: vi.fn(),
    onNewTemplate: vi.fn(),
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

  it('shows the active template name in the combobox field', () => {
    renderCard({ activeName: 'aggro' });
    expect(screen.getByPlaceholderText(/type to name/i)).toHaveValue('aggro');
  });

  it('committing a fresh unique name (Enter) fires onRename with the trimmed value', () => {
    const { onRename } = renderCard();
    const field = screen.getByPlaceholderText(/type to name/i);
    fireEvent.change(field, { target: { value: '  aggro  ' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(onRename).toHaveBeenCalledWith('aggro');
  });

  it('typing an existing template name switches to it instead of overwriting (no onRename)', () => {
    const { onRename, onSelectTemplate } = renderCard({
      activeName: 'control',
      templates: [
        { name: 'aggro', slots: emptyDeck().slots, slotLb: emptyDeck().slotLb },
        { name: 'control', slots: emptyDeck().slots, slotLb: emptyDeck().slotLb },
      ],
    });
    const field = screen.getByPlaceholderText(/type to name/i);
    fireEvent.change(field, { target: { value: 'aggro' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(onSelectTemplate).toHaveBeenCalledWith('aggro');
    expect(onRename).not.toHaveBeenCalled();
  });

  it('clearing the name field is a no-op (reverts; does not detach)', () => {
    const { onRename, onSelectTemplate } = renderCard({ activeName: 'aggro' });
    const field = screen.getByPlaceholderText(/type to name/i);
    fireEvent.change(field, { target: { value: '' } });
    fireEvent.blur(field);
    expect(onRename).not.toHaveBeenCalled();
    expect(onSelectTemplate).not.toHaveBeenCalled();
    expect(field).toHaveValue('aggro'); // reverted
  });

  it('opening the dropdown and picking a template fires onSelectTemplate', () => {
    const { onSelectTemplate } = renderCard({
      templates: [{ name: 'aggro', slots: emptyDeck().slots, slotLb: emptyDeck().slotLb }],
    });
    fireEvent.click(screen.getByLabelText('Templates')); // caret
    fireEvent.click(screen.getByText('aggro'));
    expect(onSelectTemplate).toHaveBeenCalledWith('aggro');
  });

  it('picking "New" fires onNewTemplate', () => {
    const { onNewTemplate } = renderCard({ activeName: 'aggro' });
    fireEvent.click(screen.getByLabelText('Templates'));
    fireEvent.click(screen.getByText('＋ New'));
    expect(onNewTemplate).toHaveBeenCalled();
  });

  it('Del is disabled when there is no active template', () => {
    renderCard({ activeName: '' });
    expect(screen.getByText('Del')).toBeDisabled();
  });

  it('Del fires onDeleteTemplate with the active name', () => {
    const { onDeleteTemplate } = renderCard({ activeName: 'aggro' });
    const del = screen.getByText('Del');
    expect(del).not.toBeDisabled();
    fireEvent.click(del);
    expect(onDeleteTemplate).toHaveBeenCalledWith('aggro');
  });
});
