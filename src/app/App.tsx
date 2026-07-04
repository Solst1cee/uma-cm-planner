/**
 * App shell: header (name, module nav, settings), fixture-data banner,
 * routes, and the persistent P3 honesty footer.
 */
import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { ActivePlanProvider } from '@/app/ActivePlanContext';
import { HorizonBanner, HorizonControl } from '@/app/HorizonControl';
import { SettingsMenu } from '@/app/SettingsMenu';
import { GameDataProvider, useGameData } from '@/features/data/gameData';

// Routes are lazy so each page splits into its own chunk. This keeps the
// ~5.4 MB main-thread engine bundle OUT of the eager entry chunk: the sole
// eager puller is SpOptimizerPage (rankBaskets runs evalSkillDelta/
// runPlannerCompare on the main thread), so a static import of it dragged the
// whole engine into `index`, downloaded on every route. Now it loads only when
// /sp-optimizer is visited. (The planner/inheritance reach course + skill data
// via their own lazy `import('@/sim/…')` calls, unaffected.)
const CmPlannerPage = lazy(() => import('@/features/cm-planner/CmPlannerPage').then((m) => ({ default: m.CmPlannerPage })));
const InheritancePage = lazy(() => import('@/features/inheritance/InheritancePage').then((m) => ({ default: m.InheritancePage })));
const ParentsPage = lazy(() => import('@/features/parents/ParentsPage').then((m) => ({ default: m.ParentsPage })));
const SpOptimizerPage = lazy(() => import('@/features/sp-optimizer/SpOptimizerPage').then((m) => ({ default: m.SpOptimizerPage })));
const TimelinePage = lazy(() => import('@/features/meta-intel/TimelinePage').then((m) => ({ default: m.TimelinePage })));
const StyleguidePage = lazy(() => import('@/features/styleguide/StyleguidePage').then((m) => ({ default: m.StyleguidePage })));

// Module stubs (nav shows them disabled). Inheritance un-stubbed in M1.1.
const STUB_MODULES: readonly string[] = [];

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
          <HorizonControl />
          <SettingsMenu />
        </div>
        <nav aria-label="Modules">
          <NavLink to="/" end className={navItemClass}>
            Skill Planner
          </NavLink>
          <NavLink to="/parents" className={navItemClass}>
            Parents
          </NavLink>
          <NavLink to="/inheritance" className={navItemClass}>
            Inheritance
          </NavLink>
          <NavLink to="/sp-optimizer" className={navItemClass}>SP Optimizer</NavLink>
          <NavLink to="/meta-intel" className={navItemClass}>
            Meta Intel
          </NavLink>
          {STUB_MODULES.map((name) => (
            <button key={name} type="button" className="nav-item" disabled>
              {name}
            </button>
          ))}
        </nav>
      </header>
      <FixtureBanner />
      <HorizonBanner />
      <main>
        <Suspense fallback={<div className="route-loading" role="status">Loading…</div>}>
          <Routes>
            <Route path="/" element={<CmPlannerPage />} />
            <Route path="/parents" element={<ParentsPage />} />
            <Route path="/inheritance" element={<InheritancePage />} />
            <Route path="/sp-optimizer" element={<SpOptimizerPage />} />
            <Route path="/meta-intel" element={<TimelinePage />} />
            <Route path="/styleguide" element={<StyleguidePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
      <footer className="app-footer">
        Coverage tiers are reliability estimates from community-verified
        mechanics — not guarantees. See docs/mechanics-notes.md. ·{' '}
        <NavLink to="/styleguide" className="nav-item" style={{ padding: '0 0.4rem' }}>Styleguide</NavLink>
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
