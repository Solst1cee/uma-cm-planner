import { describe, expect, it, test } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { useState } from 'react';
import { WorkingTabs, type TabKey } from './WorkingTabs';

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
    // After switching, UNIQUE is hidden (keep-alive) not removed from DOM
    expect(screen.getByText('UNIQUE').closest('[role="tabpanel"]')).toHaveAttribute('hidden');
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

  it('marks a stale tab with a "Changed — re-run" warning', () => {
    render(
      <WorkingTabs
        initial="unique"
        tabs={[
          { key: 'unique', label: 'Unique', node: <div>UNIQUE</div> },
          { key: 'skills', label: 'Skills', node: <div>SKILLS</div>, stale: true },
        ]}
      />,
    );
    // The stale tab carries the warning; the fresh tab does not.
    const skillsTab = screen.getByRole('tab', { name: /Skills/ });
    expect(skillsTab).toContainElement(screen.getByLabelText('Changed — re-run'));
    expect(screen.getByRole('tab', { name: 'Unique' })).not.toContainElement(
      screen.queryByLabelText('Changed — re-run'),
    );
  });

  it('does not render unvisited tab nodes on initial mount', () => {
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

function Counter({ label }: { label: string }) {
  const [n, setN] = useState(0);
  return (
    <button onClick={() => setN((x) => x + 1)}>{label}:{n}</button>
  );
}

test('keeps visited tabs mounted so their state survives a tab switch', () => {
  render(
    <WorkingTabs
      initial={'a' as unknown as TabKey}
      tabs={[
        { key: 'a' as unknown as TabKey, label: 'A', node: <Counter label="A" /> },
        { key: 'b' as unknown as TabKey, label: 'B', node: <Counter label="B" /> },
      ]}
    />,
  );
  // bump A's counter to 3
  const aBtn = screen.getByText('A:0');
  fireEvent.click(aBtn);
  fireEvent.click(screen.getByText('A:1'));
  fireEvent.click(screen.getByText('A:2'));
  expect(screen.getByText('A:3')).toBeInTheDocument();

  // switch to B, then back to A
  fireEvent.click(screen.getByRole('tab', { name: 'B' }));
  fireEvent.click(screen.getByRole('tab', { name: 'A' }));

  // A's state is preserved (was unmounted before → would reset to A:0)
  expect(screen.getByText('A:3')).toBeInTheDocument();
});

test('does not mount a tab until it is first visited', () => {
  render(
    <WorkingTabs
      initial={'a' as unknown as TabKey}
      tabs={[
        { key: 'a' as unknown as TabKey, label: 'A', node: <Counter label="A" /> },
        { key: 'b' as unknown as TabKey, label: 'B', node: <Counter label="B" /> },
      ]}
    />,
  );
  // B never visited → its node is not in the DOM yet
  expect(screen.queryByText('B:0')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', { name: 'B' }));
  expect(screen.getByText('B:0')).toBeInTheDocument();
});
