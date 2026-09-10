import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, NavLink } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../../features/auth/auth-slice';
import refurbnicsLogo from '../../assets/Refurbnics.png';

// A technician's menu of pages to browse. Service is their scan-a-battery
// to start work page (the "/" home) — leads the menu since it's the
// primary action.
const TECHNICIAN_NAV = [
  { to: '/', label: 'Service', end: true },
  { to: '/my/dashboard', label: 'Dashboard' },
  { to: '/my/history', label: 'History' },
  { to: '/my/profile', label: 'Profile' },
];

const navLinkClasses = ({ isActive }) =>
  `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
    isActive
      ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300'
      : 'text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-blue-900/30'
  }`;

// Sidebar-style nav item for the mobile drawer — mirrors the admin
// Sidebar's active-state left accent bar, in blue instead of emerald.
const drawerLinkClasses = ({ isActive }) =>
  `relative rounded-lg px-3 py-2.5 text-sm font-medium leading-none transition-colors ${
    isActive
      ? 'bg-blue-500/10 text-blue-400 before:absolute before:left-0 before:top-1/2 before:h-4 before:w-[3px] before:-translate-y-1/2 before:rounded-full before:bg-blue-400'
      : 'text-neutral-400 hover:bg-white/5 hover:text-white'
  }`;

function initials(name) {
  return (name || '')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

// Minimal top bar for portal roles (client/technician). Technicians get a
// Dashboard/History/Profile menu — shown inline on wider screens, and
// behind a hamburger + slide-out drawer on mobile so the header itself
// never has to squeeze past viewport width.
function PortalHeader() {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isTechnician = user?.role === 'technician';

  useEffect(() => {
    if (!drawerOpen) return;
    function handleKeyDown(e) {
      if (e.key === 'Escape') setDrawerOpen(false);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [drawerOpen]);

  return (
    <>
      <header className="sticky top-0 z-10 flex h-16 items-center gap-2 border-b border-slate-200/80 bg-white px-3 dark:border-white/10 dark:bg-surface-950/90 dark:backdrop-blur sm:gap-4 sm:px-6 shadow-xs">
        <Link to="/" className="flex items-center">
          <img
            src={refurbnicsLogo}
            alt="Refurbinics"
            className="h-8 w-auto max-w-[150px] object-contain sm:h-9 sm:max-w-[170px]"
          />
        </Link>
        {isTechnician && (
          <nav className="hidden items-center gap-1 md:flex">
            {TECHNICIAN_NAV.map((link) => (
              <NavLink key={link.to} to={link.to} end={link.end} className={navLinkClasses}>
                {link.label}
              </NavLink>
            ))}
          </nav>
        )}

        <div className="ml-auto flex min-w-0 shrink-0 items-center gap-2 sm:gap-3">
          <span className="hidden truncate text-sm text-slate-600 dark:text-neutral-300 sm:inline">
            {user?.name}
          </span>
          <button
            onClick={() => dispatch(logout())}
            className={`shrink-0 rounded-md bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 dark:bg-blue-900/20 dark:text-neutral-200 dark:hover:bg-blue-900/30 ${
              isTechnician ? 'hidden md:inline-flex' : ''
            }`}
          >
            Logout
          </button>
          {isTechnician && (
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
              className="shrink-0 rounded-md p-2 text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-blue-900/30 md:hidden"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
              </svg>
            </button>
          )}
        </div>
      </header>

    {isTechnician &&
      createPortal(
        <div
          className={`fixed inset-0 z-50 md:hidden transition-opacity duration-300 ${
            drawerOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
          }`}
        >
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setDrawerOpen(false)} />
          <aside
            className={`absolute inset-y-0 right-0 flex w-64 max-w-[80vw] flex-col bg-black shadow-2xl transition-transform duration-300 ${
              drawerOpen ? 'translate-x-0' : 'translate-x-full'
            }`}
          >
            <div className="relative flex h-16 items-center px-6">
              <img src={refurbnicsLogo} alt="Refurbinics" className="h-8 w-auto max-w-[150px] object-contain" />
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close menu"
                className="absolute right-3 top-3 rounded-md p-1.5 text-neutral-400 hover:bg-white/5 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="mx-5 border-t border-white/10" />

            <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-4 py-5">
              {TECHNICIAN_NAV.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  onClick={() => setDrawerOpen(false)}
                  className={drawerLinkClasses}
                >
                  {link.label}
                </NavLink>
              ))}
            </nav>

            <div className="shrink-0 border-t border-white/10 p-4">
              <div className="mb-3 flex items-center gap-3 px-1">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-xs font-semibold text-blue-400 ring-1 ring-blue-500/30">
                  {initials(user?.name)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">{user?.name}</p>
                  <p className="truncate text-xs capitalize text-neutral-500">{user?.role}</p>
                </div>
              </div>
              <button
                onClick={() => dispatch(logout())}
                className="w-full rounded-lg bg-white/5 px-3 py-2 text-sm font-medium text-neutral-300 transition-colors hover:bg-red-500/10 hover:text-red-400"
              >
                Logout
              </button>
            </div>
          </aside>
        </div>,
        document.body
      )}
    </>
  );
}

export default PortalHeader;
