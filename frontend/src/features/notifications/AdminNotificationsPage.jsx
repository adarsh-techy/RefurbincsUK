import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  FiBell,
  FiAlertTriangle,
  FiAlertCircle,
  FiCheckCircle,
  FiInfo,
  FiPackage,
  FiTruck,
  FiMessageSquare,
  FiAward,
  FiStar,
  FiRefreshCw,
  FiFilter,
  FiSearch,
  FiCheck,
  FiArrowRight,
  FiExternalLink,
  FiTrash2,
  FiSliders,
  FiClock,
} from 'react-icons/fi';
import apiClient from '../../services/api-client';
import { socket } from '../../services/socket-client';

const STORAGE_KEY = 'refurbnics_admin_read_notifications';

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatFullDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const CATEGORY_CONFIG = {
  all: { label: 'All Activity', icon: FiBell, color: 'text-slate-600 dark:text-slate-300' },
  urgent: { label: 'Urgent Action', icon: FiAlertTriangle, color: 'text-rose-600 dark:text-rose-400' },
  inventory: { label: 'Inventory Stock', icon: FiPackage, color: 'text-amber-600 dark:text-amber-400' },
  logistics: { label: 'Shipments & Intakes', icon: FiTruck, color: 'text-blue-600 dark:text-blue-400' },
  support: { label: 'Support Inquiries', icon: FiMessageSquare, color: 'text-purple-600 dark:text-purple-400' },
  feedback: { label: 'Client Feedback', icon: FiStar, color: 'text-yellow-600 dark:text-yellow-400' },
  milestone: { label: 'ESG Milestones', icon: FiAward, color: 'text-emerald-600 dark:text-emerald-400' },
};

export default function AdminNotificationsPage() {
  const [feed, setFeed] = useState([]);
  const [counts, setCounts] = useState({
    total: 0,
    urgent: 0,
    warning: 0,
    inventory: 0,
    logistics: 0,
    support: 0,
    feedback: 0,
    milestones: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all'); // all | urgent | warning | info
  const [readIds, setReadIds] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  async function fetchNotifications() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/notifications/admin?limit=150');
      setFeed(res.data.feed || []);
      setCounts(res.data.counts || {});
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchNotifications();

    // Auto-listen to socket events for real-time alerts
    function handleRefresh() {
      fetchNotifications();
    }

    socket.on('connect', handleRefresh);
    socket.on('parts:out-of-stock', handleRefresh);
    socket.on('tickets:new', handleRefresh);
    socket.on('intakes:new', handleRefresh);
    socket.on('returns:new', handleRefresh);

    return () => {
      socket.off('connect', handleRefresh);
      socket.off('parts:out-of-stock', handleRefresh);
      socket.off('tickets:new', handleRefresh);
      socket.off('intakes:new', handleRefresh);
      socket.off('returns:new', handleRefresh);
    };
  }, []);

  function toggleRead(id) {
    setReadIds((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }

  function markAllAsRead() {
    const allIds = feed.map((item) => item.id);
    setReadIds(allIds);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(allIds));
    } catch {
      // ignore
    }
  }

  function clearAllRead() {
    setReadIds([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  // Filtered Notifications List
  const filteredFeed = useMemo(() => {
    return feed.filter((item) => {
      // Category filter
      if (activeCategory === 'urgent') {
        if (item.severity !== 'urgent') return false;
      } else if (activeCategory !== 'all' && item.category !== activeCategory) {
        return false;
      }

      // Severity filter
      if (severityFilter !== 'all' && item.severity !== severityFilter) {
        return false;
      }

      // Keyword search
      if (search.trim()) {
        const q = search.toLowerCase();
        const inTitle = item.title?.toLowerCase().includes(q);
        const inMsg = item.message?.toLowerCase().includes(q);
        const inClient = item.meta?.clientName?.toLowerCase().includes(q);
        const inTruck = item.meta?.truckNumber?.toLowerCase().includes(q);
        const inPart = item.meta?.partName?.toLowerCase().includes(q);
        const inCode = item.meta?.batteryCode?.toLowerCase().includes(q);
        if (!inTitle && !inMsg && !inClient && !inTruck && !inPart && !inCode) return false;
      }

      return true;
    });
  }, [feed, activeCategory, severityFilter, search]);

  const unreadCount = feed.filter((item) => !readIds.includes(item.id)).length;

  return (
    <div className="space-y-3.5 sm:space-y-4 pb-12 w-full max-w-full">
      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Operations Feed
            </h1>
            {unreadCount > 0 ? (
              <span className="rounded-full bg-rose-100 dark:bg-rose-950/60 px-2 py-0.5 text-[10.5px] font-black text-rose-700 dark:text-rose-300">
                {unreadCount} unread
              </span>
            ) : (
              <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 text-[10.5px] font-bold text-emerald-700 dark:text-emerald-300">
                All clear
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Real-time stock alerts, workshop throughput, client dispatches & system notices
          </p>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllAsRead}
              className="inline-flex h-8 items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 sm:px-3 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-white/10 dark:bg-surface-800 dark:text-slate-200 dark:hover:bg-white/5 transition-all"
            >
              <FiCheck className="h-3.5 w-3.5 text-emerald-600" />
              <span>Mark all read</span>
            </button>
          )}

          {readIds.length > 0 && (
            <button
              type="button"
              onClick={clearAllRead}
              title="Reset read marks"
              className="inline-flex h-8 items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:border-white/10 dark:bg-surface-800 dark:text-slate-400 dark:hover:text-white transition-all"
            >
              <FiTrash2 className="h-3.5 w-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={fetchNotifications}
            disabled={loading}
            className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-blue-600 px-3 text-xs font-black text-white shadow-xs hover:bg-blue-700 disabled:opacity-50 transition-all active:scale-95"
          >
            <FiRefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ── Executive Unified Metric Strip (Timeless 4-Column Bar) ─────── */}
      <div className="grid grid-cols-4 rounded-2xl border border-slate-200/90 bg-white shadow-2xs divide-x divide-slate-100 dark:border-white/10 dark:bg-surface-900 dark:divide-white/5 overflow-hidden">
        {/* Urgent Action */}
        <button
          type="button"
          onClick={() => setActiveCategory((prev) => (prev === 'urgent' ? 'all' : 'urgent'))}
          className={`p-2.5 sm:p-3 text-center transition-all ${
            activeCategory === 'urgent'
              ? 'bg-rose-50/80 dark:bg-rose-950/40 ring-1 ring-inset ring-rose-400'
              : 'hover:bg-slate-50/70 dark:hover:bg-white/5'
          }`}
        >
          <div className="flex items-center justify-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 truncate">
              Urgent
            </span>
          </div>
          <div className="mt-0.5 text-base sm:text-xl font-black text-slate-900 dark:text-white">
            {counts.urgent || 0}
          </div>
        </button>

        {/* Low Stock Items */}
        <button
          type="button"
          onClick={() => setActiveCategory((prev) => (prev === 'inventory' ? 'all' : 'inventory'))}
          className={`p-2.5 sm:p-3 text-center transition-all ${
            activeCategory === 'inventory'
              ? 'bg-amber-50/80 dark:bg-amber-950/40 ring-1 ring-inset ring-amber-400'
              : 'hover:bg-slate-50/70 dark:hover:bg-white/5'
          }`}
        >
          <div className="flex items-center justify-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 truncate">
              Stock
            </span>
          </div>
          <div className="mt-0.5 text-base sm:text-xl font-black text-slate-900 dark:text-white">
            {counts.inventory || 0}
          </div>
        </button>

        {/* Logistics & Intakes */}
        <button
          type="button"
          onClick={() => setActiveCategory((prev) => (prev === 'logistics' ? 'all' : 'logistics'))}
          className={`p-2.5 sm:p-3 text-center transition-all ${
            activeCategory === 'logistics'
              ? 'bg-blue-50/80 dark:bg-blue-950/40 ring-1 ring-inset ring-blue-400'
              : 'hover:bg-slate-50/70 dark:hover:bg-white/5'
          }`}
        >
          <div className="flex items-center justify-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 truncate">
              Logistics
            </span>
          </div>
          <div className="mt-0.5 text-base sm:text-xl font-black text-slate-900 dark:text-white">
            {counts.logistics || 0}
          </div>
        </button>

        {/* ESG Milestones */}
        <button
          type="button"
          onClick={() => setActiveCategory((prev) => (prev === 'milestone' ? 'all' : 'milestone'))}
          className={`p-2.5 sm:p-3 text-center transition-all ${
            activeCategory === 'milestone'
              ? 'bg-emerald-50/80 dark:bg-emerald-950/40 ring-1 ring-inset ring-emerald-400'
              : 'hover:bg-slate-50/70 dark:hover:bg-white/5'
          }`}
        >
          <div className="flex items-center justify-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 truncate">
              ESG
            </span>
          </div>
          <div className="mt-0.5 text-base sm:text-xl font-black text-slate-900 dark:text-white">
            {counts.milestones || 0}
          </div>
        </button>
      </div>

      {/* ── Sleek Integrated Search & Filter Controls ────────────────── */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-2 sm:p-2.5 shadow-2xs dark:border-white/10 dark:bg-surface-900">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {/* Search Box */}
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-3.5 w-3.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notifications by title, client, SKU, truck or code..."
              className="w-full h-8 sm:h-9 rounded-xl border border-slate-200 bg-slate-50/60 pl-8 pr-7 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-surface-800 dark:text-white dark:placeholder:text-neutral-500 transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                ✕
              </button>
            )}
          </div>

          {/* Quick Selectors */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Severity Dropdown */}
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="h-8 sm:h-9 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 focus:border-blue-500 focus:outline-none dark:border-white/10 dark:bg-surface-800 dark:text-slate-200 transition-all cursor-pointer"
            >
              <option value="all">All Severities</option>
              <option value="urgent">🚨 Urgent Only</option>
              <option value="warning">⚠️ Warnings</option>
              <option value="success">✓ Completed</option>
              <option value="info">ℹ️ Information</option>
            </select>

            {(search || activeCategory !== 'all' || severityFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setActiveCategory('all');
                  setSeverityFilter('all');
                }}
                className="h-8 sm:h-9 rounded-xl border border-slate-200 bg-slate-100 px-2.5 text-xs font-bold text-slate-600 hover:bg-slate-200 hover:text-slate-900 dark:border-white/10 dark:bg-surface-800 dark:text-slate-300 dark:hover:bg-white/10 transition-all cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Quick-filter pill chips (single clean row) */}
        <div className="mt-2 flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar border-t border-slate-100 pt-2 dark:border-white/5">
          {[
            { id: 'all', label: 'All', count: feed.length },
            { id: 'urgent', label: 'Urgent', count: counts.urgent || 0 },
            { id: 'inventory', label: 'Stock', count: counts.inventory || 0 },
            { id: 'logistics', label: 'Logistics', count: counts.logistics || 0 },
            { id: 'support', label: 'Support', count: counts.support || 0 },
            { id: 'feedback', label: 'Feedback', count: counts.feedback || 0 },
            { id: 'milestone', label: 'ESG', count: counts.milestones || 0 },
          ].map((tab) => {
            const isActive = activeCategory === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveCategory(tab.id)}
                className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-2xs dark:bg-white dark:text-slate-900'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:bg-surface-800 dark:text-slate-300'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`rounded-full px-1 text-[9px] font-black ${
                    isActive
                      ? 'bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900'
                      : 'bg-slate-200/80 text-slate-600 dark:bg-surface-700 dark:text-slate-300'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Notifications Feed Stream ───────────────────────────────── */}
      {loading && feed.length === 0 ? (
        <div className="flex min-h-[30vh] flex-col items-center justify-center gap-2.5 rounded-2xl border border-slate-200/80 bg-white p-8 dark:border-white/10 dark:bg-surface-900">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Loading live operational notifications…
          </p>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50/60 p-5 text-center dark:border-red-900/40 dark:bg-red-950/20">
          <p className="text-xs font-bold text-red-600 dark:text-red-400">{error}</p>
          <button
            type="button"
            onClick={fetchNotifications}
            className="mt-2.5 inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-red-500"
          >
            <FiRefreshCw className="h-3 w-3" />
            Retry
          </button>
        </div>
      ) : filteredFeed.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200/80 bg-white p-10 text-center dark:border-white/10 dark:bg-surface-900 shadow-2xs">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
            <FiCheckCircle className="h-5 w-5" />
          </div>
          <h3 className="mt-3 text-sm font-bold text-slate-900 dark:text-white">
            {search || activeCategory !== 'all' || severityFilter !== 'all'
              ? 'No matching notifications found'
              : 'All systems operating normally'}
          </h3>
          <p className="mt-1 max-w-xs text-xs text-slate-400 dark:text-slate-400">
            {search || activeCategory !== 'all' || severityFilter !== 'all'
              ? 'Try adjusting your search keywords or resetting category filters.'
              : 'No outstanding alerts or pending actions required.'}
          </p>
          {(search || activeCategory !== 'all' || severityFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setActiveCategory('all');
                setSeverityFilter('all');
              }}
              className="mt-3.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-white/10 dark:bg-surface-800 dark:text-slate-200"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredFeed.map((item) => {
            const isRead = readIds.includes(item.id);

            // Styling helpers based on severity
            let severityBg = 'border-slate-200/90 bg-white dark:border-white/10 dark:bg-surface-900';
            let iconWrapper = 'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400';
            let ItemIcon = FiInfo;

            if (item.severity === 'urgent') {
              severityBg = isRead
                ? 'border-rose-200/60 bg-rose-50/20 dark:border-rose-900/30 dark:bg-rose-950/10'
                : 'border-rose-300 bg-gradient-to-r from-rose-50/40 to-white shadow-2xs dark:border-rose-800/60 dark:from-rose-950/20 dark:to-surface-900';
              iconWrapper = 'bg-rose-100 text-rose-600 dark:bg-rose-900/60 dark:text-rose-300';
              ItemIcon = FiAlertTriangle;
            } else if (item.severity === 'warning') {
              severityBg = isRead
                ? 'border-amber-200/60 bg-amber-50/20 dark:border-amber-900/30 dark:bg-amber-950/10'
                : 'border-amber-300 bg-gradient-to-r from-amber-50/30 to-white shadow-2xs dark:border-amber-800/50 dark:from-amber-950/15 dark:to-surface-900';
              iconWrapper = 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300';
              ItemIcon = FiAlertCircle;
            } else if (item.severity === 'success') {
              severityBg = isRead
                ? 'border-emerald-200/60 bg-emerald-50/20 dark:border-emerald-900/30 dark:bg-emerald-950/10'
                : 'border-emerald-300 bg-gradient-to-r from-emerald-50/20 to-white shadow-2xs dark:border-emerald-800/50 dark:from-emerald-950/15 dark:to-surface-900';
              iconWrapper = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300';
              ItemIcon = FiCheckCircle;
            }

            if (item.type === 'stock') ItemIcon = FiPackage;
            else if (item.type === 'intake' || item.type === 'return') ItemIcon = FiTruck;
            else if (item.type === 'ticket') ItemIcon = FiMessageSquare;
            else if (item.type === 'milestone') ItemIcon = FiAward;
            else if (item.type === 'rating') ItemIcon = FiStar;

            return (
              <div
                key={item.id}
                className={`group relative flex flex-col justify-between gap-3 rounded-2xl border p-3 sm:p-4 transition-all duration-150 ${severityBg} ${
                  isRead ? 'opacity-75 hover:opacity-100' : ''
                }`}
              >
                {/* Unread Indicator Bar */}
                {!isRead && (
                  <div
                    className={`absolute left-0 top-3 bottom-3 w-1 rounded-r ${
                      item.severity === 'urgent'
                        ? 'bg-rose-500'
                        : item.severity === 'warning'
                        ? 'bg-amber-500'
                        : item.severity === 'success'
                        ? 'bg-emerald-500'
                        : 'bg-blue-500'
                    }`}
                  />
                )}

                {/* Main Content Area */}
                <div className="flex items-start gap-2.5 sm:gap-3.5 min-w-0 flex-1 pl-1">
                  <div
                    className={`flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl font-bold shadow-2xs ${iconWrapper}`}
                  >
                    <ItemIcon className="h-4 w-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <Link
                        to={`/notifications/${item.id}`}
                        className="text-xs sm:text-sm font-black text-slate-900 hover:text-blue-600 dark:text-white dark:hover:text-blue-400 hover:underline break-words"
                      >
                        {item.title}
                      </Link>

                      {/* Severity Pill */}
                      {item.severity === 'urgent' && (
                        <span className="inline-flex items-center gap-0.5 rounded-md bg-rose-100 px-1.5 py-0.2 text-[9px] sm:text-[10px] font-black text-rose-800 dark:bg-rose-950/80 dark:text-rose-200 animate-pulse">
                          🚨 Urgent
                        </span>
                      )}
                      {item.severity === 'warning' && (
                        <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-100 px-1.5 py-0.2 text-[9px] sm:text-[10px] font-black text-amber-800 dark:bg-amber-950/80 dark:text-amber-200">
                          ⚠️ Action
                        </span>
                      )}

                      {/* Read / Unread Tag */}
                      <span className="text-[10px] font-bold text-slate-400 dark:text-neutral-500">
                        • {timeAgo(item.timestamp)}
                      </span>
                    </div>

                    <p className="mt-1 text-xs font-normal text-slate-600 dark:text-slate-300 leading-relaxed break-words">
                      {item.message}
                    </p>

                    {/* Metadata tags */}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] sm:text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1 text-[10px] text-slate-400">
                        <FiClock className="h-3 w-3" />
                        {formatFullDate(item.timestamp)}
                      </span>

                      {item.meta?.clientName && (
                        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-surface-800 dark:text-slate-300">
                          Client: {item.meta.clientName}
                        </span>
                      )}

                      {item.meta?.truckNumber && (
                        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-surface-800 dark:text-slate-300">
                          Truck: {item.meta.truckNumber}
                        </span>
                      )}

                      {item.meta?.sku && (
                        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-surface-800 dark:text-slate-300">
                          SKU: {item.meta.sku}
                        </span>
                      )}

                      {item.meta?.batteryCode && (
                        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-surface-800 dark:text-slate-300">
                          Battery: {item.meta.batteryCode}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Action buttons */}
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2 border-t border-slate-100 pt-2 sm:border-t-0 sm:pt-0 dark:border-white/5">
                  <Link
                    to={`/notifications/${item.id}`}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-white/10 dark:bg-surface-800 dark:text-slate-200 dark:hover:bg-white/5 transition-all"
                  >
                    <span>View Detail</span>
                  </Link>

                  <button
                    type="button"
                    onClick={() => toggleRead(item.id)}
                    title={isRead ? 'Mark as Unread' : 'Mark as Read'}
                    className={`rounded-xl border px-2.5 py-1.5 text-xs font-bold transition-all ${
                      isRead
                        ? 'border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-800 dark:border-white/10 dark:text-slate-400 dark:hover:text-white'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300'
                    }`}
                  >
                    {isRead ? 'Mark unread' : '✓ Read'}
                  </button>

                  {item.actionUrl && (
                    <Link
                      to={item.actionUrl}
                      className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-blue-600 dark:bg-surface-800 dark:hover:bg-blue-600 transition-all"
                    >
                      <span>{(item.actionLabel || 'Go to Record').replace(/\s*→\s*$/, '')}</span>
                      <FiArrowRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
