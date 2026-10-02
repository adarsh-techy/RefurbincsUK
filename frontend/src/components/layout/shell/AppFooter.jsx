import { useSelector } from 'react-redux';

// Developer credit shown at the bottom of every layout and the login page.
function AppFooter({ className = '' }) {
  const user = useSelector((state) => state.auth?.user);
  const isStaffRole = user?.role === 'staff' || user?.role === 'technician' || user?.role === 'supervisor';

  if (isStaffRole) {
    return null;
  }

  return (
    <footer
      className={`border-t border-slate-200/80 px-4 py-3 text-left text-xs sm:px-6 text-slate-500 dark:border-white/10 dark:text-neutral-400 ${className}`}
    >
      Developed by{' '}
      <span className="font-bold text-blue-600 dark:text-blue-400">Eswincha</span>{' '}
      <span className="font-bold text-red-600 dark:text-red-400">Technologies</span>
    </footer>
  );
}

export default AppFooter;
