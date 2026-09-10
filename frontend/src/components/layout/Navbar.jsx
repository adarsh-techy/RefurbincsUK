import NotificationBell from './NotificationBell';
import ClientNotificationBell from './ClientNotificationBell';
import MessagesHeaderIcon from './MessagesHeaderIcon';
import RepeatIntakeAlert from './RepeatIntakeAlert';
import ThemeToggle from './ThemeToggle';
import ThemeCustomizerButton from './ThemeCustomizerButton';
import UkClock from './UkClock';
import { useTheme } from '../../context/ThemeContext';
import { useSelector } from 'react-redux';

function Navbar({ onMenuClick }) {
  const { customTheme, theme } = useTheme();
  const user = useSelector((state) => state.auth.user);

  const isDark = theme === 'dark';
  const isAccentHeader = !!customTheme?.applyToHeader;
  const isClient = user?.role === 'client' || user?.role === 'recycle_client';

  // Header background: gets ACCENT COLOR when applyToHeader is checked, otherwise clean white/dark
  const headerBgColor = isAccentHeader
    ? (customTheme.accentColor || '#10b981')
    : isDark
      ? '#000000'
      : '#ffffff';

  return (
    <header
      className={`sticky top-0 z-10 flex h-20 items-center justify-between gap-3 px-4 sm:px-6 transition-colors shadow-xs border-b border-slate-200/80 dark:border-white/10 ${
        isAccentHeader ? 'text-white border-white/20' : ''
      }`}
      style={{ backgroundColor: headerBgColor }}
    >
      <button
        type="button"
        onClick={onMenuClick}
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

      <div className="ml-auto flex items-center gap-3 sm:gap-4">
        <UkClock />
        {!isClient && <RepeatIntakeAlert />}
        {isClient ? <ClientNotificationBell /> : <NotificationBell />}
        <MessagesHeaderIcon />
        <ThemeCustomizerButton />
        <ThemeToggle />
      </div>
    </header>
  );
}

export default Navbar;
