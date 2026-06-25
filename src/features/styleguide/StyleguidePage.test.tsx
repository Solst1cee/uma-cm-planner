import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { StyleguidePage } from './StyleguidePage';

afterEach(cleanup);

describe('StyleguidePage', () => {
  it('renders the heading and a token swatch label', () => {
    render(<StyleguidePage />);
    expect(screen.getByRole('heading', { name: /styleguide/i })).toBeInTheDocument();
    expect(screen.getByText('--accent')).toBeInTheDocument();
  });

  it('renders a sample design-system card', () => {
    const { container } = render(<StyleguidePage />);
    expect(container.querySelector('.ds-card')).not.toBeNull();
  });
});
