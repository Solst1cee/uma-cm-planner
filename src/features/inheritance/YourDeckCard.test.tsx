import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { ComponentProps } from 'react';
import { YourDeckCard, type DeckCardInfo } from './YourDeckCard';
import { addCard, dropCard, emptyDeck, moveSlot, removeSlot, type DeckState } from './deckOps';

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

  it('greys a slot that is the trainee’s own character (is-conflict)', () => {
    const resolve = (): DeckCardInfo => ({ typeLabel: 'SPD', typeColor: '#3b82f6', name: 'Trainee Card', charName: 'Alpha', sameAsTrainee: true });
    renderCard({ state: addCard(emptyDeck(), 'c1'), resolveCard: resolve });
    expect(screen.getByTestId('deck-slot-0')).toHaveClass('is-conflict');
  });

  it('greys the 2nd copy of the same character, not the first', () => {
    const resolve = (id: string): DeckCardInfo => ({ typeLabel: 'SPD', typeColor: '#3b82f6', name: id, charName: 'Alpha' });
    const state = { slots: ['a', 'b', null, null, null, null], slotLb: [4, 4, 4, 4, 4, 4] } as DeckState;
    renderCard({ state, resolveCard: resolve });
    expect(screen.getByTestId('deck-slot-0')).not.toHaveClass('is-conflict');
    expect(screen.getByTestId('deck-slot-1')).toHaveClass('is-conflict');
  });

  it('clicking a filled slot’s icon fires onSelect with its card id', () => {
    const onSelect = vi.fn();
    renderCard({ state: addCard(emptyDeck(), 'c1'), onSelect });
    fireEvent.click(screen.getByRole('button', { name: /sky-high crescendo details/i }));
    expect(onSelect).toHaveBeenCalledWith('c1');
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

  it('dragging a filled slot onto another swaps them (moveSlot)', () => {
    const state = { slots: ['c1', 'x', null, null, null, null], slotLb: [4, 4, 4, 4, 4, 4] } as DeckState;
    const { onChange } = renderCard({ state });
    // A shared store so dragStart's setData is visible to drop's getData.
    const store: Record<string, string> = {};
    const dataTransfer = { setData: (k: string, v: string) => { store[k] = v; }, getData: (k: string) => store[k] ?? '', effectAllowed: '' };
    fireEvent.dragStart(screen.getByTestId('deck-slot-0'), { dataTransfer });
    fireEvent.drop(screen.getByTestId('deck-slot-1'), { dataTransfer });
    expect(onChange).toHaveBeenCalledWith(moveSlot(state, 0, 1));
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

  it('each template row in the dropdown has a delete × that fires onDeleteTemplate', () => {
    const { onDeleteTemplate, onSelectTemplate } = renderCard({
      activeName: 'control',
      templates: [
        { name: 'aggro', slots: emptyDeck().slots, slotLb: emptyDeck().slotLb },
        { name: 'control', slots: emptyDeck().slots, slotLb: emptyDeck().slotLb },
      ],
    });
    fireEvent.click(screen.getByLabelText('Templates')); // open dropdown
    fireEvent.click(screen.getByLabelText('Delete aggro'));
    expect(onDeleteTemplate).toHaveBeenCalledWith('aggro');
    expect(onSelectTemplate).not.toHaveBeenCalled(); // deleting a row must not also select it
  });
});
