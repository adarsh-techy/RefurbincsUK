import { Suspense, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Outlet, Link } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import PortalHeader from './PortalHeader';
import ClientNotificationBell from './ClientNotificationBell';
import MessagesHeaderIcon from './MessagesHeaderIcon';
import ThemeToggle from './ThemeToggle';
import ThemeCustomizerButton from './ThemeCustomizerButton';
import ThemeCustomizerModal from './ThemeCustomizerModal';
import UkClock from './UkClock';
import LowStockAlert from './LowStockAlert';
import UnserviceableBatteriesAlert from './UnserviceableBatteriesAlert';
import { useTheme } from '../../context/ThemeContext';
import { connectSocket, disconnectSocket } from '../../services/socket-client';
import refurbnicsLogo from '../../assets/Refurbnics.png';

function PageFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center text-sm text-slate-500 dark:text-neutral-400">
      Loading…
    </div>
  );
}

function DashboardLayout() {
  const user = useSelector((state) => state.auth.user);
  const token = useSelector((state) => state.auth.token);
  const { theme, customTheme, isCustomizerOpen, closeCustomizer } = useTheme();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!token) return undefined;
    connectSocket();
    return () => disconnectSocket();
  }, [token]);

  const isDark = theme === 'dark';
  const isAccentHeader = !!customTheme?.applyToHeader;

  // Header background: gets ACCENT COLOR when applyToHeader is checked, otherwise clean white/dark
  const headerBgColor = isAccentHeader
    ? (customTheme.accentColor || '#10b981')
    : isDark
      ? '#000000'
      : '#ffffff';

  // Page background: takes customTheme.pageBg in light mode, pitch black in dark mode
  const pageBgColor = isDark ? '#000000' : (customTheme?.pageBg || '#ffffff');

  // Base background for layout wrapper
  const wrapperBgColor = isDark ? '#000000' : '#ffffff';

  // Unauthenticated visitor (e.g. client scanning a QR code with their mobile phone)
  if (!user) {
    return (
      <div
        className={`${isDark ? 'dark' : ''} flex min-h-screen flex-col text-slate-900 dark:text-neutral-100 transition-colors`}
        style={{ backgroundColor: wrapperBgColor }}
      >
        <header
          className={`sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between px-4 backdrop-blur-md sm:px-8 transition-colors shadow-xs border-b border-slate-200/80 dark:border-white/10 ${
            isAccentHeader ? 'text-white border-white/20' : ''
          }`}
          style={{ backgroundColor: headerBgColor }}
        >
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2">
              <img
                src={refurbnicsLogo}
                alt="Refurbinics"
                className={`h-9 w-auto ${isAccentHeader ? 'brightness-0 invert' : ''}`}
              />
            </Link>
            <span
              className={`hidden border-l pl-3 text-xs font-semibold tracking-wider uppercase sm:inline-block ${
                isAccentHeader ? 'border-white/30 text-white/80' : 'border-slate-200 text-slate-400 dark:border-white/10 dark:text-neutral-500'
              }`}
            >
              Battery Tracking & History
            </span>
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            <UkClock />
            <ThemeCustomizerButton />
            <ThemeToggle />
            <Link
              to="/login"
              className={`rounded-xl px-4 py-2 text-xs font-bold shadow-sm transition-all hover:opacity-90 ${
                isAccentHeader ? 'bg-white text-slate-900' : 'text-white'
              }`}
              style={!isAccentHeader ? { backgroundColor: customTheme?.accentColor || '#10b981' } : {}}
            >
              Sign In
            </Link>
          </div>
        </header>
        <main
          className="mx-auto min-w-0 flex-1 max-w-7xl w-full p-4 sm:p-6 lg:p-8 transition-colors"
          style={{ backgroundColor: pageBgColor }}
        >
          <Suspense fallback={<PageFallback />}>
            <Outlet />
          </Suspense>
        </main>

        {isCustomizerOpen && <ThemeCustomizerModal onClose={closeCustomizer} />}
      </div>
    );
  }

  // Technicians work mostly from a phone scanning batteries
  if (user?.role === 'technician') {
    return (
      <div
        className="flex min-h-screen flex-col overflow-x-hidden transition-colors"
        style={{ backgroundColor: pageBgColor }}
      >
        <div className="dark">
          <PortalHeader />
        </div>
        <main className="flex-1 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6">
          <Suspense fallback={<PageFallback />}>
            <Outlet />
          </Suspense>
        </main>
        {isCustomizerOpen && <ThemeCustomizerModal onClose={closeCustomizer} />}
      </div>
    );
  }

  // Clients Portal Layout
  if (user?.role === 'client') {
    return (
      <div
        className={`${isDark ? 'dark' : ''} flex min-h-screen transition-colors`}
        style={{ backgroundColor: wrapperBgColor }}
      >
        <Sidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <header
            className={`sticky top-0 z-10 flex h-16 shrink-0 items-center gap-3 px-4 sm:px-6 transition-colors shadow-xs border-b border-slate-200/80 dark:border-white/10 ${
              isAccentHeader ? 'text-white border-white/20' : ''
            }`}
            style={{ backgroundColor: headerBgColor }}
          >
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open menu"
              className={`rounded-xl p-2 md:hidden ${
                isAccentHeader
                  ? 'text-white hover:bg-white/15'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-neutral-300 dark:hover:bg-white/5 dark:hover:text-white'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
              </svg>
            </button>
            <img
              src={refurbnicsLogo}
              alt="Refurbinics"
              className={`h-8 w-auto max-w-[140px] object-contain md:hidden ${isAccentHeader ? 'brightness-0 invert' : ''}`}
            />
            <div className="ml-auto flex items-center gap-3 sm:gap-4">
              <UkClock />
              <ClientNotificationBell />
              <MessagesHeaderIcon />
              <ThemeCustomizerButton />
              <ThemeToggle />
            </div>
          </header>
          <main
            className="min-w-0 flex-1 p-4 sm:p-6 transition-colors"
            style={{ backgroundColor: pageBgColor }}
          >
            <Suspense fallback={<PageFallback />}>
              <Outlet />
            </Suspense>
          </main>
        </div>

        {isCustomizerOpen && <ThemeCustomizerModal onClose={closeCustomizer} />}
      </div>
    );
  }

  // Admin / Operations Layout
  return (
    <div
      className={`${isDark ? 'dark' : ''} flex min-h-screen transition-colors`}
      style={{ backgroundColor: wrapperBgColor }}
    >
      <Sidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Navbar onMenuClick={() => setMobileNavOpen(true)} />
        <main
          className="min-w-0 flex-1 p-4 sm:p-6 transition-colors"
          style={{ backgroundColor: pageBgColor }}
        >
          <Suspense fallback={<PageFallback />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <LowStockAlert />
      <UnserviceableBatteriesAlert />

      {isCustomizerOpen && <ThemeCustomizerModal onClose={closeCustomizer} />}
    </div>
  );
}

export default DashboardLayout;
