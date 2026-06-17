import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { SkillDetailDisclosure } from './SkillDetailDisclosure';
import type { SkillSummary } from './skillTechnicalDetails';

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
