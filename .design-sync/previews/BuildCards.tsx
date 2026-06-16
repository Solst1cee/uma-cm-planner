// Preview stories for BuildCards — the SP-optimizer's ranked-basket result
// cards. Reads skill names/icons from useGameData() (the GameDataProvider
// wraps every cell with fixture data, so the fixture skill ids below resolve
// to real names; GameIcon shows its placeholder, no icon assets in fixture mode).
import { BuildCards } from 'uma-cm-planner';

// Fixture skill ids (see @/core/fixtures): 200331 Professor of Curvature,
// 200332 Corner Adept ○, 200014 Right Turns ◎, 210061 Shooting for the Top,
// 200012 Right Turns ○.
const ranked = {
  mode: 'exact',
  baskets: [
    {
      skills: ['200331', '200014', '210061'],
      score: 4.2,
      spUsed: 270,
      spLeft: 30,
      descriptor: 'tight · +4.2 bashin mean',
    },
    {
      skills: ['200332', '200014'],
      score: 3.1,
      spUsed: 220,
      spLeft: 80,
      descriptor: 'moderate · +3.1 bashin mean',
    },
    {
      skills: ['200012', '210061'],
      score: 1.8,
      spUsed: 90,
      spLeft: 210,
      descriptor: 'wide · +1.8 bashin mean',
    },
  ],
};

const overBudget = {
  mode: 'exact',
  baskets: [
    {
      skills: ['200331', '200014', '200332', '210061'],
      score: 4.6,
      spUsed: 380,
      spLeft: -80,
      descriptor: 'tight · +4.6 bashin mean',
    },
  ],
};

const shortlist = {
  mode: 'shortlist',
  baskets: [
    {
      skills: ['200331', '210061'],
      score: 3.4,
      spUsed: 160,
      spLeft: 140,
      descriptor: 'moderate · +3.4 bashin mean',
    },
  ],
};

const empty = { mode: 'exact', baskets: [] };

export const RankedExact = () => <BuildCards result={ranked} />;
export const OverBudget = () => <BuildCards result={overBudget} />;
export const ShortlistEstimate = () => <BuildCards result={shortlist} />;
export const NoFeasibleBaskets = () => <BuildCards result={empty} />;
