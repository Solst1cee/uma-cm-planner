// src/features/inheritance/PlanContextHeader.test.tsx
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { CmPlan } from '@/core/types';
import { PlanContextHeader } from './PlanContextHeaderView';

afterEach(cleanup);

const plan: CmPlan = {
  id: 'p1', name: 'Cancer Cup — Late ace', planNumber: 2,
  cmRef: { kind: 'cm', cmId: 'CM15', cmNumber: 15, courseId: '10906', surface: 'turf', distance: 2200 },
  scenarioId: 4, umaId: '106801', uniqueSkillId: '', role: 'ace', strategy: 'late',
  statProfile: { stats: { spd: 1200, sta: 900, pow: 1000, gut: 600, wit: 1100 }, mood: 2 },
  sparkGoals: { pink: [], blue: {} }, wishlist: [], parents: {},
  patch: { version: 'x' }, server: 'global', dataVersion: 'x',
} as CmPlan;

describe('PlanContextHeader', () => {
  it('renders the plan label, name, source, and chips', () => {
    render(<PlanContextHeader plan={plan} trackName="Hanshin" />);
    expect(screen.getByText('PLAN #2')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Cancer Cup — Late ace' })).toBeInTheDocument();
    expect(screen.getByText('From CM Planner · Hanshin Racecourse')).toBeInTheDocument();
    expect(screen.getByText('Turf')).toBeInTheDocument();
    expect(screen.getByText('Medium · 2200m')).toBeInTheDocument();
    expect(screen.getByText('Late')).toBeInTheDocument();
  });

  it('renders a loading state when no plan is set', () => {
    render(<PlanContextHeader plan={null} trackName={null} />);
    expect(screen.getByText(/loading plan/i)).toBeInTheDocument();
  });
});
