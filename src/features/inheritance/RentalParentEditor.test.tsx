import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { Parent } from '@/core/types';
import type { SparkFilter } from '@/core/sparkFilter';
import { RentalParentEditor } from './RentalParentEditor';

afterEach(cleanup);

const umaOptions = [
  { id: 'uma1', name: 'Special Week' },
  { id: 'uma2', name: 'Silence Suzuka' },
];
const greenOptions = [{ id: 'g1', name: 'Uma Stan' }];
const whiteOptions = [{ id: 'w1', name: 'Corner Adept' }];

function setup(overrides: Partial<React.ComponentProps<typeof RentalParentEditor>> = {}) {
  const onSave = vi.fn();
  const onCancel = vi.fn();
  render(
    <RentalParentEditor
      onSave={onSave}
      onCancel={onCancel}
      umaOptions={umaOptions}
      greenOptions={greenOptions}
      whiteOptions={whiteOptions}
      {...overrides}
    />,
  );
  return { onSave, onCancel };
}

describe('RentalParentEditor', () => {
  it('Save is disabled until a parent uma is picked', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('picking a uma + white spark + green then Save emits a friend_rental/manual Parent', () => {
    const { onSave } = setup();

    fireEvent.change(screen.getByRole('combobox', { name: 'Parent uma' }), { target: { value: 'uma1' } });
    expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled();

    fireEvent.change(screen.getByRole('combobox', { name: 'Add white spark' }), { target: { value: 'w1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    fireEvent.change(screen.getByRole('combobox', { name: 'Green skill' }), { target: { value: 'g1' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const p: Parent = onSave.mock.calls[0]![0];
    expect(p.source).toBe('friend_rental');
    expect(p.importSource).toBe('manual');
    expect(p.umaId).toBe('uma1');
    expect(p.whiteSparks).toEqual([{ skillId: 'w1', stars: 3 }]);
    expect(p.greenSpark).toEqual({ skillId: 'g1', stars: 3 });
    expect(p.id).toBe('__rental__');
  });

  it('a value prop pre-populates the form and Save preserves its id', () => {
    const value: Parent = {
      id: 'existing1',
      umaId: 'uma2',
      blueSpark: { stat: 'pow', stars: 2 },
      pinkSpark: { aptitude: 'mile', stars: 1 },
      whiteSparks: [{ skillId: 'w1', stars: 2 }],
      greenSpark: { skillId: 'g1', stars: 3 },
      source: 'friend_rental',
      importSource: 'manual',
    };
    const { onSave } = setup({ value });

    expect(screen.getByRole('combobox', { name: 'Parent uma' })).toHaveValue('uma2');
    expect(screen.getByRole('combobox', { name: 'Blue stat' })).toHaveValue('pow');
    expect(screen.getByRole('combobox', { name: 'Pink aptitude' })).toHaveValue('mile');

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    const p: Parent = onSave.mock.calls[0]![0];
    expect(p.id).toBe('existing1');
    expect(p.umaId).toBe('uma2');
    expect(p.whiteSparks).toEqual([{ skillId: 'w1', stars: 2 }]);
  });

  it('seeds from seedFilters when promoting a Draft (no value)', () => {
    const seedFilters: SparkFilter[] = [
      { id: 'b1', kind: 'blue', stat: 'wit', legacyMin: 0, totalMin: 2 },
      { id: 'p1', kind: 'pink', aptitude: 'long', legacyMin: 0, totalMin: 3 },
      { id: 'g1', kind: 'green', skillId: 'g1', legacyMin: 0, totalMin: 1 },
      { id: 'w1', kind: 'white', skillId: 'w1', legacyMin: 0, totalMin: 3 },
    ];
    setup({ seedFilters });

    expect(screen.getByRole('combobox', { name: 'Blue stat' })).toHaveValue('wit');
    expect(screen.getByRole('combobox', { name: 'Blue stars' })).toHaveValue('2');
    expect(screen.getByRole('combobox', { name: 'Pink aptitude' })).toHaveValue('long');
    expect(screen.getByRole('combobox', { name: 'Pink stars' })).toHaveValue('3');
    expect(screen.getByRole('combobox', { name: 'Green skill' })).toHaveValue('g1');
    expect(screen.getByRole('button', { name: 'Remove Corner Adept' })).toBeInTheDocument();
  });

  it('Cancel calls onCancel', () => {
    const { onCancel } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
