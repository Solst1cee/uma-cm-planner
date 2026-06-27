// src/features/inheritance/UmaPickerModal.test.tsx
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { Parent, Stat } from '@/core/types';
import type { SparkAgg } from './sparkAggregate';
import { UmaPickerModal, type UmaPickerItem } from './UmaPickerModal';

const agg = (over: Partial<SparkAgg>): SparkAgg => ({
  blueTotals: {}, blueLegacy: { stat: 'spd', stars: 0 }, maxBlueTotal: 0,
  pinkTotals: {}, pinkLegacy: { aptitude: 'turf', stars: 0 }, whites: new Map(), ...over,
});
const mkParent = (id: string, stat: Stat): Parent => ({
  id, umaId: id, blueSpark: { stat, stars: 3 }, pinkSpark: { aptitude: 'long', stars: 1 }, whiteSparks: [], source: 'mine',
});
const items: UmaPickerItem[] = [
  { id: 'a', name: 'Alpha', portrait: null, parent: mkParent('a', 'pow'), affinity: 50, agg: agg({ blueTotals: { pow: 8 }, blueLegacy: { stat: 'pow', stars: 3 }, maxBlueTotal: 8 }) },
  { id: 'b', name: 'Beta', portrait: null, parent: mkParent('b', 'spd'), affinity: 10, agg: agg({ blueTotals: { spd: 2 }, blueLegacy: { stat: 'spd', stars: 2 }, maxBlueTotal: 2 }) },
];
const base = { items, skillName: (id: string) => id, whiteSkillOptions: [], onPick: vi.fn(), onClose: vi.fn() };

afterEach(cleanup);

describe('UmaPickerModal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<UmaPickerModal {...base} open={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('lists all items when open, sorted by affinity desc', () => {
    render(<UmaPickerModal {...base} open />);
    const tiles = screen.getAllByRole('button', { name: /Alpha|Beta/ });
    expect(tiles[0]).toHaveTextContent('Alpha'); // 50 before 10
    expect(screen.getByText(/2 match/)).toBeInTheDocument();
  });

  it('adding an any-blue >=8 filter narrows to matching tiles', () => {
    render(<UmaPickerModal {...base} open />);
    fireEvent.click(screen.getByRole('button', { name: /add filter/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /any blue/i }));
    const input = screen.getByLabelText(/any-blue total/i);
    fireEvent.change(input, { target: { value: '8' } });
    expect(screen.getByRole('button', { name: /Alpha/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Beta/ })).not.toBeInTheDocument();
    expect(screen.getByText(/1 match/)).toBeInTheDocument();
  });

  it('filters tiles by the name search', () => {
    render(<UmaPickerModal {...base} open />);
    fireEvent.change(screen.getByRole('searchbox', { name: /search by name/i }), { target: { value: 'alph' } });
    expect(screen.getByRole('button', { name: /Alpha/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Beta/ })).not.toBeInTheDocument();
    expect(screen.getByText(/1 match/)).toBeInTheDocument();
  });

  it('clicking a tile calls onPick', () => {
    const onPick = vi.fn();
    render(<UmaPickerModal {...base} open onPick={onPick} />);
    fireEvent.click(screen.getByRole('button', { name: /Alpha/ }));
    expect(onPick).toHaveBeenCalledWith('a');
  });

  it('Escape and backdrop click call onClose; window click does not', () => {
    const onClose = vi.fn();
    render(<UmaPickerModal {...base} open onClose={onClose} />);
    fireEvent.click(within(screen.getByRole('dialog')).getByText('Pick a parent')); // inside window
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('uma-modal-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
