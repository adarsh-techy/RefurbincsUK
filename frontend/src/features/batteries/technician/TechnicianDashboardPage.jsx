import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import apiClient from '../../../services/api-client';
import TableState from '../../../components/ui/table/TableState';
import { StatusBadge } from '../../../components/ui/primitives/Badge';
import formatDuration from '../../../utils/format-duration';
import { isCompletedRepair, isActiveRepair, repairBadgeStatus } from './work-outcome';

const DAYS_SHOWN = 14;
const RECENT_LIMIT = 5;

function buildDailyCounts(jobs) {
  const countsByDay = {};
  for (const j of jobs) {
    if (j.doneAt) {
      const day = new Date(j.doneAt).toDateString();
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

function KpiCard({ label, value, sublabel, colorClass, bgClass, borderClass, icon }) {
  return (
    <div className={`rounded-xl sm:rounded-2xl border p-3 sm:p-4 transition-all duration-200 hover:shadow-xs ${borderClass} ${bgClass}`}>
      <div className="flex items-center justify-between">
        <span className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-wider ${colorClass}`}>
          {label}
        </span>
        {icon && <span className="text-sm">{icon}</span>}
      </div>
      <p className={`mt-1 text-xl sm:text-2xl font-black tracking-tight ${colorClass}`}>{value}</p>
      <p className={`mt-0.5 text-[10px] sm:text-[11px] font-medium opacity-80 ${colorClass}`}>{sublabel}</p>
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
      .then(({ data: res }) => {
        setData(res);
        setError(null);
      })
      .catch((err) => setError(err.response?.data?.message || err.message));
  }, []);

  useEffect(() => {
    setLoading(true);
    loadData().finally(() => setLoading(false));
  }, [loadData]);

  const { staff = {}, repairs = [], issues = [], tests = [] } = data || {};

  const isSupervisor = useMemo(() => {
    const role = (staff?.role || user?.staff_role || user?.role || '').toLowerCase();
    return role === 'supervisor';
  }, [staff?.role, user?.staff_role, user?.role]);

  // SUPERVISOR WORK ONLY (Tests & QA sign-offs) vs TECHNICIAN WORK ONLY (Repairs)
  const completedJobs = useMemo(() => {
    if (isSupervisor) {
      // Supervisor: strictly testing sign-offs only, NO repairs
      return tests
        .map((t) => ({
          ...t,
          kind: 'test',
          doneAt: t.tested_at,
          duration: t.testing_duration_seconds,
        }))
        .sort((a, b) => new Date(b.doneAt || 0) - new Date(a.doneAt || 0));
    }
    // Technician: strictly completed repairs only, NO tests
    return repairs
      .filter(isCompletedRepair)
      .map((r) => ({
        ...r,
        kind: 'repair',
        doneAt: r.repaired_at,
        duration: r.duration_seconds,
      }))
      .sort((a, b) => new Date(b.doneAt || 0) - new Date(a.doneAt || 0));
  }, [isSupervisor, tests, repairs]);

  const inProgressRepairs = useMemo(() => repairs.filter(isActiveRepair), [repairs]);
  const passedTests = useMemo(() => tests.filter((t) => !t.passed_back), [tests]);
  const passedBackTests = useMemo(() => tests.filter((t) => t.passed_back), [tests]);

  const dailyCounts = useMemo(() => buildDailyCounts(completedJobs), [completedJobs]);
  const maxCount = Math.max(1, ...dailyCounts.map((d) => d.count));
  const todayCount = dailyCounts[dailyCounts.length - 1]?.count || 0;
  const weekCount = dailyCounts.slice(-7).reduce((s, d) => s + d.count, 0);
  const hasActivity = dailyCounts.some((d) => d.count > 0);

  // Speed calculation
  const avgDuration = useMemo(() => {
    if (isSupervisor) {
      const timed = tests.filter((t) => typeof t.testing_duration_seconds === 'number' && t.testing_duration_seconds > 0);
      return timed.length
        ? Math.round(timed.reduce((s, t) => s + t.testing_duration_seconds, 0) / timed.length)
        : null;
    }
    const timed = completedJobs.filter((r) => typeof r.duration === 'number' && r.duration > 0);
    return timed.length
      ? Math.round(timed.reduce((s, r) => s + r.duration, 0) / timed.length)
      : null;
  }, [isSupervisor, tests, completedJobs]);

  const passRate = useMemo(() => {
    if (!tests.length) return 0;
    return Math.round((passedTests.length / tests.length) * 100);
  }, [tests, passedTests]);

  const recentJobs = completedJobs.slice(0, RECENT_LIMIT);

  const todayDateFormatted = new Date().toLocaleDateString([], {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  const staffRoleLabel = isSupervisor ? 'Supervisor · QA Testing' : 'Technician · Repairs';

  if (loading) return <TableState>Loading dashboard…</TableState>;
  if (error) return <TableState tone="error">{error}</TableState>;

  return (
    <div className="space-y-4 sm:space-y-5 mx-auto max-w-4xl pb-16">
      {/* ── Hero Card ─────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-4 sm:p-6 shadow-xs dark:border-white/10 dark:bg-surface-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full animate-pulse ${
                isSupervisor ? 'bg-violet-500' : 'bg-emerald-500'
              }`}
            />
            <span
              className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-wider ${
                isSupervisor
                  ? 'text-violet-700 dark:text-violet-400'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {isSupervisor ? 'QA Session Active · QA Mode' : 'Shift Active · Ready'}
            </span>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-600 dark:bg-surface-800 dark:text-neutral-300">
            {todayDateFormatted}
          </span>
        </div>

        <div className="mt-4 flex items-center gap-3.5 sm:gap-4">
          <div
            className={`flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl text-base sm:text-lg font-black text-white shadow-xs ${
              isSupervisor
                ? 'bg-gradient-to-br from-violet-600 to-indigo-700'
                : 'bg-gradient-to-br from-blue-600 to-cyan-700'
            }`}
          >
            {initials(staff.name)}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg sm:text-2xl font-black text-slate-900 dark:text-white">
              {greeting()}, {staff.name || (isSupervisor ? 'Supervisor' : 'Technician')}
            </h1>
            <div className="mt-1 flex items-center gap-2">
              <span
                className={`rounded-md px-2 py-0.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider ${
                  isSupervisor
                    ? 'border border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300'
                    : 'border border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300'
                }`}
              >
                {staffRoleLabel}
              </span>
              <span className="text-xs text-slate-400 dark:text-neutral-500">Workshop Portal</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Quick Actions ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
        <button
          type="button"
          onClick={() => navigate('/')}
          className={`flex items-center justify-center gap-2 rounded-xl sm:rounded-2xl px-3 py-3 sm:py-3.5 text-xs sm:text-sm font-bold text-white shadow-xs transition-colors ${
            isSupervisor
              ? 'bg-violet-600 hover:bg-violet-700'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
            <path d="M3 7h6v6H3zM15 3h6v6h-6zM15 15h6v6h-6zM3 17h3M6 17h3M4.5 15v5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {isSupervisor ? 'Scan Battery for QA' : 'Scan Battery to Repair'}
        </button>
        <Link
          to="/my/history"
          className="flex items-center justify-center gap-2 rounded-xl sm:rounded-2xl border border-slate-200/90 bg-white px-3 py-3 sm:py-3.5 text-xs sm:text-sm font-bold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-white/10 dark:bg-surface-900 dark:text-neutral-200 dark:hover:bg-surface-800 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
          </svg>
          {isSupervisor ? 'Testing History' : 'Repair History'}
        </Link>
      </div>

      {/* ── KPI Grid ─────────────────────────────────────────────────── */}
      <div>
        <p className="mb-2 text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">
          {isSupervisor ? 'QA Testing Performance Overview' : 'Repair Performance Overview'}
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
          {isSupervisor ? (
            <>
              <KpiCard
                label="Today"
                value={todayCount}
                sublabel="Tests signed off today"
                colorClass="text-violet-700 dark:text-violet-300"
                bgClass="bg-violet-50/70 dark:bg-violet-950/30"
                borderClass="border-violet-200 dark:border-violet-900/40"
                icon="⚡"
              />
              <KpiCard
                label="This Week"
                value={weekCount}
                sublabel="Past 7 days output"
                colorClass="text-indigo-700 dark:text-indigo-300"
                bgClass="bg-indigo-50/70 dark:bg-indigo-950/30"
                borderClass="border-indigo-200 dark:border-indigo-900/40"
                icon="📅"
              />
              <KpiCard
                label="Total QA Tested"
                value={tests.length}
                sublabel={`${passRate}% passed QA rate`}
                colorClass="text-emerald-700 dark:text-emerald-300"
                bgClass="bg-emerald-50/70 dark:bg-emerald-950/30"
                borderClass="border-emerald-200 dark:border-emerald-900/40"
                icon="✓"
              />
              <KpiCard
                label="Passed Back"
                value={passedBackTests.length}
                sublabel="Returned for rework"
                colorClass="text-amber-700 dark:text-amber-300"
                bgClass="bg-amber-50/70 dark:bg-amber-950/30"
                borderClass="border-amber-200 dark:border-amber-900/40"
                icon="↩"
              />
            </>
          ) : (
            <>
              <KpiCard
                label="Today"
                value={todayCount}
                sublabel="Repairs completed today"
                colorClass="text-emerald-700 dark:text-emerald-300"
                bgClass="bg-emerald-50/70 dark:bg-emerald-950/30"
                borderClass="border-emerald-200 dark:border-emerald-800/40"
                icon="⚡"
              />
              <KpiCard
                label="This Week"
                value={weekCount}
                sublabel="Past 7 days output"
                colorClass="text-blue-700 dark:text-blue-300"
                bgClass="bg-blue-50/70 dark:bg-blue-950/30"
                borderClass="border-blue-200 dark:border-blue-800/40"
                icon="📅"
              />
              <KpiCard
                label="Total Output"
                value={completedJobs.length}
                sublabel="Lifetime repairs"
                colorClass="text-amber-700 dark:text-amber-300"
                bgClass="bg-amber-50/70 dark:bg-amber-950/30"
                borderClass="border-amber-200 dark:border-amber-800/40"
                icon="🏆"
              />
              <KpiCard
                label="Avg Repair Speed"
                value={avgDuration != null ? formatDuration(avgDuration) : '—'}
                sublabel="Per battery repair"
                colorClass="text-purple-700 dark:text-purple-300"
                bgClass="bg-purple-50/70 dark:bg-purple-950/30"
                borderClass="border-purple-200 dark:border-purple-800/40"
                icon="⏱️"
              />
            </>
          )}
        </div>
      </div>

      {/* ── Status Snapshot Bar ───────────────────────────────────────── */}
      <div className="flex items-center justify-between rounded-xl sm:rounded-2xl border border-slate-200/90 bg-white px-3.5 py-2.5 sm:px-5 sm:py-3.5 shadow-xs dark:border-white/10 dark:bg-surface-900">
        {isSupervisor ? (
          <>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span className="text-xs font-bold text-slate-700 dark:text-neutral-200">
                {passedTests.length} Passed QA
              </span>
            </div>
            <div className="h-4 w-px bg-slate-200 dark:bg-white/10" />
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
              <span className="text-xs font-bold text-slate-700 dark:text-neutral-200">
                {passedBackTests.length} Passed Back
              </span>
            </div>
            <div className="h-4 w-px bg-slate-200 dark:bg-white/10" />
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
              <span className="text-xs font-bold text-slate-700 dark:text-neutral-200">
                {issues.length} Unserviceable
              </span>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span className="text-xs font-bold text-slate-700 dark:text-neutral-200">
                {completedJobs.length} Completed
              </span>
            </div>
            <div className="h-4 w-px bg-slate-200 dark:bg-white/10" />
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
              <span className="text-xs font-bold text-slate-700 dark:text-neutral-200">
                {inProgressRepairs.length} Active
              </span>
            </div>
            <div className="h-4 w-px bg-slate-200 dark:bg-white/10" />
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
              <span className="text-xs font-bold text-slate-700 dark:text-neutral-200">
                {issues.length} Unserviceable
              </span>
            </div>
          </>
        )}
      </div>

      {/* ── 14-Day Activity Chart ─────────────────────────────────────── */}
      <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs dark:border-white/10 dark:bg-surface-900">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
              {isSupervisor ? 'QA Testing Activity' : 'Repair Activity'}
            </p>
            <p className="text-[10px] sm:text-[11px] text-slate-400 dark:text-neutral-500">
              Past {DAYS_SHOWN} days {isSupervisor ? 'testing output' : 'repair output'}
            </p>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-bold ${
              isSupervisor
                ? 'border border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-300'
                : 'border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300'
            }`}
          >
            {weekCount} this week
          </span>
        </div>

        {hasActivity ? (
          <div>
            {/* Bar chart */}
            <div className="flex items-end gap-1.5" style={{ height: '110px' }}>
              {dailyCounts.map((d, i) => {
                const heightPct = Math.max(8, (d.count / maxCount) * 90);
                return (
                  <div key={`${d.label}-${i}`} className="flex flex-1 flex-col items-center justify-end">
                    {d.count > 0 && (
                      <span
                        className={`mb-1 text-[9px] font-bold ${
                          d.isToday
                            ? 'text-emerald-600'
                            : isSupervisor
                              ? 'text-violet-600'
                              : 'text-blue-600'
                        }`}
                      >
                        {d.count}
                      </span>
                    )}
                    <div
                      className={`w-full rounded-t-md transition-all duration-300 ${
                        d.isToday
                          ? 'bg-emerald-500'
                          : d.count > 0
                            ? isSupervisor
                              ? 'bg-violet-500'
                              : 'bg-blue-500'
                            : 'bg-slate-100 dark:bg-surface-700'
                      }`}
                      style={{ height: `${heightPct}px` }}
                    />
                    <span
                      className={`mt-1.5 text-[8px] font-semibold ${
                        d.isToday
                          ? 'font-bold text-emerald-700 dark:text-emerald-400'
                          : 'text-slate-400 dark:text-neutral-500'
                      }`}
                    >
                      {d.isToday ? 'TD' : d.dayName}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 dark:border-white/10">
              <span className="text-[10px] text-slate-400 dark:text-neutral-500">14 days ago</span>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isSupervisor ? 'bg-violet-500' : 'bg-blue-500'
                    }`}
                  />
                  <span className="text-[10px] font-medium text-slate-500 dark:text-neutral-400">Past</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">Today</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p className="py-8 text-center text-xs text-slate-400 dark:text-neutral-500">
            No completed {isSupervisor ? 'tests' : 'repairs'} in the past {DAYS_SHOWN} days.
          </p>
        )}
      </div>

      {/* ── Recent Completed Work ─────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">
          {isSupervisor ? 'Recent Testing Sign-offs' : 'Recent Completed Repairs'}
        </span>
        <Link
          to="/my/history"
          className="flex items-center gap-1 text-[11px] sm:text-xs font-bold text-blue-600 hover:underline dark:text-blue-400"
        >
          View All ({completedJobs.length})
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
            <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z" clipRule="evenodd" />
          </svg>
        </Link>
      </div>

      {recentJobs.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 text-center shadow-xs dark:border-white/10 dark:bg-surface-900">
          <span className="text-2xl mb-1.5">{isSupervisor ? '🔬' : '🔧'}</span>
          <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-neutral-100">
            {isSupervisor ? 'No testing sign-offs yet' : 'No completed repairs yet'}
          </p>
          <p className="mt-0.5 text-xs text-slate-400 dark:text-neutral-500">
            {isSupervisor
              ? 'Scan a battery to inspect and sign off QA testing.'
              : 'Scan a battery QR code to service units.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {recentJobs.map((j) => (
            <Link
              key={`${j.kind}-${j.id}`}
              to={`/batteries/${j.battery_code}`}
              className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white p-3.5 sm:p-4 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-md dark:border-white/10 dark:bg-surface-900 dark:hover:bg-surface-800"
            >
              <div className="min-w-0 flex-1 pr-3">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs sm:text-sm font-extrabold text-blue-700 dark:text-blue-400">
                    {j.battery_code}
                  </span>
                  {j.kind === 'test' ? (
                    j.passed_back ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        Passed Back
                      </span>
                    ) : (
                      <StatusBadge status="repaired" />
                    )
                  ) : (
                    <StatusBadge status={repairBadgeStatus(j)} />
                  )}
                </div>

                <p className="truncate text-xs font-semibold text-slate-600 dark:text-neutral-300">
                  {j.kind === 'test'
                    ? j.passed_back
                      ? 'Returned to technician for rework'
                      : `Tested: ${j.service_name || 'QA Passed'}`
                    : j.part_name ? `Parts: ${j.part_name}` : 'Completed service & inspection'}
                </p>

                <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-slate-400 dark:text-neutral-500">
                  {typeof j.duration === 'number' && j.duration > 0 && (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-bold text-slate-600 dark:bg-surface-800 dark:text-neutral-300">
                      ⏱ {formatDuration(j.duration)}
                    </span>
                  )}
                  <span>{timeAgo(j.doneAt)}</span>
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
