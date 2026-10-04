import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../../../features/auth/auth-slice';
import { useTheme } from '../../../context/ThemeContext';
import UkClock from '../widgets/UkClock';
import refurbnicsDarkLogo from '../../../assets/REFURBNICS.png';
import refurbnicsLightLogo from '../../../assets/LogoREFURBNICSBlack.png';

function ServiceIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

function DashboardIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="7" height="9" x="3" y="3" rx="1" />
      <rect width="7" height="5" x="14" y="3" rx="1" />
      <rect width="7" height="9" x="14" y="12" rx="1" />
      <rect width="7" height="5" x="3" y="16" rx="1" />
    </svg>
  );
}

function HistoryIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15.5 14" />
    </svg>
  );
}

function ProfileIcon({ className = 'h-4 w-4' }) {
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

function initials(name) {
  return (name || 'Staff')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function PortalHeader() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);
  const { theme, customTheme } = useTheme();

  const isStaffRole =
    user?.role === 'technician' ||
    user?.role === 'supervisor' ||
    user?.role === 'staff' ||
    user?.staff_role === 'technician' ||
    user?.staff_role === 'supervisor';

  const staffRole = (user?.staff_role || user?.staffRole || user?.role || 'staff').toLowerCase();
  const isSupervisor = staffRole === 'supervisor';
  const roleLabel = isSupervisor ? 'Supervisor' : staffRole === 'technician' ? 'Technician' : 'Staff';

  const isDark = theme === 'dark';
  const isAccentHeader = !isDark && !!customTheme?.applyToHeader;
  const brandLogo = isDark || isAccentHeader ? refurbnicsDarkLogo : refurbnicsLightLogo;

  const headerBgColor = isAccentHeader
    ? (customTheme?.accentColor || '#10b981')
    : isDark
      ? '#000000'
      : '#ffffff';

  function handleLogout() {
    dispatch(logout());
    navigate('/login', { replace: true });
  }

  return (
    <>
      <header
        className={`sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-2 sm:gap-4 px-3 sm:px-6 transition-colors shadow-xs border-b ${
          isAccentHeader
            ? 'text-white border-white/20'
            : 'border-slate-200/90 bg-white text-slate-800 dark:border-white/10 dark:bg-black dark:text-neutral-100'
        }`}
        style={{ backgroundColor: headerBgColor }}
      >
        {/* Brand Logo & Desktop Navigation */}
        <div className="flex items-center gap-3 sm:gap-6 min-w-0">
          <Link to="/" className="flex shrink-0 items-center gap-2">
            <img
              src={brandLogo}
              alt="Refurbnics"
              className="h-8 sm:h-9 w-auto max-w-[140px] sm:max-w-[185px] object-contain transition-transform active:scale-95"
            />
          </Link>

          {isStaffRole && (
            <nav className="hidden items-center gap-1 md:flex">
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
                          ? isAccentHeader
                            ? 'bg-white/20 text-white shadow-xs'
                            : 'bg-slate-900 text-white shadow-xs dark:bg-white dark:text-slate-950'
                          : isAccentHeader
                            ? 'text-white/80 hover:bg-white/10 hover:text-white'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-neutral-300 dark:hover:bg-white/5 dark:hover:text-white'
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
        </div>

        {/* Right Tools, Clock, Staff Info & Logout */}
        <div className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-3.5">
          <UkClock className="hidden xl:block" />
          <UkClock compact className="hidden sm:inline-flex xl:hidden" />

          {/* User Info & Role Badge */}
          <div className="flex items-center gap-2 pl-1 sm:pl-2.5 border-l border-slate-200 dark:border-white/10">
            <div
              className={`flex h-8 w-8 sm:h-8.5 sm:w-8.5 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-1 transition-all ${
                isSupervisor
                  ? 'bg-amber-100 text-amber-900 ring-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:ring-amber-700/60'
                  : 'bg-emerald-100 text-emerald-900 ring-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-700/60'
              }`}
              title={`${user?.name || 'Staff'} (${roleLabel})`}
            >
              {initials(user?.name)}
            </div>

            <div className="hidden sm:flex flex-col text-left leading-tight min-w-0 max-w-[110px] md:max-w-[150px]">
              <span className="truncate text-xs font-bold text-slate-800 dark:text-white">
                {user?.name || 'Staff User'}
              </span>
              <span
                className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider ${
                  isSupervisor
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    isSupervisor ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                />
                {roleLabel}
              </span>
            </div>
          </div>

          {/* Logout Button */}
          <button
            type="button"
            onClick={handleLogout}
            title="Log out"
            aria-label="Log out"
            className="flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-slate-50 px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs font-bold text-slate-700 hover:border-red-200 hover:bg-red-50 hover:text-red-600 active:scale-95 dark:border-white/10 dark:bg-white/5 dark:text-neutral-200 dark:hover:border-red-900/50 dark:hover:bg-red-950/40 dark:hover:text-red-400 transition-all cursor-pointer shadow-2xs shrink-0"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* Mobile Bottom Tab Bar */}
      {isStaffRole && (
        <div className="fixed bottom-0 inset-x-0 z-40 flex h-14 items-center justify-around border-t border-slate-200 bg-white/95 backdrop-blur-md px-1.5 py-0.5 shadow-lg dark:border-white/10 dark:bg-black/95 md:hidden">
          {TECHNICIAN_TABS.map((tab) => {
            const IconComp = tab.icon;
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  `flex flex-1 flex-col items-center justify-center py-1 transition-colors ${
                    isActive
                      ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                      : 'text-slate-500 dark:text-neutral-400 font-medium'
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
