import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { RentalDraft } from '@/core/types';
import { seedFromTargetSpark } from '@/core/rentalDraft';
import { RentalDraftPanel } from './RentalDraftPanel';

afterEach(cleanup);

const draft: RentalDraft = {
  filters: [{ id: 'g1', kind: 'green', skillId: 'skill1', legacyMin: 1, totalMin: 2 }],
  forcedTier: 'double',
};

const seed = {
  blue: [{ stat: 'spd' as const, stars: 3 }],
  white: [{ id: 'w1' }],
};

function setup(overrides: Partial<React.ComponentProps<typeof RentalDraftPanel>> = {}) {
  const onChange = vi.fn();
  render(
    <RentalDraftPanel
      draft={draft}
      onChange={onChange}
      seed={seed}
      traineeCardId="card123"
      skillName={(id) => (id === 'skill1' ? 'Test Unique' : id)}
      greenOptions={[]}
      whiteOptions={[]}
      {...overrides}
    />,
  );
  return { onChange };
}

describe('RentalDraftPanel', () => {
  it('shows the forced-tier radiogroup with ◎ checked for "double"', () => {
    setup();
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
    const double = radios.find((r) => r.textContent === '◎');
    const single = radios.find((r) => r.textContent === '○');
    const triangle = radios.find((r) => r.textContent === '△');
    expect(double).toHaveAttribute('aria-checked', 'true');
    expect(single).toHaveAttribute('aria-checked', 'false');
    expect(triangle).toHaveAttribute('aria-checked', 'false');
  });

  it('picking a different tier calls onChange with the new forcedTier', () => {
    const { onChange } = setup();
    const radios = screen.getAllByRole('radio');
    const triangle = radios.find((r) => r.textContent === '△')!;
    fireEvent.click(triangle);
    expect(onChange).toHaveBeenCalledWith({ ...draft, forcedTier: 'triangle' });
  });

  it('"Load from Target spark" seeds filters from the seed', () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole('button', { name: /Load from Target spark/i }));
    expect(onChange).toHaveBeenCalledWith({ ...draft, filters: seedFromTargetSpark(seed) });
  });

  it('renders three search-link anchors pointed at each site', () => {
    setup();
    const links = screen.getAllByRole('link');
    const hrefs = links.map((a) => a.getAttribute('href') ?? '');
    expect(hrefs.some((h) => h.startsWith('https://uma.moe'))).toBe(true);
    expect(hrefs.some((h) => h.startsWith('https://uma.pure-db.com'))).toBe(true);
    expect(hrefs.some((h) => h.startsWith('https://chronogenesis.net'))).toBe(true);
  });

  it('has a titled "Link generator" section and no honesty caveat', () => {
    setup();
    expect(screen.getByText(/Link generator/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/matching record isn't a guaranteed borrowable rental/i),
    ).not.toBeInTheDocument();
  });

  it('names the unencodable spark TYPE per site (green → "unique not encoded") on all three sites', () => {
    setup();
    const notes = screen.getAllByText(/unique not encoded/i);
    expect(notes.length).toBe(3);
  });
});
