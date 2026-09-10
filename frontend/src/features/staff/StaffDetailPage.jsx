import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import apiClient from '../../services/api-client';
import PageHeader from '../../components/ui/PageHeader';
import TableState from '../../components/ui/TableState';
import { StatusBadge } from '../../components/ui/Badge';
import StatCard from '../../components/ui/StatCard';
import BarChart from '../../components/ui/BarChart';

const DAYS_SHOWN = 14;

// Converts to a YYYY-MM-DD string in the browser's local timezone, so a date
// picked in the filter matches repairs logged that same calendar day —
// toISOString() alone would shift the date near midnight in non-UTC zones.
function toLocalDateValue(value) {
  const dt = new Date(value);
  const offset = dt.getTimezoneOffset();
  return new Date(dt.getTime() - offset * 60000).toISOString().slice(0, 10);
}

// Builds a fixed DAYS_SHOWN-day range ending today, with a count for each
// day — days with no repairs show as 0 rather than being skipped.
function buildDailyCounts(visits) {
  const countsByDay = {};
  for (const v of visits) {
    const day = new Date(v.repaired_at).toDateString();
    countsByDay[day] = (countsByDay[day] || 0) + 1;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const series = [];
  for (let i = DAYS_SHOWN - 1; i >= 0; i -= 1) {
    const day = new Date(today);
    day.setDate(day.getDate() - i);
    series.push({
      label: day.toLocaleDateString([], { day: '2-digit', month: 'short' }),
      count: countsByDay[day.toDateString()] || 0,
    });
  }
  return series;
}

// duration_seconds is the gap between the technician tapping "Start Work"
// and logging the repair — how long they actually spent on it.
function formatDuration(seconds) {
  if (seconds == null) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// Spec-adjacent: a staff member's detail page — total work done and a
// per-day breakdown, so a manager can see at a glance how active they are.
function StaffDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [historyDate, setHistoryDate] = useState('');

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiClient
      .get(`/staff/${id}`)
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.message || err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <TableState>Loading…</TableState>;
  if (error) {
    return (
      <div>
        <Link to="/staff" className="mb-4 inline-block text-sm text-brand-700 hover:underline dark:text-emerald-400">
          ← Back to Staff
        </Link>
        <TableState tone="error">{error}</TableState>
      </div>
    );
  }

  const { staff, repairs } = data;
  // The API already groups repairs by batch_id (one row per visit, not per
  // part) — see staff.model.js's findRepairs.
  const visits = repairs;
  // Work History only shows visits whose battery has actually finished that
  // round (repaired/returned) — one still mid-cycle (in_repair/in_progress/
  // in_testing) isn't done yet, even though this particular repair row was
  // already logged.
  const completedVisits = visits.filter((v) => v.battery_status === 'repaired' || v.battery_status === 'returned');
  const shownVisits = historyDate
    ? completedVisits.filter((v) => toLocalDateValue(v.repaired_at) === historyDate)
    : completedVisits;
  const dailyCounts = buildDailyCounts(completedVisits);
  const hasRecentActivity = dailyCounts.some((d) => d.count > 0);
  const todayCount = dailyCounts[dailyCounts.length - 1]?.count || 0;

  return (
    <div>
      <Link to="/staff" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline dark:text-emerald-400">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path
            fillRule="evenodd"
            d="M12.79 5.23a.75.75 0 0 1 0 1.06L9.06 10l3.73 3.71a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z"
            clipRule="evenodd"
          />
        </svg>
        Back to Staff
      </Link>

      <PageHeader
        title={staff.name}
        description={[staff.role ? staff.role.charAt(0).toUpperCase() + staff.role.slice(1) : 'Technician', staff.phone].filter(Boolean).join(' · ') || 'No details on file'}
      />

      <div
        className={`mb-6 flex flex-wrap items-center gap-4 rounded-xl border-l-4 border-y border-r border-slate-200 bg-gradient-to-r p-5 shadow-sm dark:border-y-surface-700 dark:border-r-surface-700 ${
          staff.active
            ? 'border-brand-500 from-emerald-50 to-white dark:from-emerald-500/15 dark:to-black'
            : 'border-slate-400 from-slate-50 to-white dark:from-surface-800 dark:to-black'
        }`}
      >
        <span
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
            staff.active
              ? 'bg-brand-100 text-brand-700 dark:bg-emerald-500/15 dark:text-emerald-300'
              : 'bg-slate-100 text-slate-500 dark:bg-surface-700 dark:text-neutral-400'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
            <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-4.42 0-8 2.24-8 5v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2c0-2.76-3.58-5-8-5Z" />
          </svg>
        </span>
        <div className="flex-1">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              staff.active
                ? 'bg-brand-100 text-brand-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                : 'bg-slate-100 text-slate-600 dark:bg-surface-700 dark:text-neutral-300'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${staff.active ? 'bg-brand-600 dark:bg-emerald-400' : 'bg-slate-400'}`} />
            {staff.active ? 'Active' : 'Inactive'}
          </span>
          <p className="mt-1 text-sm text-slate-500 dark:text-neutral-400">
            {completedVisits.length} repair{completedVisits.length === 1 ? '' : 's'} completed in total
          </p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard label="Total Repairs Done" value={completedVisits.length} tone="good" />
        <StatCard label="Repairs Today" value={todayCount} tone="info" />
      </div>

      <div className="mb-6 rounded-xl border border-blue-300 bg-white p-5 shadow-sm dark:border-blue-800/40 dark:bg-black">
        <h2 className="mb-3 text-sm font-semibold text-slate-800 dark:text-neutral-100">
          Repairs per day (last {DAYS_SHOWN} days)
        </h2>
        {hasRecentActivity ? (
          <BarChart data={dailyCounts} color="#10b981" activeColor="#047857" />
        ) : (
          <p className="py-6 text-center text-sm text-slate-400 dark:text-neutral-500">
            No repairs logged in the last {DAYS_SHOWN} days.
          </p>
        )}
      </div>

      <div className="rounded-xl border border-blue-300 bg-white p-5 shadow-sm dark:border-blue-800/40 dark:bg-black">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4 dark:border-surface-700">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-neutral-100">Work History</h2>
          <div className="flex items-center gap-2">
            <label htmlFor="history-date-filter" className="text-sm font-medium text-slate-600 dark:text-neutral-300">
              Date
            </label>
            <input
              id="history-date-filter"
              type="date"
              value={historyDate}
              onChange={(e) => setHistoryDate(e.target.value)}
              className="rounded-md border border-blue-200 bg-blue-50/60 px-3 py-1.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-blue-800/40 dark:bg-blue-900/20 dark:text-neutral-100 dark:focus:border-blue-400 dark:focus:ring-blue-400/30 [&::-webkit-calendar-picker-indicator]:[filter:invert(70%)_sepia(90%)_saturate(600%)_hue-rotate(360deg)_brightness(100%)]"
            />
            {historyDate && (
              <button
                type="button"
                onClick={() => setHistoryDate('')}
                className="text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-neutral-400 dark:hover:text-neutral-200"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {shownVisits.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500 dark:text-neutral-400">
            {historyDate ? 'No completed repairs on this date.' : 'No completed repairs for this staff member yet.'}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-surface-800">
            {shownVisits.map((r) => (
              <li key={r.batch_id} className="flex gap-4 py-5 text-sm first:pt-0 last:pb-0">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                    <path
                      fillRule="evenodd"
                      d="M14.279 2.152a.75.75 0 0 1 .07 1.058l-2.487 2.85 1.278 1.279 2.85-2.488a.75.75 0 0 1 1.058.07 4.5 4.5 0 0 1-5.048 6.965l-4.5 4.949a2.121 2.121 0 1 1-3-3l4.949-4.5a4.5 4.5 0 0 1 6.965-5.048 4.462 4.462 0 0 1 .865-1.135ZM4.5 15a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-slate-800 dark:text-neutral-100">{r.battery_code}</span>
                      <StatusBadge status={r.battery_status} />
                    </div>
                    <span className="text-xs text-slate-400 dark:text-neutral-500">
                      {new Date(r.repaired_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-slate-500 dark:text-neutral-400">
                    <span className="flex flex-wrap items-center gap-1.5">
                      {r.part_name.includes(',') ? 'Parts changed:' : 'Part changed:'}
                      <span className="text-xs font-semibold text-brand-700 dark:text-emerald-300">
                        {r.part_name}
                      </span>
                    </span>
                    {r.duration_seconds != null && (
                      <span className="ml-4 inline-flex items-center gap-1 text-xs text-slate-500 dark:text-neutral-400">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .2.08.39.22.53l3.5 3.5a.75.75 0 1 0 1.06-1.06l-3.28-3.28V5Z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Start to completed:{' '}
                        <span className="text-pink-800 dark:text-pink-400">
                          {formatDuration(r.duration_seconds)}
                        </span>
                      </span>
                    )}
                  </div>
                  {r.notes && <p className="text-xs text-slate-400 dark:text-neutral-500">{r.notes}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default StaffDetailPage;
