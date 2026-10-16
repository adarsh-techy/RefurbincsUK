import { Link } from 'react-router-dom';
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



function Navbar({ onMenuClick }) {
  const { customTheme, theme } = useTheme();
  const user = useSelector((state) => state.auth.user);

  const isDark = theme === 'dark';
  const isAccentHeader = !isDark && !!customTheme?.applyToHeader;
  const isClient = user?.role === 'client' || user?.role === 'recycle_client';
  const clientLogo = user?.role === 'client' ? logoUrl(user?.client_logo_path) : null;
  const brandLogo = isDark || isAccentHeader ? refurbnicsDarkLogo : refurbnicsLightLogo;

  // Header background: gets ACCENT COLOR when applyToHeader is checked, otherwise clean white/dark
  const headerBgColor = isAccentHeader
    ? (customTheme.accentColor || '#10b981')
    : isDark
      ? '#000000'
      : '#ffffff';

  return (
    <header
      className={`sticky top-0 z-40 flex h-16 shrink-0 items-center justify-between gap-3 px-3.5 sm:px-6 transition-colors shadow-xs border-b border-slate-200/80 dark:border-white/10 ${
        isAccentHeader ? 'text-white border-white/20' : ''
      }`}
      style={{ backgroundColor: headerBgColor }}
    >
      {/* ── Left Side: Mobile Menu + Logo (lg:hidden) ── */}
      <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
        {/* Mobile menu trigger */}
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open menu"
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl lg:hidden transition-colors ${
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
        <Link to="/" className="flex shrink-0 items-center lg:hidden">
          <img
            src={clientLogo || brandLogo}
            alt={user?.name || 'Refurbnics'}
            className="h-8 sm:h-[2.125rem] w-auto max-w-[105px] min-[400px]:max-w-[140px] sm:max-w-[175px] object-contain transition-transform active:scale-[0.98]"
          />
        </Link>
      </div>

      {/* ── Right Side: Clock, Alerts & Tools ── */}
      <div className="ml-auto flex items-center gap-1.5 sm:gap-2.5">
        <UkClock isAccentHeader={isAccentHeader} className="hidden md:inline-flex" />

        <div className="flex items-center gap-1">
          {!isClient && <RepeatIntakeAlert />}
          {user?.role === 'client' ? <ClientNotificationBell /> : user?.role === 'recycle_client' ? null : <NotificationBell />}
          <MessagesHeaderIcon />
          {/* phones: these two move into the menu drawer */}
          <div className="hidden sm:flex items-center gap-1">
            <ThemeCustomizerButton />
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}

export default Navbar;
