import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { ActivePatchNote } from '@/core/rebalancePatches';
import { PatchedSimNote } from './PatchedSimNote';

afterEach(cleanup);

const note = (over: Partial<ActivePatchNote> = {}): ActivePatchNote => ({
  skillId: '300',
  name: 'Test Skill',
  ver: 2,
  pinLag: false,
  predicted: false,
  pinned: false,
  ...over,
});

describe('PatchedSimNote', () => {
  it('renders nothing for an empty note list', () => {
    const { container } = render(<PatchedSimNote notes={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the pin-lag copy for a confirmed-patch-pending-pin note', () => {
    render(<PatchedSimNote notes={[note({ pinLag: true })]} />);
    expect(screen.getByText(/confirmed patch, engine pin pending/i)).toBeInTheDocument();
  });

  it('prefixes a predicted arrival with ~', () => {
    render(<PatchedSimNote notes={[note({ arrival: '2026-08-01', predicted: true })]} />);
    expect(screen.getByText(/arrives ~2026-08-01/)).toBeInTheDocument();
  });

  it('shows an unpredicted (announced) arrival without the ~ prefix', () => {
    render(<PatchedSimNote notes={[note({ arrival: '2026-08-01', predicted: false })]} />);
    expect(screen.getByText(/arrives 2026-08-01/)).toBeInTheDocument();
    expect(screen.queryByText(/arrives ~/)).toBeNull();
  });

  it('marks a wishlist-pinned version with "(pinned)"', () => {
    render(<PatchedSimNote notes={[note({ pinned: true })]} />);
    expect(screen.getByText(/\(pinned\)/)).toBeInTheDocument();
  });

  it('renders one chip per note, keyed by skillId', () => {
    render(<PatchedSimNote notes={[note({ skillId: 'a', name: 'Skill A' }), note({ skillId: 'b', name: 'Skill B' })]} />);
    expect(screen.getByText(/Skill A/)).toBeInTheDocument();
    expect(screen.getByText(/Skill B/)).toBeInTheDocument();
  });
});
