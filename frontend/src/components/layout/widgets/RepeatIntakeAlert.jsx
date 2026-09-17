import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../../services/api-client';
import { socket } from '../../../services/socket-client';
import { hasPermission } from '../../../utils/permissions';

// Repeat-arrow icon with a badge count of batteries that have come in on
// more than one truck intake this calendar month. Opening it lists each
// battery with every intake time this month, so staff can spot one bouncing
// back unusually fast; clicking jumps to that battery's own history. Kept
// live by the server pushing a fresh list over the socket whenever a new
// intake is recorded (see backend/src/realtime) instead of polling.
function RepeatIntakeAlert() {
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);
  const canViewIntakes = hasPermission(user, 'truck_intakes');
  const [repeats, setRepeats] = useState([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  async function loadRepeats() {
    try {
      const { data } = await apiClient.get('/batteries/repeat-intakes-this-month');
      setRepeats(data);
    } catch {
      // Silent — a failed background refresh shouldn't disrupt the navbar.
    }
  }

  useEffect(() => {
    if (!canViewIntakes) return undefined;
    loadRepeats();
    socket.on('connect', loadRepeats);
    socket.on('intakes:repeats', setRepeats);
    return () => {
      socket.off('connect', loadRepeats);
      socket.off('intakes:repeats', setRepeats);
    };
  }, [canViewIntakes]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function goToBattery(code) {
    setOpen(false);
    navigate(`/batteries/${code}`);
  }

  function handleToggle() {
    if (!open) loadRepeats();
    setOpen((prev) => !prev);
  }

  if (!canViewIntakes) return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        aria-label="Repeat intakes this month"
        className="relative rounded-md p-2.5 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-900 dark:text-neutral-300 dark:hover:bg-neutral-900 dark:hover:text-white"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-7 w-7">
          <path
            fillRule="evenodd"
            d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H3.989a.75.75 0 0 0-.75.75v4.242a.75.75 0 0 0 1.5 0v-2.43l.31.31a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.449-.39Zm1.23-3.723a.75.75 0 0 0 .219-.53V2.929a.75.75 0 0 0-1.5 0V5.36l-.31-.31A7 7 0 0 0 3.239 8.188a.75.75 0 1 0 1.448.389A5.5 5.5 0 0 1 13.89 6.11l.311.31h-2.432a.75.75 0 0 0 0 1.5h4.243a.75.75 0 0 0 .53-.219Z"
            clipRule="evenodd"
          />
        </svg>
        {repeats.length > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-5 min-w-[1.25rem] animate-pulse items-center justify-center rounded-full bg-warning-600 px-1 text-xs font-semibold text-white ring-2 ring-white dark:ring-black">
            {repeats.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-96 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-surface-700 dark:bg-surface-900">
          <div className="flex items-center gap-2.5 border-b border-slate-100 bg-gradient-to-r from-warning-50 to-white px-4 py-3 dark:border-surface-700 dark:from-amber-500/10 dark:to-surface-900">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-warning-100 text-warning-700 dark:bg-amber-500/15 dark:text-amber-300">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4.5 w-4.5">
                <path
                  fillRule="evenodd"
                  d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H3.989a.75.75 0 0 0-.75.75v4.242a.75.75 0 0 0 1.5 0v-2.43l.31.31a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.449-.39Zm1.23-3.723a.75.75 0 0 0 .219-.53V2.929a.75.75 0 0 0-1.5 0V5.36l-.31-.31A7 7 0 0 0 3.239 8.188a.75.75 0 1 0 1.448.389A5.5 5.5 0 0 1 13.89 6.11l.311.31h-2.432a.75.75 0 0 0 0 1.5h4.243a.75.75 0 0 0 .53-.219Z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-800 dark:text-neutral-100">Repeat Intakes This Month</p>
              <p className="text-xs text-slate-500 dark:text-neutral-400">
                {repeats.length === 0
                  ? 'Nothing flagged yet'
                  : `${repeats.length} batter${repeats.length === 1 ? 'y has' : 'ies have'} come back more than once`}
              </p>
            </div>
          </div>

          {repeats.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-surface-800 dark:text-neutral-500">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                  <path
                    fillRule="evenodd"
                    d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                    clipRule="evenodd"
                  />
                </svg>
              </span>
              <p className="text-sm text-slate-500 dark:text-neutral-400">
                No battery has come in more than once this month.
              </p>
            </div>
          ) : (
            <ul className="max-h-96 overflow-y-auto p-2">
              {repeats.map((b) => (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => goToBattery(b.battery_code)}
                    className="group flex w-full flex-col items-start gap-1.5 rounded-lg border border-transparent px-3 py-2.5 text-left transition-colors hover:border-warning-200 hover:bg-warning-50 dark:hover:border-amber-500/20 dark:hover:bg-amber-500/10"
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-800 group-hover:text-warning-800 dark:text-neutral-100 dark:group-hover:text-amber-200">
                        {b.battery_code}
                      </span>
                      <span className="flex shrink-0 items-center gap-1 rounded-full bg-warning-100 px-2 py-0.5 text-xs font-bold text-warning-700 dark:bg-amber-500/15 dark:text-amber-300">
                        {b.intake_count}×
                      </span>
                    </div>
                    {b.client_name && (
                      <span className="text-xs text-slate-400 dark:text-neutral-500">{b.client_name}</span>
                    )}
                    <div className="mt-0.5 flex flex-wrap gap-1.5">
                      {b.intake_times.map((t) => (
                        <span
                          key={t}
                          className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-surface-800 dark:text-neutral-400"
                        >
                          {new Date(t).toLocaleString([], {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      ))}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default RepeatIntakeAlert;
