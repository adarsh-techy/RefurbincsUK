import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FiStar,
  FiSearch,
  FiFilter,
  FiMessageSquare,
  FiTrendingUp,
  FiCheckCircle,
  FiCalendar,
  FiRefreshCw,
  FiUser,
  FiChevronRight,
  FiX,
  FiClock,
  FiGrid,
  FiList,
  FiArrowRight,
  FiAward,
  FiExternalLink,
  FiCheck,
  FiTruck,
} from 'react-icons/fi';
import apiClient from '../../services/api-client';
import TableState from '../../components/ui/table/TableState';
import PageHeader from '../../components/ui/primitives/PageHeader';
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

  // Debounce search input changes automatically
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  useEffect(() => {
    fetchClients();
  }, []);

  // Compute effective start and end dates based on preset
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

  // Auto-fetch ratings whenever any filter changes
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
    <div className="space-y-6 pb-12">
      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <PageHeader
        title="Client Ratings & Service Feedback"
        description="Monitor client satisfaction scores, turnaround reviews, and service feedback across all battery visits."
        titleClassName="text-2xl font-bold tracking-tight text-green-600 dark:text-green-400"
      >
        <button
          type="button"
          onClick={fetchRatings}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-surface-850 dark:text-neutral-200 dark:hover:bg-surface-800 transition-colors shadow-2xs cursor-pointer"
        >
          <FiRefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </PageHeader>

      {/* ── Metric Summary Cards ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Average Rating */}
        <div className="rounded-2xl border border-amber-200/90 bg-amber-50/40 p-5 dark:border-amber-900/40 dark:bg-amber-950/20 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
              Overall Score
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400">
              <FiStar className="w-4 h-4 fill-amber-500 text-amber-500" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 dark:text-white">{avgRating}</span>
            <span className="text-xs font-bold text-slate-400 dark:text-neutral-500">/ 5.0</span>
          </div>
          <div className="flex items-center gap-1 mt-1.5 text-amber-500">
            {[1, 2, 3, 4, 5].map((s) => (
              <FiStar
                key={s}
                className={`w-3.5 h-3.5 ${
                  s <= Math.round(Number(avgRating))
                    ? 'fill-amber-400 text-amber-400'
                    : 'text-slate-300 dark:text-neutral-700'
                }`}
              />
            ))}
            <span className="text-[11px] text-slate-500 dark:text-neutral-400 font-medium ml-1.5">
              ({totalReviews} total reviews)
            </span>
          </div>
        </div>

        {/* Card 2: Total Reviews */}
        <div className="rounded-2xl border border-blue-200/90 bg-blue-50/40 p-5 dark:border-blue-900/40 dark:bg-blue-950/20 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wider">
              Total Submissions
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
              <FiMessageSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black text-slate-900 dark:text-white">
              {totalReviews.toLocaleString()}
            </span>
          </div>
          <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-1.5 font-medium">
            Verified feedback entries logged
          </p>
        </div>

        {/* Card 3: Positive Sentiment */}
        <div className="rounded-2xl border border-emerald-200/90 bg-emerald-50/40 p-5 dark:border-emerald-900/40 dark:bg-emerald-950/20 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
              Client Satisfaction
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
              <FiTrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 dark:text-white">{positivePct}%</span>
            <span className="text-xs text-emerald-700 dark:text-emerald-400 font-bold">Positive</span>
          </div>
          <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1.5 font-medium">
            {positiveCount} reviews scored 4★ or 5★
          </p>
        </div>

        {/* Card 4: Star Breakdown Bar */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-surface-850 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-600 dark:text-neutral-400 uppercase tracking-wider">
              Star Breakdown
            </span>
            <span className="text-[10px] text-slate-400 dark:text-neutral-500 font-mono">1★ – 5★</span>
          </div>
          <div className="space-y-1.5">
            {starBreakdown.map((b) => {
              const pct = totalReviews > 0 ? Math.round((b.count / totalReviews) * 100) : 0;
              return (
                <div key={b.stars} className="flex items-center gap-2 text-[10.5px]">
                  <span className="w-4 font-bold text-slate-700 dark:text-neutral-300">{b.stars}★</span>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden dark:bg-surface-800">
                    <div
                      style={{ width: `${pct}%` }}
                      className={`h-full rounded-full transition-all duration-500 ${b.color}`}
                    />
                  </div>
                  <span className="w-7 text-right font-mono text-slate-400 dark:text-neutral-500 text-[10px]">
                    {b.count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Filter Bar ────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-surface-850 shadow-2xs space-y-3.5">
        {/* Date Presets Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-white/5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-500 dark:text-neutral-400 uppercase tracking-wider flex items-center gap-1.5 mr-1">
              <FiCalendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Date Filter:</span>
            </span>
            {DATE_PRESETS.map((preset) => {
              const active = datePreset === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setDatePreset(preset.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                    active
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-surface-800 dark:text-neutral-300 dark:hover:bg-white/10'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          {/* View Mode Toggle Switcher */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-surface-900 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-white text-slate-900 shadow-2xs dark:bg-surface-800 dark:text-white'
                    : 'text-slate-500 hover:text-slate-900 dark:text-neutral-400'
                }`}
                title="Grid View"
              >
                <FiGrid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-white text-slate-900 shadow-2xs dark:bg-surface-800 dark:text-white'
                    : 'text-slate-500 hover:text-slate-900 dark:text-neutral-400'
                }`}
                title="Table View"
              >
                <FiList className="w-3.5 h-3.5" />
              </button>
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 cursor-pointer ml-1"
              >
                <FiX className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Inputs Row: Search + Client Select + Star Rating Select */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-3">
          {/* Keyword Search */}
          <div className="sm:col-span-2 md:col-span-6 relative">
            <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search battery code, comments, client..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-hidden dark:border-surface-700 dark:bg-surface-800 dark:text-neutral-100 dark:focus:bg-surface-750"
            />
          </div>

          {/* Client Filter */}
          <div className="sm:col-span-1 md:col-span-3">
            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              aria-label="Filter by client"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 focus:outline-hidden dark:border-surface-700 dark:bg-surface-800 dark:text-neutral-200"
            >
              <option value="">All Clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Rating Filter */}
          <div className="sm:col-span-1 md:col-span-3">
            <select
              value={ratingFilter}
              onChange={(e) => setRatingFilter(e.target.value)}
              aria-label="Filter by star rating"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 focus:outline-hidden dark:border-surface-700 dark:bg-surface-800 dark:text-neutral-200"
            >
              <option value="">All Star Ratings</option>
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
          <div className="pt-3 border-t border-slate-100 dark:border-white/5 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label htmlFor="filter-start-date" className="text-xs font-bold text-slate-600 dark:text-neutral-400">
                From:
              </label>
              <input
                id="filter-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 focus:outline-hidden dark:border-surface-700 dark:bg-surface-800 dark:text-neutral-200"
              />
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="filter-end-date" className="text-xs font-bold text-slate-600 dark:text-neutral-400">
                To:
              </label>
              <input
                id="filter-end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 focus:outline-hidden dark:border-surface-700 dark:bg-surface-800 dark:text-neutral-200"
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
        <div className="rounded-2xl border border-dashed border-slate-200 p-12 text-center bg-white dark:border-white/10 dark:bg-surface-850 shadow-2xs">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-surface-800 text-slate-400 mb-3">
            <FiStar className="h-6 w-6 text-slate-300 dark:text-neutral-600" />
          </div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-neutral-200">
            No Ratings Found
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
            {hasActiveFilters
              ? 'Try widening your date range or clearing specific filter tags to see more feedback records.'
              : 'Client feedback and ratings will appear here as soon as clients review their serviced batteries.'}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="mt-3.5 inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200 dark:bg-surface-800 dark:text-neutral-200 cursor-pointer transition-colors"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : viewMode === 'table' ? (
        /* Table View */
        <div className="rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-surface-850 overflow-hidden shadow-2xs">
          <div className="max-h-[540px] overflow-y-auto overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-100/95 dark:bg-surface-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-white/10">
                <tr className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-neutral-400">
                  <th className="py-3 px-3.5 w-12 text-center">#</th>
                  <th className="py-3 px-3.5 min-w-[130px]">Date & Time</th>
                  <th className="py-3 px-3.5 min-w-[150px]">Client</th>
                  <th className="py-3 px-3.5 min-w-[110px]">Score</th>
                  <th className="py-3 px-3.5 min-w-[130px]">Battery Code</th>
                  <th className="py-3 px-3.5 min-w-[160px]">Feedback Tags</th>
                  <th className="py-3 px-3.5 min-w-[200px]">Comments</th>
                  <th className="py-3 px-3.5 min-w-[110px] text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5 bg-white dark:bg-surface-850">
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
                      <td className="py-3 px-3.5 text-center font-mono text-slate-400 dark:text-neutral-500">
                        {index + 1}
                      </td>
                      <td className="py-3 px-3.5">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800 dark:text-neutral-200">
                            {new Date(r.created_at).toLocaleDateString([], { day: '2-digit', month: 'short' })}
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-neutral-500">
                            {new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3.5 font-bold text-slate-900 dark:text-white">
                        {r.client_name || 'Verified Client'}
                      </td>
                      <td className="py-3 px-3.5">
                        <span className="inline-flex items-center gap-1 font-bold text-xs bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 px-2 py-0.5 rounded-lg border border-amber-200 dark:border-amber-900/40">
                          <FiStar className="w-3 h-3 fill-amber-400 text-amber-400" />
                          <span>{r.rating}.0</span>
                        </span>
                      </td>
                      <td className="py-3 px-3.5">
                        {r.battery_code ? (
                          <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md dark:bg-blue-950/60 dark:text-blue-300">
                            {r.battery_code}
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-neutral-500">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3.5">
                        <div className="flex flex-wrap gap-1">
                          {tags.slice(0, 2).map((t, idx) => (
                            <span
                              key={idx}
                              className="text-[10.5px] font-semibold bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-md dark:bg-blue-950/40 dark:text-blue-300"
                            >
                              {t}
                            </span>
                          ))}
                          {tags.length > 2 && (
                            <span className="text-[10px] font-bold text-slate-400 dark:text-neutral-500 self-center">
                              +{tags.length - 2}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3.5 max-w-[220px]">
                        <span className="text-slate-600 dark:text-neutral-300 line-clamp-1 italic" title={r.custom_feedback}>
                          {r.custom_feedback ? `"${r.custom_feedback}"` : '—'}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-right">
                        <Link
                          to={`/ratings/${r.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-bold text-xs hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-900/60 transition-colors"
                        >
                          <span>Inspect</span>
                          <FiArrowRight className="w-3 h-3" />
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
        /* ── Executive Classic Grid Cards ── */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4.5">
          {ratings.map((r) => {
            const logo = getLogoUrl(r.client_logo_path);
            const tags = Array.isArray(r.preset_tags)
              ? r.preset_tags
              : typeof r.preset_tags === 'string'
              ? JSON.parse(r.preset_tags || '[]')
              : [];

            const theme = RATING_CARD_THEME[r.rating] || RATING_CARD_THEME[5];

            const dateStr = r.created_at
              ? new Date(r.created_at).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '—';

            return (
              <div
                key={r.id}
                className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 md:p-5.5 shadow-xs hover:shadow-md hover:border-blue-400/50 dark:border-white/10 dark:bg-surface-850 dark:hover:border-blue-500/40 transition-all duration-300 overflow-hidden"
              >
                {/* Top Subtle Gradient Accent Line */}
                <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${theme.gradient}`} />

                <div className="space-y-3.5">
                  {/* ── Top Row: Client Info & Star Rating ── */}
                  <div className="flex items-start justify-between gap-3 pt-0.5">
                    <div className="flex items-center gap-3 min-w-0">
                      {logo ? (
                        <img
                          src={logo}
                          alt={r.client_name || 'Client'}
                          className="h-11 w-11 rounded-2xl object-contain bg-white border border-slate-200/80 p-1 dark:bg-surface-800 dark:border-white/10 shrink-0 shadow-2xs"
                        />
                      ) : (
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-linear-to-br from-blue-600 to-indigo-700 text-white font-black text-sm shrink-0 shadow-2xs">
                          {(r.client_name || 'C')[0]?.toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white truncate">
                            {r.client_name || 'Client Review'}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 dark:text-neutral-400 block truncate mt-0.5">
                          {r.user_email || 'Verified Partner'}
                        </span>
                      </div>
                    </div>

                    {/* Star Rating Badge */}
                    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-xl border text-xs font-black shadow-2xs shrink-0 ${theme.starBadge}`}>
                      <FiStar className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <span>{r.rating}.0</span>
                    </div>
                  </div>

                  {/* ── Meta Ribbon: Battery Unit & Return Info ── */}
                  <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-slate-50/80 dark:bg-surface-900/60 border border-slate-100 dark:border-white/5">
                    {r.battery_code ? (
                      <Link
                        to={`/batteries/${encodeURIComponent(r.battery_code)}`}
                        className="inline-flex items-center gap-1.5 font-mono font-bold text-xs text-blue-700 bg-blue-50/90 dark:bg-blue-950/60 dark:text-blue-300 px-2.5 py-0.5 rounded-lg hover:underline transition-colors border border-blue-200/60 dark:border-blue-800/40"
                      >
                        <span>🔋</span>
                        <span>{r.battery_code}</span>
                      </Link>
                    ) : (
                      <span className="text-xs text-slate-400 font-mono">General Service</span>
                    )}

                    {r.return_id && (
                      <Link
                        to={`/returns/${r.return_id}`}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:text-blue-600 dark:text-neutral-300 dark:hover:text-blue-400 px-2 py-0.5 rounded-lg bg-white dark:bg-surface-800 border border-slate-200/60 dark:border-white/5"
                      >
                        <FiTruck className="w-3 h-3 text-slate-400" />
                        <span>Return #{r.return_id}</span>
                      </Link>
                    )}

                    <span className="ml-auto text-[10.5px] font-bold text-slate-400 dark:text-neutral-500 uppercase tracking-wider">
                      {theme.sentiment}
                    </span>
                  </div>

                  {/* ── Preset Service Strength Tags ── */}
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/70 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/40 shadow-2xs"
                        >
                          <FiCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400 stroke-[3]" />
                          <span>{tag}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* ── Written Feedback Box ── */}
                  {r.custom_feedback && (
                    <div className="relative rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 text-xs text-slate-700 dark:border-white/5 dark:bg-surface-900/80 dark:text-neutral-200 leading-relaxed italic">
                      <span className="text-2xl text-slate-300 dark:text-neutral-600 absolute top-1 left-2 font-serif select-none">“</span>
                      <p className="relative z-10 pl-3">{r.custom_feedback}</p>
                    </div>
                  )}
                </div>

                {/* ── Card Bottom Footer ── */}
                <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400 dark:text-neutral-500">
                    <FiClock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{dateStr}</span>
                  </div>

                  <Link
                    to={`/ratings/${r.id}`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 text-xs font-bold shadow-2xs hover:shadow-xs transition-all cursor-pointer"
                  >
                    <span>View Details</span>
                    <FiChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
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
