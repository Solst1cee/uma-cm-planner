import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { RouteErrorBoundary } from './RouteErrorBoundary';

function Boom(): never {
  throw new Error('chunk failed');
}

describe('RouteErrorBoundary', () => {
  afterEach(cleanup);

  it('renders children when nothing throws', () => {
    render(
      <RouteErrorBoundary>
        <div>page content</div>
      </RouteErrorBoundary>,
    );
    expect(screen.getByText('page content')).toBeTruthy();
  });

  it('shows a reload prompt instead of a white page when a child throws', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <RouteErrorBoundary>
        <Boom />
      </RouteErrorBoundary>,
    );
    expect(screen.getByRole('alert').textContent).toMatch(/failed to load/i);
    expect(screen.getByRole('button', { name: /reload/i })).toBeTruthy();
    spy.mockRestore();
  });
});
