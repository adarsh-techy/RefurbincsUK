import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FiStar,
  FiSearch,
  FiMessageSquare,
  FiTrendingUp,
  FiCalendar,
  FiRefreshCw,
  FiClock,
  FiGrid,
  FiList,
  FiArrowRight,
  FiCheck,
  FiTruck,
  FiX,
  FiChevronRight,
} from 'react-icons/fi';
import apiClient from '../../services/api-client';
import TableState from '../../components/ui/table/TableState';
import { getLogoUrl } from '../../utils/logo-url';

const DATE_PRESETS = [
  { id: 'all', label: 'All Time' },
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'custom', label: 'Custom Range' },
];

const RATING_CARD_THEME = {
  5: {
    gradient: 'from-amber-400 via-amber-500 to-yellow-500',
    starBadge: 'bg-amber-50 border-amber-200/90 text-amber-800 dark:bg-amber-950/70 dark:border-amber-800/60 dark:text-amber-300',
    sentiment: 'Excellent Quality',
  },
  4: {
    gradient: 'from-emerald-400 via-emerald-500 to-teal-500',
    starBadge: 'bg-emerald-50 border-emerald-200/90 text-emerald-800 dark:bg-emerald-950/70 dark:border-emerald-800/60 dark:text-emerald-300',
    sentiment: 'Very Good Quality',
  },
  3: {
    gradient: 'from-blue-400 via-blue-500 to-indigo-500',
    starBadge: 'bg-blue-50 border-blue-200/90 text-blue-800 dark:bg-blue-950/70 dark:border-blue-800/60 dark:text-blue-300',
    sentiment: 'Satisfactory',
  },
  2: {
    gradient: 'from-orange-400 via-orange-500 to-amber-500',
    starBadge: 'bg-orange-50 border-orange-200/90 text-orange-800 dark:bg-orange-950/70 dark:border-orange-800/60 dark:text-orange-300',
    sentiment: 'Needs Attention',
  },
  1: {
    gradient: 'from-rose-500 via-rose-600 to-red-600',
    starBadge: 'bg-rose-50 border-rose-200/90 text-rose-800 dark:bg-rose-950/70 dark:border-rose-800/60 dark:text-rose-300',
    sentiment: 'Critical Review',
  },
};

function RatingsPage() {
  const navigate = useNavigate();

  const [ratings, setRatings] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [ratingFilter, setRatingFilter] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState('');

  // Date Filters
  const [datePreset, setDatePreset] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // View Mode: 'grid' | 'table'
  const [viewMode, setViewMode] = useState('grid');

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    if (datePreset === 'all') {
      setStartDate('');
      setEndDate('');
    } else if (datePreset === 'today') {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const todayStr = `${yyyy}-${mm}-${dd}`;
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (datePreset === 'week') {
      const now = new Date();
      const day = now.getDay();
      const diffToMonday = now.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(now.setDate(diffToMonday));
      const yyyy = monday.getFullYear();
      const mm = String(monday.getMonth() + 1).padStart(2, '0');
      const dd = String(monday.getDate()).padStart(2, '0');
      const startStr = `${yyyy}-${mm}-${dd}`;

      const todayNow = new Date();
      const endY = todayNow.getFullYear();
      const endM = String(todayNow.getMonth() + 1).padStart(2, '0');
      const endD = String(todayNow.getDate()).padStart(2, '0');
      const endStr = `${endY}-${endM}-${endD}`;

      setStartDate(startStr);
      setEndDate(endStr);
    } else if (datePreset === 'month') {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const startStr = `${yyyy}-${mm}-01`;

      const dd = String(now.getDate()).padStart(2, '0');
      const endStr = `${yyyy}-${mm}-${dd}`;
      setStartDate(startStr);
      setEndDate(endStr);
    }
  }, [datePreset]);

  useEffect(() => {
    fetchRatings();
  }, [ratingFilter, selectedClient, debouncedSearch, startDate, endDate]);

  async function fetchClients() {
    try {
      const res = await apiClient.get('/clients');
      setClients(res.data || []);
    } catch (err) {
      console.error('Failed to load clients:', err);
    }
  }

  async function fetchRatings() {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (ratingFilter) params.rating = ratingFilter;
      if (selectedClient) params.clientId = selectedClient;
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const res = await apiClient.get('/ratings', { params });
      setRatings(res.data?.data || []);
      setStats(res.data?.stats || null);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleClearFilters() {
    setRatingFilter('');
    setSelectedClient('');
    setSearch('');
    setDebouncedSearch('');
    setDatePreset('all');
    setStartDate('');
    setEndDate('');
  }

  const hasActiveFilters = Boolean(
    ratingFilter || selectedClient || search || datePreset !== 'all' || startDate || endDate
  );

  const totalReviews = Number(stats?.total_reviews || 0);
  const avgRating = Number(stats?.average_rating || 0).toFixed(1);
  const positiveCount = Number(stats?.positive_count || 0);
  const positivePct = totalReviews > 0 ? Math.round((positiveCount / totalReviews) * 100) : 0;

  const starBreakdown = [
    { stars: 5, count: Number(stats?.stars_5 || 0), color: 'bg-amber-400' },
    { stars: 4, count: Number(stats?.stars_4 || 0), color: 'bg-emerald-400' },
    { stars: 3, count: Number(stats?.stars_3 || 0), color: 'bg-blue-400' },
    { stars: 2, count: Number(stats?.stars_2 || 0), color: 'bg-orange-400' },
    { stars: 1, count: Number(stats?.stars_1 || 0), color: 'bg-rose-400' },
  ];

  return (
    <div className="space-y-2.5 sm:space-y-4 pb-12 w-full max-w-full overflow-x-hidden">
      {/* ── Executive Header Card — COMPACT ────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-3 sm:p-4 shadow-2xs dark:border-white/10 dark:bg-surface-900">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-xl font-extrabold tracking-tight text-slate-900 dark:text-neutral-100">
                Customer Reviews & Ratings
              </h1>
              <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:border-amber-800/40 dark:bg-amber-950/40 dark:text-amber-300">
                Service Satisfaction
              </span>
            </div>
            <p className="mt-0.5 text-[11px] sm:text-xs text-slate-500 dark:text-neutral-400">
              Monitor client satisfaction scores, turnaround reviews, and service feedback across all battery visits.
            </p>
          </div>

          <button
            type="button"
            onClick={fetchRatings}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-200 shadow-2xs transition-colors cursor-pointer self-start sm:self-auto"
          >
            <FiRefreshCw className={`h-3 w-3 ${loading ? 'animate-spin text-amber-600' : 'text-slate-500'}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Live Counters Strip — Ultra-compact Single Line */}
        <div className="mt-2.5 flex items-center gap-2 text-[10.5px] text-slate-500 dark:text-neutral-400 border-t border-slate-100 pt-2 dark:border-white/5 flex-wrap">
          <span className="flex items-center gap-1">
            Score:{' '}
            <strong className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
              <FiStar className="h-3 w-3 fill-amber-400 text-amber-400" />
              <span>{avgRating}</span>
            </strong>
          </span>
          <span className="text-slate-300 dark:text-neutral-600">•</span>
          <span>
            Reviews:{' '}
            <strong className="font-bold text-slate-900 dark:text-neutral-100">
              {totalReviews}
            </strong>
          </span>
          <span className="text-slate-300 dark:text-neutral-600">•</span>
          <span>
            Satisfaction:{' '}
            <strong className="font-bold text-emerald-700 dark:text-emerald-300">
              {positivePct}% Positive
            </strong>
          </span>
          <span className="text-slate-300 dark:text-neutral-600">•</span>
          <span>
            5★: <strong className="font-bold text-slate-700 dark:text-neutral-200">{stats?.stars_5 || 0}</strong>
          </span>
          <span className="text-slate-300 dark:text-neutral-600">•</span>
          <span>
            4★: <strong className="font-bold text-slate-700 dark:text-neutral-200">{stats?.stars_4 || 0}</strong>
          </span>
        </div>
      </div>

      {/* ── Metric Summary Cards — COMPACT ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        {/* Card 1: Average Rating */}
        <div className="rounded-xl border border-amber-200/90 bg-amber-50/40 p-2.5 sm:p-3 dark:border-amber-900/40 dark:bg-amber-950/20 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
              Overall Score
            </span>
            <FiStar className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">{avgRating}</span>
            <span className="text-[10px] font-bold text-slate-400">/ 5.0</span>
          </div>
          <div className="flex items-center gap-0.5 mt-0.5 text-amber-500">
            {[1, 2, 3, 4, 5].map((s) => (
              <FiStar
                key={s}
                className={`w-2.5 h-2.5 ${
                  s <= Math.round(Number(avgRating))
                    ? 'fill-amber-400 text-amber-400'
                    : 'text-slate-300 dark:text-neutral-700'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Card 2: Total Reviews */}
        <div className="rounded-xl border border-blue-200/90 bg-blue-50/40 p-2.5 sm:p-3 dark:border-blue-900/40 dark:bg-blue-950/20 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wider">
              Submissions
            </span>
            <FiMessageSquare className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="mt-1">
            <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              {totalReviews.toLocaleString()}
            </span>
          </div>
          <p className="text-[9.5px] text-blue-600 dark:text-blue-400 mt-0.5 font-medium truncate">
            Verified feedback entries
          </p>
        </div>

        {/* Card 3: Satisfaction */}
        <div className="rounded-xl border border-emerald-200/90 bg-emerald-50/40 p-2.5 sm:p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
              Satisfaction
            </span>
            <FiTrendingUp className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">{positivePct}%</span>
            <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold">Positive</span>
          </div>
          <p className="text-[9.5px] text-emerald-700 dark:text-emerald-400 mt-0.5 font-medium truncate">
            {positiveCount} scored 4★ or 5★
          </p>
        </div>

        {/* Card 4: Star Breakdown Bar */}
        <div className="rounded-xl border border-slate-200 bg-white p-2.5 sm:p-3 dark:border-white/10 dark:bg-surface-900 shadow-2xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold text-slate-600 dark:text-neutral-400 uppercase tracking-wider">
              Breakdown
            </span>
            <span className="text-[9px] text-slate-400 font-mono">1★ – 5★</span>
          </div>
          <div className="space-y-1">
            {starBreakdown.slice(0, 3).map((b) => {
              const pct = totalReviews > 0 ? Math.round((b.count / totalReviews) * 100) : 0;
              return (
                <div key={b.stars} className="flex items-center gap-1.5 text-[9.5px]">
                  <span className="w-3.5 font-bold text-slate-700 dark:text-neutral-300">{b.stars}★</span>
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden dark:bg-surface-800">
                    <div style={{ width: `${pct}%` }} className={`h-full rounded-full ${b.color}`} />
                  </div>
                  <span className="w-5 text-right font-mono text-slate-400 text-[9px]">
                    {b.count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Toolbar: Search & Filters — WRAPPING & ZERO HORIZONTAL SCROLLING ──────────────── */}
      <div className="rounded-xl border border-slate-200/90 bg-white p-2 sm:p-2.5 shadow-2xs dark:border-white/10 dark:bg-surface-900 space-y-2">
        {/* Date Presets Row — Wrapping */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 pb-2 border-b border-slate-100 dark:border-white/5">
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider mr-0.5">
              Date:
            </span>
            {DATE_PRESETS.map((preset) => {
              const active = datePreset === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setDatePreset(preset.id)}
                  className={`px-2 py-0.5 rounded-lg text-[10.5px] font-bold cursor-pointer transition-all ${
                    active
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                      : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-300'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5">
            <div className="flex items-center rounded-lg bg-slate-100 p-0.5 dark:bg-surface-800 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1 rounded font-bold cursor-pointer transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-white text-slate-900 shadow-2xs dark:bg-surface-700 dark:text-white'
                    : 'text-slate-500'
                }`}
                title="Cards View"
              >
                <FiGrid className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1 rounded font-bold cursor-pointer transition-colors ${
                  viewMode === 'table'
                    ? 'bg-white text-slate-900 shadow-2xs dark:bg-surface-700 dark:text-white'
                    : 'text-slate-500'
                }`}
                title="Table View"
              >
                <FiList className="w-3 h-3" />
              </button>
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="text-[11px] font-bold text-rose-600 hover:text-rose-700 px-1 py-0.5 cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Inputs Row: Search + Client Filter + Star Rating */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-1.5">
          {/* Keyword Search */}
          <div className="sm:col-span-6 relative">
            <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search battery, client, comments…"
              className="w-full rounded-lg border border-slate-200 bg-slate-50/70 pl-8 pr-7 py-1 text-xs text-slate-800 placeholder-slate-400 focus:border-amber-500 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-surface-800 dark:text-neutral-100 transition-colors"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <FiX className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Client Select */}
          <div className="sm:col-span-3">
            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              aria-label="Filter by client"
              className="w-full rounded-lg border border-slate-200 bg-slate-50/70 px-2 py-1 text-xs text-slate-700 focus:outline-none dark:border-white/10 dark:bg-surface-800 dark:text-neutral-200"
            >
              <option value="">All Clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Rating Select */}
          <div className="sm:col-span-3">
            <select
              value={ratingFilter}
              onChange={(e) => setRatingFilter(e.target.value)}
              aria-label="Filter by star rating"
              className="w-full rounded-lg border border-slate-200 bg-slate-50/70 px-2 py-1 text-xs text-slate-700 focus:outline-none dark:border-white/10 dark:bg-surface-800 dark:text-neutral-200"
            >
              <option value="">All Ratings</option>
              <option value="5">⭐⭐⭐⭐⭐ 5 Stars</option>
              <option value="4">⭐⭐⭐⭐ 4 Stars</option>
              <option value="3">⭐⭐⭐ 3 Stars</option>
              <option value="2">⭐⭐ 2 Stars</option>
              <option value="1">⭐ 1 Star</option>
            </select>
          </div>
        </div>

        {/* Custom Date Pickers Drawer */}
        {datePreset === 'custom' && (
          <div className="pt-2 border-t border-slate-100 dark:border-white/5 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 text-[11px] text-slate-500">
              <span>From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-md border border-slate-200 bg-slate-50/70 px-1.5 py-0.5 text-xs text-slate-700 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-200"
              />
            </div>
            <div className="flex items-center gap-1 text-[11px] text-slate-500">
              <span>To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="rounded-md border border-slate-200 bg-slate-50/70 px-1.5 py-0.5 text-xs text-slate-700 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-200"
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Reviews Content ──────────────────────────────────────────────────── */}
      {loading ? (
        <TableState>Loading client ratings & feedback…</TableState>
      ) : error ? (
        <TableState tone="error">{error}</TableState>
      ) : ratings.length === 0 ? (
        <div className="rounded-xl border border-slate-200/90 bg-white p-6 text-center dark:border-white/10 dark:bg-surface-900 shadow-2xs">
          <FiStar className="mx-auto h-6 w-6 text-slate-400 mb-2" />
          <h3 className="text-xs font-bold text-slate-800 dark:text-neutral-200">
            No Ratings Found
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-neutral-400 mt-0.5 max-w-sm mx-auto">
            {hasActiveFilters
              ? 'Try widening your date range or clearing specific filter tags to see more feedback records.'
              : 'Client feedback and ratings will appear here as soon as clients review their serviced batteries.'}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="mt-2.5 inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-200 dark:bg-surface-800 dark:text-neutral-200 cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : viewMode === 'table' ? (
        /* Table View */
        <div className="rounded-xl border border-slate-200/90 bg-white dark:border-white/10 dark:bg-surface-900 overflow-hidden shadow-2xs">
          <div className="max-h-[540px] overflow-y-auto overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-50/95 dark:bg-surface-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-white/10">
                <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">
                  <th className="py-2.5 px-3 w-10 text-center">#</th>
                  <th className="py-2.5 px-3 min-w-[120px]">Date</th>
                  <th className="py-2.5 px-3 min-w-[140px]">Client</th>
                  <th className="py-2.5 px-3 min-w-[90px]">Score</th>
                  <th className="py-2.5 px-3 min-w-[120px]">Battery</th>
                  <th className="py-2.5 px-3 min-w-[140px]">Tags</th>
                  <th className="py-2.5 px-3 min-w-[180px]">Comments</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {ratings.map((r, index) => {
                  const tags = Array.isArray(r.preset_tags)
                    ? r.preset_tags
                    : typeof r.preset_tags === 'string'
                    ? JSON.parse(r.preset_tags || '[]')
                    : [];
                  return (
                    <tr
                      key={r.id || index}
                      className="hover:bg-slate-50/80 dark:hover:bg-surface-800/60 transition-colors"
                    >
                      <td className="py-2.5 px-3 text-center font-mono text-slate-400 text-[10px]">
                        {index + 1}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-semibold text-slate-800 dark:text-neutral-200 block text-[11px]">
                          {new Date(r.created_at).toLocaleDateString([], { day: '2-digit', month: 'short' })}
                        </span>
                        <span className="text-[9.5px] text-slate-400">
                          {new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white text-xs">
                        {r.client_name || 'Verified Client'}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="inline-flex items-center gap-0.5 font-bold text-[10.5px] bg-amber-50 text-amber-800 px-1.5 py-0.2 rounded border border-amber-200">
                          <FiStar className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                          <span>{r.rating}.0</span>
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        {r.battery_codes && r.battery_codes.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {r.battery_codes.map((code) => (
                              <Link
                                key={code}
                                to={`/batteries/${encodeURIComponent(code)}`}
                                className="font-mono font-bold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded dark:bg-blue-950/60 dark:text-blue-300 text-[10px] hover:underline"
                              >
                                {code}
                              </Link>
                            ))}
                          </div>
                        ) : r.battery_code ? (
                          <span className="font-mono font-bold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded dark:bg-blue-950/60 dark:text-blue-300 text-[10px]">
                            {r.battery_code}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex flex-wrap gap-1">
                          {tags.slice(0, 2).map((t, idx) => (
                            <span
                              key={idx}
                              className="text-[9.5px] font-semibold bg-blue-50 text-blue-700 px-1 py-0.2 rounded dark:bg-blue-950/40 dark:text-blue-300"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 max-w-[200px]">
                        <span className="text-slate-600 dark:text-neutral-300 line-clamp-1 italic text-[11px]" title={r.custom_feedback}>
                          {r.custom_feedback ? `"${r.custom_feedback}"` : '—'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <Link
                          to={`/ratings/${r.id}`}
                          className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded border border-slate-200 bg-white text-slate-700 font-semibold text-[10px] hover:bg-slate-50 transition-colors shadow-2xs"
                        >
                          <span>Inspect</span>
                          <FiArrowRight className="w-2.5 h-2.5 text-slate-400" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ── Executive Grid Cards — COMPACT & ZERO HORIZONTAL SCROLL ── */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-2.5">
          {ratings.map((r) => {
            const logo = getLogoUrl(r.client_logo_path);
            const tags = Array.isArray(r.preset_tags)
              ? r.preset_tags
              : typeof r.preset_tags === 'string'
              ? JSON.parse(r.preset_tags || '[]')
              : [];

            const batteryList =
              Array.isArray(r.battery_codes) && r.battery_codes.length > 0
                ? r.battery_codes
                : r.battery_code
                ? r.battery_code.split(',').map((s) => s.trim()).filter(Boolean)
                : [];

            const theme = RATING_CARD_THEME[r.rating] || RATING_CARD_THEME[5];

            const dateStr = r.created_at
              ? new Date(r.created_at).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })
              : '—';

            return (
              <div
                key={r.id}
                className="relative flex flex-col justify-between rounded-xl border border-slate-200/90 bg-white p-2.5 sm:p-3 shadow-2xs dark:border-white/10 dark:bg-surface-900 transition-all hover:border-slate-300 space-y-2 overflow-hidden"
              >
                {/* Top Subtle Gradient Accent Line */}
                <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${theme.gradient}`} />

                <div className="space-y-1.5 pt-0.5">
                  {/* Top Row: Client Info & Star Rating */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {logo ? (
                        <img
                          src={logo}
                          alt={r.client_name || 'Client'}
                          className="h-8 w-8 rounded-lg object-contain bg-white border border-slate-200 p-0.5 shrink-0 shadow-2xs"
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-blue-600 to-indigo-700 text-white font-black text-xs shrink-0 shadow-2xs">
                          {(r.client_name || 'C')[0]?.toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <span className="font-bold text-xs text-slate-900 dark:text-white truncate block">
                          {r.client_name || 'Client Review'}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-neutral-400 block truncate">
                          {r.user_email || 'Verified Partner'}
                        </span>
                      </div>
                    </div>

                    {/* Star Rating Badge */}
                    <div className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10.5px] font-extrabold shrink-0 ${theme.starBadge}`}>
                      <FiStar className="w-3 h-3 fill-amber-400 text-amber-400" />
                      <span>{r.rating}.0</span>
                    </div>
                  </div>

                  {/* Meta Ribbon: Battery Unit(s) & Return Info */}
                  <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-lg bg-slate-50/80 dark:bg-surface-800/60 border border-slate-100 dark:border-white/5">
                    {batteryList.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-1">
                        {batteryList.map((code) => (
                          <Link
                            key={code}
                            to={`/batteries/${encodeURIComponent(code)}`}
                            className="inline-flex items-center gap-0.5 font-mono font-bold text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded hover:underline"
                          >
                            <span>🔋</span>
                            <span>{code}</span>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-mono">General Service</span>
                    )}

                    {r.return_id && (
                      <Link
                        to={`/returns/${r.return_id}`}
                        className="inline-flex items-center gap-0.5 text-[10px] font-bold text-slate-600 hover:text-blue-600 px-1.5 py-0.2 rounded bg-white border border-slate-200"
                      >
                        <FiTruck className="w-2.5 h-2.5 text-slate-400" />
                        <span>Return #{r.return_id}</span>
                      </Link>
                    )}

                    <span className="ml-auto text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                      {theme.sentiment}
                    </span>
                  </div>

                  {/* Preset Tags */}
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/70"
                        >
                          <FiCheck className="w-2.5 h-2.5 text-emerald-600" />
                          <span>{tag}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Written Feedback Box */}
                  {r.custom_feedback && (
                    <div className="rounded-lg border border-slate-200/80 bg-slate-50/70 p-2 text-[10.5px] text-slate-700 dark:border-white/5 dark:bg-surface-800/80 dark:text-neutral-200 leading-relaxed italic">
                      “{r.custom_feedback}”
                    </div>
                  )}
                </div>

                {/* Card Bottom Footer */}
                <div className="pt-2 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-1 text-[10px] text-slate-400">
                    <FiClock className="w-3 h-3 text-slate-400" />
                    <span>{dateStr}</span>
                  </div>

                  <Link
                    to={`/ratings/${r.id}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-2.5 py-0.5 text-[10px] font-semibold shadow-2xs transition-colors"
                  >
                    <span>Inspect</span>
                    <FiChevronRight className="w-2.5 h-2.5 text-slate-400" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default RatingsPage;
