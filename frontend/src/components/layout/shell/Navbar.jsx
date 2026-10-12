import { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import NotificationBell from '../widgets/NotificationBell';
import ClientNotificationBell from '../widgets/ClientNotificationBell';
import MessagesHeaderIcon from '../widgets/MessagesHeaderIcon';
import RepeatIntakeAlert from '../widgets/RepeatIntakeAlert';
import ThemeToggle from '../theme/ThemeToggle';
import ThemeCustomizerButton from '../theme/ThemeCustomizerButton';
import UkClock from '../widgets/UkClock';
import { useTheme } from '../../../context/ThemeContext';
import { useSelector } from 'react-redux';
import refurbnicsDarkLogo from '../../../assets/REFURBNICS.png';
import refurbnicsLightLogo from '../../../assets/LogoREFURBNICSBlack.png';
import logoUrl from '../../../utils/logo-url';
import { NAV_GROUPS, CLIENT_NAV_GROUPS, RECYCLE_CLIENT_NAV_GROUPS } from './Sidebar';

function initials(name) {
  return (name || 'U')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function Navbar({ onMenuClick }) {
  const location = useLocation();
  const { customTheme, theme } = useTheme();
  const user = useSelector((state) => state.auth.user);

  const isDark = theme === 'dark';
  const isAccentHeader = !isDark && !!customTheme?.applyToHeader;
  const accent = customTheme?.accentColor || '#10b981';
  const isClient = user?.role === 'client' || user?.role === 'recycle_client';
  const clientLogo = user?.role === 'client' ? logoUrl(user?.client_logo_path) : null;
  const brandLogo = isDark || isAccentHeader ? refurbnicsDarkLogo : refurbnicsLightLogo;

  // Header background: gets ACCENT COLOR when applyToHeader is checked, otherwise clean white/dark
  const headerBgColor = isAccentHeader
    ? (customTheme.accentColor || '#10b981')
    : isDark
      ? '#000000'
      : '#ffffff';

  const role = user?.role || 'staff';
  const roleLabel =
    role === 'super_admin' ? 'Super Admin' :
    role === 'admin' ? 'Admin' :
    role === 'client' ? 'Client' :
    role === 'recycle_client' ? 'Recycle Partner' :
    role === 'supervisor' ? 'Supervisor' :
    role === 'technician' ? 'Technician' :
    'Staff';

  const allGroups = isClient
    ? (user?.role === 'recycle_client' ? RECYCLE_CLIENT_NAV_GROUPS : CLIENT_NAV_GROUPS)
    : NAV_GROUPS;

  const currentNavInfo = useMemo(() => {
    const path = location.pathname;
    if (allGroups) {
      for (const group of allGroups) {
        for (const link of group.links) {
          if (link.end ? path === link.to : path === link.to || (link.to !== '/' && path.startsWith(link.to))) {
            return {
              groupHeading: group.heading,
              linkLabel: link.label,
            };
          }
        }
      }
    }
    // Contextual fallbacks for sub-detail routes
    if (path.startsWith('/batteries/')) return { groupHeading: 'Battery Operations', linkLabel: 'Battery Details' };
    if (path.startsWith('/truck-intakes/')) return { groupHeading: 'Battery Operations', linkLabel: 'Truck Intake Details' };
    if (path.startsWith('/returns/')) return { groupHeading: 'Battery Operations', linkLabel: 'Return Details' };
    if (path.startsWith('/clients/')) return { groupHeading: 'Clients & Staff', linkLabel: 'Client Profile' };
    if (path.startsWith('/staff/')) return { groupHeading: 'Clients & Staff', linkLabel: 'Staff Profile' };
    if (path.startsWith('/invoices/')) return { groupHeading: 'Finance & Impact', linkLabel: 'Invoice Details' };
    if (path.startsWith('/my/batteries/')) return { groupHeading: 'Repairs & Sorting', linkLabel: 'Battery Details' };
    return { groupHeading: 'Operations', linkLabel: 'Dashboard' };
  }, [allGroups, location.pathname]);

  return (
    <header
      className={`sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-3 px-3.5 sm:px-6 transition-colors shadow-xs border-b border-slate-200/80 dark:border-white/10 ${
        isAccentHeader ? 'text-white border-white/20' : ''
      }`}
      style={{ backgroundColor: headerBgColor }}
    >
      {/* ── Left Side: Mobile Menu + Logo OR Desktop Breadcrumb ── */}
      <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
        {/* Mobile menu trigger */}
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open menu"
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl md:hidden transition-colors ${
            isAccentHeader
              ? 'text-white hover:bg-white/15 active:bg-white/20'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-neutral-300 dark:hover:bg-white/10 dark:hover:text-white'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-[1.375rem] w-[1.375rem]">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
          </svg>
        </button>

        {/* Mobile brand logo */}
        <Link to="/" className="flex shrink-0 items-center md:hidden">
          <img
            src={clientLogo || brandLogo}
            alt={user?.name || 'Refurbnics'}
            className="h-8 sm:h-[2.125rem] w-auto max-w-[105px] min-[400px]:max-w-[140px] sm:max-w-[175px] object-contain transition-transform active:scale-[0.98]"
          />
        </Link>

        {/* Desktop Breadcrumb Navigation */}
        <div className="hidden md:flex items-center gap-2 min-w-0">
          <span className={`text-[11px] font-extrabold uppercase tracking-wider shrink-0 ${
            isAccentHeader ? 'text-white/70' : 'text-slate-400 dark:text-neutral-500'
          }`}>
            {currentNavInfo?.groupHeading || 'Refurbnics'}
          </span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-3 w-3 shrink-0 ${isAccentHeader ? 'text-white/40' : 'text-slate-300 dark:text-neutral-600'}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <h1 className={`truncate text-sm font-extrabold tracking-tight ${
            isAccentHeader ? 'text-white' : 'text-slate-800 dark:text-white'
          }`}>
            {currentNavInfo?.linkLabel || 'Dashboard'}
          </h1>
        </div>
      </div>

      {/* ── Right Side: Clock, Alerts, Widgets & User Chip ── */}
      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        <UkClock isAccentHeader={isAccentHeader} />

        <div className="flex items-center gap-1">
          {!isClient && <RepeatIntakeAlert />}
          {user?.role === 'client' ? <ClientNotificationBell /> : user?.role === 'recycle_client' ? null : <NotificationBell />}
          <MessagesHeaderIcon />
          <ThemeCustomizerButton />
          <ThemeToggle />
        </div>

        {/* Desktop User Profile Chip */}
        <div className={`hidden sm:flex items-center gap-2 pl-2 sm:pl-3 border-l ${
          isAccentHeader ? 'border-white/20' : 'border-slate-200 dark:border-white/10'
        }`}>
          <span
            className="flex h-[2.125rem] w-[2.125rem] shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white shadow-xs"
            style={{ backgroundColor: isAccentHeader ? 'rgba(255, 255, 255, 0.25)' : accent }}
            title={`${user?.name || 'User'} (${user?.email || ''})`}
          >
            {initials(user?.name)}
          </span>
          <div className="hidden lg:flex flex-col text-left leading-tight min-w-0 max-w-[130px]">
            <span className={`truncate text-xs font-bold ${
              isAccentHeader ? 'text-white' : 'text-slate-800 dark:text-white'
            }`}>
              {user?.name || 'User'}
            </span>
            <span className={`truncate text-[10px] font-semibold uppercase tracking-wider ${
              isAccentHeader ? 'text-white/80' : 'text-emerald-600 dark:text-emerald-400'
            }`}>
              {roleLabel}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Navbar;
