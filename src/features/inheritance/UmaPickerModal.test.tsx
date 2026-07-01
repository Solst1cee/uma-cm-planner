// src/features/inheritance/UmaPickerModal.test.tsx
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { Parent, Stat } from '@/core/types';
import type { SparkAgg } from './sparkAggregate';
import { UmaPickerModal, type UmaPickerItem } from './UmaPickerModal';

const agg = (over: Partial<SparkAgg>): SparkAgg => ({
  blueTotals: {}, blueLegacy: { stat: 'spd', stars: 0 }, maxBlueTotal: 0,
  pinkTotals: {}, pinkLegacy: { aptitude: 'turf', stars: 0 }, whites: new Map(), greens: new Map(), ...over,
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

  it('lists all items when open, sorted by affinity desc + shows the box total', () => {
    render(<UmaPickerModal {...base} open />);
    const tiles = screen.getAllByRole('button', { name: /Alpha|Beta/ });
    expect(tiles[0]).toHaveTextContent('Alpha'); // 50 before 10
    expect(screen.getByText(/of 2 in your box/i)).toBeInTheDocument();
  });

  it('filters by a blue total — activate Power, require lineage ≥4', () => {
    render(<UmaPickerModal {...base} open />);
    // Alpha has Power total 8; Beta has none → require Power ≥4.
    fireEvent.click(screen.getByRole('button', { name: '+ Power' }));
    fireEvent.click(screen.getByRole('button', { name: 'Power lineage 4' }));
    expect(screen.getByRole('button', { name: /Alpha/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Beta/ })).not.toBeInTheDocument();
  });

  it('a parent star auto-raises the total to match', () => {
    render(<UmaPickerModal {...base} open />);
    fireEvent.click(screen.getByRole('button', { name: '+ Power' }));
    fireEvent.click(screen.getByRole('button', { name: 'Power own 3' })); // legacy 3 → total bumps to ≥3
    expect(screen.getByRole('button', { name: 'Power lineage 3' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('enforces the 3-member budget — Power total 6 disables Stamina beyond 3★', () => {
    render(<UmaPickerModal {...base} open />);
    fireEvent.click(screen.getByRole('button', { name: '+ Power' }));
    fireEvent.click(screen.getByRole('button', { name: 'Power lineage 6' })); // 2 members
    fireEvent.click(screen.getByRole('button', { name: '+ Stamina' }));
    expect(screen.getByRole('button', { name: 'Stamina lineage 4' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Stamina lineage 3' })).not.toBeDisabled();
  });

  it('single legacy per category — parent stars lock on a second blue stat', () => {
    render(<UmaPickerModal {...base} open />);
    fireEvent.click(screen.getByRole('button', { name: '+ Power' }));
    fireEvent.click(screen.getByRole('button', { name: 'Power own 2' }));
    fireEvent.click(screen.getByRole('button', { name: '+ Stamina' }));
    expect(screen.getByRole('button', { name: 'Stamina own 1' })).toBeDisabled();
  });

  it('Reset all clears the filters', () => {
    render(<UmaPickerModal {...base} open />);
    fireEvent.click(screen.getByRole('button', { name: '+ Power' }));
    expect(screen.getByRole('button', { name: 'Power own 1' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /reset all/i }));
    expect(screen.queryByRole('button', { name: 'Power own 1' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Power' })).toBeInTheDocument(); // add chip back
  });

  it('green search adds a unique-skill row with parent + total meters', () => {
    const uniqueSkillOptions = [{ id: '100151', name: 'Vittoria' }, { id: '100201', name: 'Other Unique' }];
    render(<UmaPickerModal {...base} open uniqueSkillOptions={uniqueSkillOptions} skillName={(id) => (id === '100151' ? 'Vittoria' : id)} />);
    fireEvent.change(screen.getByRole('combobox', { name: /search unique skill/i }), { target: { value: 'vitt' } });
    fireEvent.click(screen.getByRole('option', { name: 'Vittoria' }));
    expect(screen.getByRole('button', { name: 'Vittoria own 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Vittoria lineage 1' })).toBeInTheDocument();
  });

  it('green search supports keyboard nav (↓ then Enter picks the highlighted option)', () => {
    const uniqueSkillOptions = [{ id: '100151', name: 'Vittoria' }, { id: '100201', name: 'Vitesse' }];
    render(<UmaPickerModal {...base} open uniqueSkillOptions={uniqueSkillOptions} skillName={(id) => (id === '100201' ? 'Vitesse' : 'Vittoria')} />);
    const box = screen.getByRole('combobox', { name: /search unique skill/i });
    fireEvent.change(box, { target: { value: 'vit' } });
    fireEvent.keyDown(box, { key: 'ArrowDown' }); // highlight index 1 (Vitesse)
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(screen.getByRole('button', { name: 'Vitesse own 1' })).toBeInTheDocument();
  });

  it('filters tiles by the name search', () => {
    render(<UmaPickerModal {...base} open />);
    fireEvent.change(screen.getByRole('searchbox', { name: /search by name/i }), { target: { value: 'alph' } });
    expect(screen.getByRole('button', { name: /Alpha/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Beta/ })).not.toBeInTheDocument();
  });

  it('renders the rank score under the badge, the stat row, and stacked GP nodes', () => {
    const rich: UmaPickerItem[] = [{
      ...items[0]!,
      rankScore: 9347,
      rankBadge: <span>rk</span>,
      gpPortraits: [<span key="g1">gp1</span>, <span key="g2">gp2</span>],
      statRow: <span>spd 991</span>,
    }];
    render(<UmaPickerModal {...base} items={rich} open />);
    expect(screen.getByTitle('Rank score')).toHaveTextContent('9347');
    expect(screen.getByText('spd 991')).toBeInTheDocument();
    const gpWrap = screen.getByTitle('Grandparents');
    expect(gpWrap.querySelectorAll('.inh-uma-gp-item')).toHaveLength(2);
  });

  it('clicking a tile calls onPick', () => {
    const onPick = vi.fn();
    render(<UmaPickerModal {...base} open onPick={onPick} />);
    fireEvent.click(screen.getByRole('button', { name: /Alpha/ }));
    expect(onPick).toHaveBeenCalledWith('a');
  });

  it('greys a disabled (other-parent) tile, sorts it last, and blocks its click', () => {
    const onPick = vi.fn();
    // Alpha (aff 50) would normally sort first; mark it disabled → it sinks below Beta.
    const withDisabled = items.map((it) => (it.id === 'a' ? { ...it, disabled: true } : it));
    render(<UmaPickerModal {...base} items={withDisabled} open onPick={onPick} />);
    const tiles = screen.getAllByRole('button', { name: /Alpha|Beta/ });
    expect(tiles[0]).toHaveTextContent('Beta'); // disabled Alpha no longer first
    const alpha = screen.getByRole('button', { name: /Alpha/ });
    expect(alpha).toHaveClass('is-disabled');
    expect(alpha).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(alpha);
    expect(onPick).not.toHaveBeenCalled(); // click blocked
    fireEvent.click(screen.getByRole('button', { name: /Beta/ }));
    expect(onPick).toHaveBeenCalledWith('b'); // enabled tile still works
  });

  it('tags an already-selected / same-character veteran and blocks its click', () => {
    const onPick = vi.fn();
    const tagged = items.map((it) =>
      it.id === 'a'
        ? { ...it, disabled: true, selectedLabel: 'Same as Parent 2', unavailableReason: "Same character as Parent 2 — can't use one character for both parents" }
        : it,
    );
    render(<UmaPickerModal {...base} items={tagged} open onPick={onPick} />);
    const alpha = screen.getByRole('button', { name: /Alpha/ });
    expect(alpha).toHaveClass('is-disabled');
    expect(within(alpha).getByText('Same as Parent 2')).toBeInTheDocument();
    expect(alpha).toHaveAttribute('title', "Same character as Parent 2 — can't use one character for both parents");
    fireEvent.click(alpha);
    expect(onPick).not.toHaveBeenCalled();
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
