/**
 * GameIcon: renders an <img> with the resolved (BASE_URL + relative) src for a
 * present id, and a neutral placeholder (no <img>) for an absent id, a null
 * manifest, or a runtime load error. Images augment text — degradation is
 * graceful, never a broken-image glyph.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { IconManifest } from '@/core/icons';

const MANIFEST: IconManifest = {
  dataVersion: 'test',
  format: 'webp',
  skill: ['10011'],
  card: ['30028'],
  uma: ['100201'],
};

// useGameData is mocked per-test via this mutable holder so each case can vary
// the manifest (present / null) without re-mocking the module.
const state = vi.hoisted(() => ({ manifest: null as IconManifest | null }));

vi.mock('@/features/data/gameData', () => ({
  BASE_URL: '/base/',
  useGameData: () => ({ iconManifest: state.manifest }),
}));

// Import after the mock so the component picks up the mocked module.
const { GameIcon } = await import('@/features/data/GameIcon');

afterEach(() => {
  cleanup();
  state.manifest = null;
});

describe('GameIcon', () => {
  it('renders an img with the BASE_URL-prefixed resolved src for a present skill id', () => {
    state.manifest = MANIFEST;
    render(<GameIcon kind="skill" id="10011" alt="Right Turns icon" />);
    const img = screen.getByRole('img', { name: 'Right Turns icon' });
    expect(img).toHaveAttribute('src', '/base/data/icons/skill/10011.webp');
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).toHaveAttribute('decoding', 'async');
    expect(img).toHaveAttribute('width', '22');
  });

  it('resolves card and uma kinds to their directories', () => {
    state.manifest = MANIFEST;
    const { rerender } = render(<GameIcon kind="card" id="30028" alt="card" />);
    expect(screen.getByRole('img', { name: 'card' })).toHaveAttribute(
      'src',
      '/base/data/icons/support/30028.webp',
    );
    rerender(<GameIcon kind="uma" id="100201" alt="uma" />);
    expect(screen.getByRole('img', { name: 'uma' })).toHaveAttribute(
      'src',
      '/base/data/icons/uma/100201.webp',
    );
  });

  it('honors the size prop on the img box', () => {
    state.manifest = MANIFEST;
    render(<GameIcon kind="skill" id="10011" alt="x" size={32} />);
    const img = screen.getByRole('img', { name: 'x' });
    expect(img).toHaveAttribute('width', '32');
    expect(img).toHaveAttribute('height', '32');
  });

  it('renders a placeholder (no img) for an id absent from the manifest', () => {
    state.manifest = MANIFEST;
    const { container } = render(<GameIcon kind="skill" id="99999" alt="missing" />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(container.querySelector('.game-icon-ph')).toBeInTheDocument();
  });

  it('renders a placeholder (no img) when the manifest is null', () => {
    state.manifest = null;
    const { container } = render(<GameIcon kind="card" id="30028" alt="x" />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(container.querySelector('.game-icon-ph')).toBeInTheDocument();
  });

  it('swaps to the placeholder on a runtime load error', () => {
    state.manifest = MANIFEST;
    const { container } = render(<GameIcon kind="skill" id="10011" alt="boom" />);
    const img = screen.getByRole('img', { name: 'boom' });
    fireEvent.error(img);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(container.querySelector('.game-icon-ph')).toBeInTheDocument();
  });
});
