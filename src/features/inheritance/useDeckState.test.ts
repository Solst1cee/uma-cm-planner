import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useActiveTemplateName, useDeckState, useDeckTemplates } from './useDeckState';
import { addCard, emptyDeck } from './deckOps';

afterEach(cleanup);
beforeEach(() => localStorage.clear());

describe('useDeckState', () => {
  it('starts empty when nothing is stored', () => {
    const { result } = renderHook(() => useDeckState());
    expect(result.current[0]).toEqual(emptyDeck());
  });

  it('autosaves changes to scb_deck', () => {
    const { result } = renderHook(() => useDeckState());
    act(() => result.current[1](addCard(emptyDeck(), 'c1')));
    expect(result.current[0].slots[0]).toBe('c1');
    expect(JSON.parse(localStorage.getItem('scb_deck')!).slots[0]).toBe('c1');
  });

  it('loads a stored deck on mount', () => {
    localStorage.setItem('scb_deck', JSON.stringify(addCard(emptyDeck(), 'c9')));
    const { result } = renderHook(() => useDeckState());
    expect(result.current[0].slots[0]).toBe('c9');
  });

  it('falls back to empty on a corrupt stored value', () => {
    localStorage.setItem('scb_deck', '{not json');
    const { result } = renderHook(() => useDeckState());
    expect(result.current[0]).toEqual(emptyDeck());
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

describe('useActiveTemplateName', () => {
  it("starts '' when nothing is stored", () => {
    const { result } = renderHook(() => useActiveTemplateName());
    expect(result.current[0]).toBe('');
  });

  it('autosaves the name to scb_deck_active', () => {
    const { result } = renderHook(() => useActiveTemplateName());
    act(() => result.current[1]('aggro'));
    expect(result.current[0]).toBe('aggro');
    expect(localStorage.getItem('scb_deck_active')).toBe('aggro');
  });

  it('loads a stored name on mount', () => {
    localStorage.setItem('scb_deck_active', 'control');
    const { result } = renderHook(() => useActiveTemplateName());
    expect(result.current[0]).toBe('control');
  });

  it('reports stored=false until a value is set, then true', () => {
    const { result } = renderHook(() => useActiveTemplateName());
    expect(result.current[2]).toBe(false);
    act(() => result.current[1]('aggro'));
    expect(result.current[2]).toBe(true);
  });

  it("treats an explicit '' (New) as stored — so it survives a reload", () => {
    // Simulate a prior "New": the empty string was persisted.
    localStorage.setItem('scb_deck_active', '');
    const { result } = renderHook(() => useActiveTemplateName());
    expect(result.current[0]).toBe('');
    expect(result.current[2]).toBe(true); // distinguishable from never-chosen (null)
  });
});
