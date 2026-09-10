import { useEffect, useState } from 'react';
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
} from 'react-icons/fi';
import apiClient from '../../services/api-client';
import TableState from '../../components/ui/TableState';
import { getLogoUrl } from '../../utils/logo-url';

function RatingsPage() {
  const [ratings, setRatings] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [ratingFilter, setRatingFilter] = useState('');
  const [search, setSearch] = useState('');
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState('');

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    fetchRatings();
  }, [ratingFilter, selectedClient]);

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
      if (search) params.search = search;

      const res = await apiClient.get('/ratings', { params });
      setRatings(res.data?.data || []);
      setStats(res.data?.stats || null);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleSearchSubmit(e) {
    e.preventDefault();
    fetchRatings();
  }

  const totalReviews = Number(stats?.total_reviews || 0);
  const avgRating = Number(stats?.average_rating || 0).toFixed(1);
  const positiveCount = Number(stats?.positive_count || 0);
  const positivePct = totalReviews > 0 ? Math.round((positiveCount / totalReviews) * 100) : 0;

  const starBreakdown = [
    { stars: 5, count: Number(stats?.stars_5 || 0) },
    { stars: 4, count: Number(stats?.stars_4 || 0) },
    { stars: 3, count: Number(stats?.stars_3 || 0) },
    { stars: 2, count: Number(stats?.stars_2 || 0) },
    { stars: 1, count: Number(stats?.stars_1 || 0) },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-neutral-100">
            Client Ratings & Service Feedback
          </h1>
          <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">
            Monitor client satisfaction scores, turnaround reviews, and service feedback across all battery visits.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchRatings}
          className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-surface-850 dark:text-neutral-200 dark:hover:bg-surface-800 transition-colors shadow-2xs"
        >
          <FiRefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Metrics Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
              Average Rating
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400">
              <FiStar className="w-4 h-4 fill-amber-500" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">{avgRating}</span>
            <span className="text-xs text-slate-400 font-bold">/ 5.0</span>
          </div>
          <div className="flex items-center gap-1 mt-1 text-amber-500">
            {[1, 2, 3, 4, 5].map((s) => (
              <FiStar
                key={s}
                className={`w-3.5 h-3.5 ${
                  s <= Math.round(Number(avgRating)) ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-neutral-700'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wider">
              Total Reviews
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
              <FiMessageSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {totalReviews.toLocaleString()}
            </span>
          </div>
          <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-1 font-medium">
            Customer feedback submissions
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
              Positive Sentiment
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
              <FiTrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">{positivePct}%</span>
          </div>
          <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1 font-medium">
            4-Star and 5-Star ratings ({positiveCount} reviews)
          </p>
        </div>

        {/* Mini Distribution Bar */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-surface-850">
          <span className="text-[11px] font-bold text-slate-500 dark:text-neutral-400 uppercase tracking-wider block mb-1.5">
            Rating Breakdown
          </span>
          <div className="space-y-1">
            {starBreakdown.map((b) => {
              const pct = totalReviews > 0 ? Math.round((b.count / totalReviews) * 100) : 0;
              return (
                <div key={b.stars} className="flex items-center gap-1.5 text-[10px]">
                  <span className="w-3 font-bold text-slate-600 dark:text-neutral-400">{b.stars}★</span>
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden dark:bg-surface-800">
                    <div
                      style={{ width: `${pct}%` }}
                      className={`h-full rounded-full ${
                        b.stars >= 4 ? 'bg-amber-400' : b.stars === 3 ? 'bg-blue-400' : 'bg-rose-400'
                      }`}
                    />
                  </div>
                  <span className="w-5 text-right font-mono text-slate-400">{b.count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-3 rounded-2xl border border-slate-200 dark:border-white/10 dark:bg-surface-850 shadow-2xs">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
          <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by battery code, feedback text, or client..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-4 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-hidden dark:border-surface-700 dark:bg-surface-800 dark:text-neutral-100"
          />
        </form>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {/* Client filter */}
          <select
            value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 focus:outline-hidden dark:border-surface-700 dark:bg-surface-800 dark:text-neutral-200"
          >
            <option value="">All Clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Rating filter */}
          <select
            value={ratingFilter}
            onChange={(e) => setRatingFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 focus:outline-hidden dark:border-surface-700 dark:bg-surface-800 dark:text-neutral-200"
          >
            <option value="">All Ratings</option>
            <option value="5">⭐⭐⭐⭐⭐ (5 Stars)</option>
            <option value="4">⭐⭐⭐⭐ (4 Stars)</option>
            <option value="3">⭐⭐⭐ (3 Stars)</option>
            <option value="2">⭐⭐ (2 Stars)</option>
            <option value="1">⭐ (1 Star)</option>
          </select>
        </div>
      </div>

      {/* Reviews List */}
      {loading ? (
        <TableState>Loading client ratings & feedback…</TableState>
      ) : error ? (
        <TableState tone="error">{error}</TableState>
      ) : ratings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-12 text-center bg-white dark:border-white/10 dark:bg-surface-850">
          <FiStar className="mx-auto h-10 w-10 text-slate-300 dark:text-neutral-600 mb-3" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-neutral-200">No Ratings Recorded Yet</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Client feedback and ratings will appear here as soon as clients scan and review their received battery shipments.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {ratings.map((r) => {
            const logo = getLogoUrl(r.client_logo_path);
            const tags = Array.isArray(r.preset_tags) ? r.preset_tags : [];
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
                className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-4.5 shadow-2xs hover:border-slate-300 dark:border-white/10 dark:bg-surface-850 dark:hover:border-white/20 transition-all"
              >
                <div>
                  {/* Top Bar: Client & Stars */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {logo ? (
                        <img
                          src={logo}
                          alt={r.client_name || 'Client'}
                          className="h-8 w-8 rounded-xl object-contain bg-slate-50 border border-slate-200 p-0.5 dark:bg-surface-800 dark:border-white/10 shrink-0"
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-surface-800 dark:text-neutral-300 font-bold text-xs shrink-0">
                          {(r.client_name || 'C')[0]}
                        </div>
                      )}
                      <div className="min-w-0">
                        <span className="font-bold text-xs text-slate-900 dark:text-white truncate block">
                          {r.client_name || 'Client Review'}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-neutral-500 block">
                          {r.user_email || 'Verified Client'}
                        </span>
                      </div>
                    </div>

                    {/* Star Badge */}
                    <div className="flex items-center gap-1 bg-amber-50 px-2.5 py-1 rounded-xl border border-amber-200 text-amber-800 dark:bg-amber-950/60 dark:border-amber-900/50 dark:text-amber-300 shrink-0">
                      <FiStar className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <span className="font-black text-xs">{r.rating}.0</span>
                    </div>
                  </div>

                  {/* Battery Code Tag */}
                  {r.battery_code && (
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Battery:</span>
                      <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded-lg border border-blue-200/60 dark:border-blue-800/40">
                        {r.battery_code}
                      </span>
                    </div>
                  )}

                  {/* Preset Tags */}
                  {tags.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {tags.map((t, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 text-[10.5px] font-medium text-slate-700 dark:bg-surface-800 dark:text-neutral-300 border border-slate-200/50 dark:border-white/5"
                        >
                          <FiCheckCircle className="w-2.5 h-2.5 text-emerald-500" />
                          <span>{t}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Custom Feedback Text */}
                  {r.custom_feedback && (
                    <p className="mt-3 rounded-xl bg-slate-50 p-2.5 text-xs text-slate-700 leading-relaxed dark:bg-surface-900/80 dark:text-neutral-200 border border-slate-200/60 dark:border-white/5 italic">
                      "{r.custom_feedback}"
                    </p>
                  )}
                </div>

                {/* Footer Timestamp */}
                <div className="mt-4 pt-2.5 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-[10.5px] text-slate-400 dark:text-neutral-500">
                  <div className="flex items-center gap-1">
                    <FiCalendar className="w-3 h-3" />
                    <span>{dateStr}</span>
                  </div>
                  <span className="text-slate-300 dark:text-neutral-600">ID #{r.id}</span>
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
