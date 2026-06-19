/**
 * App shell: header (name, module nav, settings), fixture-data banner,
 * routes, and the persistent P3 honesty footer.
 */
import { BrowserRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { ActivePlanProvider } from '@/app/ActivePlanContext';
import { SettingsMenu } from '@/app/SettingsMenu';
import { GameDataProvider, useGameData } from '@/features/data/gameData';
import { CmPlannerPage } from '@/features/cm-planner/CmPlannerPage';
import { ParentsPage } from '@/features/parents/ParentsPage';
import { SkillAcquisitionPage } from '@/features/skill-acq/SkillAcquisitionPage';
import { SpOptimizerPage } from '@/features/sp-optimizer/SpOptimizerPage';
import { TimelinePage } from '@/features/meta-intel/TimelinePage';

// Module 1 (Inheritance) lands in a later phase; nav shows it as a disabled stub.
const STUB_MODULES = ['Inheritance'] as const;

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

function CurrentCmBadge() {
  const { currentCm } = useGameData();
  if (!currentCm) return null;
  const date = currentCm.dates.finals ?? currentCm.dates.start ?? '';
  return (
    <span className="cmp-now-chip" title="Current / next Champions Meeting (from the timeline)">
      Now: {currentCm.title}{date ? ` · ${date}` : ''}
    </span>
  );
}

function Shell() {
  return (
    <>
      <header className="app-header">
        <div className="app-title-row">
          <h1>Uma CM Planner</h1>
          <CurrentCmBadge />
          <SettingsMenu />
        </div>
        <nav aria-label="Modules">
          <NavLink to="/" end className={navItemClass}>
            Skill Planner
          </NavLink>
          <NavLink to="/parents" className={navItemClass}>
            Parents
          </NavLink>
          <NavLink to="/sp-optimizer" className={navItemClass}>SP Optimizer</NavLink>
          <NavLink to="/meta-intel" className={navItemClass}>
            Meta Intel
          </NavLink>
          <NavLink to="/legacy" className={navItemClass}>
            Legacy
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
          <Route path="/" element={<CmPlannerPage />} />
          <Route path="/legacy" element={<SkillAcquisitionPage />} />
          <Route path="/parents" element={<ParentsPage />} />
          <Route path="/sp-optimizer" element={<SpOptimizerPage />} />
          <Route path="/meta-intel" element={<TimelinePage />} />
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
