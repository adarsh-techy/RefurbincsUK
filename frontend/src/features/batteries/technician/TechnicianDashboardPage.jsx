import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import apiClient from '../../../services/api-client';
import TableState from '../../../components/ui/table/TableState';
import { StatusBadge } from '../../../components/ui/primitives/Badge';
import formatDuration from '../../../utils/format-duration';

const DAYS_SHOWN = 14;
const RECENT_LIMIT = 5;

function buildDailyCounts(repairs) {
  const countsByDay = {};
  for (const r of repairs) {
    if (r.repaired_at) {
      const day = new Date(r.repaired_at).toDateString();
      countsByDay[day] = (countsByDay[day] || 0) + 1;
    }
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const series = [];
  for (let i = DAYS_SHOWN - 1; i >= 0; i -= 1) {
    const day = new Date(today);
    day.setDate(day.getDate() - i);
    series.push({
      label: day.toLocaleDateString([], { day: 'numeric', month: 'short' }),
      dayName: day.toLocaleDateString([], { weekday: 'narrow' }),
      isToday: i === 0,
      count: countsByDay[day.toDateString()] || 0,
    });
  }
  return series;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function initials(name) {
  return (name || 'ST')
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function timeAgo(dateString) {
  if (!dateString) return 'recently';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(dateString).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function KpiCard({ label, value, sublabel, colorClass, bgClass, borderClass }) {
  return (
    <div className={`rounded-2xl border p-4 ${borderClass} ${bgClass}`}>
      <div className="flex items-center justify-between">
        <span className={`text-[11px] font-bold uppercase tracking-wide ${colorClass}`}>{label}</span>
      </div>
      <p className={`mt-1 text-2xl font-extrabold ${colorClass}`}>{value}</p>
      <p className={`mt-0.5 text-[10px] font-medium opacity-80 ${colorClass}`}>{sublabel}</p>
    </div>
  );
}

function TechnicianDashboardPage() {
  const navigate = useNavigate();
  const user = useSelector((s) => s.auth.user);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = useCallback(() => {
    return apiClient
      .get('/staff/me')
      .then(({ data: res }) => { setData(res); setError(null); })
      .catch((err) => setError(err.response?.data?.message || err.message));
  }, []);

  useEffect(() => {
    setLoading(true);
    loadData().finally(() => setLoading(false));
  }, [loadData]);

  if (loading) return <TableState>Loading dashboard…</TableState>;
  if (error) return <TableState tone="error">{error}</TableState>;

  const { staff = {}, repairs = [], issues = [] } = data || {};

  const completedRepairs = repairs.filter(
    (r) => r.battery_status === 'repaired' || r.battery_status === 'returned'
  );
  const inProgressRepairs = repairs.filter(
    (r) => r.battery_status === 'in_progress' || r.battery_status === 'in_testing'
  );

  const dailyCounts = buildDailyCounts(completedRepairs);
  const maxCount = Math.max(1, ...dailyCounts.map((d) => d.count));
  const todayCount = dailyCounts[dailyCounts.length - 1]?.count || 0;
  const weekCount = dailyCounts.slice(-7).reduce((s, d) => s + d.count, 0);
  const hasActivity = dailyCounts.some((d) => d.count > 0);

  const timedRepairs = completedRepairs.filter((r) => typeof r.duration_seconds === 'number' && r.duration_seconds > 0);
  const avgDuration = timedRepairs.length
    ? Math.round(timedRepairs.reduce((s, r) => s + r.duration_seconds, 0) / timedRepairs.length)
    : null;

  const recentRepairs = completedRepairs.slice(0, RECENT_LIMIT);

  const todayDateFormatted = new Date().toLocaleDateString([], {
    weekday: 'short', day: 'numeric', month: 'short',
  });

  const staffRoleLabel = (staff?.role || user?.staff_role || 'Technician')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="space-y-4">

      {/* ── Hero Card ─────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-surface-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Shift Active · Ready
            </span>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500 dark:bg-surface-800 dark:text-neutral-400">
            {todayDateFormatted}
          </span>
        </div>

        <div className="mt-4 flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 shadow-sm">
            <span className="text-base font-extrabold text-white">{initials(staff.name)}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xl font-extrabold text-slate-900 dark:text-white">
              {greeting()}, {staff.name || 'Technician'}
            </p>
            <div className="mt-0.5 flex items-center gap-2">
              <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-blue-700 dark:border-blue-800/50 dark:bg-blue-950/40 dark:text-blue-300">
                {staffRoleLabel}
              </span>
              <span className="text-xs text-slate-500 dark:text-neutral-400">Workshop Portal</span>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-3.5 dark:border-red-800/40 dark:bg-red-950/20">
          <p className="text-xs font-semibold text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* ── Quick Actions ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-3 py-3.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
            <path d="M3 7h6v6H3zM15 3h6v6h-6zM15 15h6v6h-6zM3 17h3M6 17h3M4.5 15v5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Scan Battery
        </button>
        <Link
          to="/my/history"
          className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-3.5 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-white/10 dark:bg-surface-900 dark:text-neutral-200 dark:hover:bg-surface-800 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
          </svg>
          My History
        </Link>
      </div>

      {/* ── KPI Grid ─────────────────────────────────────────────────── */}
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">
        Performance Overview
      </p>

      <div className="grid grid-cols-2 gap-3">
        <KpiCard
          label="Today"
          value={todayCount}
          sublabel="Repairs completed"
          colorClass="text-emerald-700 dark:text-emerald-300"
          bgClass="bg-emerald-50/70 dark:bg-emerald-950/30"
          borderClass="border-emerald-200 dark:border-emerald-800/40"
        />
        <KpiCard
          label="This Week"
          value={weekCount}
          sublabel="Past 7 days output"
          colorClass="text-blue-700 dark:text-blue-300"
          bgClass="bg-blue-50/70 dark:bg-blue-950/30"
          borderClass="border-blue-200 dark:border-blue-800/40"
        />
        <KpiCard
          label="Total Output"
          value={completedRepairs.length}
          sublabel="Lifetime serviced"
          colorClass="text-amber-700 dark:text-amber-300"
          bgClass="bg-amber-50/70 dark:bg-amber-950/30"
          borderClass="border-amber-200 dark:border-amber-800/40"
        />
        <KpiCard
          label="Avg Speed"
          value={avgDuration != null ? formatDuration(avgDuration) : '—'}
          sublabel="Per battery repair"
          colorClass="text-purple-700 dark:text-purple-300"
          bgClass="bg-purple-50/70 dark:bg-purple-950/30"
          borderClass="border-purple-200 dark:border-purple-800/40"
        />
      </div>

      {/* ── Status Snapshot Bar ───────────────────────────────────────── */}
      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-white/10 dark:bg-surface-900">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-emerald-500" />
          <span className="text-xs font-semibold text-slate-700 dark:text-neutral-200">{completedRepairs.length} Done</span>
        </div>
        <div className="h-4 w-px bg-slate-200 dark:bg-white/10" />
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-blue-500" />
          <span className="text-xs font-semibold text-slate-700 dark:text-neutral-200">{inProgressRepairs.length} Active</span>
        </div>
        <div className="h-4 w-px bg-slate-200 dark:bg-white/10" />
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-rose-500" />
          <span className="text-xs font-semibold text-slate-700 dark:text-neutral-200">{issues.length} Unserviceable</span>
        </div>
      </div>

      {/* ── 14-Day Activity Chart ─────────────────────────────────────── */}
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-surface-900">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-slate-900 dark:text-white">Repair Activity</p>
            <p className="text-[11px] text-slate-400 dark:text-neutral-500">Past {DAYS_SHOWN} days output</p>
          </div>
          <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 dark:border-blue-800/40 dark:bg-blue-950/30 dark:text-blue-300">
            {weekCount} this week
          </span>
        </div>

        {hasActivity ? (
          <div>
            {/* Bar chart */}
            <div className="flex items-end gap-1" style={{ height: '110px' }}>
              {dailyCounts.map((d, i) => {
                const heightPct = Math.max(8, (d.count / maxCount) * 85);
                return (
                  <div key={`${d.label}-${i}`} className="flex flex-1 flex-col items-center justify-end">
                    {d.count > 0 && (
                      <span className={`mb-1 text-[9px] font-bold ${d.isToday ? 'text-emerald-600' : 'text-slate-500 dark:text-neutral-400'}`}>
                        {d.count}
                      </span>
                    )}
                    <div
                      className={`w-full rounded-t-md ${d.isToday ? 'bg-emerald-500' : d.count > 0 ? 'bg-blue-500' : 'bg-slate-100 dark:bg-surface-700'}`}
                      style={{ height: `${heightPct}px` }}
                    />
                    <span className={`mt-1.5 text-[8px] font-semibold ${d.isToday ? 'font-bold text-emerald-700 dark:text-emerald-400' : 'text-slate-400 dark:text-neutral-500'}`}>
                      {d.isToday ? 'TD' : d.dayName}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2 dark:border-white/10">
              <span className="text-[10px] text-slate-400 dark:text-neutral-500">14 days ago</span>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                  <span className="text-[10px] text-slate-500 dark:text-neutral-400">Past</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">Today</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p className="py-6 text-center text-xs text-slate-400 dark:text-neutral-500">
            No repairs logged in the past {DAYS_SHOWN} days.
          </p>
        )}
      </div>

      {/* ── Recent Completed Work ─────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">
          Recent Completed Work
        </span>
        <Link
          to="/my/history"
          className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline dark:text-blue-400"
        >
          View All ({repairs.length})
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
            <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z" clipRule="evenodd" />
          </svg>
        </Link>
      </div>

      {recentRepairs.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-white/10 dark:bg-surface-900">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" className="mb-2 h-6 w-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
          </svg>
          <p className="text-sm font-semibold text-slate-800 dark:text-neutral-100">No completed jobs yet</p>
          <p className="mt-0.5 text-xs text-slate-400 dark:text-neutral-500">Scan a battery QR code to start servicing units.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {recentRepairs.map((r) => (
            <Link
              key={r.id}
              to={`/batteries/${r.battery_code}`}
              className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-surface-900 dark:hover:bg-surface-800"
            >
              <div className="min-w-0 flex-1 pr-2">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-blue-700 dark:text-blue-400">{r.battery_code}</span>
                  <StatusBadge status={r.battery_status} />
                </div>
                <p className="truncate text-xs font-medium text-slate-600 dark:text-neutral-300">
                  {r.part_name || 'Completed inspection'}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {typeof r.duration_seconds === 'number' && r.duration_seconds > 0 && (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-surface-800 dark:text-neutral-300">
                      ⏱ {formatDuration(r.duration_seconds)}
                    </span>
                  )}
                  <span className="text-[10px] text-slate-400 dark:text-neutral-500">{timeAgo(r.repaired_at)}</span>
                </div>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-slate-400">
                <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z" clipRule="evenodd" />
              </svg>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default TechnicianDashboardPage;
