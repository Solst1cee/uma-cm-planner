/**
 * App shell: header (name, module nav, settings), fixture-data banner,
 * routes, and the persistent P3 honesty footer.
 */
import { BrowserRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { ActivePlanProvider } from '@/app/ActivePlanContext';
import { SettingsMenu } from '@/app/SettingsMenu';
import { GameDataProvider, useGameData } from '@/features/data/gameData';
import { ParentsPage } from '@/features/parents/ParentsPage';
import { SkillPlannerPage } from '@/features/skill-planner/SkillPlannerPage';

// Modules 1–3 land in later phases; nav shows them as disabled stubs.
const STUB_MODULES = ['Inheritance', 'SP Optimizer', 'Meta Intel'] as const;

const navItemClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? 'nav-item active' : 'nav-item';

function FixtureBanner() {
  const { status } = useGameData();
  if (status !== 'fixture') return null;
  return (
    <div className="banner" role="status">
      Fixture data — bundled game datasets were not found; all numbers are
      synthetic placeholders, not real game values.
    </div>
  );
}

function Shell() {
  return (
    <>
      <header className="app-header">
        <div className="app-title-row">
          <h1>Uma CM Planner</h1>
          <SettingsMenu />
        </div>
        <nav aria-label="Modules">
          <NavLink to="/" end className={navItemClass}>
            Skill Planner
          </NavLink>
          <NavLink to="/parents" className={navItemClass}>
            Parents
          </NavLink>
          {STUB_MODULES.map((name) => (
            <button key={name} type="button" className="nav-item" disabled>
              {name}
            </button>
          ))}
        </nav>
      </header>
      <FixtureBanner />
      <main>
        <Routes>
          <Route path="/" element={<SkillPlannerPage />} />
          <Route path="/parents" element={<ParentsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <footer className="app-footer">
        Coverage tiers are reliability estimates from community-verified
        mechanics — not guarantees. See docs/mechanics-notes.md.
      </footer>
    </>
  );
}

export function App() {
  return (
    <GameDataProvider>
      <ActivePlanProvider>
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <Shell />
        </BrowserRouter>
      </ActivePlanProvider>
    </GameDataProvider>
  );
}
