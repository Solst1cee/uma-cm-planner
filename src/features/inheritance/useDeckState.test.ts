import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useDeckState, useDeckTemplates } from './useDeckState';
import { addCard, emptyDeck } from './deckOps';

afterEach(cleanup);
beforeEach(() => localStorage.clear());

describe('useDeckState', () => {
  it('starts empty when nothing is stored', () => {
    const { result } = renderHook(() => useDeckState('plan-1'));
    expect(result.current[0]).toEqual(emptyDeck());
  });

  it('autosaves changes to scb_deck:<planId>', () => {
    const { result } = renderHook(() => useDeckState('plan-1'));
    act(() => result.current[1](addCard(emptyDeck(), 'c1')));
    expect(result.current[0].slots[0]).toBe('c1');
    expect(JSON.parse(localStorage.getItem('scb_deck:plan-1')!).slots[0]).toBe('c1');
  });

  it('loads a stored deck on mount', () => {
    localStorage.setItem('scb_deck:plan-1', JSON.stringify(addCard(emptyDeck(), 'c9')));
    const { result } = renderHook(() => useDeckState('plan-1'));
    expect(result.current[0].slots[0]).toBe('c9');
  });

  it('falls back to empty on a corrupt stored value', () => {
    localStorage.setItem('scb_deck:plan-1', '{not json');
    const { result } = renderHook(() => useDeckState('plan-1'));
    expect(result.current[0]).toEqual(emptyDeck());
  });

  it('swaps decks when planId changes', () => {
    localStorage.setItem('scb_deck:plan-1', JSON.stringify(addCard(emptyDeck(), 'a')));
    localStorage.setItem('scb_deck:plan-2', JSON.stringify(addCard(emptyDeck(), 'b')));
    const { result, rerender } = renderHook(({ id }) => useDeckState(id), { initialProps: { id: 'plan-1' } });
    expect(result.current[0].slots[0]).toBe('a');
    rerender({ id: 'plan-2' });
    expect(result.current[0].slots[0]).toBe('b');
  });

  it('does not write when planId is undefined', () => {
    const { result } = renderHook(() => useDeckState(undefined));
    act(() => result.current[1](addCard(emptyDeck(), 'c1')));
    expect(result.current[0].slots[0]).toBe('c1');
    expect(localStorage.length).toBe(0);
  });
});

describe('useDeckTemplates', () => {
  it('saves and reads back a template', () => {
    const { result } = renderHook(() => useDeckTemplates());
    act(() => result.current.save('aggro', addCard(emptyDeck(), 'c1')));
    expect(result.current.templates).toHaveLength(1);
    expect(result.current.get('aggro')!.slots[0]).toBe('c1');
    expect(JSON.parse(localStorage.getItem('scb_profiles')!)).toHaveLength(1);
  });

  it('upserts by name (replaces a same-name template)', () => {
    const { result } = renderHook(() => useDeckTemplates());
    act(() => result.current.save('x', addCard(emptyDeck(), 'c1')));
    act(() => result.current.save('x', addCard(emptyDeck(), 'c2')));
    expect(result.current.templates).toHaveLength(1);
    expect(result.current.get('x')!.slots[0]).toBe('c2');
  });

  it('removes a template', () => {
    const { result } = renderHook(() => useDeckTemplates());
    act(() => result.current.save('x', emptyDeck()));
    act(() => result.current.remove('x'));
    expect(result.current.templates).toHaveLength(0);
  });

  it('reads [] from a corrupt scb_profiles', () => {
    localStorage.setItem('scb_profiles', '{not json');
    const { result } = renderHook(() => useDeckTemplates());
    expect(result.current.templates).toEqual([]);
  });

  it('two saves in one act both persist (no stale-closure overwrite)', () => {
    const { result } = renderHook(() => useDeckTemplates());
    act(() => {
      result.current.save('alpha', addCard(emptyDeck(), 'c1'));
      result.current.save('beta', addCard(emptyDeck(), 'c2'));
    });
    expect(result.current.templates).toHaveLength(2);
    expect(result.current.get('alpha')!.slots[0]).toBe('c1');
    expect(result.current.get('beta')!.slots[0]).toBe('c2');
  });
});
