import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../../services/api-client';
import DataTable from '../../../components/ui/table/DataTable';

function formatTimestamp(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

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

const TYPE_CONFIG = {
  intake: {
    label: 'Verified Intake',
    shortLabel: 'Intake',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/40',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
        <path d="M6.5 3c-1.051 0-2.093.04-3.125.117A1.49 1.49 0 0 0 2 4.607V10.5h9V4.606c0-.771-.58-1.43-1.341-1.489A42.42 42.42 0 0 0 6.5 3ZM11 12H2v3.393c0 .772.58 1.43 1.341 1.49 2.063.155 4.147.234 6.25.234s4.187-.079 6.25-.234A1.49 1.49 0 0 0 17 15.393V12h-6ZM12.5 10.5h4.5V4.606c0-.771-.58-1.43-1.341-1.489A42.42 42.42 0 0 0 12.5 3v7.5Z" />
      </svg>
    ),
  },
  return: {
    label: 'Packed for Return',
    shortLabel: 'Return',
    badgeClass: 'bg-teal-50 text-teal-700 border-teal-200/80 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-800/40',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
        <path d="M6.5 3A1.5 1.5 0 0 0 5 4.5V6H3.5A1.5 1.5 0 0 0 2 7.5v6A1.5 1.5 0 0 0 3.5 15h.586a2.5 2.5 0 0 0 4.828 0h2.172a2.5 2.5 0 0 0 4.828 0h.586a1.5 1.5 0 0 0 1.5-1.5V10a2 2 0 0 0-.586-1.414l-2-2A2 2 0 0 0 14 6h-1.5V4.5A1.5 1.5 0 0 0 11 3H6.5ZM6 14.5a1 1 0 1 1 2 0 1 1 0 0 1-2 0Zm7 0a1 1 0 1 1 2 0 1 1 0 0 1-2 0Z" />
      </svg>
    ),
  },
  invoice: {
    label: 'Invoices & Billing',
    shortLabel: 'Bill',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200/80 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800/40',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
        <path fillRule="evenodd" d="M4.5 2A1.5 1.5 0 0 0 3 3.5v13A1.5 1.5 0 0 0 4.5 18h11a1.5 1.5 0 0 0 1.5-1.5V7.621a1.5 1.5 0 0 0-.44-1.06l-4.12-4.122A1.5 1.5 0 0 0 11.378 2H4.5Zm2.25 8.5a.75.75 0 0 0 0 1.5h6.5a.75.75 0 0 0 0-1.5h-6.5Zm0 3a.75.75 0 0 0 0 1.5h6.5a.75.75 0 0 0 0-1.5h-6.5Z" clipRule="evenodd" />
      </svg>
    ),
  },
  repair: {
    label: 'Service Update',
    shortLabel: 'Service',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200/80 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800/40',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
        <path fillRule="evenodd" d="M14.5 2a2.5 2.5 0 0 0-2.316 3.44l-6.84 6.84a2.25 2.25 0 1 0 3.182 3.182l6.84-6.84A2.5 2.5 0 1 0 14.5 2Z" clipRule="evenodd" />
      </svg>
    ),
  },
};

export default function ClientNotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [search, setSearch] = useState('');

  // Selected Batch subview
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [batchSearch, setBatchSearch] = useState('');

  async function fetchNotifications() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/clients/me/notifications?limit=100');
      setNotifications(res.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchNotifications();
  }, []);

  const filtered = useMemo(() => {
    return notifications.filter((item) => {
      if (filterType !== 'all' && item.type !== filterType) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const codes = Array.isArray(item.battery_codes)
          ? item.battery_codes.join(' ').toLowerCase()
          : '';
        const msg = (item.message || '').toLowerCase();
        const title = (item.title || '').toLowerCase();
        const truck = (item.truck_number || '').toLowerCase();
        const driver = (item.driver_name || '').toLowerCase();
        if (
          !codes.includes(q) &&
          !msg.includes(q) &&
          !title.includes(q) &&
          !truck.includes(q) &&
          !driver.includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [notifications, filterType, search]);

  const stats = useMemo(() => {
    return {
      all: notifications.length,
      intake: notifications.filter((n) => n.type === 'intake').length,
      return: notifications.filter((n) => n.type === 'return').length,
      invoice: notifications.filter((n) => n.type === 'invoice').length,
    };
  }, [notifications]);

  // ── Batch Subview ──────────────────────────────────────────────────────────
  if (selectedBatch) {
    const codes = selectedBatch.battery_codes || [];
    const filteredCodes = codes.filter(
      (c) =>
        !batchSearch ||
        String(c).toLowerCase().includes(batchSearch.toLowerCase().trim())
    );

    const batchColumns = [
      {
        key: 'code',
        label: 'Battery Code',
        render: (code) => (
          <Link
            to={`/batteries/${encodeURIComponent(code)}`}
            className="font-mono text-xs font-bold text-blue-600 hover:underline dark:text-blue-400"
          >
            {code}
          </Link>
        ),
      },
      {
        key: 'event',
        label: 'Action',
        render: () => (
          <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
            {selectedBatch.type === 'intake'
              ? 'Intake'
              : selectedBatch.type === 'return'
                ? 'Return'
                : 'Bill'}
          </span>
        ),
      },
      {
        key: 'actions',
        label: '',
        render: (code) => (
          <Link
            to={`/batteries/${encodeURIComponent(code)}`}
            className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-blue-600 hover:underline dark:text-blue-400"
          >
            <span>Track</span>
            <span>→</span>
          </Link>
        ),
      },
    ];

    return (
      <div className="space-y-3 pb-8">
        <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-2.5">
          <button
            type="button"
            onClick={() => {
              setSelectedBatch(null);
              setBatchSearch('');
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
          >
            <span>←</span>
            <span>Back</span>
          </button>

          <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900/40">
            {codes.length} Batteries
          </span>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
            {selectedBatch.title}
          </h2>
          {selectedBatch.message && (
            <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-400 leading-normal">
              {selectedBatch.message}
            </p>
          )}

          <div className="mt-2 flex flex-wrap gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            {selectedBatch.truck_number && (
              <div className="rounded-md bg-slate-50 dark:bg-slate-950 px-2 py-0.5 border border-slate-100 dark:border-slate-800">
                <span className="text-[9px] uppercase font-bold text-slate-400">Truck: </span>
                <span className="font-mono text-[10.5px] font-bold text-slate-800 dark:text-slate-200">
                  {selectedBatch.truck_number}
                </span>
              </div>
            )}
            {selectedBatch.driver_name && (
              <div className="rounded-md bg-slate-50 dark:bg-slate-950 px-2 py-0.5 border border-slate-100 dark:border-slate-800">
                <span className="text-[9px] uppercase font-bold text-slate-400">Driver: </span>
                <span className="text-[10.5px] font-bold text-slate-800 dark:text-slate-200">
                  {selectedBatch.driver_name}
                </span>
              </div>
            )}
            {selectedBatch.timestamp && (
              <div className="rounded-md bg-slate-50 dark:bg-slate-950 px-2 py-0.5 border border-slate-100 dark:border-slate-800">
                <span className="text-[9px] uppercase font-bold text-slate-400">Logged: </span>
                <span className="text-[10.5px] font-semibold text-slate-700 dark:text-slate-300">
                  {formatTimestamp(selectedBatch.timestamp)}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="relative">
          <input
            type="text"
            value={batchSearch}
            onChange={(e) => setBatchSearch(e.target.value)}
            placeholder="Search code in batch…"
            className="w-full h-8 rounded-lg border border-slate-200/80 bg-white pl-7 pr-3 text-[11px] font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-hidden dark:border-slate-800 dark:bg-slate-900 dark:text-white"
          />
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400"
          >
            <path
              fillRule="evenodd"
              d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z"
              clipRule="evenodd"
            />
          </svg>
        </div>

        <DataTable
          headerColor="blue"
          columns={batchColumns}
          rows={filteredCodes}
          showRowNumber
          emptyMessage="No batteries match your search."
        />
      </div>
    );
  }

  // ── Main Compact Mobile-Friendly Feed View (No Horizontal Scroll) ───────────
  return (
    <div className="space-y-2.5 pb-8">
      {/* Compact Top Header */}
      <div className="flex items-center justify-between pt-0.5">
        <div>
          <div className="flex items-center gap-1.5">
            <h1 className="text-sm sm:text-base font-bold tracking-tight text-slate-900 dark:text-white">
              Notifications
            </h1>
            {stats.all > 0 && (
              <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                {stats.all}
              </span>
            )}
          </div>
          <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
            Intakes, returns, and statements
          </p>
        </div>

        <button
          type="button"
          onClick={fetchNotifications}
          disabled={loading}
          aria-label="Refresh feed"
          className="inline-flex h-7 sm:h-8 items-center gap-1 rounded-lg border border-slate-200/90 bg-white px-2 sm:px-2.5 text-[11px] font-semibold text-slate-700 shadow-2xs transition active:scale-95 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="2"
            stroke="currentColor"
            className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
            />
          </svg>
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* ── 4-Column Responsive Grid Filter (100% Fits Screen, ZERO Horizontal Scroll) ── */}
      <div className="grid grid-cols-4 gap-1 w-full">
        {[
          { id: 'all', short: 'All', full: 'All Alerts', count: stats.all },
          { id: 'intake', short: 'Intake', full: 'Intakes', count: stats.intake },
          { id: 'return', short: 'Return', full: 'Returns', count: stats.return },
          { id: 'invoice', short: 'Bills', full: 'Invoices', count: stats.invoice },
        ].map((tab) => {
          const isActive = filterType === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterType(tab.id)}
              className={`flex items-center justify-center gap-1 rounded-lg py-1 px-1 text-[10.5px] font-semibold transition-all w-full truncate ${
                isActive
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-2xs'
                  : 'bg-white border border-slate-200/80 text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300'
              }`}
            >
              <span className="truncate sm:hidden">{tab.short}</span>
              <span className="hidden sm:inline truncate">{tab.full}</span>
              <span
                className={`rounded-full px-1 text-[9.5px] font-bold ${
                  isActive
                    ? 'bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900'
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Compact Search Bar ─────────────────────────────────────────── */}
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by battery serial, truck, driver…"
          className="w-full h-8 sm:h-8.5 rounded-lg border border-slate-200/80 bg-white py-1 pl-7 pr-7 text-[11px] font-medium text-slate-900 placeholder:text-slate-400 shadow-2xs focus:border-blue-500 focus:outline-hidden dark:border-slate-800 dark:bg-slate-900 dark:text-white"
        />
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400"
        >
          <path
            fillRule="evenodd"
            d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z"
            clipRule="evenodd"
          />
        </svg>
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="absolute right-2 top-2 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        )}
      </div>

      {/* ── Notification Content ───────────────────────────────────────── */}
      {loading && notifications.length === 0 ? (
        <div className="flex min-h-[25vh] flex-col items-center justify-center gap-1.5">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-900 border-t-transparent dark:border-white" />
          <p className="text-[11px] text-slate-500">Checking for activity…</p>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50/60 p-3 text-center dark:border-red-900/40 dark:bg-red-950/20">
          <p className="text-[11px] font-semibold text-red-600 dark:text-red-400">{error}</p>
          <button
            type="button"
            onClick={fetchNotifications}
            className="mt-2 rounded-lg bg-red-600 px-3 py-1 text-[11px] font-bold text-white shadow-2xs hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      ) : filtered.length === 0 ? (
        /* Compact Clean Empty State (No huge border, zero horizontal scroll) */
        <div className="flex flex-col items-center justify-center py-8 px-3 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 mb-2">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
            </svg>
          </div>
          <p className="text-xs font-bold text-slate-900 dark:text-white">
            {search ? 'No matching notifications' : 'All caught up'}
          </p>
          <p className="mt-0.5 max-w-xs text-[10.5px] text-slate-500 dark:text-slate-400 leading-normal">
            {search
              ? 'Try searching with another keyword.'
              : 'Alerts appear here as batteries are received, serviced, or invoiced.'}
          </p>
        </div>
      ) : (
        /* Reduced-Size Cards */
        <div className="space-y-2">
          {filtered.map((item) => {
            const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.intake;
            const isInvoice = item.type === 'invoice';
            const codes = item.battery_codes || [];
            const count = item.battery_count || codes.length || 1;
            const isBatch = count > 1;

            return (
              <div
                key={item.id}
                className="rounded-xl border border-slate-200/80 bg-white p-2.5 sm:p-3 shadow-2xs dark:border-slate-800 dark:bg-slate-900"
              >
                {/* Header: Tag + Time */}
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.2 text-[9.5px] font-bold ${config.badgeClass}`}
                    >
                      {config.icon}
                      <span>{config.shortLabel}</span>
                    </span>

                    {count > 0 && !isInvoice && (
                      <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 text-[9.5px] font-bold text-slate-600 dark:text-slate-300">
                        {count} {count === 1 ? 'Battery' : 'Batteries'}
                      </span>
                    )}
                  </div>

                  <span className="text-[10px] text-slate-400">
                    {timeAgo(item.timestamp)}
                  </span>
                </div>

                {/* Title & Message */}
                <h3 className="mt-1.5 text-xs font-bold text-slate-900 dark:text-white leading-snug">
                  {item.title?.replace(/\s*\(\d+\s*Batteries\)/gi, '')}
                </h3>

                {item.message && (
                  <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-400 leading-normal">
                    {item.message}
                  </p>
                )}

                {/* Micro Details Grid */}
                {(item.truck_number || item.driver_name || item.packed_at || item.received_shop_at) && (
                  <div className="mt-2 rounded-lg bg-slate-50/80 dark:bg-slate-950/60 p-2 border border-slate-100 dark:border-slate-800/80 text-[10.5px]">
                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <span className="text-[8.5px] uppercase font-bold text-slate-400 block">Truck</span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200 truncate block">
                          {item.truck_number || '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[8.5px] uppercase font-bold text-slate-400 block">Driver</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200 truncate block">
                          {item.driver_name || '—'}
                        </span>
                      </div>
                    </div>

                    {(item.packed_at || item.received_shop_at) && (
                      <div className="mt-1.5 pt-1.5 border-t border-slate-200/60 dark:border-slate-800/60 grid grid-cols-2 gap-1.5">
                        <div>
                          <span className="text-[8.5px] uppercase font-bold text-slate-400 block">Packed</span>
                          <span className="text-slate-700 dark:text-slate-300 truncate block">
                            {formatTimestamp(item.packed_at)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[8.5px] uppercase font-bold text-slate-400 block">Workshop Arrival</span>
                          <span className="truncate block">
                            {item.received_shop_at ? (
                              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                ✓ {formatTimestamp(item.received_shop_at)}
                              </span>
                            ) : (
                              <span className="font-medium text-amber-600 dark:text-amber-400">
                                ● In Transit
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Action Trigger */}
                <div className="mt-2 flex items-center justify-between pt-1.5 border-t border-slate-100 dark:border-slate-800/80">
                  <span className="text-[9.5px] text-slate-400">
                    {formatTimestamp(item.timestamp)}
                  </span>

                  {isInvoice ? (
                    <Link
                      to="/my/invoices"
                      className="inline-flex items-center gap-0.5 rounded-md bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 px-2 py-0.5 text-[10.5px] font-bold"
                    >
                      <span>Open PDF Bill</span>
                      <span>→</span>
                    </Link>
                  ) : isBatch ? (
                    <button
                      type="button"
                      onClick={() => setSelectedBatch(item)}
                      className="inline-flex items-center gap-0.5 rounded-md bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 px-2 py-0.5 text-[10.5px] font-bold"
                    >
                      <span>View Batch ({count})</span>
                      <span>→</span>
                    </button>
                  ) : codes[0] ? (
                    <Link
                      to={`/batteries/${encodeURIComponent(codes[0])}`}
                      className="inline-flex items-center gap-0.5 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-2 py-0.5 text-[10.5px] font-mono font-bold"
                    >
                      <span>{codes[0]}</span>
                      <span>→</span>
                    </Link>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
