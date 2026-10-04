import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import apiClient from '../../../services/api-client';
import TableState from '../../../components/ui/table/TableState';
import { StatusBadge } from '../../../components/ui/primitives/Badge';
import formatDuration from '../../../utils/format-duration';
import { resolveImageUrl } from '../../../utils/image-url';
import ImageLightboxModal from '../../../components/ui/overlays/ImageLightboxModal';
import { repairBadgeStatus } from './work-outcome';

const DATE_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'week', label: '7 Days' },
  { id: 'month', label: '30 Days' },
];

const SUPERVISOR_TYPE_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'passed', label: 'Passed QA' },
  { id: 'passed_back', label: 'Passed Back' },
  { id: 'issue', label: 'Unserviceable' },
];

const TECHNICIAN_TYPE_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'repair', label: 'Repairs' },
  { id: 'issue', label: 'Unserviceable' },
];

function isSameDay(d1, d2) {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function parseYMD(str) {
  if (!str) return null;
  const parts = str.split('-');
  if (parts.length !== 3) return null;
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
}

const DAY_NAMES = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function formatYMD(d) {
  if (!d) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatShortDate(str) {
  const d = parseYMD(str);
  if (!d) return '';
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

function matchesDateFilter(dateStr, filter, customStart, customEnd) {
  if (filter === 'all' || !filter) return true;
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();

  if (filter === 'today') return isSameDay(d, now);
  if (filter === 'yesterday') {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    return isSameDay(d, y);
  }
  if (filter === 'week') {
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    return d >= sevenDaysAgo;
  }
  if (filter === 'month') {
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);
    return d >= thirtyDaysAgo;
  }
  if (filter === 'custom') {
    if (customStart) {
      const s = parseYMD(customStart);
      if (s) {
        s.setHours(0, 0, 0, 0);
        if (d < s) return false;
      }
    }
    if (customEnd) {
      const e = parseYMD(customEnd);
      if (e) {
        e.setHours(23, 59, 59, 999);
        if (d > e) return false;
      }
    } else if (customStart) {
      const s = parseYMD(customStart);
      if (s && !isSameDay(d, s)) return false;
    }
    return true;
  }
  return true;
}

function buildTimeline(repairs, issues, tests, isSupervisor) {
  if (isSupervisor) {
    // Supervisors see ONLY tester history: testing sign-offs and test unserviceable issues
    const testEntries = (tests || []).map((t) => ({
      ...t,
      kind: 'test',
      sortDate: t.tested_at,
    }));
    const issueEntries = (issues || []).map((i) => ({
      ...i,
      kind: 'issue',
      sortDate: i.reported_at,
    }));
    return [...testEntries, ...issueEntries].sort(
      (a, b) => new Date(b.sortDate || 0) - new Date(a.sortDate || 0)
    );
  }

  // Technicians see ONLY tech history: repairs and reported repair issues
  const repairEntries = (repairs || []).map((r) => ({
    ...r,
    kind: 'repair',
    sortDate: r.repaired_at,
  }));
  const issueEntries = (issues || []).map((i) => ({
    ...i,
    kind: 'issue',
    sortDate: i.reported_at,
  }));
  return [...repairEntries, ...issueEntries].sort(
    (a, b) => new Date(b.sortDate || 0) - new Date(a.sortDate || 0)
  );
}

function groupTimelineByDate(items) {
  const groups = {};
  const todayStr = new Date().toDateString();
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = yesterdayDate.toDateString();

  for (const item of items) {
    if (!item.sortDate) {
      const key = 'Undated';
      if (!groups[key]) groups[key] = { label: 'Undated', dateKey: key, data: [] };
      groups[key].data.push(item);
      continue;
    }
    const d = new Date(item.sortDate);
    const dateKey = d.toDateString();
    if (!groups[dateKey]) {
      let label = d.toLocaleDateString([], {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      let isToday = false;
      let isYesterday = false;
      if (dateKey === todayStr) {
        label = 'Today · ' + d.toLocaleDateString([], { day: 'numeric', month: 'short' });
        isToday = true;
      } else if (dateKey === yesterdayStr) {
        label = 'Yesterday · ' + d.toLocaleDateString([], { day: 'numeric', month: 'short' });
        isYesterday = true;
      }
      groups[dateKey] = {
        label,
        isToday,
        isYesterday,
        dateKey,
        data: [],
      };
    }
    groups[dateKey].data.push(item);
  }

  return Object.values(groups);
}

function TechnicianHistoryPage() {
  const user = useSelector((state) => state.auth.user);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [customRange, setCustomRange] = useState({ start: null, end: null });
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [tempRange, setTempRange] = useState({ start: null, end: null });
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    setLoading(true);
    apiClient
      .get('/staff/me')
      .then(({ data: res }) => {
        setData(res);
        setError(null);
      })
      .catch((err) => setError(err.response?.data?.message || err.message))
      .finally(() => setLoading(false));
  }, []);

  const isSupervisor = useMemo(() => {
    const role = (data?.staff?.role || user?.staff_role || user?.role || '').toLowerCase();
    return role === 'supervisor';
  }, [data?.staff?.role, user?.staff_role, user?.role]);

  const typeFilters = isSupervisor ? SUPERVISOR_TYPE_FILTERS : TECHNICIAN_TYPE_FILTERS;

  // Stats calculation
  const stats = useMemo(() => {
    if (!data) return null;
    if (isSupervisor) {
      const tests = data.tests || [];
      const issues = data.issues || [];
      const passed = tests.filter((t) => !t.passed_back);
      const passedBack = tests.filter((t) => t.passed_back);
      const total = tests.length + issues.length;
      const passRate = tests.length ? Math.round((passed.length / tests.length) * 100) : 0;
      return {
        totalTests: tests.length,
        passedCount: passed.length,
        passedBackCount: passedBack.length,
        issueCount: issues.length,
        passRate,
        total,
      };
    } else {
      const repairs = data.repairs || [];
      const issues = data.issues || [];
      const completed = repairs.filter((r) => r.outcome !== 'failed');
      const timedRepairs = repairs.filter((r) => typeof r.duration_seconds === 'number' && r.duration_seconds > 0);
      const avgDuration = timedRepairs.length
        ? Math.round(timedRepairs.reduce((s, r) => s + r.duration_seconds, 0) / timedRepairs.length)
        : null;
      return {
        totalRepairs: repairs.length,
        completedCount: completed.length,
        avgDuration,
        issueCount: issues.length,
        total: repairs.length + issues.length,
      };
    }
  }, [data, isSupervisor]);

  function openCustomDateModal() {
    setTempRange({ ...customRange });
    const base = customRange.start ? parseYMD(customRange.start) : new Date();
    setViewYear(base.getFullYear());
    setViewMonth(base.getMonth());
    setCustomModalOpen(true);
  }

  function handlePrevMonth() {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function handleNextMonth() {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  function handleSelectDay(ymd) {
    if (!tempRange.start || (tempRange.start && tempRange.end)) {
      setTempRange({ start: ymd, end: null });
    } else if (ymd >= tempRange.start) {
      setTempRange({ start: tempRange.start, end: ymd });
    } else {
      setTempRange({ start: ymd, end: null });
    }
  }

  function setModalQuickPreset(preset) {
    const now = new Date();
    const today = formatYMD(now);
    const back = (days) => {
      const d = new Date(now);
      d.setDate(d.getDate() - days);
      return formatYMD(d);
    };
    if (preset === 'today') setTempRange({ start: today, end: today });
    else if (preset === 'yesterday') setTempRange({ start: back(1), end: back(1) });
    else if (preset === 'week') setTempRange({ start: back(7), end: today });
    else if (preset === 'month') setTempRange({ start: back(30), end: today });
  }

  function applyCustomDateFilter() {
    if (!tempRange.start) {
      setDateFilter('all');
      setCustomRange({ start: null, end: null });
    } else {
      setCustomRange({ ...tempRange });
      setDateFilter('custom');
    }
    setCustomModalOpen(false);
  }

  const calendarDays = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const total = new Date(viewYear, viewMonth + 1, 0).getDate();
    let offset = first.getDay() - 1;
    if (offset === -1) offset = 6;
    const days = Array.from({ length: offset }, () => null);
    for (let d = 1; d <= total; d++) days.push(formatYMD(new Date(viewYear, viewMonth, d)));
    return days;
  }, [viewYear, viewMonth]);

  const viewMonthName = useMemo(
    () => new Date(viewYear, viewMonth, 1).toLocaleDateString([], { month: 'long', year: 'numeric' }),
    [viewYear, viewMonth]
  );

  const rawTimeline = useMemo(() => {
    if (!data) return [];
    return buildTimeline(data.repairs, data.issues, data.tests, isSupervisor);
  }, [data, isSupervisor]);

  const filteredTimeline = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rawTimeline.filter((item) => {
      if (typeFilter !== 'all') {
        if (isSupervisor) {
          if (typeFilter === 'passed' && (item.kind !== 'test' || item.passed_back)) return false;
          if (typeFilter === 'passed_back' && (item.kind !== 'test' || !item.passed_back)) return false;
          if (typeFilter === 'issue' && item.kind !== 'issue') return false;
        } else {
          if (typeFilter === 'repair' && item.kind !== 'repair') return false;
          if (typeFilter === 'issue' && item.kind !== 'issue') return false;
        }
      }
      if (!matchesDateFilter(item.sortDate, dateFilter, customRange.start, customRange.end)) {
        return false;
      }
      if (q) {
        const code = (item.battery_code || '').toLowerCase();
        const part = (item.part_name || item.service_name || '').toLowerCase();
        const reason = (item.reason_label || item.reason_code || '').toLowerCase();
        const note = (item.note || item.notes || '').toLowerCase();
        if (!code.includes(q) && !part.includes(q) && !reason.includes(q) && !note.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [rawTimeline, search, typeFilter, dateFilter, customRange, isSupervisor]);

  const dateGroups = useMemo(() => groupTimelineByDate(filteredTimeline), [filteredTimeline]);

  const hasActiveFilters =
    search.trim().length > 0 || dateFilter !== 'all' || typeFilter !== 'all';

  function resetFilters() {
    setSearch('');
    setDateFilter('all');
    setTypeFilter('all');
    setCustomRange({ start: null, end: null });
  }

  if (loading) return <TableState>Loading history…</TableState>;
  if (error) return <TableState tone="error">{error}</TableState>;

  return (
    <div className="mx-auto max-w-4xl pb-20">
      {/* ── Hero Banner & Role Stats Header ────────────────────────────── */}
      <div className="mb-3 overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-3 sm:p-4 shadow-xs dark:border-white/10 dark:bg-surface-900">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pb-3 border-b border-slate-100 dark:border-white/5">
          <div className="flex items-center gap-2.5">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-xl text-base shadow-2xs ${
                isSupervisor
                  ? 'bg-gradient-to-br from-violet-500 to-indigo-600 text-white'
                  : 'bg-gradient-to-br from-blue-500 to-cyan-600 text-white'
              }`}
            >
              {isSupervisor ? '🔬' : '🔧'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                  {isSupervisor ? 'QA Testing & Sign-off History' : 'Repair & Service History'}
                </h1>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                    isSupervisor
                      ? 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300'
                      : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                  }`}
                >
                  {isSupervisor ? 'Supervisor' : 'Technician'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-neutral-400">
                {isSupervisor
                  ? 'Battery testing sign-offs, QA services, and technician rework passes'
                  : 'Battery repairs, fitted parts, and workshop service logs'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 self-start sm:self-auto rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-surface-800 dark:text-neutral-300">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px]">Staff: {data?.staff?.name || user?.name}</span>
          </div>
        </div>

        {/* Quick Stats Grid */}
        {stats && (
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
            {isSupervisor ? (
              <>
                <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-2.5 dark:border-violet-900/30 dark:bg-violet-950/20">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-violet-700 dark:text-violet-300">Total Tested</p>
                  <p className="mt-0.5 text-lg sm:text-xl font-black text-violet-950 dark:text-white">
                    {stats.totalTests}
                  </p>
                  <p className="text-[10px] text-violet-600/80 dark:text-violet-400">
                    Sign-offs logged
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-2.5 dark:border-emerald-900/30 dark:bg-emerald-950/20">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Passed QA</p>
                  <p className="mt-0.5 text-lg sm:text-xl font-black text-emerald-950 dark:text-white">
                    {stats.passedCount}
                  </p>
                  <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                    {stats.passRate}% pass rate
                  </p>
                </div>
                <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-2.5 dark:border-amber-900/30 dark:bg-amber-950/20">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">Passed Back</p>
                  <p className="mt-0.5 text-lg sm:text-xl font-black text-amber-950 dark:text-white">
                    {stats.passedBackCount}
                  </p>
                  <p className="text-[10px] text-amber-600/80 dark:text-amber-400">
                    Returned for rework
                  </p>
                </div>
                <div className="rounded-xl border border-rose-100 bg-rose-50/50 p-2.5 dark:border-rose-900/30 dark:bg-rose-950/20">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300">Unserviceable</p>
                  <p className="mt-0.5 text-lg sm:text-xl font-black text-rose-950 dark:text-white">
                    {stats.issueCount}
                  </p>
                  <p className="text-[10px] text-rose-600/80 dark:text-rose-400">
                    Failed testing
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-2.5 dark:border-blue-900/30 dark:bg-blue-950/20">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">Total Repairs</p>
                  <p className="mt-0.5 text-lg sm:text-xl font-black text-blue-950 dark:text-white">
                    {stats.totalRepairs}
                  </p>
                  <p className="text-[10px] text-blue-600/80 dark:text-blue-400">
                    Batteries repaired
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-2.5 dark:border-emerald-900/30 dark:bg-emerald-950/20">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Completed</p>
                  <p className="mt-0.5 text-lg sm:text-xl font-black text-emerald-950 dark:text-white">
                    {stats.completedCount}
                  </p>
                  <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400">
                    Submitted for test
                  </p>
                </div>
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-2.5 dark:border-indigo-900/30 dark:bg-indigo-950/20">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">Avg Duration</p>
                  <p className="mt-0.5 text-lg sm:text-xl font-black text-indigo-950 dark:text-white">
                    {stats.avgDuration ? formatDuration(stats.avgDuration) : '—'}
                  </p>
                  <p className="text-[10px] text-indigo-600/80 dark:text-indigo-400">
                    Per battery
                  </p>
                </div>
                <div className="rounded-xl border border-rose-100 bg-rose-50/50 p-2.5 dark:border-rose-900/30 dark:bg-rose-950/20">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300">Issues</p>
                  <p className="mt-0.5 text-lg sm:text-xl font-black text-rose-950 dark:text-white">
                    {stats.issueCount}
                  </p>
                  <p className="text-[10px] text-rose-600/80 dark:text-rose-400">
                    Unserviceable
                  </p>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Search & Filter Controls ───────────────────────────────────── */}
      <div className="mb-3 rounded-xl border border-slate-200/90 bg-white p-2 sm:p-2.5 shadow-2xs dark:border-white/10 dark:bg-surface-900">
        {/* Compact Search Bar */}
        <div className="flex items-center gap-2 rounded-lg border border-slate-200/90 bg-slate-50/80 px-2.5 py-1 dark:border-white/10 dark:bg-surface-950">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 shrink-0 text-slate-400">
            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              isSupervisor
                ? 'Search battery code, services, notes…'
                : 'Search battery code, parts, notes…'
            }
            className="flex-1 bg-transparent text-xs text-slate-900 focus:outline-none dark:text-white placeholder:text-slate-400"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 text-[9px] font-bold text-slate-600 hover:bg-slate-300 dark:bg-surface-800 dark:text-neutral-300"
              title="Clear search"
            >
              ✕
            </button>
          ) : (
            <span className="text-[10px] font-medium text-slate-400">
              {filteredTimeline.length} {filteredTimeline.length === 1 ? 'unit' : 'units'}
            </span>
          )}
        </div>

        {/* Compact Filters Toolbar */}
        <div className="mt-1.5 flex flex-col md:flex-row md:items-center md:justify-between gap-1.5 border-t border-slate-100 pt-1.5 dark:border-white/5">
          {/* Status/Type Filter - Classic Segmented Control */}
          <div className="inline-flex items-center gap-0.5 rounded-lg bg-slate-100 p-0.5 dark:bg-surface-950 border border-slate-200/50 dark:border-white/5">
            {typeFilters.map((tf) => {
              const active = typeFilter === tf.id;
              return (
                <button
                  key={tf.id}
                  type="button"
                  onClick={() => setTypeFilter(tf.id)}
                  className={`rounded-md px-2 py-0.5 text-[11px] font-semibold transition-all duration-150 ${
                    active
                      ? isSupervisor
                        ? 'bg-white text-violet-700 shadow-2xs font-bold dark:bg-surface-800 dark:text-violet-300'
                        : 'bg-white text-blue-700 shadow-2xs font-bold dark:bg-surface-800 dark:text-blue-300'
                      : 'text-slate-600 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white'
                  }`}
                >
                  {tf.label}
                </button>
              );
            })}
          </div>

          {/* Date Filter Pills - Compact, Classic & 100% Scrollbar-Free */}
          <div
            className="flex items-center gap-1 overflow-x-auto no-scrollbar"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {DATE_FILTERS.map((df) => {
              const active = dateFilter === df.id;
              return (
                <button
                  key={df.id}
                  type="button"
                  onClick={() => {
                    setDateFilter(df.id);
                    if (df.id !== 'custom') setCustomRange({ start: null, end: null });
                  }}
                  className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium transition-all ${
                    active
                      ? isSupervisor
                        ? 'bg-violet-600 text-white font-bold shadow-2xs'
                        : 'bg-blue-600 text-white font-bold shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-surface-800 dark:text-neutral-300'
                  }`}
                >
                  {df.label}
                </button>
              );
            })}

            {/* Custom Date Range Pill */}
            <button
              type="button"
              onClick={openCustomDateModal}
              className={`flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium transition-all ${
                dateFilter === 'custom'
                  ? isSupervisor
                    ? 'bg-violet-600 text-white font-bold shadow-2xs'
                    : 'bg-blue-600 text-white font-bold shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-surface-800 dark:text-neutral-300'
              }`}
            >
              <span>📅</span>
              <span>
                {dateFilter === 'custom' && customRange.start
                  ? customRange.end && customRange.end !== customRange.start
                    ? `${formatShortDate(customRange.start)}–${formatShortDate(customRange.end)}`
                    : formatShortDate(customRange.start)
                  : 'Custom'}
              </span>
            </button>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="shrink-0 ml-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Date-Wise Grouped Feed ─────────────────────────────────────── */}
      {dateGroups.length === 0 ? (
        <div className="rounded-2xl sm:rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xs dark:border-white/10 dark:bg-surface-900">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-xl dark:bg-surface-800">
            🔍
          </div>
          <p className="text-sm font-bold text-slate-800 dark:text-white">
            {hasActiveFilters ? 'No matching records found' : 'No history logged yet'}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {hasActiveFilters
              ? 'Try selecting a different filter or clearing your search.'
              : isSupervisor
                ? 'Signed-off tests and test inspections will appear here date-wise.'
                : 'Completed repairs and reported workshop issues will appear here date-wise.'}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className={`mt-4 rounded-xl px-4 py-2 text-xs font-bold text-white shadow-xs ${
                isSupervisor ? 'bg-violet-600 hover:bg-violet-700' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              Clear All Filters
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-7 sm:gap-8">
          {dateGroups.map((group) => (
            <div key={group.dateKey} className="flex flex-col gap-3.5">
              {/* Date Header Tag */}
              <div className="flex items-center justify-between px-1.5 py-0.5">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      group.isToday
                        ? 'bg-emerald-500 ring-4 ring-emerald-500/20'
                        : isSupervisor
                          ? 'bg-violet-500'
                          : 'bg-blue-500'
                    }`}
                  />
                  <span
                    className={`text-xs font-black tracking-tight ${
                      group.isToday
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-slate-800 dark:text-neutral-200'
                    }`}
                  >
                    {group.label}
                  </span>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-surface-800 dark:text-neutral-400 shadow-2xs">
                  {group.data.length} unit{group.data.length === 1 ? '' : 's'}
                </span>
              </div>

              {/* Cards Grid / Stack */}
              <div className="flex flex-col gap-3.5 sm:gap-4">
                {group.data.map((item) => {
                  if (item.kind === 'test') {
                    // SUPERVISOR TEST CARD
                    const isPassedBack = item.passed_back;
                    return (
                      <Link
                        key={`test-${item.id}`}
                        to={`/batteries/${item.battery_code}`}
                        className={`group relative overflow-hidden rounded-2xl border bg-white p-4 sm:p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:bg-surface-900 ${
                          isPassedBack
                            ? 'border-amber-200/90 hover:border-amber-400 dark:border-amber-900/40'
                            : 'border-emerald-200/90 hover:border-emerald-400 dark:border-emerald-900/40'
                        }`}
                      >
                        {/* Left colored accent bar */}
                        <div
                          className={`absolute top-0 bottom-0 left-0 w-1.5 ${
                            isPassedBack ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                        />

                        {/* Top row: Battery Code + Status Badge + Time */}
                        <div className="flex items-center justify-between gap-3 pl-2 sm:pl-3 pb-3 border-b border-slate-100 dark:border-white/5">
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`flex h-6 w-6 items-center justify-center rounded-lg text-xs font-black ${
                                isPassedBack
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              }`}
                            >
                              {isPassedBack ? '↩' : '✓'}
                            </span>
                            <span className="font-mono text-sm sm:text-base font-extrabold text-slate-900 group-hover:text-violet-600 dark:text-white dark:group-hover:text-violet-400">
                              {item.battery_code}
                            </span>
                            {isPassedBack ? (
                              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                Sent Back to Tech
                              </span>
                            ) : (
                              <StatusBadge status="repaired" />
                            )}
                          </div>
                          <span className="text-xs font-semibold text-slate-400 dark:text-neutral-500">
                            {item.tested_at
                              ? new Date(item.tested_at).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : ''}
                          </span>
                        </div>

                        {/* Optional notes if any */}
                        {item.notes && (
                          <div className="mt-3 pl-2 sm:pl-3 text-xs text-slate-600 dark:text-neutral-300 line-clamp-2">
                            <span className="font-semibold text-slate-700 dark:text-neutral-200">Note:</span> {item.notes}
                          </div>
                        )}

                        {/* Footer row: duration & action link */}
                        <div className="mt-3.5 flex items-center justify-between text-xs pl-2 sm:pl-3 pt-3 border-t border-slate-100 dark:border-white/5">
                          {typeof item.testing_duration_seconds === 'number' && item.testing_duration_seconds > 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-md border border-violet-100 bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700 dark:border-violet-900/40 dark:bg-violet-950 dark:text-violet-300">
                              ⏱️ Testing Time: {formatDuration(item.testing_duration_seconds)}
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              {isPassedBack ? 'Rework Pass-Back' : 'QA Testing Sign-off'}
                            </span>
                          )}
                          <span className="flex items-center gap-1 text-[11px] font-bold text-slate-400 group-hover:text-violet-600 dark:text-neutral-500 dark:group-hover:text-violet-400">
                            <span>View Battery Details</span>
                            <span className="transition-transform group-hover:translate-x-0.5">›</span>
                          </span>
                        </div>
                      </Link>
                    );
                  }

                  if (item.kind === 'repair') {
                    // TECHNICIAN REPAIR CARD
                    return (
                      <Link
                        key={`repair-${item.id}`}
                        to={`/batteries/${item.battery_code}`}
                        className="group relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-md dark:border-white/10 dark:bg-surface-900"
                      >
                        {/* Left colored accent bar */}
                        <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-blue-500" />

                        {/* Top row */}
                        <div className="flex items-center justify-between gap-3 pl-2 sm:pl-3 pb-3 border-b border-slate-100 dark:border-white/5">
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                                <path fillRule="evenodd" d="M14.5 10a4.5 4.5 0 0 0 4.284-5.882c-.105-.324-.51-.391-.752-.15L15.34 6.66a.454.454 0 0 1-.493.11 3.01 3.01 0 0 1-1.618-1.616.455.455 0 0 1 .11-.494l2.694-2.692c.24-.241.174-.647-.15-.752a4.5 4.5 0 0 0-5.873 4.575c.055.873-.128 1.808-.8 2.368l-7.23 6.024a2.724 2.724 0 1 0 3.837 3.837l6.024-7.23c.56-.672 1.495-.855 2.368-.8.096.007.193.01.291.01ZM5 16a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" clipRule="evenodd" />
                              </svg>
                            </span>
                            <span className="font-mono text-sm sm:text-base font-extrabold text-slate-900 group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400">
                              {item.battery_code}
                            </span>
                            <StatusBadge status={repairBadgeStatus(item)} />
                          </div>
                          <span className="text-xs font-semibold text-slate-400 dark:text-neutral-500">
                            {item.repaired_at
                              ? new Date(item.repaired_at).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : ''}
                          </span>
                        </div>

                        {/* Optional notes if any */}
                        {item.notes && (
                          <div className="mt-3 pl-2 sm:pl-3 text-xs text-slate-600 dark:text-neutral-300 line-clamp-2">
                            <span className="font-semibold text-slate-700 dark:text-neutral-200">Note:</span> {item.notes}
                          </div>
                        )}

                        {/* Footer row */}
                        <div className="mt-3.5 flex items-center justify-between text-xs pl-2 sm:pl-3 pt-3 border-t border-slate-100 dark:border-white/5">
                          {typeof item.duration_seconds === 'number' && item.duration_seconds > 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-md border border-blue-100 bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:border-blue-900/40 dark:bg-blue-950 dark:text-blue-300">
                              ⏱️ Repair Time: {formatDuration(item.duration_seconds)}
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              Completed Repair
                            </span>
                          )}
                          <span className="flex items-center gap-1 text-[11px] font-bold text-slate-400 group-hover:text-blue-600 dark:text-neutral-500 dark:group-hover:text-blue-400">
                            <span>View Battery Details</span>
                            <span className="transition-transform group-hover:translate-x-0.5">›</span>
                          </span>
                        </div>
                      </Link>
                    );
                  }

                  // ISSUE CARD (UNSERVICEABLE)
                  return (
                    <div
                      key={`issue-${item.id}`}
                      className="group relative overflow-hidden rounded-2xl border border-rose-200/90 bg-white p-4 sm:p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-rose-400 hover:shadow-md dark:border-rose-900/40 dark:bg-surface-900"
                    >
                      {/* Left colored accent bar */}
                      <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-rose-500" />

                      {/* Top row */}
                      <div className="mb-3 flex items-center justify-between gap-3 pl-2 sm:pl-3 pb-3 border-b border-rose-100/80 dark:border-rose-900/30">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400 font-bold">
                            ⚠
                          </span>
                          <Link
                            to={`/batteries/${item.battery_code}`}
                            className="font-mono text-sm sm:text-base font-extrabold text-rose-700 hover:underline dark:text-rose-400"
                          >
                            {item.battery_code}
                          </Link>
                          <StatusBadge status={item.battery_status || 'unserviceable'} />
                        </div>
                        <span className="text-xs font-semibold text-slate-400 dark:text-neutral-500">
                          {item.reported_at
                            ? new Date(item.reported_at).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : ''}
                        </span>
                      </div>

                      {/* Issue description box */}
                      <div className="rounded-xl border border-rose-100 bg-rose-50/60 p-3.5 pl-4 dark:border-rose-950 dark:bg-rose-950/20">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-rose-900 dark:text-rose-300">
                            Unserviceable Reason:
                          </span>
                          <span className="rounded-md border border-rose-200 bg-white/80 px-2 py-0.5 text-[11px] font-bold text-rose-800 dark:border-rose-900 dark:bg-surface-900 dark:text-rose-300">
                            {item.reason_label || item.reason_code}
                          </span>
                        </div>

                        {item.note && (
                          <p className="mt-2.5 text-xs leading-relaxed text-rose-800 dark:text-rose-300 border-t border-rose-200/50 pt-2 dark:border-rose-900/40">
                            <span className="font-semibold">Note:</span> {item.note}
                          </p>
                        )}

                        {item.photo_urls && item.photo_urls.length > 0 && (
                          <div className="mt-3 flex items-center gap-2.5 border-t border-rose-200/50 pt-2.5 dark:border-rose-900/40">
                            {item.photo_urls.map((photo, pIdx) => (
                              <button
                                key={pIdx}
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  setLightbox({
                                    images: item.photo_urls.map((p) => resolveImageUrl(p)),
                                    index: pIdx,
                                    title: `${item.battery_code} Issue Photos`,
                                  });
                                }}
                                className="group/img relative h-14 w-14 overflow-hidden rounded-xl border border-rose-200 bg-white shadow-2xs hover:scale-105 transition-transform dark:border-rose-900"
                              >
                                <img
                                  src={resolveImageUrl(photo)}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/20 transition-colors flex items-center justify-center">
                                  <span className="text-white opacity-0 group-hover/img:opacity-100 text-xs font-bold">🔍</span>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Footer row */}
                      <div className="mt-3.5 flex items-center justify-between text-xs pl-2 sm:pl-3 pt-3 border-t border-rose-100/80 dark:border-rose-900/30">
                        <span className="text-[10px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400">
                          Marked Unserviceable
                        </span>
                        <Link
                          to={`/batteries/${item.battery_code}`}
                          className="flex items-center gap-1 font-bold text-slate-400 hover:text-rose-600 dark:text-neutral-500 dark:hover:text-rose-400"
                        >
                          <span>View Battery</span>
                          <span>›</span>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Custom Date Range Picker Modal ─────────────────────────────── */}
      {customModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4 backdrop-blur-xs"
          onClick={() => setCustomModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl border border-slate-200 bg-white p-5 pb-8 shadow-2xl dark:border-white/10 dark:bg-surface-900 sm:rounded-3xl sm:pb-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-white/10">
              <div>
                <p className="text-base font-extrabold text-slate-900 dark:text-white">Filter By Date</p>
                <p className="text-xs text-slate-400">Select single day or date range</p>
              </div>
              <button
                type="button"
                onClick={() => setCustomModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-surface-800 dark:text-neutral-300"
              >
                ✕
              </button>
            </div>

            <div className="mt-3 grid grid-cols-4 gap-2">
              {[['today', 'Today'], ['yesterday', 'Yesterday'], ['week', 'Last 7d'], ['month', 'Last 30d']].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setModalQuickPreset(id)}
                  className="rounded-xl bg-slate-100 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:bg-surface-800 dark:text-neutral-300"
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between px-2">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-base font-bold text-slate-700 hover:bg-slate-200 dark:bg-surface-800 dark:text-neutral-300"
              >
                ‹
              </button>
              <span className="text-sm font-extrabold text-slate-900 dark:text-white">{viewMonthName}</span>
              <button
                type="button"
                onClick={handleNextMonth}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-base font-bold text-slate-700 hover:bg-slate-200 dark:bg-surface-800 dark:text-neutral-300"
              >
                ›
              </button>
            </div>

            <div className="mt-3 grid grid-cols-7 gap-1 px-1">
              {DAY_NAMES.map((d, i) => (
                <div key={`dn-${i}`} className="text-center text-xs font-bold text-slate-400">{d}</div>
              ))}
              {calendarDays.map((ymd, i) => {
                if (!ymd) return <div key={`empty-${i}`} className="h-10" />;
                const dayNum = Number(ymd.split('-')[2]);
                const isSelected = tempRange.start === ymd || tempRange.end === ymd;
                const inRange = tempRange.start && tempRange.end && ymd > tempRange.start && ymd < tempRange.end;
                return (
                  <button
                    key={ymd}
                    type="button"
                    onClick={() => handleSelectDay(ymd)}
                    className={`h-10 rounded-xl text-xs font-bold transition-colors ${
                      isSelected
                        ? isSupervisor
                          ? 'bg-violet-600 text-white shadow-xs'
                          : 'bg-blue-600 text-white shadow-xs'
                        : inRange
                          ? isSupervisor
                            ? 'bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-300'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300'
                          : 'text-slate-800 hover:bg-slate-100 dark:text-neutral-200 dark:hover:bg-surface-800'
                    }`}
                  >
                    {dayNum}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-white/10 dark:bg-surface-950">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Chosen Filter Date</p>
                <p className="mt-0.5 text-xs font-extrabold text-blue-700 dark:text-blue-400">
                  {tempRange.start
                    ? tempRange.end && tempRange.end !== tempRange.start
                      ? `${formatShortDate(tempRange.start)} – ${formatShortDate(tempRange.end)}`
                      : `Single Day: ${formatShortDate(tempRange.start)}`
                    : 'Tap a date above'}
                </p>
              </div>
              {tempRange.start && (
                <button
                  type="button"
                  onClick={() => setTempRange({ start: null, end: null })}
                  className="text-xs font-bold text-rose-600 hover:underline dark:text-rose-400"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setTempRange({ start: null, end: null });
                  setDateFilter('all');
                  setCustomRange({ start: null, end: null });
                  setCustomModalOpen(false);
                }}
                className="flex-1 rounded-2xl bg-slate-100 py-3.5 text-xs font-bold text-slate-600 hover:bg-slate-200 dark:bg-surface-800 dark:text-neutral-300"
              >
                Show All Dates
              </button>
              <button
                type="button"
                onClick={applyCustomDateFilter}
                className={`flex-1 rounded-2xl py-3.5 text-xs font-bold text-white shadow-xs ${
                  isSupervisor
                    ? 'bg-violet-600 hover:bg-violet-700 shadow-violet-600/30'
                    : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/30'
                }`}
              >
                Apply Date Filter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {lightbox && (
        <ImageLightboxModal
          images={lightbox.images}
          initialIndex={lightbox.index}
          title={lightbox.title}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}

export default TechnicianHistoryPage;
