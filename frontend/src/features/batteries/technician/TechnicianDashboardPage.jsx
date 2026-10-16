import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import apiClient from '../../../services/api-client';
import TableState from '../../../components/ui/table/TableState';
import formatDuration from '../../../utils/format-duration';
import {
  isCompletedRepair,
  isActiveRepair,
  isVerifiedRepair,
  isPartsRemoved,
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
  FiCamera,
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
  const inTestingRepairs = useMemo(() => repairs.filter(isActiveRepair), [repairs]);
  const verifiedRepairs = useMemo(() => repairs.filter(isVerifiedRepair), [repairs]);
  const partsRemovedRepairs = useMemo(() => repairs.filter(isPartsRemoved), [repairs]);
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

  if (loading) return <TableState>Loading workshop dashboard…</TableState>;
  if (error) return <TableState tone="error">{error}</TableState>;

  return (
    <div className="space-y-4 sm:space-y-5 mx-auto max-w-5xl pb-16">

      {/* ── Core Status KPI Metric Cards (4 Pillars) ──────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">
            {isSupervisor ? 'QA Verification Overview' : 'Workshop Repairs & Status Overview'}
          </p>
          <span className="text-xs font-semibold text-slate-400">Live Breakdown</span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
          {isSupervisor ? (
            <>
              <KpiCard
                label="Total Batteries"
                value={tests.length + unserviceableIssues.length}
                sublabel={`Total started work · ${todayCount} today`}
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
              <KpiCard
                label="Total Batteries"
                value={repairs.length + unserviceableIssues.length}
                sublabel={`Total started work · ${todayCount} today`}
                colorClass="text-emerald-700 dark:text-emerald-300"
                bgClass="bg-emerald-50/70 dark:bg-emerald-950/25"
                borderClass="border-emerald-200/90 dark:border-emerald-800/40"
                icon={FiZap}
                iconBgClass="bg-emerald-100 dark:bg-emerald-900/50"
              />
              <KpiCard
                label="Verified Passed"
                value={verifiedRepairs.length}
                sublabel={inTestingRepairs.length > 0 ? `${inTestingRepairs.length} awaiting QA` : 'All QA verified'}
                colorClass="text-blue-700 dark:text-blue-300"
                bgClass="bg-blue-50/70 dark:bg-blue-950/25"
                borderClass="border-blue-200/90 dark:border-blue-800/40"
                icon={FiCheckCircle}
                iconBgClass="bg-blue-100 dark:bg-blue-900/50"
              />
              <KpiCard
                label="Test Failed"
                value={partsRemovedRepairs.length}
                sublabel="Unserviceable / restocked"
                colorClass="text-amber-700 dark:text-amber-300"
                bgClass="bg-amber-50/70 dark:bg-amber-950/25"
                borderClass="border-amber-200/90 dark:border-amber-800/40"
                icon={FiRotateCcw}
                iconBgClass="bg-amber-100 dark:bg-amber-900/50"
              />
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
            </>
          )}
        </div>
      </div>

      {/* ── Secondary Performance Snapshot Bar ────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5 rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-4.5 shadow-xs dark:border-white/10 dark:bg-surface-900">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-surface-800 dark:text-neutral-300">
            <FiCalendar className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500 block truncate">
              This Week
            </span>
            <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
              {weekCount} units
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-surface-800 dark:text-neutral-300">
            <FiTool className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500 block truncate">
              Lifetime Completed
            </span>
            <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
              {completedJobs.length} done
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-surface-800 dark:text-neutral-300">
            <FiClock className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500 block truncate">
              Avg Speed
            </span>
            <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
              {avgDuration != null ? formatDuration(avgDuration) : '—'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
            <FiTrendingUp className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500 block truncate">
              Approval Rate
            </span>
            <span className="text-sm sm:text-base font-black text-emerald-600 dark:text-emerald-400">
              {approvalRate}% pass
            </span>
          </div>
        </div>
      </div>

      {/* ── 14-Day Activity Chart ─────────────────────────────────────── */}
      <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs dark:border-white/10 dark:bg-surface-900">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
              {isSupervisor ? 'QA Testing 14-Day Output' : 'Repair Output Activity (14 Days)'}
            </p>
            <p className="text-[11px] text-slate-400 dark:text-neutral-500 mt-0.5">
              Daily output timeline · Past {DAYS_SHOWN} days
            </p>
          </div>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
              isSupervisor
                ? 'border border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-300'
                : 'border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300'
            }`}
          >
            {weekCount} units this week
          </span>
        </div>

        {hasActivity ? (
          <div>
            <div className="flex items-end gap-1.5 sm:gap-2 pt-2" style={{ height: '90px' }}>
              {dailyCounts.map((d, i) => {
                const heightPct = Math.max(8, (d.count / maxCount) * 72);
                return (
                  <div key={`${d.label}-${i}`} className="flex flex-1 flex-col items-center justify-end h-full">
                    {d.count > 0 && (
                      <span
                        className={`mb-1 text-[9px] sm:text-[10px] font-black ${
                          d.isToday
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : isSupervisor
                              ? 'text-violet-600 dark:text-violet-400'
                              : 'text-slate-600 dark:text-slate-400'
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
                              : 'bg-gradient-to-t from-slate-600 to-slate-400'
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
                      isSupervisor ? 'bg-violet-500' : 'bg-slate-500'
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
          <p className="py-6 text-center text-xs text-slate-400 dark:text-neutral-500">
            No completed {isSupervisor ? 'tests' : 'repairs'} in the past {DAYS_SHOWN} days.
          </p>
        )}
      </div>

      {/* ── Quick Workshop Navigation Shortcuts (Clean replacement for redundant logs) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link
          to="/my/history"
          className="group flex items-center justify-between rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md dark:border-white/10 dark:bg-surface-900 cursor-pointer"
        >
          <div className="min-w-0 pr-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500 block">
              Complete Audit Logs
            </span>
            <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
              Service History
            </p>
            <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">
              Review all {repairs.length + issues.length} units in service &amp; repair history.
            </p>
          </div>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition-colors group-hover:bg-emerald-600 group-hover:text-white dark:bg-surface-800 dark:text-neutral-300">
            <FiArrowRight className="h-4 w-4" />
          </div>
        </Link>

        <Link
          to="/"
          className="group flex items-center justify-between rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md dark:border-white/10 dark:bg-surface-900 cursor-pointer"
        >
          <div className="min-w-0 pr-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500 block">
              Station Ready
            </span>
            <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
              Scan Next Battery
            </p>
            <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">
              Start new diagnosis, repair, or quality test with camera/RFID.
            </p>
          </div>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 transition-colors group-hover:bg-emerald-600 group-hover:text-white dark:bg-emerald-950/40 dark:text-emerald-400">
            <FiCamera className="h-4 w-4" />
          </div>
        </Link>
      </div>
    </div>
  );
}

export default TechnicianDashboardPage;
