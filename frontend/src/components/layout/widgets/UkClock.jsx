import { useEffect, useState } from 'react';
import { syncRealTime, getSyncedDate, getSyncStatus } from '../../../services/time-api';

const DATE_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  weekday: 'short',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const TIME_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

// Live UK (Europe/London) date and time synchronized with Free Time API
function UkClock({ className = '', compact = false }) {
  const [now, setNow] = useState(getSyncedDate());
  const [status, setStatus] = useState(getSyncStatus());

  useEffect(() => {
    // Initial free API synchronization
    syncRealTime().then(() => {
      setNow(getSyncedDate());
      setStatus(getSyncStatus());
    });

    // 1-second continuous tick using synchronized clock
    const tickInterval = setInterval(() => {
      setNow(getSyncedDate());
    }, 1000);

    // Periodic re-sync with free API every 5 minutes
    const syncInterval = setInterval(() => {
      syncRealTime().then(() => {
        setStatus(getSyncStatus());
      });
    }, 5 * 60 * 1000);

    // Re-sync when user refocuses the tab / window
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        syncRealTime().then(() => {
          setNow(getSyncedDate());
          setStatus(getSyncStatus());
        });
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(tickInterval);
      clearInterval(syncInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const formattedTime = TIME_FORMATTER.format(now);
  const formattedDate = DATE_FORMATTER.format(now);
  const syncTitle = status.isSynced
    ? `Live UK Time synced via ${status.syncSource}`
    : 'Live UK Time (Local System)';

  if (compact) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 text-xs font-mono font-bold text-slate-700 dark:text-neutral-200 ${className}`}
        title={syncTitle}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            status.isSynced ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'
          }`}
        />
        <span>{formattedTime}</span>
        <span className="text-[10px] text-slate-400 dark:text-neutral-500">UK</span>
      </div>
    );
  }

  return (
    <div
      className={`hidden text-right leading-tight sm:block select-none ${className}`}
      title={syncTitle}
    >
      <div className="flex items-center justify-end gap-1.5">
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            status.isSynced ? 'bg-emerald-500 animate-pulse' : 'bg-emerald-400'
          }`}
          title={status.isSynced ? `Synced with ${status.syncSource}` : 'Syncing…'}
        />
        <p className="text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-400 tracking-tight">
          {formattedTime}{' '}
          <span className="text-[11px] font-semibold text-emerald-600/80 dark:text-emerald-500/80">
            UK
          </span>
        </p>
      </div>
      <p className="text-[11px] font-medium text-slate-500 dark:text-neutral-400 mt-0.5">
        {formattedDate}
      </p>
    </div>
  );
}

export default UkClock;
