// Preview stories for PlanHeaderPanel — the Skill Planner's plan header form:
// plan name, Champions Meeting preset/scenario selects, and the target-skill
// wishlist (priority stars + SP cost + remove) with an embedded skill search.
// Reads cmPresets/skillById from useGameData() (fixture data via provider; the
// embedded picker is interaction-gated, GameIcons render placeholders).
import { PlanHeaderPanel } from 'uma-cm-planner';

const noop = () => {};

// Mirrors @/core/fixtures FIXTURE_PLAN; cmRef matches the fixture CM preset so
// the CM select shows the preset (not the custom-race fields). Wishlist skill
// ids resolve to fixture names: 200331 Professor of Curvature, 200014 Right
// Turns ◎, 210061 Shooting for the Top.
const basePlan = {
  id: 'fixture-plan',
  name: 'Cancer Cup — Late ace',
  planNumber: 1,
  cmRef: { cmId: 'CM0', cmNumber: 0, courseId: '10606', surface: 'turf', distance: 2400 },
  scenarioId: 4,
  umaId: '100201',
  uniqueSkillId: '',
  role: 'ace',
  strategy: 'late',
  statProfile: { stats: { spd: 1200, sta: 900, pow: 800, gut: 400, wit: 600 }, mood: 2 },
  sparkGoals: { pink: [], blue: {} },
  wishlist: [
    { skillId: '200331', priority: 1, source: 'targeted' },
    { skillId: '200014', priority: 2, source: 'targeted' },
    { skillId: '210061', priority: 3, source: 'targeted' },
  ],
  lockedDeckSlots: [],
  parents: {},
  patch: { version: 'test' },
  server: 'global',
  dataVersion: 'test',
};

const emptyPlan = { ...basePlan, name: 'New plan', wishlist: [] };

export const WithTargets = () => <PlanHeaderPanel plan={basePlan} onChange={noop} />;
export const EmptyWishlist = () => <PlanHeaderPanel plan={emptyPlan} onChange={noop} />;
