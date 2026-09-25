import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../../../features/auth/auth-slice';
import { useTheme } from '../../../context/ThemeContext';
import UkClock from '../widgets/UkClock';
import refurbnicsDarkLogo from '../../../assets/REFURBNICS.png';
import refurbnicsLightLogo from '../../../assets/LogoREFURBNICSBlack.png';

function ServiceIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

function DashboardIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="7" height="9" x="3" y="3" rx="1" />
      <rect width="7" height="5" x="14" y="3" rx="1" />
      <rect width="7" height="9" x="14" y="12" rx="1" />
      <rect width="7" height="5" x="3" y="16" rx="1" />
    </svg>
  );
}

function HistoryIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15.5 14" />
    </svg>
  );
}

function ProfileIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

const TECHNICIAN_TABS = [
  { to: '/', label: 'Service', icon: ServiceIcon, end: true },
  { to: '/my/dashboard', label: 'Dashboard', icon: DashboardIcon },
  { to: '/my/history', label: 'History', icon: HistoryIcon },
  { to: '/my/profile', label: 'Profile', icon: ProfileIcon },
];

function PortalHeader() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);
  const { theme } = useTheme();
  const isTechnician = user?.role === 'technician';
  const isDark = theme === 'dark';
  const brandLogo = isDark ? refurbnicsDarkLogo : refurbnicsLightLogo;

  function handleLogout() {
    dispatch(logout());
    navigate('/login', { replace: true });
  }

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-slate-200/80 bg-white px-3 dark:border-white/10 dark:bg-surface-950/90 dark:backdrop-blur sm:gap-4 sm:px-6 shadow-xs">
        <Link to="/" className="flex items-center">
          <img
            src={brandLogo}
            alt="Refurbinics"
            className="h-10 sm:h-11 w-auto max-w-[200px] sm:max-w-[220px] object-contain"
          />
        </Link>

        {isTechnician && (
          <nav className="hidden items-center gap-1.5 md:flex ml-4">
            {TECHNICIAN_TABS.map((tab) => {
              const IconComp = tab.icon;
              return (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  end={tab.end}
                  className={({ isActive }) =>
                    `flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                        : 'text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-white/5'
                    }`
                  }
                >
                  <IconComp className="h-4 w-4" />
                  <span>{tab.label}</span>
                </NavLink>
              );
            })}
          </nav>
        )}

        <div className="ml-auto flex min-w-0 shrink-0 items-center gap-2 sm:gap-4">
          <UkClock />
          <span className="hidden truncate text-sm font-medium text-slate-700 dark:text-neutral-300 sm:inline">
            {user?.name}
          </span>
          <button
            onClick={handleLogout}
            className="shrink-0 rounded-xl bg-slate-100 px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 active:bg-slate-300 dark:bg-surface-800 dark:text-neutral-200 dark:hover:bg-surface-700 transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Mobile Bottom Tab Bar — exact replica of mobile app MainTabs */}
      {isTechnician && (
        <div className="fixed bottom-0 inset-x-0 z-40 flex h-16 items-center justify-around border-t border-slate-200 bg-white/95 backdrop-blur-md px-2 py-1 shadow-lg dark:border-white/10 dark:bg-black/95 md:hidden">
          {TECHNICIAN_TABS.map((tab) => {
            const IconComp = tab.icon;
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  `flex flex-1 flex-col items-center justify-center py-1 transition-colors ${
                    isActive ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-slate-500 dark:text-neutral-400 font-medium'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <IconComp className={`h-5 w-5 mb-0.5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
                    <span className="text-[10px] tracking-tight">{tab.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </div>
      )}
    </>
  );
}

export default PortalHeader;
