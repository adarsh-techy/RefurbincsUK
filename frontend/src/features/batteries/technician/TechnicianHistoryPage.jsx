import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../../services/api-client';
import TableState from '../../../components/ui/table/TableState';
import { StatusBadge } from '../../../components/ui/primitives/Badge';
import formatDuration from '../../../utils/format-duration';
import { resolveImageUrl } from '../../../utils/image-url';

const DATE_FILTERS = [
  { id: 'all', label: 'All Dates' },
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'week', label: 'Last 7 Days' },
  { id: 'month', label: 'Last 30 Days' },
];

const TYPE_FILTERS = [
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

function buildTimeline(repairs, issues) {
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
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [customRange, setCustomRange] = useState({ start: null, end: null });
  const [customModalOpen, setCustomModalOpen] = useState(false);
  // Calendar range picker (ported from mobile HistoryScreen): temp selection
  // until "Apply", plus the month being viewed.
  const [tempRange, setTempRange] = useState({ start: null, end: null });
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());

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

  // First tap = start, second tap (later date) = end, earlier tap restarts.
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
    let offset = first.getDay() - 1; // Monday-first grid
    if (offset === -1) offset = 6;
    const days = Array.from({ length: offset }, () => null);
    for (let d = 1; d <= total; d++) days.push(formatYMD(new Date(viewYear, viewMonth, d)));
    return days;
  }, [viewYear, viewMonth]);

  const viewMonthName = useMemo(
    () => new Date(viewYear, viewMonth, 1).toLocaleDateString([], { month: 'long', year: 'numeric' }),
    [viewYear, viewMonth]
  );

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

  const rawTimeline = useMemo(() => {
    if (!data) return [];
    return buildTimeline(data.repairs, data.issues);
  }, [data]);

  const filteredTimeline = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rawTimeline.filter((item) => {
      if (typeFilter !== 'all' && item.kind !== typeFilter) return false;
      if (!matchesDateFilter(item.sortDate, dateFilter, customRange.start, customRange.end)) {
        return false;
      }
      if (q) {
        const code = (item.battery_code || '').toLowerCase();
        const part = (item.part_name || '').toLowerCase();
        const reason = (item.reason_label || item.reason_code || '').toLowerCase();
        const note = (item.note || item.notes || '').toLowerCase();
        if (!code.includes(q) && !part.includes(q) && !reason.includes(q) && !note.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [rawTimeline, search, typeFilter, dateFilter, customRange]);

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
    <div className="mx-auto max-w-3xl pb-16">
      {/* ── Search & Filter Controls Header ────────────────────────────── */}
      <div className="mb-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-surface-900">
        {/* Search Input */}
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 dark:border-neutral-700 dark:bg-surface-950">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-slate-400">
            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search battery code, part, reason…"
            className="flex-1 bg-transparent text-xs text-slate-900 focus:outline-none dark:text-white"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} className="p-1 text-slate-400 hover:text-slate-600">
              ✕
            </button>
          )}
        </div>

        {/* Date Filter Pills */}
        <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1">
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
                className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                  active
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-surface-800 dark:text-neutral-300'
                }`}
              >
                {df.label}
              </button>
            );
          })}

          {/* Custom date-range pill (opens the calendar) */}
          <button
            type="button"
            onClick={openCustomDateModal}
            className={`flex shrink-0 items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
              dateFilter === 'custom'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-surface-800 dark:text-neutral-300'
            }`}
          >
            <span>📅</span>
            <span>
              {dateFilter === 'custom' && customRange.start
                ? customRange.end && customRange.end !== customRange.start
                  ? `${formatShortDate(customRange.start)} – ${formatShortDate(customRange.end)}`
                  : formatShortDate(customRange.start)
                : 'Custom'}
            </span>
          </button>
        </div>

        {/* Type Filter Pills & Reset */}
        <div className="mt-2.5 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {TYPE_FILTERS.map((tf) => {
              const active = typeFilter === tf.id;
              return (
                <button
                  key={tf.id}
                  type="button"
                  onClick={() => setTypeFilter(tf.id)}
                  className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-all ${
                    active
                      ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-300'
                      : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-400'
                  }`}
                >
                  {tf.label}
                </button>
              );
            })}
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-[11px] font-semibold text-rose-600 hover:underline dark:text-rose-400"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Summary Bar */}
      <div className="mb-4 flex items-center justify-between rounded-2xl bg-slate-100/80 px-4 py-2 text-[11px] font-semibold text-slate-500 dark:bg-surface-900/60 dark:text-neutral-400">
        <span>
          Showing {filteredTimeline.length} record{filteredTimeline.length === 1 ? '' : 's'} across {dateGroups.length} date{dateGroups.length === 1 ? '' : 's'}
        </span>
        {dateFilter !== 'all' && (
          <span className="flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-bold uppercase text-blue-700 dark:bg-blue-950 dark:text-blue-300">
            {DATE_FILTERS.find((d) => d.id === dateFilter)?.label}
            <button type="button" onClick={() => setDateFilter('all')}>✕</button>
          </span>
        )}
      </div>

      {/* Date-Wise Grouped Feed */}
      {dateGroups.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-white/10 dark:bg-surface-900">
          <p className="text-sm font-bold text-slate-800 dark:text-white">
            {hasActiveFilters ? 'No matching records found' : 'Nothing logged yet'}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {hasActiveFilters
              ? 'Try selecting a different filter or clearing your search.'
              : 'Completed repairs and reported issues will appear here date-wise.'}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm"
            >
              Clear All Filters
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {dateGroups.map((group) => (
            <div key={group.dateKey} className="flex flex-col gap-2.5">
              {/* Date Header Tag */}
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      group.isToday ? 'bg-emerald-500 ring-2 ring-emerald-500/20' : 'bg-blue-500'
                    }`}
                  />
                  <span
                    className={`text-xs font-black tracking-tight ${
                      group.isToday ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-800 dark:text-neutral-200'
                    }`}
                  >
                    {group.label}
                  </span>
                </div>
                <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-surface-800 dark:text-neutral-400">
                  {group.data.length} unit{group.data.length === 1 ? '' : 's'}
                </span>
              </div>

              {/* Items for this date */}
              <div className="flex flex-col gap-2">
                {group.data.map((item) =>
                  item.kind === 'issue' ? (
                    <Link
                      key={`issue-${item.id}`}
                      to={`/batteries/${item.battery_code}`}
                      className="group rounded-2xl border border-rose-200 bg-white p-4 shadow-sm transition-all hover:border-rose-300 dark:border-rose-900/40 dark:bg-surface-900"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400">
                            ⚠
                          </span>
                          <span className="text-sm font-extrabold text-rose-700 dark:text-rose-400">
                            {item.battery_code}
                          </span>
                          <StatusBadge status={item.battery_status || 'unserviceable'} />
                        </div>
                        <span className="text-[11px] font-medium text-slate-400">
                          {item.reported_at
                            ? new Date(item.reported_at).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : ''}
                        </span>
                      </div>

                      <div className="rounded-xl border border-rose-100 bg-rose-50/70 p-2.5 dark:border-rose-950 dark:bg-rose-950/20">
                        <p className="text-xs font-bold text-rose-800 dark:text-rose-300">
                          Issue: {item.reason_label || item.reason_code}
                        </p>
                        {item.note && (
                          <p className="mt-1 text-xs leading-relaxed text-rose-700 dark:text-rose-400">
                            {item.note}
                          </p>
                        )}
                        {item.photo_urls && item.photo_urls.length > 0 && (
                          <div className="mt-2 flex items-center gap-2 border-t border-rose-200/60 pt-2 dark:border-rose-900/40">
                            {item.photo_urls.map((photo, pIdx) => (
                              <div
                                key={pIdx}
                                className="h-12 w-12 overflow-hidden rounded-lg border border-rose-200 bg-white dark:border-rose-900"
                              >
                                <img
                                  src={resolveImageUrl(photo)}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="mt-2.5 flex items-center justify-between text-[11px]">
                        <span className="font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 text-[10px]">
                          Marked Unserviceable
                        </span>
                        <span className="font-bold text-slate-400 group-hover:text-slate-600 dark:text-neutral-500 dark:group-hover:text-white">
                          Details ›
                        </span>
                      </div>
                    </Link>
                  ) : (
                    <Link
                      key={`repair-${item.id}`}
                      to={`/batteries/${item.battery_code}`}
                      className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-blue-300 dark:border-white/10 dark:bg-surface-900"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                              <path fillRule="evenodd" d="M14.5 10a4.5 4.5 0 0 0 4.284-5.882c-.105-.324-.51-.391-.752-.15L15.34 6.66a.454.454 0 0 1-.493.11 3.01 3.01 0 0 1-1.618-1.616.455.455 0 0 1 .11-.494l2.694-2.692c.24-.241.174-.647-.15-.752a4.5 4.5 0 0 0-5.873 4.575c.055.873-.128 1.808-.8 2.368l-7.23 6.024a2.724 2.724 0 1 0 3.837 3.837l6.024-7.23c.56-.672 1.495-.855 2.368-.8.096.007.193.01.291.01ZM5 16a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" clipRule="evenodd" />
                            </svg>
                          </span>
                          <span className="text-sm font-extrabold text-blue-700 dark:text-blue-400">
                            {item.battery_code}
                          </span>
                          <StatusBadge status={item.battery_status || 'repaired'} />
                        </div>
                        <span className="text-[11px] font-medium text-slate-400">
                          {item.repaired_at
                            ? new Date(item.repaired_at).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : ''}
                        </span>
                      </div>

                      <div className="rounded-xl border border-slate-100 bg-slate-50 p-2.5 dark:border-white/5 dark:bg-surface-950">
                        <p className="text-xs font-bold text-slate-800 dark:text-neutral-200">
                          {item.part_name ? `Part: ${item.part_name}` : 'Completed service & inspection'}
                        </p>
                        {item.notes && (
                          <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-neutral-400">
                            {item.notes}
                          </p>
                        )}
                      </div>

                      <div className="mt-2.5 flex items-center justify-between text-[11px]">
                        {typeof item.duration_seconds === 'number' && item.duration_seconds > 0 ? (
                          <span className="rounded-md border border-blue-100 bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:border-blue-900/40 dark:bg-blue-950 dark:text-blue-300">
                            ⏱️ Duration: {formatDuration(item.duration_seconds)}
                          </span>
                        ) : (
                          <span />
                        )}
                        <span className="font-bold text-slate-400 group-hover:text-slate-600 dark:text-neutral-500 dark:group-hover:text-white">
                          Details ›
                        </span>
                      </div>
                    </Link>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Custom Date Range Picker Modal ─────────────────────────────── */}
      {customModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4" onClick={() => setCustomModalOpen(false)}>
          <div
            className="w-full max-w-md rounded-t-3xl border border-slate-200 bg-white p-5 pb-8 shadow-2xl dark:border-white/10 dark:bg-surface-900 sm:rounded-3xl sm:pb-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-white/10">
              <div>
                <p className="text-base font-extrabold text-slate-900 dark:text-white">Filter By Date</p>
                <p className="text-xs text-slate-400">Select single day or date range</p>
              </div>
              <button type="button" onClick={() => setCustomModalOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-surface-800 dark:text-neutral-300">✕</button>
            </div>

            <div className="mt-3 grid grid-cols-4 gap-2">
              {[['today', 'Today'], ['yesterday', 'Yesterday'], ['week', 'Last 7d'], ['month', 'Last 30d']].map(([id, label]) => (
                <button key={id} type="button" onClick={() => setModalQuickPreset(id)} className="rounded-xl bg-slate-100 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:bg-surface-800 dark:text-neutral-300">
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between px-2">
              <button type="button" onClick={handlePrevMonth} className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-base font-bold text-slate-700 hover:bg-slate-200 dark:bg-surface-800 dark:text-neutral-300">‹</button>
              <span className="text-sm font-extrabold text-slate-900 dark:text-white">{viewMonthName}</span>
              <button type="button" onClick={handleNextMonth} className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-base font-bold text-slate-700 hover:bg-slate-200 dark:bg-surface-800 dark:text-neutral-300">›</button>
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
                        ? 'bg-blue-600 text-white shadow-sm'
                        : inRange
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300'
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
                <button type="button" onClick={() => setTempRange({ start: null, end: null })} className="text-xs font-bold text-rose-600 hover:underline dark:text-rose-400">Clear</button>
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
              <button type="button" onClick={applyCustomDateFilter} className="flex-1 rounded-2xl bg-blue-600 py-3.5 text-xs font-bold text-white shadow-sm shadow-blue-600/30 hover:bg-blue-700">
                Apply Date Filter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TechnicianHistoryPage;
