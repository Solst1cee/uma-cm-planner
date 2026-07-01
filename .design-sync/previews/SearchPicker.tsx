// Preview stories for SearchPicker — a generic searchable picker (name filter,
// capped results, clears on pick). The results list is gated behind a typed
// query (internal state), so a static preview shows the labeled search field;
// the row rendering (sub-text, badges, "added" marker) appears once a query is
// entered. See .design-sync/NOTES.md "interaction-gated previews".
import { SearchPicker } from 'uma-cm-planner';

const noop = () => {};

const umaItems = [
  { id: '100201', name: 'Kitasan Black', sub: 'Sky-High Tycoon', badge: 'long', badgeClass: 'badge-apt' },
  { id: '100101', name: 'Special Week', sub: 'Hello, Tokyo!', badge: 'mile' },
  { id: '100301', name: 'Silence Suzuka', sub: 'Wonder of the Track', badge: 'mile', disabled: true },
];

const skillItems = [
  { id: '200331', name: 'Professor of Curvature', sub: 'gold · 160 SP' },
  { id: '200332', name: 'Corner Adept ○', sub: 'white · 110 SP' },
  { id: '210061', name: 'Shooting for the Top', sub: 'scenario · 0 SP' },
];

export const ParentPicker = () => (
  <SearchPicker label="Add parent" placeholder="Search umas by name…" items={umaItems} onPick={noop} />
);

export const SkillSearch = () => (
  <SearchPicker label="Add target skill" placeholder="Search skills…" items={skillItems} onPick={noop} />
);
