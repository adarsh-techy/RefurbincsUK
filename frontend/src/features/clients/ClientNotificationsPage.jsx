import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../services/api-client';
import DataTable from '../../components/ui/DataTable';
import { useTheme } from '../../context/ThemeContext';

function formatTimestamp(ts) {
  if (!ts) return '';
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

export default function ClientNotificationsPage() {
  const { customTheme } = useTheme();
  const accent = customTheme?.accentColor || '#10b981';

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterType, setFilterType] = useState('all'); // 'all' | 'intake' | 'repair' | 'return' | 'invoice'
  const [search, setSearch] = useState('');

  // Selected Batch full-page subview state (Page instead of Modal)
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
        const codes = Array.isArray(item.battery_codes) ? item.battery_codes.join(' ').toLowerCase() : '';
        const msg = (item.message || '').toLowerCase();
        const title = (item.title || '').toLowerCase();
        const truck = (item.truck_number || '').toLowerCase();
        if (!codes.includes(q) && !msg.includes(q) && !title.includes(q) && !truck.includes(q)) {
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

  // ── If Batch is Selected, Render Full Dedicated Page Subview (Not a Modal) ──
  if (selectedBatch) {
    const codes = selectedBatch.battery_codes || [];
    const filteredCodes = codes.filter((c) =>
      !batchSearch || c.toLowerCase().includes(batchSearch.toLowerCase().trim())
    );

    const batchColumns = [
      {
        key: 'code',
        label: 'Battery ID / Code',
        render: (code) => (
          <Link
            to={`/batteries/${encodeURIComponent(code)}`}
            className="font-mono font-bold text-blue-700 hover:underline dark:text-blue-400"
          >
            {code}
          </Link>
        ),
      },
      {
        key: 'event',
        label: 'Batch Action',
        render: () => (
          <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-neutral-300">
            {selectedBatch.type === 'intake'
              ? 'Verified Workshop Intake'
              : selectedBatch.type === 'return'
                ? 'Packed for Return'
                : 'Invoice Document'}
          </span>
        ),
      },
      {
        key: 'actions',
        label: '',
        render: (code) => (
          <Link
            to={`/batteries/${encodeURIComponent(code)}`}
            className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            <span>Track Battery Details</span>
            <span>→</span>
          </Link>
        ),
      },
    ];

    return (
      <div className="space-y-6">
        {/* Back Navigation Bar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/80 pb-5 dark:border-white/10">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setSelectedBatch(null);
                setBatchSearch('');
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-surface-900 dark:text-neutral-200 dark:hover:bg-white/5"
            >
              <span>←</span>
              <span>Back to Notifications Feed</span>
            </button>

            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                <span>{selectedBatch.title}</span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">
                {selectedBatch.truck_number ? `Truck: ${selectedBatch.truck_number}` : ''}
                {selectedBatch.driver_name ? ` • Driver: ${selectedBatch.driver_name}` : ''}
                {` • Logged on ${formatTimestamp(selectedBatch.timestamp)}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-xl bg-emerald-100 px-3.5 py-1.5 text-xs font-black text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-200">
              {codes.length} Batteries in this Batch
            </span>
          </div>
        </div>

        {/* Batch Overview Banner */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs dark:border-white/10 dark:bg-surface-900">
          <p className="text-xs font-semibold text-slate-800 dark:text-white">
            {selectedBatch.message}
          </p>
        </div>

        {/* Filter Search */}
        <div className="flex items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <input
              type="text"
              value={batchSearch}
              onChange={(e) => setBatchSearch(e.target.value)}
              placeholder="Search Battery Code in this batch…"
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3.5 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 dark:border-white/10 dark:bg-surface-900 dark:text-white"
            />
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="absolute left-3 top-2.5 h-4 w-4 text-slate-400">
              <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
            </svg>
          </div>
        </div>

        {/* Detailed Full Table for this Notification Batch */}
        <DataTable
          headerColor="blue"
          columns={batchColumns}
          rows={filteredCodes}
          showRowNumber
          emptyMessage="No batteries found in this batch."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Executive Header ────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-xl text-white shadow-sm"
              style={{ backgroundColor: accent }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                <path fillRule="evenodd" d="M5.25 9a6.75 6.75 0 0 1 13.5 0v.75c0 2.123.8 4.057 2.118 5.52a.75.75 0 0 1-.297 1.206c-1.544.57-3.16.99-4.831 1.243a3.75 3.75 0 1 1-7.48 0 24.585 24.585 0 0 1-4.831-1.244.75.75 0 0 1-.298-1.205A8.217 8.217 0 0 0 5.25 9.75V9Zm4.502 8.9a2.25 2.25 0 0 0 4.496 0 25.057 25.057 0 0 1-4.496 0Z" clipRule="evenodd" />
              </svg>
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Battery Activity & Notifications
            </h1>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
            Verified workshop intakes, packed return dispatches, and invoice documents for your fleet.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchNotifications}
          disabled={loading}
          className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition-all hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:bg-surface-900 dark:text-neutral-200 dark:hover:bg-white/5"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          Refresh Feed
        </button>
      </div>

      {/* ── Filter Tabs & Search Bar ───────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-2xs dark:border-white/10 dark:bg-surface-900">
          {[
            { id: 'all', label: 'All Alerts', count: stats.all },
            { id: 'intake', label: 'Verified Intakes', count: stats.intake },
            { id: 'return', label: 'Packed for Return', count: stats.return },
            { id: 'invoice', label: 'Invoices & Bills', count: stats.invoice },
          ].map((tab) => {
            const isActive = filterType === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterType(tab.id)}
                style={isActive ? { backgroundColor: accent, color: '#ffffff' } : {}}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                  isActive
                    ? 'shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-neutral-300 dark:hover:bg-white/5 dark:hover:text-white'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                    isActive ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-neutral-400'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative min-w-[240px]">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by battery ID, truck or keyword…"
            className="w-full rounded-2xl border border-slate-200/80 bg-white py-2 pl-9 pr-4 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 dark:border-white/10 dark:bg-surface-900 dark:text-white"
          />
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="absolute left-3 top-2.5 h-4 w-4 text-slate-400">
            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
          </svg>
        </div>
      </div>

      {/* ── Notification Feed Content ─────────────────────────────── */}
      {loading && notifications.length === 0 ? (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-emerald-500 border-t-transparent" />
          <p className="text-xs font-medium text-slate-500 dark:text-neutral-400">Loading battery notifications…</p>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50/50 p-6 text-center dark:border-red-900/40 dark:bg-red-950/20">
          <p className="text-xs font-semibold text-red-600 dark:text-red-400">{error}</p>
          <button
            type="button"
            onClick={fetchNotifications}
            className="mt-3 rounded-xl bg-red-600 px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-red-500"
          >
            Retry
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex min-h-[35vh] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center dark:border-white/10 dark:bg-surface-900">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-white/5">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="h-6 w-6 text-slate-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
            </svg>
          </div>
          <p className="mt-3 text-sm font-bold text-slate-800 dark:text-white">No notifications found</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
            {search ? 'No notifications match your search query.' : 'New batch alerts will appear here as your batteries are delivered, serviced, and returned.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const isIntake = item.type === 'intake';
            const isRepair = item.type === 'repair';
            const isReturn = item.type === 'return';
            const isInvoice = item.type === 'invoice';
            const codes = item.battery_codes || [];
            const count = item.battery_count || codes.length || 1;
            const isBatch = count > 1;

            return (
              <div
                key={item.id}
                onClick={() => {
                  if (isBatch) {
                    setSelectedBatch(item);
                  }
                }}
                style={{
                  borderColor: `${accent}40`,
                  boxShadow: `0 4px 18px -2px ${accent}25, 0 2px 6px -2px ${accent}15`,
                }}
                className={`group relative flex flex-col gap-2.5 rounded-xl border bg-white p-3.5 transition-all hover:scale-[1.003] dark:bg-surface-900 ${
                  isBatch ? 'cursor-pointer' : ''
                }`}
              >
                {/* ── Card Header: Icon, Title & Status Badges ────────────── */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-2 dark:border-white/5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-bold shadow-2xs ${
                        isIntake
                          ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                          : isRepair
                            ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400'
                            : isReturn
                              ? 'bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400'
                              : 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400'
                      }`}
                    >
                      {isIntake && (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                          <path d="M3.375 3C2.339 3 1.5 3.84 1.5 4.875v.75c0 1.036.84 1.875 1.875 1.875h17.25c1.035 0 1.875-.84 1.875-1.875v-.75C22.5 3.839 21.66 3 20.625 3H3.375Z" />
                          <path fillRule="evenodd" d="m3.087 9 .54 9.176A3 3 0 0 0 6.62 21h10.757a3 3 0 0 0 2.995-2.824L20.913 9H3.087Zm6.163 3.75A.75.75 0 0 1 10 12h4a.75.75 0 0 1 0 1.5h-4a.75.75 0 0 1-.75-.75Z" clipRule="evenodd" />
                        </svg>
                      )}
                      {isRepair && (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                          <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm-2.625 6c-.54 0-.828.419-.936.634a1.96 1.96 0 0 0-.189.866c0 .298.059.605.189.866.108.215.395.634.936.634.54 0 .828-.419.936-.634.13-.26.189-.568.189-.866 0-.298-.059-.605-.189-.866-.108-.215-.395-.634-.936-.634Zm4.314.634c.108-.215.395-.634.936-.634.54 0 .828.419.936.634.13.26.189.568.189.866 0 .298-.059.605-.189.866-.108.215-.395.634-.936.634-.54 0-.828-.419-.936-.634a1.96 1.96 0 0 1-.189-.866c0-.298.059-.605.189-.866Zm-4.34 7.964a.75.75 0 0 1-1.061-1.06 4.5 4.5 0 0 1 6.364 0 .75.75 0 0 1-1.06 1.06 3 3 0 0 0-4.243 0Z" clipRule="evenodd" />
                        </svg>
                      )}
                      {isReturn && (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                          <path d="M3.375 4.5C2.339 4.5 1.5 5.34 1.5 6.375V13.5h12V6.375c0-1.036-.84-1.875-1.875-1.875h-8.25ZM13.5 15h-12v2.625c0 1.035.84 1.875 1.875 1.875h.375a3 3 0 1 1 6 0h3a.75.75 0 0 0 .75-.75V15Z" />
                          <path d="M8.25 19.5a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0ZM15.75 6.75a.75.75 0 0 0-.75.75v11.25c0 .087.015.17.042.248a3 3 0 0 1 5.958.464c.853-.175 1.522-.935 1.464-1.883a18.659 18.659 0 0 0-3.732-10.104 1.837 1.837 0 0 0-1.47-.725H15.75Z" />
                          <path d="M19.5 19.5a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0Z" />
                        </svg>
                      )}
                      {isInvoice && (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                          <path d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0 0 16.5 9h-1.875a1.875 1.875 0 0 1-1.875-1.875V5.25A3.75 3.75 0 0 0 9 1.5H5.625Z" />
                          <path d="M12.971 1.816A5.23 5.23 0 0 1 16.5 5.25v1.875c0 .207.168.375.375.375H18.75a5.23 5.23 0 0 1 3.434 3.529.75.75 0 0 0 .566.246h.75a.75.75 0 0 0 0-1.5h-.75a.75.75 0 0 0-.277.053A3.75 3.75 0 0 0 18.75 7.5h-1.875A1.875 1.875 0 0 1 15 5.625V3.75a3.75 3.75 0 0 0-2.3-3.473.75.75 0 0 0-.246.566v.75a.75.75 0 0 0 1.5 0v-.75a.75.75 0 0 0-.053-.277Z" />
                        </svg>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-xs font-bold text-slate-900 dark:text-white">
                        {item.title?.replace(/\s*\(\d+\s*Batteries\)/gi, '')}
                      </h3>
                      <p className="truncate text-[11px] text-slate-500 dark:text-neutral-400">
                        {item.message}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 self-start sm:self-center shrink-0">
                    {isInvoice && (
                      <span className="rounded-lg border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300">
                        Official PDF Bill
                      </span>
                    )}
                    {count > 0 && !isInvoice && (
                      <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/50 dark:text-emerald-300">
                        {count} {count === 1 ? 'Battery' : 'Batteries'}
                      </span>
                    )}
                  </div>
                </div>

                {/* ── Card Body: Structured 4-Column Metadata Matrix ─────── */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {/* 1. Truck */}
                  <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-1.5 dark:border-white/5 dark:bg-surface-800/60">
                    <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-400">
                      Truck
                    </span>
                    <p className="font-mono text-xs font-bold text-slate-900 dark:text-white truncate">
                      {item.truck_number || '—'}
                    </p>
                  </div>

                  {/* 2. Driver */}
                  <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-1.5 dark:border-white/5 dark:bg-surface-800/60">
                    <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-400">
                      Driver
                    </span>
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {item.driver_name || '—'}
                    </p>
                  </div>

                  {/* 3. Packed Time */}
                  <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-1.5 dark:border-white/5 dark:bg-surface-800/60">
                    <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-400">
                      Packed Time
                    </span>
                    <p className="text-[11px] font-semibold text-slate-800 dark:text-neutral-200 truncate">
                      {item.packed_at ? formatTimestamp(item.packed_at) : '—'}
                    </p>
                  </div>

                  {/* 4. Received at Workshop */}
                  <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-1.5 dark:border-white/5 dark:bg-surface-800/60">
                    <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-400">
                      Received Shop
                    </span>
                    <div className="truncate">
                      {item.received_shop_at ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                          <span>✓</span>
                          <span>{formatTimestamp(item.received_shop_at)}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                          <span>Pending Arrival</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── Card Footer: Logged Time ─────────────── */}
                <div className="flex items-center justify-between pt-0.5 text-[10px] text-slate-400 dark:text-neutral-500">
                  <div className="flex items-center gap-2">
                    <span>Logged: {formatTimestamp(item.timestamp)}</span>
                    <span>•</span>
                    <span>{timeAgo(item.timestamp)}</span>
                  </div>
                  {isInvoice && (
                    <Link
                      to="/my/invoices"
                      onClick={(e) => e.stopPropagation()}
                      className="font-bold text-red-600 hover:underline dark:text-red-400"
                    >
                      Open PDF Bill →
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
