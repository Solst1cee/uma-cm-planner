import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { SelectedSkillProvider, useSelectedSkill } from './useSelectedSkill';

afterEach(cleanup);

function Probe() {
  const { selectedSkillId, setSelectedSkillId } = useSelectedSkill();
  return (
    <div>
      <span data-testid="sel">{selectedSkillId ?? 'none'}</span>
      <button type="button" onClick={() => setSelectedSkillId('200332')}>
        select
      </button>
    </div>
  );
}

describe('useSelectedSkill', () => {
  it('defaults to no selection and updates the selected id', () => {
    render(
      <SelectedSkillProvider>
        <Probe />
      </SelectedSkillProvider>,
    );
    expect(screen.getByTestId('sel')).toHaveTextContent('none');
    fireEvent.click(screen.getByRole('button', { name: 'select' }));
    expect(screen.getByTestId('sel')).toHaveTextContent('200332');
  });

  it('throws when used outside the provider', () => {
    expect(() => render(<Probe />)).toThrow(/SelectedSkillProvider/);
  });
});
