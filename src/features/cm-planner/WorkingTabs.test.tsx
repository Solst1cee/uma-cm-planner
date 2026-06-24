import { describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { WorkingTabs } from './WorkingTabs';

afterEach(cleanup);

describe('WorkingTabs', () => {
  it('shows the initial tab and switches on click', () => {
    render(
      <WorkingTabs
        initial="unique"
        tabs={[
          { key: 'unique', label: 'Unique', node: <div>UNIQUE</div> },
          { key: 'skills', label: 'Skills', node: <div>SKILLS</div> },
        ]}
      />,
    );
    expect(screen.getByText('UNIQUE')).toBeInTheDocument();
    expect(screen.queryByText('SKILLS')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Skills' }));
    expect(screen.getByText('SKILLS')).toBeInTheDocument();
    expect(screen.queryByText('UNIQUE')).toBeNull();
  });

  it('defaults to the first tab when initial is not provided', () => {
    render(
      <WorkingTabs
        tabs={[
          { key: 'unique', label: 'Unique', node: <div>UNIQUE</div> },
          { key: 'skills', label: 'Skills', node: <div>SKILLS</div> },
        ]}
      />,
    );
    expect(screen.getByText('UNIQUE')).toBeInTheDocument();
    expect(screen.queryByText('SKILLS')).toBeNull();
  });

  it('marks only the active tab button as selected', () => {
    render(
      <WorkingTabs
        initial="unique"
        tabs={[
          { key: 'unique', label: 'Unique', node: <div>UNIQUE</div> },
          { key: 'skills', label: 'Skills', node: <div>SKILLS</div> },
        ]}
      />,
    );
    expect(screen.getByRole('tab', { name: 'Unique' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Skills' })).toHaveAttribute('aria-selected', 'false');

    fireEvent.click(screen.getByRole('tab', { name: 'Skills' }));

    expect(screen.getByRole('tab', { name: 'Unique' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tab', { name: 'Skills' })).toHaveAttribute('aria-selected', 'true');
  });

  it('mounts only the active tab node (inactive is unmounted)', () => {
    render(
      <WorkingTabs
        initial="unique"
        tabs={[
          { key: 'unique', label: 'Unique', node: <div>UNIQUE</div> },
          { key: 'skills', label: 'Skills', node: <div>SKILLS</div> },
        ]}
      />,
    );
    // Only Unique is in the DOM
    expect(document.querySelectorAll('div[role="tabpanel"] > div')).toHaveLength(1);
    expect(screen.queryByText('SKILLS')).toBeNull();
  });
});
