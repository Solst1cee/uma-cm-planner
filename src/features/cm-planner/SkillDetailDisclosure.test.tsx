import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { SkillDetailDisclosure } from './SkillDetailDisclosure';
import type { SkillSummary } from './skillTechnicalDetails';
import type { RebalanceInfo } from '@/core/types';

vi.mock('@/features/data/GameIcon', () => ({ GameIcon: () => null }));
vi.mock('./skillTechnicalDetails', async (orig) => ({
  ...(await orig<typeof import('./skillTechnicalDetails')>()),
  loadSkillTechnicalDetail: async () => null,
}));

const skill: SkillSummary = {
  skillId: '200332',
  nameEn: 'Corner Adept',
  iconId: '1',
  rarity: 'white',
  baseSpCost: 120,
  conditions: '',
};

describe('SkillDetailDisclosure controlled open', () => {
  it('is controlled when open + onOpenChange are passed', () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(<SkillDetailDisclosure skill={skill} open={false} onOpenChange={onOpenChange} />);
    // Initially closed via controlled prop
    expect(document.querySelector('details')?.open).toBe(false);
    // Rerender with open=true — details should reflect the controlled prop
    rerender(<SkillDetailDisclosure skill={skill} open onOpenChange={onOpenChange} />);
    expect(document.querySelector('details')?.open).toBe(true);
  });

  it('does not render a trace section without traceContext', () => {
    render(<SkillDetailDisclosure skill={skill} open onOpenChange={() => {}} />);
    // No velocity chart present without a traceContext
    expect(document.querySelector('.cmp-trace')).toBeNull();
  });
});

describe('SkillDetailDisclosure rebalance history', () => {
  afterEach(cleanup);

  const curatedInfo: RebalanceInfo = {
    globalVer: 1,
    jpVer: 3,
    versions: [
      { ver: 1 },
      {
        ver: 2,
        jpDate: '2025-11-20',
        globalArrival: '2026-08-10',
        globalDatePredicted: true,
        conditions: 'corner==2',
      },
      {
        ver: 3,
        jpDate: '2026-05-10',
        globalDate: '2026-09-01',
        globalArrival: '2026-09-01',
        modifier: 0.25,
        note: 'Buffed activation window',
        sourceUrl: 'https://example.com/patch-notes',
      },
    ],
  };

  it('renders a version-ascending timeline with the live marker, arrival dates, params, note, and source link', () => {
    const rebalanceSkill: SkillSummary = { ...skill, rebalance: curatedInfo };
    render(<SkillDetailDisclosure skill={rebalanceSkill} open onOpenChange={() => {}} />);

    expect(screen.getByText('Rebalance history')).toBeInTheDocument();

    // v1: baseline, no date, but Global (live) marker since globalVer: 1
    expect(screen.getByText('v1')).toBeInTheDocument();
    expect(screen.getByText('Global (live)')).toBeInTheDocument();

    // v2: predicted arrival + conditions string
    expect(screen.getByText('~2026-08-10')).toBeInTheDocument();
    expect(screen.getByText('corner==2')).toBeInTheDocument();

    // v3: announced arrival + modifier + note + source link
    expect(screen.getByText('✓ 2026-09-01')).toBeInTheDocument();
    expect(screen.getByText('modifier 0.25')).toBeInTheDocument();
    expect(screen.getByText('Buffed activation window')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /source/i });
    expect(link).toHaveAttribute('href', 'https://example.com/patch-notes');
    expect(link).toHaveAttribute('rel', 'noreferrer');
  });

  it('renders the uncurated-candidate state instead of a version list', () => {
    const candidateInfo: RebalanceInfo = {
      globalVer: 1,
      jpVer: 2,
      versions: [{ ver: 1 }],
      uncuratedCandidate: true,
      candidateConditions: { jp: 'corner==2', global: 'corner==4' },
    };
    const rebalanceSkill: SkillSummary = { ...skill, rebalance: candidateInfo };
    render(<SkillDetailDisclosure skill={rebalanceSkill} open onOpenChange={() => {}} />);

    expect(screen.getByText('Rebalance history')).toBeInTheDocument();
    expect(screen.getByText(/JP conditions differ — not yet curated/)).toBeInTheDocument();
    expect(screen.getByText(/JP:\s*corner==2/)).toBeInTheDocument();
    expect(screen.getByText(/Global:\s*corner==4/)).toBeInTheDocument();
  });

  it('omits the section entirely when the skill has no rebalance info', () => {
    render(<SkillDetailDisclosure skill={skill} open onOpenChange={() => {}} />);
    expect(screen.queryByText('Rebalance history')).toBeNull();
  });
});
