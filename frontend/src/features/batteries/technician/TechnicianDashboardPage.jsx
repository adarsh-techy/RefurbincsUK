import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import apiClient from '../../../services/api-client';
import TableState from '../../../components/ui/table/TableState';
import { StatusBadge } from '../../../components/ui/primitives/Badge';
import formatDuration from '../../../utils/format-duration';
import {
  isCompletedRepair,
  isActiveRepair,
  isVerifiedRepair,
  isPartsRemoved,
  repairBadgeStatus,
} from './work-outcome';
import {
  FiZap,
  FiActivity,
  FiCheckCircle,
  FiAlertTriangle,
  FiRotateCcw,
  FiClock,
  FiCalendar,
  FiTrendingUp,
  FiTool,
  FiArrowRight,
  FiChevronRight,
  FiLayers,
} from 'react-icons/fi';

const DAYS_SHOWN = 14;

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
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return 'recently';
  const seconds = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function KpiCard({ label, value, sublabel, colorClass, bgClass, borderClass, icon: IconComponent, iconBgClass }) {
  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border p-4 sm:p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xs ${borderClass} ${bgClass}`}
    >
      <div className="flex items-center justify-between">
        <span className={`text-[11px] font-bold uppercase tracking-wider ${colorClass}`}>
          {label}
        </span>
        {IconComponent && (
          <div className={`flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl transition-transform group-hover:scale-105 ${iconBgClass}`}>
            <IconComponent className={`h-4 w-4 sm:h-4.5 sm:w-4.5 ${colorClass}`} />
          </div>
        )}
      </div>
      <p className={`mt-2 text-2xl sm:text-3xl font-black tracking-tight ${colorClass}`}>{value}</p>
      <p className={`mt-1 text-xs font-semibold opacity-85 truncate ${colorClass}`}>
        {sublabel}
      </p>
    </div>
  );
}

function TechnicianDashboardPage() {
  const navigate = useNavigate();
  const user = useSelector((s) => s.auth.user);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('all');

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

  // Technicians: Completed repairs (both verified & currently in testing awaiting QA)
  const completedJobs = useMemo(() => {
    if (isSupervisor) {
      return tests
        .map((t) => ({
          ...t,
          kind: 'test',
          doneAt: t.tested_at,
          duration: t.testing_duration_seconds,
        }))
        .sort((a, b) => new Date(b.doneAt || 0) - new Date(a.doneAt || 0));
    }
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

  // Detailed categories for technician dashboard:
  // 1. Passed to Testing / Awaiting QA
  const inTestingRepairs = useMemo(() => repairs.filter(isActiveRepair), [repairs]);
  // 2. Verified QA Complete
  const verifiedRepairs = useMemo(() => repairs.filter(isVerifiedRepair), [repairs]);
  // 3. Parts Removed & Restocked
  const partsRemovedRepairs = useMemo(() => repairs.filter(isPartsRemoved), [repairs]);
  // 4. Reported Unserviceable issues
  const unserviceableIssues = issues || [];

  // Supervisor categories:
  const passedTests = useMemo(() => tests.filter((t) => !t.passed_back), [tests]);
  const passedBackTests = useMemo(() => tests.filter((t) => t.passed_back), [tests]);

  // 14-day counts
  const dailyCounts = useMemo(() => buildDailyCounts(completedJobs), [completedJobs]);
  const maxCount = Math.max(1, ...dailyCounts.map((d) => d.count));
  const todayCount = dailyCounts[dailyCounts.length - 1]?.count || 0;
  const weekCount = dailyCounts.slice(-7).reduce((s, d) => s + d.count, 0);
  const hasActivity = dailyCounts.some((d) => d.count > 0);

  // Speed calculation
  const avgDuration = useMemo(() => {
    if (isSupervisor) {
      const timed = tests.filter(
        (t) => typeof t.testing_duration_seconds === 'number' && t.testing_duration_seconds > 0
      );
      return timed.length
        ? Math.round(timed.reduce((s, t) => s + t.testing_duration_seconds, 0) / timed.length)
        : null;
    }
    const timed = completedJobs.filter((r) => typeof r.duration === 'number' && r.duration > 0);
    return timed.length
      ? Math.round(timed.reduce((s, r) => s + r.duration, 0) / timed.length)
      : null;
  }, [isSupervisor, tests, completedJobs]);

  const approvalRate = useMemo(() => {
    if (isSupervisor) {
      if (!tests.length) return 100;
      return Math.round((passedTests.length / tests.length) * 100);
    }
    const totalAttempted = repairs.length + unserviceableIssues.length;
    if (!totalAttempted) return 100;
    return Math.round((completedJobs.length / totalAttempted) * 100);
  }, [isSupervisor, tests, passedTests, repairs.length, unserviceableIssues.length, completedJobs.length]);

  // Combined workshop feed with active tab filter
  const filteredFeed = useMemo(() => {
    if (isSupervisor) {
      if (activeTab === 'passed') return tests.filter((t) => !t.passed_back);
      if (activeTab === 'passed_back') return tests.filter((t) => t.passed_back);
      if (activeTab === 'unserviceable') return unserviceableIssues;
      return tests;
    }

    if (activeTab === 'testing') {
      return inTestingRepairs.map((r) => ({ ...r, entryType: 'testing', date: r.repaired_at }));
    }
    if (activeTab === 'unserviceable') {
      return unserviceableIssues.map((i) => ({ ...i, entryType: 'issue', date: i.reported_at }));
    }
    if (activeTab === 'removed') {
      return partsRemovedRepairs.map((r) => ({ ...r, entryType: 'removed', date: r.removed_at || r.repaired_at }));
    }
    if (activeTab === 'completed') {
      return verifiedRepairs.map((r) => ({ ...r, entryType: 'completed', date: r.repaired_at }));
    }

    // 'all': blend repairs and reported issues together in descending date order
    const repairItems = repairs.map((r) => ({
      ...r,
      entryType: isPartsRemoved(r) ? 'removed' : isActiveRepair(r) ? 'testing' : 'completed',
      date: r.removed_at || r.repaired_at,
    }));
    const issueItems = unserviceableIssues.map((i) => ({
      ...i,
      entryType: 'issue',
      date: i.reported_at,
    }));

    return [...repairItems, ...issueItems].sort(
      (a, b) => new Date(b.date || 0) - new Date(a.date || 0)
    );
  }, [
    isSupervisor,
    activeTab,
    tests,
    unserviceableIssues,
    inTestingRepairs,
    partsRemovedRepairs,
    verifiedRepairs,
    repairs,
  ]);

  const todayDateFormatted = new Date().toLocaleDateString([], {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  const staffRoleLabel = isSupervisor ? 'Supervisor · QA Testing' : 'Technician · Workshop Repairs';
  const staffDisplayName = staff.name || user?.name || (isSupervisor ? 'Supervisor' : 'Technician');

  if (loading) return <TableState>Loading workshop dashboard…</TableState>;
  if (error) return <TableState tone="error">{error}</TableState>;

  return (
    <div className="space-y-5 sm:space-y-6 mx-auto max-w-5xl pb-16">
      {/* ── Compact Executive Hero Card ─────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/50 p-4 sm:p-5 shadow-xs dark:border-white/10 dark:from-surface-900 dark:to-surface-950">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full animate-pulse ${
                isSupervisor ? 'bg-violet-500' : 'bg-emerald-500'
              }`}
            />
            <span
              className={`text-[11px] font-extrabold uppercase tracking-wider ${
                isSupervisor
                  ? 'text-violet-700 dark:text-violet-400'
                  : 'text-emerald-700 dark:text-emerald-400'
              }`}
            >
              {isSupervisor ? 'QA Session Active · Verification' : 'Workshop Shift Active · Live'}
            </span>
          </div>
          <span className="rounded-full bg-slate-100/90 px-3 py-1 text-[11px] font-bold text-slate-600 dark:bg-surface-800 dark:text-neutral-300">
            {todayDateFormatted}
          </span>
        </div>

        <div className="mt-3.5 flex items-center gap-3.5 sm:gap-4">
          <div
            className={`flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl text-base sm:text-lg font-black text-white shadow-xs ${
              isSupervisor
                ? 'bg-gradient-to-br from-violet-600 to-indigo-700'
                : 'bg-gradient-to-br from-blue-600 to-cyan-700'
            }`}
          >
            {initials(staffDisplayName)}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg sm:text-xl font-black text-slate-900 dark:text-white">
              {greeting()}, {staffDisplayName}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${
                  isSupervisor
                    ? 'border border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300'
                    : 'border border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300'
                }`}
              >
                {staffRoleLabel}
              </span>
              <span className="text-xs text-slate-400 dark:text-neutral-500">• Refurbnics Workshop</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Core Status KPI Metric Cards (4 Pillars) ──────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">
            {isSupervisor ? 'QA Verification Overview' : 'Workshop Repairs & Status Overview'}
          </p>
          <span className="text-xs font-semibold text-slate-400">Live Breakdown</span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3.5">
          {isSupervisor ? (
            <>
              <KpiCard
                label="Today Tested"
                value={todayCount}
                sublabel="Tests signed off today"
                colorClass="text-violet-700 dark:text-violet-300"
                bgClass="bg-violet-50/70 dark:bg-violet-950/25"
                borderClass="border-violet-200/90 dark:border-violet-800/40"
                icon={FiZap}
                iconBgClass="bg-violet-100 dark:bg-violet-900/50"
              />
              <KpiCard
                label="Passed QA"
                value={passedTests.length}
                sublabel="Passed inspection"
                colorClass="text-emerald-700 dark:text-emerald-300"
                bgClass="bg-emerald-50/70 dark:bg-emerald-950/25"
                borderClass="border-emerald-200/90 dark:border-emerald-800/40"
                icon={FiCheckCircle}
                iconBgClass="bg-emerald-100 dark:bg-emerald-900/50"
              />
              <KpiCard
                label="Passed Back"
                value={passedBackTests.length}
                sublabel="Returned for rework"
                colorClass="text-amber-700 dark:text-amber-300"
                bgClass="bg-amber-50/70 dark:bg-amber-950/25"
                borderClass="border-amber-200/90 dark:border-amber-800/40"
                icon={FiRotateCcw}
                iconBgClass="bg-amber-100 dark:bg-amber-900/50"
              />
              <KpiCard
                label="Unserviceable"
                value={unserviceableIssues.length}
                sublabel="Marked failed tests"
                colorClass="text-rose-700 dark:text-rose-300"
                bgClass="bg-rose-50/70 dark:bg-rose-950/25"
                borderClass="border-rose-200/90 dark:border-rose-800/40"
                icon={FiAlertTriangle}
                iconBgClass="bg-rose-100 dark:bg-rose-900/50"
              />
            </>
          ) : (
            <>
              {/* Pillar 1: Repairs Today */}
              <KpiCard
                label="Repairs Today"
                value={todayCount}
                sublabel="Completed today"
                colorClass="text-emerald-700 dark:text-emerald-300"
                bgClass="bg-emerald-50/70 dark:bg-emerald-950/25"
                borderClass="border-emerald-200/90 dark:border-emerald-800/40"
                icon={FiZap}
                iconBgClass="bg-emerald-100 dark:bg-emerald-900/50"
              />
              {/* Pillar 2: Passed to Test */}
              <KpiCard
                label="Passed to Test"
                value={inTestingRepairs.length}
                sublabel="In QA testing queue"
                colorClass="text-blue-700 dark:text-blue-300"
                bgClass="bg-blue-50/70 dark:bg-blue-950/25"
                borderClass="border-blue-200/90 dark:border-blue-800/40"
                icon={FiActivity}
                iconBgClass="bg-blue-100 dark:bg-blue-900/50"
              />
              {/* Pillar 3: Unservice Marked */}
              <KpiCard
                label="Unservice Marked"
                value={unserviceableIssues.length}
                sublabel="Issues logged"
                colorClass="text-rose-700 dark:text-rose-300"
                bgClass="bg-rose-50/70 dark:bg-rose-950/25"
                borderClass="border-rose-200/90 dark:border-rose-800/40"
                icon={FiAlertTriangle}
                iconBgClass="bg-rose-100 dark:bg-rose-900/50"
              />
              {/* Pillar 4: Parts Removed */}
              <KpiCard
                label="Parts Removed"
                value={partsRemovedRepairs.length}
                sublabel="Restocked to stock"
                colorClass="text-amber-700 dark:text-amber-300"
                bgClass="bg-amber-50/70 dark:bg-amber-950/25"
                borderClass="border-amber-200/90 dark:border-amber-800/40"
                icon={FiRotateCcw}
                iconBgClass="bg-amber-100 dark:bg-amber-900/50"
              />
            </>
          )}
        </div>
      </div>

      {/* ── Secondary Performance Snapshot Bar ────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs dark:border-white/10 dark:bg-surface-900">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-surface-800 dark:text-neutral-300">
            <FiCalendar className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500 block">
              This Week
            </span>
            <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
              {weekCount} units
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-surface-800 dark:text-neutral-300">
            <FiTool className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500 block">
              Lifetime Completed
            </span>
            <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
              {completedJobs.length} done
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-surface-800 dark:text-neutral-300">
            <FiClock className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500 block">
              Avg Service Speed
            </span>
            <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
              {avgDuration != null ? formatDuration(avgDuration) : '—'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
            <FiTrendingUp className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500 block">
              Approval Rate
            </span>
            <span className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400">
              {approvalRate}% pass
            </span>
          </div>
        </div>
      </div>

      {/* ── 14-Day Activity Chart ─────────────────────────────────────── */}
      <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs dark:border-white/10 dark:bg-surface-900">
        <div className="mb-3.5 flex items-center justify-between">
          <div>
            <p className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
              {isSupervisor ? 'QA Testing 14-Day Output' : 'Repair Output Activity (14 Days)'}
            </p>
            <p className="text-xs text-slate-400 dark:text-neutral-500 mt-0.5">
              Daily output timeline · Past {DAYS_SHOWN} days
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              isSupervisor
                ? 'border border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-300'
                : 'border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300'
            }`}
          >
            {weekCount} units this week
          </span>
        </div>

        {hasActivity ? (
          <div>
            {/* Sleek Bar chart */}
            <div className="flex items-end gap-1.5 sm:gap-2 pt-2" style={{ height: '95px' }}>
              {dailyCounts.map((d, i) => {
                const heightPct = Math.max(8, (d.count / maxCount) * 75);
                return (
                  <div key={`${d.label}-${i}`} className="flex flex-1 flex-col items-center justify-end h-full">
                    {d.count > 0 && (
                      <span
                        className={`mb-1 text-[9px] sm:text-[10px] font-black ${
                          d.isToday
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : isSupervisor
                              ? 'text-violet-600 dark:text-violet-400'
                              : 'text-blue-600 dark:text-blue-400'
                        }`}
                      >
                        {d.count}
                      </span>
                    )}
                    <div
                      className={`w-full rounded-t-lg transition-all duration-300 ${
                        d.isToday
                          ? 'bg-gradient-to-t from-emerald-600 to-emerald-400 shadow-xs shadow-emerald-500/20'
                          : d.count > 0
                            ? isSupervisor
                              ? 'bg-gradient-to-t from-violet-600 to-violet-400'
                              : 'bg-gradient-to-t from-blue-600 to-blue-400'
                            : 'bg-slate-100 dark:bg-surface-800'
                      }`}
                      style={{ height: `${heightPct}px` }}
                    />
                    <span
                      className={`mt-1.5 text-[8px] sm:text-[10px] font-bold ${
                        d.isToday
                          ? 'text-emerald-700 dark:text-emerald-400 font-black'
                          : 'text-slate-400 dark:text-neutral-500'
                      }`}
                    >
                      {d.isToday ? 'TODAY' : d.dayName}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 dark:border-white/10">
              <span className="text-[10px] font-medium text-slate-400 dark:text-neutral-500">14 days ago</span>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isSupervisor ? 'bg-violet-500' : 'bg-blue-500'
                    }`}
                  />
                  <span className="text-[10px] font-medium text-slate-500 dark:text-neutral-400">Past Shift</span>
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

      {/* ── Interactive Workshop Activity Hub with Tabs ──────────────── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">
            Workshop Activity Details
          </span>
          <Link
            to="/my/history"
            className="flex items-center gap-0.5 text-[10px] sm:text-[11px] font-bold text-blue-600 hover:underline dark:text-blue-400"
          >
            View Full Log ({completedJobs.length})
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
              <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z" clipRule="evenodd" />
            </svg>
          </Link>
        </div>

        {/* Tab Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-3 scrollbar-none text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all shadow-xs ${
              activeTab === 'all'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-slate-900/20'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80 dark:bg-surface-800 dark:text-neutral-300 dark:border-white/10'
            }`}
          >
            All Activity
          </button>
          {!isSupervisor && (
            <>
              <button
                type="button"
                onClick={() => setActiveTab('testing')}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                  activeTab === 'testing'
                    ? 'bg-blue-600 text-white shadow-xs shadow-blue-500/25'
                    : 'bg-white text-blue-700 hover:bg-blue-50 border border-blue-200 dark:bg-surface-800 dark:text-blue-400 dark:border-blue-900/40'
                }`}
              >
                In Testing <span className="ml-1 opacity-75 font-mono">({inTestingRepairs.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('completed')}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                  activeTab === 'completed'
                    ? 'bg-emerald-600 text-white shadow-xs shadow-emerald-500/25'
                    : 'bg-white text-emerald-700 hover:bg-emerald-50 border border-emerald-200 dark:bg-surface-800 dark:text-emerald-400 dark:border-emerald-900/40'
                }`}
              >
                QA Verified <span className="ml-1 opacity-75 font-mono">({verifiedRepairs.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('unserviceable')}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                  activeTab === 'unserviceable'
                    ? 'bg-rose-600 text-white shadow-xs shadow-rose-500/25'
                    : 'bg-white text-rose-700 hover:bg-rose-50 border border-rose-200 dark:bg-surface-800 dark:text-rose-400 dark:border-rose-900/40'
                }`}
              >
                Unserviceable <span className="ml-1 opacity-75 font-mono">({unserviceableIssues.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('removed')}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                  activeTab === 'removed'
                    ? 'bg-amber-600 text-white shadow-xs shadow-amber-500/25'
                    : 'bg-white text-amber-700 hover:bg-amber-50 border border-amber-200 dark:bg-surface-800 dark:text-amber-400 dark:border-amber-900/40'
                }`}
              >
                Parts Removed <span className="ml-1 opacity-75 font-mono">({partsRemovedRepairs.length})</span>
              </button>
            </>
          )}
          {isSupervisor && (
            <>
              <button
                type="button"
                onClick={() => setActiveTab('passed')}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                  activeTab === 'passed'
                    ? 'bg-emerald-600 text-white shadow-xs shadow-emerald-500/25'
                    : 'bg-white text-emerald-700 hover:bg-emerald-50 border border-emerald-200 dark:bg-surface-800 dark:text-emerald-400 dark:border-emerald-900/40'
                }`}
              >
                Passed <span className="ml-1 opacity-75 font-mono">({passedTests.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('passed_back')}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                  activeTab === 'passed_back'
                    ? 'bg-amber-600 text-white shadow-xs shadow-amber-500/25'
                    : 'bg-white text-amber-700 hover:bg-amber-50 border border-amber-200 dark:bg-surface-800 dark:text-amber-400 dark:border-amber-900/40'
                }`}
              >
                Passed Back <span className="ml-1 opacity-75 font-mono">({passedBackTests.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('unserviceable')}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                  activeTab === 'unserviceable'
                    ? 'bg-rose-600 text-white shadow-xs shadow-rose-500/25'
                    : 'bg-white text-rose-700 hover:bg-rose-50 border border-rose-200 dark:bg-surface-800 dark:text-rose-400 dark:border-rose-900/40'
                }`}
              >
                Unserviceable <span className="ml-1 opacity-75 font-mono">({unserviceableIssues.length})</span>
              </button>
            </>
          )}
        </div>

        {/* Activity Items List */}
        {filteredFeed.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white p-8 sm:p-10 text-center shadow-xs dark:border-white/10 dark:bg-surface-900">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-surface-800 dark:text-neutral-400 mb-3">
              {isSupervisor ? <FiActivity className="h-6 w-6" /> : <FiTool className="h-6 w-6" />}
            </div>
            <p className="text-sm font-black text-slate-900 dark:text-neutral-100">
              No entries in this view
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400 max-w-sm">
              All workshop actions, completed jobs, and battery updates will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="space-y-2 sm:space-y-2.5">
            {filteredFeed.slice(0, 8).map((j, idx) => {
              const isIssue = j.entryType === 'issue' || j.reason_label != null;
              const isRemoved = j.entryType === 'removed' || isPartsRemoved(j);
              const isTesting = j.entryType === 'testing' || j.battery_status === 'in_testing';

              return (
                <Link
                  key={`${j.battery_code}-${j.id || idx}`}
                  to={`/batteries/${j.battery_code}`}
                  className="group flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white p-3.5 sm:p-4 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-md dark:border-white/10 dark:bg-surface-900 dark:hover:bg-surface-800"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1 pr-3">
                    {/* Status Icon Indicator */}
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold transition-transform group-hover:scale-105 ${
                        isIssue
                          ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                          : isRemoved
                            ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'
                            : isTesting
                              ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400'
                              : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                      }`}
                    >
                      {isIssue ? (
                        <FiAlertTriangle className="h-5 w-5" />
                      ) : isRemoved ? (
                        <FiRotateCcw className="h-5 w-5" />
                      ) : isTesting ? (
                        <FiZap className="h-5 w-5" />
                      ) : (
                        <FiCheckCircle className="h-5 w-5" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm sm:text-base font-black tracking-tight text-slate-900 dark:text-white">
                          {j.battery_code}
                        </span>

                        {/* Explicit Outcome Pill */}
                        {isIssue ? (
                          <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-rose-800 dark:bg-rose-950/80 dark:text-rose-300">
                            Unserviceable
                          </span>
                        ) : isRemoved ? (
                          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-800 dark:bg-amber-950/80 dark:text-amber-300">
                            Parts Removed
                          </span>
                        ) : isTesting ? (
                          <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-blue-800 dark:bg-blue-950/80 dark:text-blue-300">
                            Passed to Testing
                          </span>
                        ) : (
                          <StatusBadge status={repairBadgeStatus(j)} />
                        )}

                        <span className="text-[11px] font-medium text-slate-400 dark:text-neutral-500 ml-auto flex items-center gap-1">
                          <FiClock className="h-3 w-3" />
                          {timeAgo(j.date || j.doneAt || j.repaired_at || j.reported_at)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-600 dark:text-neutral-300">
                        <span className="truncate font-medium text-slate-600 dark:text-neutral-300">
                          {isIssue
                            ? `Reported: ${j.reason_label || j.note || 'Can not service unit'}`
                            : isRemoved
                              ? `Parts restocked: ${j.part_name || 'Fitted parts returned'}`
                              : isSupervisor
                                ? j.passed_back
                                  ? 'Returned to technician for rework'
                                  : `QA Tested: ${j.service_name || 'Inspection passed'}`
                                : j.part_name
                                  ? `Fitted: ${j.part_name}`
                                  : 'Completed service inspection'}
                        </span>
                        {typeof (j.duration || j.duration_seconds) === 'number' && (j.duration || j.duration_seconds) > 0 && (
                          <span className="ml-2 shrink-0 inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-surface-800 dark:text-neutral-300">
                            <FiClock className="h-2.5 w-2.5 text-slate-400" />
                            {formatDuration(j.duration || j.duration_seconds)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                    <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z" clipRule="evenodd" />
                  </svg>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default TechnicianDashboardPage;
