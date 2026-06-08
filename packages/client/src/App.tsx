import { Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { BattlesPage } from './pages/BattlesPage.js';
import { RankingsPage } from './pages/RankingsPage.js';
import { TechPage } from './pages/TechPage.js';
import { DiplomacyPage } from './pages/DiplomacyPage.js';
import { CouncilPage } from './pages/CouncilPage.js';
import { BlackmarketPage } from './pages/BlackmarketPage.js';
import { ShipDesignerPage } from './pages/ShipDesignerPage.js';
import { SpyPage } from './pages/SpyPage.js';
import { WarfarePage } from './pages/WarfarePage.js';
import { ProjectsPage } from './pages/ProjectsPage.js';
import { InfoPage } from './pages/InfoPage.js';
import { PreferencesPage } from './pages/PreferencesPage.js';
import { useAuthStore } from './lib/auth.js';
import { useHotkeys } from './hooks/useHotkeys.js';
import { useToast } from './hooks/useToast.js';
import { ToastContext } from './hooks/useToastContext.js';
import { ToastContainer } from './components/ui.js';

const NAV_ITEMS = [
  { to: '/',           label: 'Empire',   key: 'E' },
  { to: '/tech',       label: 'Tech',     key: 'T' },
  { to: '/ships',      label: 'Ships',    key: 'S' },
  { to: '/warfare',    label: 'Warfare',  key: 'W' },
  { to: '/spy',        label: 'Spy',      key: 'Y' },
  { to: '/projects',   label: 'Projects', key: 'P' },
  { to: '/diplomacy',  label: 'Diplo',    key: 'D' },
  { to: '/council',    label: 'Council',  key: 'C' },
  { to: '/battles',    label: 'Battles',  key: 'B' },
  { to: '/info',       label: 'Info',     key: 'I' },
  { to: '/blackmarket',label: 'Market',   key: 'M' },
];

function Nav() {
  const logout = useAuthStore((s) => s.logout);
  useHotkeys();

  return (
    <nav className="nav">
      <NavLink to="/" className="nav__brand">MagellanWars</NavLink>
      <div className="nav__sep" />
      {NAV_ITEMS.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => `nav__link${isActive ? ' active' : ''}`}
          data-tip={`[${item.key}]`}
        >
          {item.label}
        </NavLink>
      ))}
      <div className="nav__spacer" />
      <NavLink to="/prefs" className={({ isActive }) => `nav__link${isActive ? ' active' : ''}`}>Prefs</NavLink>
      <div className="nav__sep" />
      <button className="btn btn--sm" onClick={logout} style={{ margin: '0 4px' }}>Logout</button>
    </nav>
  );
}

export function App() {
  const token = useAuthStore((s) => s.token);
  const { toasts, toast, dismiss } = useToast();

  if (!token) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <ToastContext.Provider value={toast}>
      <Nav />
      <main className="page">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/tech" element={<TechPage />} />
          <Route path="/ships" element={<ShipDesignerPage />} />
          <Route path="/warfare" element={<WarfarePage />} />
          <Route path="/spy" element={<SpyPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/diplomacy" element={<DiplomacyPage />} />
          <Route path="/council" element={<CouncilPage />} />
          <Route path="/battles" element={<BattlesPage />} />
          <Route path="/info" element={<InfoPage />} />
          <Route path="/rankings" element={<RankingsPage />} />
          <Route path="/blackmarket" element={<BlackmarketPage />} />
          <Route path="/prefs" element={<PreferencesPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  );
}
