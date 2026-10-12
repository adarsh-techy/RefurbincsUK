import { Suspense, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Outlet, Link } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import PortalHeader from './PortalHeader';
import AppFooter from './AppFooter';
import ClientNotificationBell from '../widgets/ClientNotificationBell';
import MessagesHeaderIcon from '../widgets/MessagesHeaderIcon';
import ThemeToggle from '../theme/ThemeToggle';
import ThemeCustomizerButton from '../theme/ThemeCustomizerButton';
import ThemeCustomizerModal from '../theme/ThemeCustomizerModal';
import UkClock from '../widgets/UkClock';
import LowStockAlert from '../widgets/LowStockAlert';
import UnserviceableBatteriesAlert from '../widgets/UnserviceableBatteriesAlert';
import { useTheme } from '../../../context/ThemeContext';
import { connectSocket, disconnectSocket } from '../../../services/socket-client';
import refurbnicsDarkLogo from '../../../assets/REFURBNICS.png';
import refurbnicsLightLogo from '../../../assets/LogoREFURBNICSBlack.png';
import logoUrl from '../../../utils/logo-url';

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
  const isAccentHeader = !isDark && !!customTheme?.applyToHeader;
  const brandLogo = isDark || isAccentHeader ? refurbnicsDarkLogo : refurbnicsLightLogo;
  const clientLogo = user?.role === 'client' ? logoUrl(user?.client_logo_path) : null;

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
          className={`sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between px-3.5 sm:px-8 backdrop-blur-md transition-colors shadow-xs border-b border-slate-200/80 dark:border-white/10 ${
            isAccentHeader ? 'text-white border-white/20' : ''
          }`}
          style={{ backgroundColor: headerBgColor }}
        >
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2">
              <img
                src={brandLogo}
                alt="Refurbinics"
                className="h-9 sm:h-11 w-auto max-w-[120px] min-[400px]:max-w-[160px] sm:max-w-[200px] object-contain"
              />
            </Link>
            <span
              className={`hidden border-l pl-3 text-xs font-semibold tracking-wider uppercase md:inline-block ${
                isAccentHeader ? 'border-white/30 text-white/80' : 'border-slate-200 text-slate-400 dark:border-white/10 dark:text-neutral-500'
              }`}
            >
              Battery Tracking & History
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-4">
            <UkClock />
            <ThemeCustomizerButton />
            <ThemeToggle />
            <Link
              to="/login"
              className={`rounded-xl px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs font-bold shadow-sm transition-all hover:opacity-90 ${
                isAccentHeader ? 'bg-white text-slate-900' : 'text-white'
              }`}
              style={!isAccentHeader ? { backgroundColor: customTheme?.accentColor || '#10b981' } : {}}
            >
              Sign In
            </Link>
          </div>
        </header>
        <main
          className="mx-auto min-w-0 flex-1 max-w-7xl w-full p-3 sm:p-6 lg:p-8 transition-colors pb-safe"
          style={{ backgroundColor: pageBgColor }}
        >
          <Suspense fallback={<PageFallback />}>
            <Outlet />
          </Suspense>
        </main>
        <AppFooter />

        {isCustomizerOpen && <ThemeCustomizerModal onClose={closeCustomizer} />}
      </div>
    );
  }

  // Technicians, staff, and supervisors in the workshop
  const isWorkshopStaff =
    user?.role === 'technician' ||
    user?.role === 'supervisor' ||
    user?.role === 'staff' ||
    user?.staff_role === 'technician' ||
    user?.staff_role === 'supervisor';

  if (isWorkshopStaff) {
    return (
      <div
        className={`${isDark ? 'dark' : ''} flex min-h-screen flex-col overflow-x-clip text-slate-900 dark:text-neutral-100 transition-colors`}
        style={{ backgroundColor: pageBgColor }}
      >
        <PortalHeader />
        <main className="flex-1 p-2.5 pb-20 sm:p-6 sm:pb-20 lg:pb-8">
          <Suspense fallback={<PageFallback />}>
            <Outlet />
          </Suspense>
        </main>
        <AppFooter className="mb-14 lg:mb-0" />
        {isCustomizerOpen && <ThemeCustomizerModal onClose={closeCustomizer} />}
      </div>
    );
  }

  // Clients Portal Layout
  if (user?.role === 'client') {
    return (
      <div
        className={`${isDark ? 'dark' : ''} min-h-screen transition-colors`}
        style={{ backgroundColor: wrapperBgColor }}
      >
        <Sidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
        <div className="flex min-h-screen min-w-0 flex-1 flex-col lg:pl-64">
          <Navbar onMenuClick={() => setMobileNavOpen(true)} />
          <main
            className="min-w-0 flex-1 p-3 sm:p-6 transition-colors pb-safe"
            style={{ backgroundColor: pageBgColor }}
          >
            <Suspense fallback={<PageFallback />}>
              <Outlet />
            </Suspense>
          </main>
          <AppFooter />
        </div>

        {isCustomizerOpen && <ThemeCustomizerModal onClose={closeCustomizer} />}
      </div>
    );
  }

  // Admin / Operations Layout
  return (
    <div
      className={`${isDark ? 'dark' : ''} min-h-screen transition-colors`}
      style={{ backgroundColor: wrapperBgColor }}
    >
      <Sidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col lg:pl-64">
        <Navbar onMenuClick={() => setMobileNavOpen(true)} />
        <main
          className="min-w-0 flex-1 p-3 sm:p-6 transition-colors pb-safe"
          style={{ backgroundColor: pageBgColor }}
        >
          <Suspense fallback={<PageFallback />}>
            <Outlet />
          </Suspense>
        </main>
        <AppFooter />
      </div>
      {/* Workshop alerts call office-only endpoints (/parts, unserviceable
          count); a recycle_client also lands in this layout but may not. */}
      {['super_admin', 'admin', 'staff'].includes(user?.role) && (
        <>
          <LowStockAlert />
          <UnserviceableBatteriesAlert />
        </>
      )}

      {isCustomizerOpen && <ThemeCustomizerModal onClose={closeCustomizer} />}
    </div>
  );
}

export default DashboardLayout;
